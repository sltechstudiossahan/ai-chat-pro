import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

function aiApiPlugin(): Plugin {
  return {
    name: 'chatpro-ai-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/ai' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const parsed = JSON.parse(body || '{}');
              const message = String(parsed.message || '').trim();
              const history = Array.isArray(parsed.history) ? parsed.history : [];
              const apiKey = process.env.GEMINI_API_KEY;

              if (!apiKey) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ fallback: true, reason: 'No GEMINI_API_KEY provided' }));
                return;
              }

              const { GoogleGenAI } = await import('@google/genai');
              const ai = new GoogleGenAI({ apiKey });

              const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
              if (Array.isArray(history)) {
                for (const h of history.slice(-10)) {
                  if (h && h.text) {
                    contents.push({
                      role: h.role === 'user' ? 'user' : 'model',
                      parts: [{ text: String(h.text) }]
                    });
                  }
                }
              }

              contents.push({
                role: 'user',
                parts: [{ text: message }]
              });

              const response = await ai.models.generateContent({
                model: 'gemini-3.8-flash',
                contents,
                config: {
                  systemInstruction: 'You are ChatPro AI, a helpful, intelligent, polite AI assistant on the ChatPro messaging platform (similar to Meta AI on WhatsApp). You answer all user questions accurately, comprehensively, and clearly. You support English, Sinhala (සිංහල), Tamil, and other languages. You help with general knowledge, coding, science, mathematics, literature, daily advice, translation, and ChatPro application guides. Format responses cleanly with neat paragraphs, bullet points, or code blocks where appropriate.'
                }
              });

              const replyText = response.text || 'I am here to help you!';
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ reply: replyText }));
            } catch (err: any) {
              console.error('Gemini AI API Error:', err);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ fallback: true, error: err?.message || 'AI request error' }));
            }
          });
          return;
        }
        next();
      });
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), aiApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
