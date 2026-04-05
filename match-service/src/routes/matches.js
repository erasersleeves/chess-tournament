const express = require('express');
const axios = require('axios');
const router = express.Router();

// URL du player-service dans le cluster Kubernetes
// Kubernetes expose le service via son nom : http://player-service/api/players
const PLAYER_SERVICE_URL = process.env.PLAYER_SERVICE_URL || 'http://player-service/api/players';

const matches = [];
let nextId = 1;

// GET /api/matches
router.get('/', (req, res) => res.json(matches));

// GET /api/matches/:id
router.get('/:id', (req, res) => {
  const match = matches.find(m => m.id === parseInt(req.params.id));
  if (!match) return res.status(404).json({ error: 'Match not found' });
  res.json(match);
});

// POST /api/matches — créer une partie entre deux joueurs
router.post('/', async (req, res) => {
  const { player1Id, player2Id } = req.body;
  if (!player1Id || !player2Id)
    return res.status(400).json({ error: 'player1Id and player2Id are required' });

  try {
    // Vérifier que les deux joueurs existent (appel inter-service)
    const [p1res, p2res] = await Promise.all([
      axios.get(`${PLAYER_SERVICE_URL}/${player1Id}`),
      axios.get(`${PLAYER_SERVICE_URL}/${player2Id}`)
    ]);

    const match = {
      id: nextId++,
      player1: p1res.data,
      player2: p2res.data,
      status: 'pending',   // pending | ongoing | finished
      winnerId: null,
      createdAt: new Date()
    };
    matches.push(match);
    res.status(201).json(match);
  } catch (err) {
    if (err.response?.status === 404)
      return res.status(404).json({ error: 'One or both players not found' });
    res.status(500).json({ error: 'Could not reach player-service', detail: err.message });
  }
});

// PUT /api/matches/:id/result — enregistrer le résultat et mettre à jour les ELO
router.put('/:id/result', async (req, res) => {
  const match = matches.find(m => m.id === parseInt(req.params.id));
  if (!match) return res.status(404).json({ error: 'Match not found' });
  if (match.status === 'finished')
    return res.status(400).json({ error: 'Match already finished' });

  const { winnerId } = req.body;
  if (!winnerId) return res.status(400).json({ error: 'winnerId is required' });

  // Calcul ELO simplifié (K=32)
  const K = 32;
  const p1 = match.player1;
  const p2 = match.player2;
  const expected1 = 1 / (1 + Math.pow(10, (p2.elo - p1.elo) / 400));
  const score1 = winnerId === p1.id ? 1 : 0;
  const newElo1 = Math.round(p1.elo + K * (score1 - expected1));
  const newElo2 = Math.round(p2.elo + K * ((1 - score1) - (1 - expected1)));

  try {
    // Mettre à jour les ELO dans le player-service
    await Promise.all([
      axios.put(`${PLAYER_SERVICE_URL}/${p1.id}`, { elo: newElo1 }),
      axios.put(`${PLAYER_SERVICE_URL}/${p2.id}`, { elo: newElo2 })
    ]);

    match.status = 'finished';
    match.winnerId = winnerId;
    match.player1.elo = newElo1;
    match.player2.elo = newElo2;

    res.json(match);
  } catch (err) {
    res.status(500).json({ error: 'Could not update player ELO', detail: err.message });
  }
});

module.exports = router;