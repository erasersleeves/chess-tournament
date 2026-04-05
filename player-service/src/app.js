const express = require('express');
const playersRouter = require('./routes/players');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'UP' }));
app.use('/api/players', playersRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Player service running on port ${PORT}`));