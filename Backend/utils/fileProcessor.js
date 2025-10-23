const pdf = require('pdf-parse');

/**
 * Extract text from various file formats (in-memory processing)
 * @param {Object} file - Multer file object with buffer and mimetype
 * @returns {Promise<string>} - Extracted text content
 */
async function extractTextFromFile(file) {
  const mimetype = file.mimetype;
  
  try {
    if (mimetype === 'text/plain') {
      return await extractTextFromTxt(file.buffer);
    } else if (mimetype === 'application/pdf') {
      return await extractTextFromPdf(file.buffer);
    } else {
      throw new Error('Unsupported file format. Only TXT and PDF files are supported.');
    }
  } catch (error) {
    throw new Error(`Error extracting text from file: ${error.message}`);
  }
}

/**
 * Extract text from TXT file buffer
 * @param {Buffer} buffer - File buffer
 * @returns {Promise<string>} - Text content
 */
async function extractTextFromTxt(buffer) {
  try {
    return buffer.toString('utf8');
  } catch (error) {
    throw new Error(`Error reading TXT file: ${error.message}`);
  }
}

/**
 * Extract text from PDF file buffer
 * @param {Buffer} buffer - File buffer
 * @returns {Promise<string>} - Extracted text content
 */
async function extractTextFromPdf(buffer) {
  try {
    const data = await pdf(buffer);
    return data.text;
  } catch (error) {
    throw new Error(`Error reading PDF file: ${error.message}`);
  }
}

module.exports = {
  extractTextFromFile
};
