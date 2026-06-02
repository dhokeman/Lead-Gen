const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'leadgen.db');
const db = new Database(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    base_prompt TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER,
    profile_url TEXT NOT NULL UNIQUE,
    name TEXT,
    headline TEXT,
    state TEXT DEFAULT 'Imported',
    ai_drafted_message TEXT,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
  );
`);

module.exports = db;
