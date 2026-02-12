const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');
const { authenticateToken, JWT_SECRET } = require('./authMiddleware');

const app = express();
const PORT = 3000;
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

// Auth Routes
app.post('/api/auth/register', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const hashedPassword = bcrypt.hashSync(password, 8);

    db.run(`INSERT INTO users (email, password) VALUES (?, ?)`, [email, hashedPassword], function (err) {
        if (err) {
            if (err.message.includes("UNIQUE constraint failed")) {
                return res.status(409).json({ error: "User already exists" });
            }
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: this.lastID, email });
    });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: "User not found" });

        const passwordIsValid = bcrypt.compareSync(password, user.password);
        if (!passwordIsValid) return res.status(401).json({ auth: false, token: null });

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: 86400 });
        res.status(200).json({ auth: true, token });
    });
});

// Unit Routes
app.get('/api/units', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM units WHERE user_id = ? ORDER BY created_at DESC`, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/units', authenticateToken, upload.single('file'), (req, res) => {
    const { name } = req.body;
    const filePath = req.file.path;

    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const fileContent = fs.readFileSync(filePath, 'utf8');

    // Attempt parse CSV
    const parsed = Papa.parse(fileContent, { header: false, skipEmptyLines: true });

    if (parsed.data.length === 0) return res.status(400).json({ error: "Empty or invalid file" });

    db.serialize(() => {
        db.run(`INSERT INTO units (user_id, name) VALUES (?, ?)`, [req.user.id, name || req.file.originalname], function (err) {
            if (err) return res.status(500).json({ error: "Failed to create unit" });

            const unitId = this.lastID;
            const stmt = db.prepare(`INSERT INTO words (unit_id, en, ru) VALUES (?, ?, ?)`);

            parsed.data.forEach(row => {
                if (row.length >= 2) {
                    let en = row[0].trim();
                    let ru = row[1].trim();
                    if (en.length > 0) {
                        en = en.charAt(0).toUpperCase() + en.slice(1);
                    }
                    if (ru.length > 0) {
                        ru = ru.charAt(0).toUpperCase() + ru.slice(1);
                    }
                    stmt.run(unitId, en, ru);
                }
            });
            stmt.finalize();

            // Clean up upload
            fs.unlinkSync(filePath);

            res.status(201).json({ id: unitId, name: name || req.file.originalname });
        });
    });
});

app.delete('/api/units/:id', authenticateToken, (req, res) => {
    const unitId = req.params.id;
    // Verify ownership
    db.get(`SELECT * FROM units WHERE id = ? AND user_id = ?`, [unitId, req.user.id], (err, unit) => {
        if (err || !unit) return res.status(404).json({ error: "Unit not found" });

        db.serialize(() => {
            db.run(`DELETE FROM words WHERE unit_id = ?`, [unitId]);
            db.run(`DELETE FROM units WHERE id = ?`, [unitId], (err) => {
                if (err) return res.status(500).json({ error: "Failed to delete unit" });
                res.json({ success: true });
            });
        });
    });
});

app.get('/api/words', authenticateToken, (req, res) => {
    const unitIds = req.query.units; // Expecting "1,2,3"
    if (!unitIds) return res.status(400).json({ error: "No units specified" });

    // Validate IDs are numbers
    const ids = unitIds.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));

    if (ids.length === 0) return res.json({ words: [] });

    const placeholders = ids.map(() => '?').join(',');
    const sql = `
        SELECT w.* 
        FROM words w
        JOIN units u ON w.unit_id = u.id
        WHERE w.unit_id IN (${placeholders}) AND u.user_id = ?
    `;

    db.all(sql, [...ids, req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ words: rows });
    });
});

app.get('/api/units/:id', authenticateToken, (req, res) => {
    const unitId = req.params.id;
    // Verify ownership
    db.get(`SELECT * FROM units WHERE id = ? AND user_id = ?`, [unitId, req.user.id], (err, unit) => {
        if (err || !unit) return res.status(404).json({ error: "Unit not found" });

        db.all(`SELECT * FROM words WHERE unit_id = ?`, [unitId], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ unit, words: rows });
        });
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
