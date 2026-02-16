const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'vocab.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initDb();
    }
});

function initDb() {
    db.serialize(() => {
        // Users Table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )`);

        // Units Table
        db.run(`CREATE TABLE IF NOT EXISTS units (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            language TEXT DEFAULT 'English',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`, (err) => {
            if (!err) {
                // Check if language column exists (for existing tables)
                db.run(`ALTER TABLE units ADD COLUMN language TEXT DEFAULT 'English'`, (alterErr) => {
                    if (alterErr && !alterErr.message.includes("duplicate column name")) {
                        console.error("Error migrating units table:", alterErr.message);
                    }
                });
            }
        });

        // Words Table
        db.run(`CREATE TABLE IF NOT EXISTS words (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            unit_id INTEGER NOT NULL,
            en TEXT NOT NULL,
            ru TEXT NOT NULL,
            FOREIGN KEY (unit_id) REFERENCES units(id)
        )`);

        // Sessions Table
        db.run(`CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE NOT NULL,
            unit_ids TEXT NOT NULL,
            queue TEXT NOT NULL,
            progress TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);
    });
}

module.exports = db;
