import express from 'express';
import { loadProject, saveProject } from './storage.js';

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

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Storage API running on http://localhost:${PORT}`);
});
