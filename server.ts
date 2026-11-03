import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Proxy route for Google Apps Script to bypass any browser CORS quirks seamlessly if needed
app.post('/api/gas-proxy', async (req, res) => {
  try {
    const GAS_URL = 'https://script.google.com/macros/s/AKfycbyXkfWspcmg-EfxrttyeIRY8pks8ogkzOIV89IWTR-R-Zqew8I1lcpGCDaUu420b4FIAw/exec';
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(req.body),
    });
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      res.json(data);
    } catch {
      res.send(text);
    }
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Proxy failed' });
  }
});

// Setup Vite middlewares in development or static serve in production
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`COC Media Team server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
