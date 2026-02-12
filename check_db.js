const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.resolve(__dirname, 'vocab.db'), sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error(err.message);
        return;
    }
    console.log('Connected to database.');
});

db.serialize(() => {
    db.all("SELECT * FROM sessions", [], (err, rows) => {
        if (err) {
            throw err;
        }
        console.log("Sessions Count:", rows.length);
        rows.forEach((row) => {
            console.log(row);
        });
    });

    db.all("SELECT id, email FROM users", [], (err, rows) => {
        if (err) throw err;
        console.log("Users:", rows);
    });
});

db.close();
