import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { loadProject, saveProject } from './storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// CORS middleware - allow all localhost origins
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
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

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Storage API running on http://localhost:${PORT}`);
});
