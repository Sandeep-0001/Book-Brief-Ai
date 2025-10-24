import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import pdfParse from 'pdf-parse';
import { encoding_for_model } from 'tiktoken';
import fs from 'fs/promises';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Initialize Gemini AI
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('GEMINI_API_KEY is missing in .env file');
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  systemInstruction: 'You are an expert summarizer. Create well-balanced summaries that capture all important information while being more concise than the original. Include key points, main ideas, important details, and essential context. Aim for summaries that are approximately 50% of the original length - comprehensive yet condensed.'
});

const generationConfig = {
  temperature: 0.4,
  maxOutputTokens: 4096,
};

// Utility functions
function calculateSummarizationParams(targetSummarySize = 500, modelContextSize = 16000) {
  const summaryInputSize = modelContextSize - targetSummarySize - 1000;
  return {
    modelContextSize,
    targetSummarySize,
    summaryInputSize
  };
}

function countTokens(text) {
  try {
    const encoder = encoding_for_model('gpt-3.5-turbo');
    const tokens = encoder.encode(text);
    encoder.free();
    return tokens.length;
  } catch (error) {
    // Fallback: approximate tokens as words / 0.75
    return Math.ceil(text.split(/\s+/).length / 0.75);
  }
}

function splitTextIntoSections(text, maxTokens, separator = '\n\n') {
  const paragraphs = text.split(separator);
  const sections = [];
  let currentSection = '';

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) continue;

    const tentativeSection = currentSection 
      ? currentSection + separator + paragraph 
      : paragraph;
    
    const tokens = countTokens(tentativeSection);

    if (tokens > maxTokens) {
      if (currentSection) {
        sections.push(currentSection.trim());
        currentSection = paragraph;
      } else {
        sections.push(paragraph.trim());
        currentSection = '';
      }
    } else {
      currentSection = tentativeSection;
    }
  }

  if (currentSection) {
    sections.push(currentSection.trim());
  }

  return sections;
}

function createSummarizationPrompt(content, targetSummarySize) {
  const wordCount = content.split(/\s+/).length;
  const targetRatio = Math.max(0.4, targetSummarySize / wordCount); // Target ~50% reduction
  
  return `Create a well-balanced summary that captures the key information while being more concise than the original.

Original text length: ~${wordCount} words
Target summary length: ${targetSummarySize} words (${Math.round(targetRatio * 100)}% of original)

GUIDELINES:
1. Include all major points and important details
2. Maintain the structure and flow of the original
3. Keep essential examples and explanations
4. Aim for approximately 50% of the original length
5. Be clear and comprehensive while removing redundancy

Text to summarize:

${content}`;
}

async function callGeminiAPI(promptText, retries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: promptText }] }],
        generationConfig
      });
      
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error(`Gemini API error (attempt ${attempt}/${retries}):`, error.message);
      
      // Check if it's a 503 error (overloaded) or rate limit error
      const isRetryable = error.message.includes('503') || 
                          error.message.includes('overloaded') ||
                          error.message.includes('429') ||
                          error.message.includes('rate limit');
      
      if (isRetryable && attempt < retries) {
        // Exponential backoff: wait longer with each retry
        const waitTime = delay * Math.pow(2, attempt - 1);
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        // If not retryable or out of retries, return error message
        return `[Error summarizing chunk: ${error.message}]`;
      }
    }
  }
  
  return '[Error: Max retries exceeded]';
}

async function extractTextFromFile(file) {
  const fileName = file.originalname.toLowerCase();
  
  if (fileName.endsWith('.txt')) {
    return file.buffer.toString('utf-8');
  } else if (fileName.endsWith('.pdf')) {
    try {
      const data = await pdfParse(file.buffer);
      return data.text;
    } catch (error) {
      throw new Error('Failed to parse PDF file');
    }
  } else {
    throw new Error('Unsupported file format. Please upload .txt or .pdf');
  }
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'BookBrief-AI API is running' });
});

// Preview endpoint
app.post('/api/preview', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const text = await extractTextFromFile(req.file);
    const preview = text.substring(0, 4000);
    
    res.json({ 
      preview,
      fullLength: text.length 
    });
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Summarize endpoint
app.post('/api/summarize', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
    }

    // Extract text from file
    const text = await extractTextFromFile(req.file);
    
    // Calculate parameters - aim for 50% of original length
    const textLength = text.length;
    const targetSummaryWords = Math.max(200, Math.min(2000, Math.floor(text.split(/\s+/).length * 0.5)));
    const params = calculateSummarizationParams(targetSummaryWords, 16000);
    
    // Split text into chunks
    const chunks = splitTextIntoSections(text, params.summaryInputSize, '\n\n');
    
    console.log(`Processing ${chunks.length} chunks...`);
    
    // Summarize each chunk
    const allSummaries = [];
    for (let i = 0; i < chunks.length; i++) {
      console.log(`Summarizing chunk ${i + 1}/${chunks.length}...`);
      
      const prompt = createSummarizationPrompt(chunks[i], params.targetSummarySize);
      const summary = await callGeminiAPI(prompt);
      allSummaries.push(summary);
    }
    
    const finalSummary = allSummaries.join('\n\n');
    
    console.log('Summary completed');
    res.json({ summary: finalSummary, chunks: chunks.length });
    
  } catch (error) {
    console.error('Summarization error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`BookBrief-AI API ready`);
});
