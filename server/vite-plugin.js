/**
 * Vite plugin that runs the storage API server inside Vite's dev server.
 * No need to run node server/api.js separately!
 */
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { loadProject, saveProject } from './storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default function studioApiPlugin() {
  let apiRouter;

  return {
    name: 'studio-api',

    /**
     * Called when the Vite dev server is configured.
     * We add the Express API as middleware directly on the Vite server.
     */
    configureServer(server) {
      // Create an Express app for the API routes
      const app = express();

      // CORS is not needed because Vite proxy handles it,
      // but we add it just in case
      app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') return res.sendStatus(204);
        next();
      });

      app.use(express.json({ limit: '50mb' }));

      // Load project
      app.get('/api/project', (req, res) => {
        const project = loadProject();
        res.json(project);
      });

      // Save project
      app.post('/api/project', (req, res) => {
        const success = saveProject(req.body);
        res.json({ success });
      });

      // Serve workflow JSON files
      app.get('/api/workflows/:file', (req, res) => {
        const filePath = path.resolve(__dirname, '../workflows', req.params.file);
        try {
          if (fs.existsSync(filePath)) {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            res.json(data);
          } else {
            res.status(404).json({ error: 'Workflow not found' });
          }
        } catch (error) {
          res.status(500).json({ error: 'Failed to load workflow' });
        }
      });

      // Proxy for ComfyUI /prompt (bypasses CORS)
      app.post('/api/comfyui/prompt', async (req, res) => {
        try {
          console.log('[COMFYUI PROXY] === START ===');
          console.log('[COMFYUI PROXY] Incoming body keys:', Object.keys(req.body));
          const hasPrompt = !!req.body.prompt;
          const hasClientId = !!req.body.client_id;
          console.log('[COMFYUI PROXY] Has prompt:', hasPrompt, '| Has client_id:', hasClientId);
          if (!hasPrompt || !hasClientId) {
            return res.status(400).json({ success: false, error: 'Missing prompt or client_id', bodyKeys: Object.keys(req.body) });
          }
          const targetUrl = 'http://127.0.0.1:8188/prompt';
          const outgoingBody = JSON.stringify(req.body);
          // Save payload to debug file
          try {
            const fs = await import('fs');
            const path = await import('path');
            const debugPath = path.resolve(__dirname, '../debug-workflow.json');
            fs.writeFileSync(debugPath, outgoingBody, 'utf8');
            console.log('[COMFYUI PROXY] Saved payload to debug-workflow.json');
          } catch (e) {
            console.warn('[COMFYUI PROXY] Could not save debug file:', e);
          }
          console.log('[COMFYUI PROXY] Outgoing body length:', outgoingBody.length);
          console.log('[COMFYUI PROXY] Full payload:');
          console.log(outgoingBody);
          try {
            const comfyRes = await fetch(targetUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: outgoingBody
            });
            const rawText = await comfyRes.text();
            console.log('[COMFYUI PROXY] ComfyUI status:', comfyRes.status);
            console.log('[COMFYUI PROXY] ComfyUI FULL raw response:');
            console.log(rawText);
            console.log('[COMFYUI PROXY] === END ===');
            // Always return JSON
            let parsed;
            try {
              parsed = JSON.parse(rawText);
            } catch {
              return res.status(comfyRes.status || 500).json({
                success: false,
                error: 'ComfyUI returned non-JSON',
                comfyStatus: comfyRes.status,
                comfyRawText: rawText,
                payloadPreview: outgoingBody.substring(0, 500)
              });
            }
            return res.status(comfyRes.ok ? 200 : (comfyRes.status || 500)).json(parsed);
          } catch (fetchErr) {
            const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
            console.error('[COMFYUI PROXY] Fetch to ComfyUI failed:', msg);
            return res.status(502).json({
              success: false,
              error: 'Fetch to ComfyUI failed',
              details: msg,
              payloadPreview: outgoingBody.substring(0, 500)
            });
          }
        } catch (outerErr) {
          const msg = outerErr instanceof Error ? outerErr.message : String(outerErr);
          console.error('[COMFYUI PROXY] UNCAUGHT error:', msg);
          return res.status(500).json({ success: false, error: 'Internal proxy error', details: msg });
        }
      });

      // Proxy for ComfyUI /history/{prompt_id} (bypasses CORS)
      app.get('/api/comfyui/history/:promptId', async (req, res) => {
        try {
          const promptId = req.params.promptId;
          const targetUrl = `http://127.0.0.1:8188/history/${promptId}`;
          const comfyRes = await fetch(targetUrl);
          const rawText = await comfyRes.text();
          let parsed;
          try { parsed = JSON.parse(rawText); } catch { parsed = { error: 'Invalid JSON from ComfyUI', raw: rawText.slice(0, 500) }; }
          res.status(comfyRes.ok ? 200 : (comfyRes.status || 500)).json(parsed);
        } catch (err) {
          res.status(502).json({ error: 'History proxy failed', details: err instanceof Error ? err.message : String(err) });
        }
      });

      // Attach the Express app as Vite middleware
      // This makes the API available at the same port as Vite
      server.middlewares.use(app);

      console.log('[API] Storage API running on Vite dev server (no separate port needed)');
    },
  };
}
