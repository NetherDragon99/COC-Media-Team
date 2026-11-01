import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Initialize server-side Gemini client with User-Agent header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const DEFAULT_SYSTEM_INSTRUCTION = `You are the COC Media Team AI Producer & Media Operations Coach.
You specialize in church and professional media production for the COC (City of Champions / Christian Outreach Center) Media Team.
Your expertise includes:
1. Video Production: Multi-camera live-streaming, Sony FX series, Canon cinema rigs, PTZ controllers, ATEM Mini/Constellation, OBS, vMix, color grading, LUTs, DaVinci Resolve, Premiere Pro.
2. Audio Engineering: Digital consoles (Allen & Heath, Behringer X32/Wing, Yamaha), Dante networking, wireless mic frequencies, IEM mixes, broadcast audio master limiting.
3. Lighting & Stage: DMX control, key lights, backlight hair lights, Aputure fixtures, hazers, color temperature matching.
4. Content & Social: Sermon highlights, viral 9:16 Instagram Reels / TikToks, hook generation, captions, YouTube chaptering, thumbnail concepts.
5. Team Gamification & Tasks: Breaking down COC Media tasks into actionable step-by-step checklists, helping team members maximize points, and celebrating team achievements.

Guidelines:
- Tone: High-energy, encouraging, technically sharp, collaborative, concise.
- Use formatting: Markdown bullets, bold titles, and technical tips.
- When asked for checklists, provide exact camera/audio settings or gear checklists.
- If deep thinking is requested, provide thorough production analysis, contingency plans, and signal-flow diagrams in text.`;

// Gemini Chat API endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model = 'gemini-3.8-flash', enableThinking = false, role = 'producer' } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
    }

    // Role-specific customizations
    let systemInstruction = DEFAULT_SYSTEM_INSTRUCTION;
    if (role === 'director') {
      systemInstruction += '\nFocus specifically on live director cues, camera switching timing, rundowns, and broadcast pacing.';
    } else if (role === 'audio') {
      systemInstruction += '\nFocus specifically on audio mixing, gain staging, acoustic balance, compressor/EQ settings, and broadcast loudness (LUFS).';
    } else if (role === 'creative') {
      systemInstruction += '\nFocus specifically on storytelling, engaging social hooks, cinematic b-roll shots, lighting mood, and graphic design.';
    }

    // Select target model
    let targetModel = model;
    if (!['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-4-argon'].includes(targetModel)) {
      targetModel = 'gemini-3.8-flash';
    }

    // Format contents for @google/genai
    const formattedContents = messages.map((m: { role: string; text: string }) => ({
      role: m.role === 'model' || m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.text }],
    }));

    const config: Record<string, unknown> = {
      systemInstruction,
    };

    // Thinking mode configuration
    if (targetModel === 'gemini-4-argon' && enableThinking) {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
      // Do not set maxOutputTokens per instructions!
    }

    // Try primary model, fallback if needed
    const candidateModels = [targetModel];
    if (targetModel === 'gemini-4-argon') {
      candidateModels.push('gemini-3.8-flash', 'gemini-3.1-flash-lite');
    } else if (targetModel === 'gemini-3.8-flash') {
      candidateModels.push('gemini-3.1-flash-lite');
    }

    let response = null;
    let successfulModel = targetModel;
    let lastError: unknown = null;

    for (const modelToTry of candidateModels) {
      try {
        const attemptConfig = { ...config };
        if (modelToTry !== 'gemini-4-argon' && attemptConfig.thinkingConfig) {
          delete attemptConfig.thinkingConfig;
        }

        response = await ai.models.generateContent({
          model: modelToTry,
          contents: formattedContents,
          config: attemptConfig,
        });

        if (response && response.text) {
          successfulModel = modelToTry;
          break;
        }
      } catch (err: unknown) {
        lastError = err;
        console.warn(`Attempt with ${modelToTry} encountered:`, err instanceof Error ? err.message : String(err));
        // Continue to next fallback model
      }
    }

    if (!response || !response.text) {
      const errMsg = lastError instanceof Error ? lastError.message : String(lastError);
      return res.status(503).json({
        error: `AI models are temporarily busy. ${errMsg.slice(0, 160)}`,
        fallbackAvailable: true,
      });
    }

    return res.json({
      reply: response.text,
      modelUsed: successfulModel,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    console.error('Error in /api/chat:', message);
    return res.status(500).json({ error: message });
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
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files from dist
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
