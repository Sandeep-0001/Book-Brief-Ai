# BookBrief-AI Frontend

React + Vite frontend for BookBrief-AI book summarizer.

## Environment Variables

Create a `.env.local` file in the Frontend directory with:

```env
VITE_API_URL=http://localhost:5000
```

For production deployment on Vercel, set the environment variable:
- **Key**: `VITE_API_URL`
- **Value**: Your backend URL (e.g., `https://your-backend.onrender.com`)

## Local Development

```bash
npm install
npm run dev
```

The app will run on `http://localhost:3000`

## Build for Production

```bash
npm run build
```

The build output will be in the `dist` folder.

## Deployment

See [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md) for detailed deployment instructions.
