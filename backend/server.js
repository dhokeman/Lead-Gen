const express = require('express');
const cors = require('cors');
const db = require('./db');
const workflowManager = require('./workflowManager');

const app = express();
app.use(cors());
app.use(express.json());

// Get all campaigns
app.get('/api/campaigns', (req, res) => {
  const campaigns = db.prepare('SELECT * FROM campaigns').all();
  res.json(campaigns);
});

// Create campaign
app.post('/api/campaigns', (req, res) => {
  const { name, base_prompt } = req.body;
  const insert = db.prepare('INSERT INTO campaigns (name, base_prompt) VALUES (?, ?)');
  const result = insert.run(name, base_prompt);
  res.json({ id: result.lastInsertRowid });
});

// Import Contacts
app.post('/api/contacts/import', (req, res) => {
  const { campaign_id, profile_urls } = req.body;
  
  const insert = db.prepare('INSERT OR IGNORE INTO contacts (campaign_id, profile_url) VALUES (?, ?)');
  
  const insertMany = db.transaction((urls) => {
    for (const url of urls) insert.run(campaign_id, url);
  });
  
  insertMany(profile_urls);
  res.json({ success: true, message: `Imported ${profile_urls.length} contacts` });
});

// Get contacts for campaign
app.get('/api/contacts/:campaign_id', (req, res) => {
  const { campaign_id } = req.params;
  const contacts = db.prepare('SELECT * FROM contacts WHERE campaign_id = ?').all(campaign_id);
  res.json(contacts);
});

// Start/Stop Engine
app.post('/api/engine/start', async (req, res) => {
  await workflowManager.start();
  res.json({ status: 'started' });
});

app.post('/api/engine/stop', async (req, res) => {
  await workflowManager.stop();
  res.json({ status: 'stopped' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
