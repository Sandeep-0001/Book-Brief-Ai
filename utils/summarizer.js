const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * A heuristic to estimate word count from character length.
 */
const CHARS_PER_WORD = 5;

/**
 * Split text into chunks based on approximate character limits.
 * Keeps paragraph boundaries when possible and falls back to sentence splits.
 * @param {string} text
 * @param {number} maxChars
 * @returns {Array<string>}
 */
function splitTextIntoChunks(text, maxChars = 24000) {
  const paragraphs = text.split('\n\n');
  const chunks = [];
  let current = '';

  const pushCurrent = () => {
    if (current.trim()) chunks.push(current.trim());
    current = '';
  };

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    const tentative = current ? `${current}\n\n${trimmed}` : trimmed;
    if (tentative.length <= maxChars) {
      current = tentative;
      continue;
    }

    if (current) pushCurrent();

    if (trimmed.length <= maxChars) {
      current = trimmed;
      continue;
    }

    // Paragraph itself is too large: split by sentences
    const sentences = trimmed.split(/(?<=[.!?])\s+/);
    let sentenceChunk = '';
    for (const sentence of sentences) {
      const t = sentenceChunk ? `${sentenceChunk} ${sentence}` : sentence;
      if (t.length > maxChars) {
        if (sentenceChunk) chunks.push(sentenceChunk.trim());
        // If a single sentence is still too long, hard-split by characters
        if (sentence.length > maxChars) {
          for (let i = 0; i < sentence.length; i += maxChars) {
            chunks.push(sentence.slice(i, i + maxChars).trim());
          }
          sentenceChunk = '';
        } else {
          sentenceChunk = sentence;
        }
      } else {
        sentenceChunk = t;
      }
    }
    if (sentenceChunk) current = sentenceChunk;
  }

  if (current) pushCurrent();
  return chunks;
}

/**
 * Generate summary for a single chunk using Gemini
 * @param {string} text - Text chunk to summarize
 * @param {number} targetWords - Target summary length in words
 * @returns {Promise<string>} - Generated summary
 */
async function summarizeChunk(text, targetWords = 100) {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash", 
      systemInstruction: "You are an expert at creating precise, impactful summaries. Extract ONLY the most important insights, key findings, and essential information. Focus on actionable points and critical concepts. Eliminate examples, anecdotes, and minor details. Prioritize substance over length."
    });

    const prompt = `Create a concise summary of the following text in ${targetWords} words or less. Extract ONLY the most important insights and key points. Be brief and focused:

${text}

Concise Summary (${targetWords} words max):`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error('Error summarizing chunk:', error);
    return `[Error summarizing this section: ${error.message}]`;
  }
}

/**
 * Combine multiple summaries into a final summary
 * @param {Array<string>} summaries - Array of individual summaries
 * @param {number} targetWords - Target summary length in words
 * @returns {Promise<string>} - Final combined summary
 */
async function combineSummaries(summaries, targetWords = 200) {
  if (summaries.length === 1) {
    return summaries[0];
  }

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: "You are an expert at creating precise, impactful final summaries. Combine the most important insights from the following summary sections into a single, coherent, and actionable summary. Focus on key findings, critical insights, and essential information. Eliminate redundancy and prioritize substance."
    });

    const combinedText = summaries.join('\n\n---\n\n');
    const prompt = `Combine these summaries into one concise final summary. Include only the most important insights and key points. Maximum ${targetWords} words. Be brief and focused:

${combinedText}

Concise Final Summary (${targetWords} words max):`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error('Error combining summaries:', error);
    return summaries.join('\n\n'); 
  }
}

/**
 * Apply additional compression to summary if it's still too long
 * @param {string} summary - Summary to compress
 * @param {number} maxChars - Maximum allowed character length
 * @returns {Promise<string>} - Compressed summary
 */
async function compressSummary(summary, maxChars) {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: "You are an expert at creating precise, impactful summaries. Extract only the most important insights, key findings, and essential information. Focus on actionable points and critical concepts. Prioritize substance and impact over length."
    });

    // Convert max character length to a target word count
    const targetWords = Math.floor(maxChars / CHARS_PER_WORD);
    const prompt = `Compress this summary to ${targetWords} words or less. Extract only the most important insights and key points. Be extremely brief:

${summary}

Compressed Summary (${targetWords} words max):`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error('Error compressing summary:', error);
    
    return summary.substring(0, maxChars) + (summary.length > maxChars ? '...' : '');
  }
}

/**
 * Main summarization function
 * @param {string} text - Full text to summarize
 * @returns {Promise<string>} - Final summary
 */
async function summarizeText(text) {
  try {
    console.log(`Starting summarization of text with ${text.length} characters`);
    
    
    const totalTargetCharLength = Math.max(200, Math.floor(text.length * 0.50));
    // Set a 55% ceiling for the final compression check
    const maxFinalCharLength = Math.max(200, Math.floor(text.length * 0.55));

    // --- Single Call Path (for smaller texts) ---
    if (text.length < 30000) {
      console.log('Processing small text with single API call');
      // Convert target CHARS to target WORDS for the prompt
      const targetWords = Math.floor(totalTargetCharLength / CHARS_PER_WORD);
      return await summarizeChunk(text, targetWords);
    }

    const chunks = splitTextIntoChunks(text, 8000); // 8k chunks for parallel processing
    console.log(`Split text into ${chunks.length} chunks`);

    if (chunks.length === 0) {
      throw new Error('No text content to summarize');
    }

    // Calculate target WORDS per chunk
    const targetCharLengthPerChunk = Math.max(50, Math.floor(totalTargetCharLength / chunks.length));
    const targetWordsPerChunk = Math.max(50, Math.floor(targetCharLengthPerChunk / CHARS_PER_WORD));

    // Process chunks in parallel
    console.log(`Processing chunks in parallel (target ${targetWordsPerChunk} words/chunk)...`);
    const summaries = await Promise.all(
      chunks.map(async (chunk, index) => {
        console.log(`Processing chunk ${index + 1}/${chunks.length}`);
        return await summarizeChunk(chunk, targetWordsPerChunk);
      })
    );

    // Combine summaries
    // Convert total target CHARS to total target WORDS for the combine step
    const totalTargetWords = Math.floor(totalTargetCharLength / CHARS_PER_WORD);
    console.log(`Combining summaries to target ${totalTargetWords} words...`);
    let finalSummary = await combineSummaries(summaries, totalTargetWords);

    // Apply final compression if summary is still too long
    if (finalSummary.length > maxFinalCharLength) {
      console.log(`Final summary too long (${finalSummary.length} chars), applying additional compression to ${maxFinalCharLength} chars`);
      finalSummary = await compressSummary(finalSummary, maxFinalCharLength);
    }

    // Safety check: ensure summary is not longer than original
    if (finalSummary.length > text.length) {
      console.log(`Warning: Summary (${finalSummary.length} chars) is longer than original (${text.length} chars). Applying emergency compression.`);
      const emergencyTargetChars = Math.floor(text.length * 0.5); // 50% of original
      finalSummary = await compressSummary(finalSummary, emergencyTargetChars);
    }

    console.log(`Summarization complete. Final summary length: ${finalSummary.length} characters (${Math.round((finalSummary.length / text.length) * 100)}% of original)`);
    return finalSummary;

  } catch (error) {
    console.error('Error in summarizeText:', error);
    throw new Error(`Summarization failed: ${error.message}`);
  }
}

module.exports = {
  summarizeText
};