const express = require('express');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const Tesseract = require('tesseract.js');
const pdfParse = require('pdf-parse');
const { body, validationResult } = require('express-validator');
const Transaction = require('../models/Transaction');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Cloudinary storage for images
const imageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'receipts',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff'],
    transformation: [
      { width: 1000, height: 1000, crop: 'limit' },
      { quality: 'auto' }
    ]
  }
});

// Configure Cloudinary storage for PDFs
const pdfStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'receipts/pdfs',
    allowed_formats: ['pdf'],
    resource_type: 'raw'
  }
});

// Multer configuration for images
const uploadImage = multer({
  storage: imageStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Multer configuration for PDFs
const uploadPDF = multer({
  storage: pdfStorage,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// Apply authentication to all routes
router.use(protect);

// Helper function to extract receipt data from text
const extractReceiptData = (text) => {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  const extractedData = {
    merchantName: '',
    merchantAddress: '',
    totalAmount: 0,
    taxAmount: 0,
    date: null,
    items: []
  };

  // Extract merchant name (usually first few lines)
  if (lines.length > 0) {
    extractedData.merchantName = lines[0];
  }

  // Extract total amount (look for patterns like "Total: $XX.XX", "TOTAL $XX.XX", etc.)
  const totalPatterns = [
    /total[:\s]*\$?(\d+\.?\d*)/i,
    /amount[:\s]*\$?(\d+\.?\d*)/i,
    /sum[:\s]*\$?(\d+\.?\d*)/i
  ];

  for (const line of lines) {
    for (const pattern of totalPatterns) {
      const match = line.match(pattern);
      if (match) {
        const amount = parseFloat(match[1]);
        if (amount > extractedData.totalAmount) {
          extractedData.totalAmount = amount;
        }
      }
    }
  }

  // Extract tax amount
  const taxPatterns = [
    /tax[:\s]*\$?(\d+\.?\d*)/i,
    /vat[:\s]*\$?(\d+\.?\d*)/i,
    /gst[:\s]*\$?(\d+\.?\d*)/i
  ];

  for (const line of lines) {
    for (const pattern of taxPatterns) {
      const match = line.match(pattern);
      if (match) {
        extractedData.taxAmount = parseFloat(match[1]);
        break;
      }
    }
  }

  // Extract date (look for date patterns)
  const datePatterns = [
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
    /(\d{2,4}[\/\-]\d{1,2}[\/\-]\d{1,2})/,
    /(\w{3,9}\s+\d{1,2},?\s+\d{2,4})/i
  ];

  for (const line of lines) {
    for (const pattern of datePatterns) {
      const match = line.match(pattern);
      if (match) {
        const dateStr = match[1];
        const parsedDate = new Date(dateStr);
        if (!isNaN(parsedDate.getTime())) {
          extractedData.date = parsedDate;
          break;
        }
      }
    }
    if (extractedData.date) break;
  }

  // Extract items (look for price patterns)
  const itemPattern = /(.+?)\s+\$?(\d+\.?\d*)/;
  for (const line of lines) {
    const match = line.match(itemPattern);
    if (match && !line.toLowerCase().includes('total') && !line.toLowerCase().includes('tax')) {
      const itemName = match[1].trim();
      const price = parseFloat(match[2]);
      if (itemName.length > 2 && price > 0) {
        extractedData.items.push({
          name: itemName,
          price: price,
          quantity: 1
        });
      }
    }
  }

  // If totalAmount is not detected or is 0, sum up the items
  if ((!extractedData.totalAmount || extractedData.totalAmount === 0) && extractedData.items.length > 0) {
    const sum = extractedData.items.reduce((acc, item) => acc + (item.price || 0), 0);
    if (sum > 0) extractedData.totalAmount = sum;
  }

  return extractedData;
};

// Helper function to suggest transaction category based on merchant name
const suggestCategory = (merchantName) => {
  const categoryKeywords = {
    'food': ['restaurant', 'cafe', 'pizza', 'burger', 'food', 'kitchen', 'diner', 'bistro'],
    'groceries': ['grocery', 'supermarket', 'market', 'walmart', 'target', 'costco', 'safeway'],
    'gas': ['gas', 'fuel', 'shell', 'exxon', 'bp', 'chevron', 'mobil'],
    'shopping': ['store', 'shop', 'mall', 'retail', 'amazon', 'ebay'],
    'healthcare': ['pharmacy', 'hospital', 'clinic', 'medical', 'doctor', 'cvs', 'walgreens'],
    'entertainment': ['cinema', 'movie', 'theater', 'netflix', 'spotify', 'game'],
    'transportation': ['uber', 'lyft', 'taxi', 'bus', 'train', 'metro', 'parking'],
    'utilities': ['electric', 'water', 'internet', 'phone', 'cable', 'utility']
  };

  const merchantLower = merchantName.toLowerCase();
  
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(keyword => merchantLower.includes(keyword))) {
      return category;
    }
  }
  
  return 'other-expense';
};

// @desc    Upload and process receipt image
// @route   POST /api/receipts/upload-image
// @access  Private
router.post('/upload-image', uploadImage.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file uploaded'
      });
    }

    // Process image with OCR
    const { data: { text } } = await Tesseract.recognize(req.file.path, 'eng', {
      logger: m => console.log(m)
    });

    // Extract receipt data
    const extractedData = extractReceiptData(text);
    
    // Suggest category based on merchant name
    const suggestedCategory = suggestCategory(extractedData.merchantName);

    // Prepare response
    const receiptData = {
      url: req.file.path,
      publicId: req.file.filename,
      extractedText: text,
      extractedData,
      suggestedTransaction: {
        type: 'expense',
        amount: extractedData.totalAmount,
        description: extractedData.merchantName || 'Receipt transaction',
        category: suggestedCategory,
        date: extractedData.date || new Date(),
        location: extractedData.merchantName,
        receipt: {
          url: req.file.path,
          publicId: req.file.filename,
          extractedData
        }
      }
    };

    res.status(200).json({
      success: true,
      message: 'Receipt processed successfully',
      data: receiptData
    });
  } catch (error) {
    console.error('Receipt processing error:', error);
    
    // If OCR fails, still return the uploaded image
    if (req.file) {
      res.status(200).json({
        success: true,
        message: 'Receipt uploaded but OCR processing failed',
        data: {
          url: req.file.path,
          publicId: req.file.filename,
          extractedText: '',
          extractedData: {},
          suggestedTransaction: {
            type: 'expense',
            amount: 0,
            description: 'Manual entry required',
            category: 'other-expense',
            date: new Date(),
            receipt: {
              url: req.file.path,
              publicId: req.file.filename,
              extractedData: {}
            }
          }
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Error processing receipt'
      });
    }
  }
});

