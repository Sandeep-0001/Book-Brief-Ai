# BookBrief-AI Backend

Express.js backend API for BookBrief-AI book summarizer using Google Gemini AI.

## Environment Variables

Create a `.env` file in the Backend directory with:

```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=5000
```

### Getting a Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key and add it to your `.env` file

## Local Development

```bash
npm install
node server.js
```

The API will run on `http://localhost:5000`

## API Endpoints

- `GET /api/health` - Health check endpoint
- `POST /api/preview` - Preview uploaded file (first 4000 characters)
- `POST /api/summarize` - Summarize uploaded file using Gemini AI

## Deployment on Render

See [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md) for detailed deployment instructions.

### Quick Setup:
1. Create a new Web Service on Render
2. Set Root Directory to `Backend`
3. Set Build Command to `npm install`
4. Set Start Command to `node server.js`
5. Add environment variable: `GEMINI_API_KEY`
