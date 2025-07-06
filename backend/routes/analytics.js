const express = require('express');
const { query, validationResult } = require('express-validator');
const Transaction = require('../models/Transaction');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// @desc    Get expenses by category
// @route   GET /api/analytics/expenses-by-category
// @access  Private
router.get('/expenses-by-category', [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date'),
  query('period')
    .optional()
    .isIn(['7d', '30d', '90d', '1y', 'all'])
    .withMessage('Period must be one of: 7d, 30d, 90d, 1y, all')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { startDate, endDate, period } = req.query;

    // Build date filter
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    } else if (period && period !== 'all') {
      const now = new Date();
      const periodMap = {
        '7d': 7,
        '30d': 30,
        '90d': 90,
        '1y': 365
      };
      const daysBack = periodMap[period];
      const startPeriod = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));
      dateFilter = {
        date: { $gte: startPeriod }
      };
    }

    const pipeline = [
      {
        $match: {
          user: req.user._id,
          type: 'expense',
          ...dateFilter
        }
      },
      {
        $group: {
          _id: '$category',
          totalAmount: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
          averageAmount: { $avg: '$amount' }
        }
      },
      {
        $sort: { totalAmount: -1 }
      },
      {
        $project: {
          category: '$_id',
          totalAmount: { $round: ['$totalAmount', 2] },
          transactionCount: 1,
          averageAmount: { $round: ['$averageAmount', 2] },
          _id: 0
        }
      }
    ];

    const expensesByCategory = await Transaction.aggregate(pipeline);

    // Calculate total for percentage calculation
    const totalExpenses = expensesByCategory.reduce((sum, item) => sum + item.totalAmount, 0);

    // Add percentage to each category
    const dataWithPercentage = expensesByCategory.map(item => ({
      ...item,
      percentage: totalExpenses > 0 ? Math.round((item.totalAmount / totalExpenses) * 100 * 100) / 100 : 0
    }));

    res.status(200).json({
      success: true,
      data: dataWithPercentage,
      summary: {
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        categoryCount: expensesByCategory.length,
        period: period || 'custom'
      }
    });
  } catch (error) {
    console.error('Get expenses by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching expenses by category'
    });
  }
});

// @desc    Get income by category
// @route   GET /api/analytics/income-by-category
// @access  Private
router.get('/income-by-category', [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date'),
  query('period')
    .optional()
    .isIn(['7d', '30d', '90d', '1y', 'all'])
    .withMessage('Period must be one of: 7d, 30d, 90d, 1y, all')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { startDate, endDate, period } = req.query;

    // Build date filter
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    } else if (period && period !== 'all') {
      const now = new Date();
      const periodMap = {
        '7d': 7,
        '30d': 30,
        '90d': 90,
        '1y': 365
      };
      const daysBack = periodMap[period];
      const startPeriod = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));
      dateFilter = {
        date: { $gte: startPeriod }
      };
    }

    const pipeline = [
      {
        $match: {
          user: req.user._id,
          type: 'income',
          ...dateFilter
        }
      },
      {
        $group: {
          _id: '$category',
          totalAmount: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
          averageAmount: { $avg: '$amount' }
        }
      },
      {
        $sort: { totalAmount: -1 }
      },
      {
        $project: {
          category: '$_id',
          totalAmount: { $round: ['$totalAmount', 2] },
          transactionCount: 1,
          averageAmount: { $round: ['$averageAmount', 2] },
          _id: 0
        }
      }
    ];

    const incomeByCategory = await Transaction.aggregate(pipeline);

    // Calculate total for percentage calculation
    const totalIncome = incomeByCategory.reduce((sum, item) => sum + item.totalAmount, 0);

    // Add percentage to each category
    const dataWithPercentage = incomeByCategory.map(item => ({
      ...item,
      percentage: totalIncome > 0 ? Math.round((item.totalAmount / totalIncome) * 100 * 100) / 100 : 0
    }));

    res.status(200).json({
      success: true,
      data: dataWithPercentage,
      summary: {
        totalIncome: Math.round(totalIncome * 100) / 100,
        categoryCount: incomeByCategory.length,
        period: period || 'custom'
      }
    });
  } catch (error) {
    console.error('Get income by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching income by category'
    });
  }
});