// @desc    Upload and process PDF receipt
// @route   POST /api/receipts/upload-pdf
// @access  Private
router.post('/upload-pdf', uploadPDF.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No PDF file uploaded'
      });
    }

    // Download the PDF from Cloudinary to process it
    const response = await fetch(req.file.path);
    const buffer = await response.arrayBuffer();
    
    // Parse PDF
    const pdfData = await pdfParse(Buffer.from(buffer));
    const text = pdfData.text;

    // Check if it's a transaction history (tabular format) or a single receipt
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const isTransactionHistory = lines.some(line => 
      line.toLowerCase().includes('date') && 
      line.toLowerCase().includes('amount') &&
      (line.toLowerCase().includes('description') || line.toLowerCase().includes('transaction'))
    );

    if (isTransactionHistory) {
      // Process as transaction history
      const transactions = parseTransactionHistory(text);
      
      res.status(200).json({
        success: true,
        message: 'Transaction history processed successfully',
        data: {
          url: req.file.path,
          publicId: req.file.filename,
          type: 'transaction_history',
          extractedText: text,
          transactions: transactions
        }
      });
    } else {
      // Process as single receipt
      const extractedData = extractReceiptData(text);
      const suggestedCategory = suggestCategory(extractedData.merchantName);

      const receiptData = {
        url: req.file.path,
        publicId: req.file.filename,
        type: 'single_receipt',
        extractedText: text,
        extractedData,
        suggestedTransaction: {
          type: 'expense',
          amount: extractedData.totalAmount,
          description: extractedData.merchantName || 'PDF receipt transaction',
          category: suggestedCategory,
          date: extractedData.date || new Date(),
          location: extractedData.merchantName,
          receipt: {
            url: req.file.path,
            publicId: req.file.filename,
            extractedData
          }
        }
      };

      res.status(200).json({
        success: true,
        message: 'PDF receipt processed successfully',
        data: receiptData
      });
    }
  } catch (error) {
    console.error('PDF processing error:', error);
    
    // If processing fails, still return the uploaded PDF
    if (req.file) {
      res.status(200).json({
        success: true,
        message: 'PDF uploaded but processing failed',
        data: {
          url: req.file.path,
          publicId: req.file.filename,
          type: 'unknown',
          extractedText: '',
          extractedData: {},
          suggestedTransaction: {
            type: 'expense',
            amount: 0,
            description: 'Manual entry required',
            category: 'other-expense',
            date: new Date(),
            receipt: {
              url: req.file.path,
              publicId: req.file.filename,
              extractedData: {}
            }
          }
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Error processing PDF'
      });
    }
  }
});

