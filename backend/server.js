const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected successfully'))
.catch((err) => console.error('MongoDB connection error:', err));

// Test route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Personal Finance API is running',
    timestamp: new Date().toISOString()
  });
});

// Add routes one by one
try {
  app.use('/api/auth', require('./routes/auth'));
  console.log('Auth routes loaded');
} catch (error) {
  console.error('Error loading auth routes:', error.message);
}

try {
  const transactionsRoutes = require('./routes/transactions');
  app.use('/api/transactions', transactionsRoutes);
  console.log('Transactions routes loaded successfully');
} catch (error) {
  console.error('Error loading transactions routes:', error);
}

try {
  app.use('/api/analytics', require('./routes/analytics'));
  console.log('Analytics routes loaded');
} catch (error) {
  console.error('Error loading analytics routes:', error.message);
}

try {
  app.use('/api/receipts', require('./routes/receipts'));
  console.log('Receipts routes loaded');
} catch (error) {
  console.error('Error loading receipts routes:', error.message);
}

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Test server running on port ${PORT}`);
});