// @desc    Get transactions by date (daily, weekly, monthly)
// @route   GET /api/analytics/transactions-by-date
// @access  Private
router.get('/transactions-by-date', [
  query('groupBy')
    .optional()
    .isIn(['day', 'week', 'month'])
    .withMessage('GroupBy must be one of: day, week, month'),
  query('type')
    .optional()
    .isIn(['income', 'expense', 'both'])
    .withMessage('Type must be one of: income, expense, both'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date'),
  query('period')
    .optional()
    .isIn(['7d', '30d', '90d', '1y'])
    .withMessage('Period must be one of: 7d, 30d, 90d, 1y')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { groupBy = 'day', type = 'both', startDate, endDate, period = '30d' } = req.query;

    // Build date filter
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    } else {
      const now = new Date();
      const periodMap = {
        '7d': 7,
        '30d': 30,
        '90d': 90,
        '1y': 365
      };
      const daysBack = periodMap[period];
      const startPeriod = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));
      dateFilter = {
        date: { $gte: startPeriod }
      };
    }

    // Build type filter
    let typeFilter = {};
    if (type !== 'both') {
      typeFilter = { type };
    }

    // Build grouping based on groupBy parameter
    let grouping = {};
    let sortField = {};
    
    switch (groupBy) {
      case 'day':
        grouping = {
          year: { $year: '$date' },
          month: { $month: '$date' },
          day: { $dayOfMonth: '$date' }
        };
        sortField = { '_id.year': 1, '_id.month': 1, '_id.day': 1 };
        break;
      case 'week':
        grouping = {
          year: { $year: '$date' },
          week: { $week: '$date' }
        };
        sortField = { '_id.year': 1, '_id.week': 1 };
        break;
      case 'month':
        grouping = {
          year: { $year: '$date' },
          month: { $month: '$date' }
        };
        sortField = { '_id.year': 1, '_id.month': 1 };
        break;
    }

    const pipeline = [
      {
        $match: {
          user: req.user._id,
          ...dateFilter,
          ...typeFilter
        }
      },
      {
        $group: {
          _id: {
            ...grouping,
            ...(type === 'both' ? { type: '$type' } : {})
          },
          totalAmount: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
          averageAmount: { $avg: '$amount' }
        }
      },
      {
        $sort: {
          ...sortField,
          ...(type === 'both' ? { '_id.type': 1 } : {})
        }
      },
      {
        $project: {
          date: '$_id',
          totalAmount: { $round: ['$totalAmount', 2] },
          transactionCount: 1,
          averageAmount: { $round: ['$averageAmount', 2] },
          _id: 0
        }
      }
    ];

    const transactionsByDate = await Transaction.aggregate(pipeline);

    // Format the response data
    const formattedData = transactionsByDate.map(item => {
      let dateString = '';
      
      switch (groupBy) {
        case 'day':
          dateString = `${item.date.year}-${String(item.date.month).padStart(2, '0')}-${String(item.date.day).padStart(2, '0')}`;
          break;
        case 'week':
          dateString = `${item.date.year}-W${String(item.date.week).padStart(2, '0')}`;
          break;
        case 'month':
          dateString = `${item.date.year}-${String(item.date.month).padStart(2, '0')}`;
          break;
      }

      return {
        date: dateString,
        ...(type === 'both' ? { type: item.date.type } : {}),
        totalAmount: item.totalAmount,
        transactionCount: item.transactionCount,
        averageAmount: item.averageAmount
      };
    });

    res.status(200).json({
      success: true,
      data: formattedData,
      summary: {
        groupBy,
        type,
        period: period || 'custom',
        totalRecords: formattedData.length
      }
    });
  } catch (error) {
    console.error('Get transactions by date error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching transactions by date'
    });
  }
});

// @desc    Get financial summary
// @route   GET /api/analytics/summary
// @access  Private
router.get('/summary', [
  query('period')
    .optional()
    .isIn(['7d', '30d', '90d', '1y', 'all'])
    .withMessage('Period must be one of: 7d, 30d, 90d, 1y, all')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { period = '30d' } = req.query;

    // Build date filter
    let dateFilter = {};
    if (period !== 'all') {
      const now = new Date();
      const periodMap = {
        '7d': 7,
        '30d': 30,
        '90d': 90,
        '1y': 365
      };
      const daysBack = periodMap[period];
      const startPeriod = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));
      dateFilter = {
        date: { $gte: startPeriod }
      };
    }

    const pipeline = [
      {
        $match: {
          user: req.user._id,
          ...dateFilter
        }
      },
      {
        $group: {
          _id: '$type',
          totalAmount: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
          averageAmount: { $avg: '$amount' },
          maxAmount: { $max: '$amount' },
          minAmount: { $min: '$amount' }
        }
      }
    ];

    const summary = await Transaction.aggregate(pipeline);

    const result = {
      totalIncome: 0,
      totalExpenses: 0,
      netAmount: 0,
      incomeCount: 0,
      expenseCount: 0,
      averageIncome: 0,
      averageExpense: 0,
      maxIncome: 0,
      maxExpense: 0,
      minIncome: 0,
      minExpense: 0
    };

    summary.forEach(item => {
      if (item._id === 'income') {
        result.totalIncome = Math.round(item.totalAmount * 100) / 100;
        result.incomeCount = item.transactionCount;
        result.averageIncome = Math.round(item.averageAmount * 100) / 100;
        result.maxIncome = Math.round(item.maxAmount * 100) / 100;
        result.minIncome = Math.round(item.minAmount * 100) / 100;
      } else {
        result.totalExpenses = Math.round(item.totalAmount * 100) / 100;
        result.expenseCount = item.transactionCount;
        result.averageExpense = Math.round(item.averageAmount * 100) / 100;
        result.maxExpense = Math.round(item.maxAmount * 100) / 100;
        result.minExpense = Math.round(item.minAmount * 100) / 100;
      }
    });

    result.netAmount = Math.round((result.totalIncome - result.totalExpenses) * 100) / 100;
    result.totalTransactions = result.incomeCount + result.expenseCount;

    // Get top categories
    const topExpenseCategories = await Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
          type: 'expense',
          ...dateFilter
        }
      },
      {
        $group: {
          _id: '$category',
          totalAmount: { $sum: '$amount' }
        }
      },
      {
        $sort: { totalAmount: -1 }
      },
      {
        $limit: 5
      },
      {
        $project: {
          category: '$_id',
          totalAmount: { $round: ['$totalAmount', 2] },
          _id: 0
        }
      }
    ]);

    const topIncomeCategories = await Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
          type: 'income',
          ...dateFilter
        }
      },
      {
        $group: {
          _id: '$category',
          totalAmount: { $sum: '$amount' }
        }
      },
      {
        $sort: { totalAmount: -1 }
      },
      {
        $limit: 5
      },
      {
        $project: {
          category: '$_id',
          totalAmount: { $round: ['$totalAmount', 2] },
          _id: 0
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        ...result,
        topExpenseCategories,
        topIncomeCategories,
        period
      }
    });
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching summary'
    });
  }
});

module.exports = router;

