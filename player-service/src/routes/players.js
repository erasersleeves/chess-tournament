const express = require('express');
const { Pool } = require('pg');
const router = express.Router();

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  user: process.env.DB_USER || 'chess',
  password: process.env.DB_PASSWORD || 'chess1234',
  database: process.env.DB_NAME || 'chessdb',
  port: 5432,
});

// Créer la table au démarrage
pool.query(`
  CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    elo INTEGER DEFAULT 1200,
    created_at TIMESTAMP DEFAULT NOW()
  )
`).catch(console.error);

router.get('/', async (req, res) => {
  const result = await pool.query('SELECT * FROM players ORDER BY elo DESC');
  res.json(result.rows);
});

router.get('/:id', async (req, res) => {
  const result = await pool.query('SELECT * FROM players WHERE id=$1', [req.params.id]);
  if (!result.rows.length) return res.status(404).json({ error: 'Player not found' });
  res.json(result.rows[0]);
});

router.post('/', async (req, res) => {
  const { username, elo = 1200 } = req.body;
  if (!username) return res.status(400).json({ error: 'username is required' });
  try {
    const result = await pool.query(
      'INSERT INTO players (username, elo) VALUES ($1, $2) RETURNING *',
      [username, elo]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username already exists' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { elo, username } = req.body;
  const result = await pool.query(
    'UPDATE players SET elo=COALESCE($1,elo), username=COALESCE($2,username) WHERE id=$3 RETURNING *',
    [elo, username, req.params.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Player not found' });
  res.json(result.rows[0]);
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM players WHERE id=$1', [req.params.id]);
  res.status(204).send();
});

module.exports = router;