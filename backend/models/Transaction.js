const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['income', 'expense'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  category: {
    type: String,
    required: true,
    validate: {
      validator: function(value) {
        const validCategories = this.constructor.getCategoriesByType(this.type);
        return validCategories.includes(value);
      },
      message: 'Invalid category for transaction type'
    }
  },
  date: {
    type: Date,
    default: Date.now
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'credit-card', 'debit-card', 'bank-transfer', 'digital-wallet', 'check', 'other'],
    default: 'cash'
  },
  location: {
    type: String,
    trim: true,
    maxlength: 100
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  }
}, {
  timestamps: true
});

// CORRECTED: Static method to get categories by type
transactionSchema.statics.getCategoriesByType = function(type) {
  const categories = {
    income: [
      'salary', 'freelance', 'business', 'investment', 'rental', 'gift', 'others'
    ],
    expense: [
      'food-dining', 'transportation', 'shopping', 'entertainment', 'bills-utilities',
      'healthcare', 'education', 'travel', 'groceries', 'gas', 'others'
    ]
  };
  
  return categories[type] || [];
};

// Index for better query performance
transactionSchema.index({ user: 1, date: -1 });
transactionSchema.index({ user: 1, type: 1 });
transactionSchema.index({ user: 1, category: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);

