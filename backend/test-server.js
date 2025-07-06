const express = require('express');
const app = express();

app.use(express.json());

app.get('/api/test', (req, res) => {
  res.json({ message: 'Simple test server works!' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Simple server is running' });
});

const PORT = 5001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Simple test server running on port ${PORT}`);
});

