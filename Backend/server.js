const express = require('express');
const cors = require('cors');
const multer = require('multer');
require('dotenv').config();
const path = require('path');

const { extractTextFromFile } = require('./utils/fileProcessor');
const { summarizeText } = require('./utils/summarizer');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for in-memory file uploads (no permanent storage)
const storage = multer.memoryStorage();

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['text/plain', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only TXT and PDF files are allowed'), false);
    }
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'BookBrief AI Server is running' });
});

// Summarize endpoint
app.post('/api/summarize', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Check for API key
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      return res.status(500).json({ 
        error: 'GEMINI_API_KEY not configured properly',
        details: 'Please edit server/.env file and add your actual Gemini API key'
      });
    }

    console.log(`Processing file: ${req.file.originalname}`);

    // Extract text from file (in-memory processing)
    const text = await extractTextFromFile(req.file);
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'No text content found in the file' });
    }

    console.log(`Extracted text length: ${text.length} characters`);

    // Summarize the text
    const summary = await summarizeText(text);

    // No cleanup needed - file was processed in memory

    res.json({ 
      summary: summary,
      originalLength: text.length,
      summaryLength: summary.length
    });

  } catch (error) {
    console.error('Error processing file:', error);
    
    // No cleanup needed - file was processed in memory

    res.status(500).json({ 
      error: error.message || 'An error occurred while processing the file',
      details: process.env.NODE_ENV === 'development' ? String(error.stack || error) : undefined
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 50MB.' });
    }
  }
  
  res.status(500).json({ error: error.message });
});

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '..', 'Frontend', 'build');
  app.use(express.static(buildPath));

  // SPA fallback for non-API routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`BookBrief AI Server running on port ${PORT}`);
  console.log(`Ready to summarize books with Gemini AI`);
});
