const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');
const router = express.Router();

const PLAYER_SERVICE_URL = process.env.PLAYER_SERVICE_URL || 'http://player-service/api/players';

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  user: process.env.DB_USER || 'chess',
  password: process.env.DB_PASSWORD || 'chess1234',
  database: process.env.DB_NAME || 'chessdb',
  port: 5432,
});

pool.query(`
  CREATE TABLE IF NOT EXISTS matches (
    id SERIAL PRIMARY KEY,
    player1_id INTEGER NOT NULL,
    player2_id INTEGER NOT NULL,
    player1_username VARCHAR(100),
    player2_username VARCHAR(100),
    player1_elo_before INTEGER,
    player2_elo_before INTEGER,
    player1_elo_after INTEGER,
    player2_elo_after INTEGER,
    status VARCHAR(20) DEFAULT 'pending',
    winner_id INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
  )
`).catch(console.error);

router.get('/', async (req, res) => {
  const result = await pool.query('SELECT * FROM matches ORDER BY created_at DESC');
  res.json(result.rows);
});

router.get('/:id', async (req, res) => {
  const result = await pool.query('SELECT * FROM matches WHERE id=$1', [req.params.id]);
  if (!result.rows.length) return res.status(404).json({ error: 'Match not found' });
  res.json(result.rows[0]);
});

router.post('/', async (req, res) => {
  const { player1Id, player2Id } = req.body;
  if (!player1Id || !player2Id)
    return res.status(400).json({ error: 'player1Id and player2Id are required' });

  try {
    const [p1res, p2res] = await Promise.all([
      axios.get(`${PLAYER_SERVICE_URL}/${player1Id}`),
      axios.get(`${PLAYER_SERVICE_URL}/${player2Id}`)
    ]);
    const p1 = p1res.data;
    const p2 = p2res.data;

    const result = await pool.query(
      `INSERT INTO matches
        (player1_id, player2_id, player1_username, player2_username, player1_elo_before, player2_elo_before, status)
       VALUES ($1,$2,$3,$4,$5,$6,'pending') RETURNING *`,
      [p1.id, p2.id, p1.username, p2.username, p1.elo, p2.elo]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.response?.status === 404)
      return res.status(404).json({ error: 'One or both players not found' });
    res.status(500).json({ error: 'Could not reach player-service', detail: err.message });
  }
});

router.put('/:id/result', async (req, res) => {
  const matchRes = await pool.query('SELECT * FROM matches WHERE id=$1', [req.params.id]);
  if (!matchRes.rows.length) return res.status(404).json({ error: 'Match not found' });
  const match = matchRes.rows[0];
  if (match.status === 'finished')
    return res.status(400).json({ error: 'Match already finished' });

  const { winnerId } = req.body;
  if (!winnerId) return res.status(400).json({ error: 'winnerId is required' });

  const K = 32;
  const elo1 = match.player1_elo_before;
  const elo2 = match.player2_elo_before;
  const expected1 = 1 / (1 + Math.pow(10, (elo2 - elo1) / 400));
  const score1 = parseInt(winnerId) === match.player1_id ? 1 : 0;
  const newElo1 = Math.round(elo1 + K * (score1 - expected1));
  const newElo2 = Math.round(elo2 + K * ((1 - score1) - (1 - expected1)));

  try {
    await Promise.all([
      axios.put(`${PLAYER_SERVICE_URL}/${match.player1_id}`, { elo: newElo1 }),
      axios.put(`${PLAYER_SERVICE_URL}/${match.player2_id}`, { elo: newElo2 })
    ]);

    const updated = await pool.query(
      `UPDATE matches SET
        status='finished', winner_id=$1,
        player1_elo_after=$2, player2_elo_after=$3
       WHERE id=$4 RETURNING *`,
      [winnerId, newElo1, newElo2, match.id]
    );
    res.json(updated.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Could not update ELO', detail: err.message });
  }
});

module.exports = router;