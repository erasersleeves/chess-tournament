const express = require('express');
const matchesRouter = require('./routes/matches');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'UP' }));
app.use('/api/matches', matchesRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Match service running on port ${PORT}`));