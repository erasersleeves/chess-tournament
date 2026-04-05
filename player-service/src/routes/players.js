const express = require('express');
const router = express.Router();

const players = []; // in-memory store
let nextId = 1;

// GET /players — liste tous les joueurs
router.get('/', (req, res) => res.json(players));

// GET /players/:id
router.get('/:id', (req, res) => {
  const player = players.find(p => p.id === parseInt(req.params.id));
  if (!player) return res.status(404).json({ error: 'Player not found' });
  res.json(player);
});

// POST /players — créer un joueur
router.post('/', (req, res) => {
  const { username, elo = 1200 } = req.body;
  if (!username) return res.status(400).json({ error: 'username is required' });
  const player = { id: nextId++, username, elo, createdAt: new Date() };
  players.push(player);
  res.status(201).json(player);
});

// PUT /players/:id — mettre à jour le ELO
router.put('/:id', (req, res) => {
  const player = players.find(p => p.id === parseInt(req.params.id));
  if (!player) return res.status(404).json({ error: 'Player not found' });
  if (req.body.elo !== undefined) player.elo = req.body.elo;
  if (req.body.username) player.username = req.body.username;
  res.json(player);
});

// DELETE /players/:id
router.delete('/:id', (req, res) => {
  const idx = players.findIndex(p => p.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Player not found' });
  players.splice(idx, 1);
  res.status(204).send();
});

module.exports = router;