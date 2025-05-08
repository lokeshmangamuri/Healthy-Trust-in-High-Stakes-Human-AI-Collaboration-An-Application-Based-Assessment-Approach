const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// Connect to SQLite database
const db = new sqlite3.Database('./diagnosis.db');

// Create the diagnoses table if it doesn't exist
db.run(`
  CREATE TABLE IF NOT EXISTS diagnoses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    studyId TEXT,
    questionIndex INTEGER,
    diagnosis TEXT,
    aiRecommendation TEXT,
    timestamp TEXT
  )
`);

// Route: Submit diagnosis data
app.post('/submit', (req, res) => {
  const { userId, studyId, responses } = req.body;

  const stmt = db.prepare(`
    INSERT INTO diagnoses (userId, studyId, questionIndex, diagnosis, aiRecommendation, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  responses.forEach((r, i) => {
    stmt.run(
      userId,
      studyId,
      i,
      r.answer,
      r.aiRecommendation || null,
      new Date().toISOString()
    );
  });

  stmt.finalize();
  res.json({ success: true });
});

// Route: Get all diagnosis results
app.get('/results', (req, res) => {
  db.all('SELECT * FROM diagnoses ORDER BY userId, questionIndex', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Route: Filter by userId or studyId
app.get('/filter', (req, res) => {
  const { userId, studyId } = req.query;
  let query = 'SELECT * FROM diagnoses WHERE 1=1';
  const params = [];

  if (userId) {
    query += ' AND userId = ?';
    params.push(userId);
  }

  if (studyId) {
    query += ' AND studyId = ?';
    params.push(studyId);
  }

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Route: Export data to CSV
app.get('/export', (req, res) => {
  const filePath = path.join(__dirname, 'diagnosis_export.csv');
  const header = 'userId,studyId,questionIndex,diagnosis,aiRecommendation,timestamp\n';

  db.all('SELECT * FROM diagnoses ORDER BY userId, questionIndex', (err, rows) => {
    if (err) return res.status(500).send('Error generating export.');

    const csv = rows.map(row =>
      `${row.userId},${row.studyId},${row.questionIndex},"${row.diagnosis}","${row.aiRecommendation}",${row.timestamp}`
    ).join('\n');

    fs.writeFileSync(filePath, header + csv);
    res.download(filePath);
  });
});

// Route: Clear all data (use with caution!)
app.delete('/clear', (req, res) => {
  db.run('DELETE FROM diagnoses', (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'All data cleared ✅' });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