// Helper function to parse transaction history from PDF text
const parseTransactionHistory = (text) => {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const transactions = [];
  
  // Look for patterns that indicate transaction rows
  const transactionPattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(.+?)\s+[\$\-]?(\d+\.?\d*)/;
  
  for (const line of lines) {
    const match = line.match(transactionPattern);
    if (match) {
      const dateStr = match[1];
      const description = match[2].trim();
      const amount = parseFloat(match[3]);
      
      const parsedDate = new Date(dateStr);
      if (!isNaN(parsedDate.getTime()) && amount > 0) {
        // Determine if it's income or expense based on description or amount sign
        const isIncome = description.toLowerCase().includes('deposit') || 
                        description.toLowerCase().includes('salary') ||
                        description.toLowerCase().includes('payment received') ||
                        line.includes('+');
        
        const suggestedCategory = isIncome ? 'other-income' : suggestCategory(description);
        
        transactions.push({
          type: isIncome ? 'income' : 'expense',
          amount: amount,
          description: description,
          category: suggestedCategory,
          date: parsedDate,
          paymentMethod: 'bank-transfer'
        });
      }
    }
  }
  
  return transactions;
};

// @desc    Create transaction from processed receipt
// @route   POST /api/receipts/create-transaction
// @access  Private
router.post('/create-transaction', async (req, res) => {
  try {
    const { amount, category, date, description, type } = req.body;

    if (!amount || !category || !date || !description || !type) {
      return res.status(400).json({ success: false, message: 'Validation failed: Missing required fields.' });
    }

    const transactionData = {
      ...req.body,
      user: req.user.id
    };

    const transaction = await Transaction.create(transactionData);

    return res.status(200).json({ success: true, transaction });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});


// @desc    Bulk create transactions from transaction history
// @route   POST /api/receipts/bulk-create-transactions
// @access  Private
router.post('/bulk-create-transactions', [
  body('transactions')
    .isArray({ min: 1 })
    .withMessage('Transactions must be a non-empty array'),
  body('transactions.*.type')
    .isIn(['income', 'expense'])
    .withMessage('Each transaction type must be either income or expense'),
  body('transactions.*.amount')
    .isFloat({ min: 0.01 })
    .withMessage('Each transaction amount must be greater than 0'),
  body('transactions.*.description')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Each transaction description must be between 1 and 200 characters'),
  body('transactions.*.category')
    .notEmpty()
    .withMessage('Each transaction must have a category')
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

    const { transactions } = req.body;
    
    // Add user ID to each transaction
    const transactionsWithUser = transactions.map(transaction => ({
      ...transaction,
      user: req.user.id
    }));

    // Bulk insert transactions
    const createdTransactions = await Transaction.insertMany(transactionsWithUser);

    res.status(201).json({
      success: true,
      message: `${createdTransactions.length} transactions created successfully`,
      data: createdTransactions
    });
  } catch (error) {
    console.error('Bulk create transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating transactions'
    });
  }
});

// @desc    Delete receipt from Cloudinary
// @route   DELETE /api/receipts/:publicId
// @access  Private
router.delete('/:publicId', async (req, res) => {
  try {
    const { publicId } = req.params;
    
    // Delete from Cloudinary
    await cloudinary.uploader.destroy(publicId);
    
    res.status(200).json({
      success: true,
      message: 'Receipt deleted successfully'
    });
  } catch (error) {
    console.error('Delete receipt error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting receipt'
    });
  }
});

module.exports = router;

