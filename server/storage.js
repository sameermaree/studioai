import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.join(__dirname, '../data/projects/default-project');
const PROJECT_FILE = path.join(PROJECT_DIR, 'project.json');
const BACKUPS_DIR = path.join(PROJECT_DIR, 'backups');
const MAX_BACKUPS = 10;

// Asset folder structure
const ASSET_FOLDERS = [
  'assets/characters',
  'assets/backgrounds',
  'assets/audio/music',
  'assets/audio/voice',
  'assets/audio/sfx',
  'assets/renders',
  'assets/thumbnails',
  'assets/subtitles',
  'assets/temp',
  'backups'
];

// Create .gitkeep files to preserve empty folders
function createGitkeep(folderPath) {
  const gitkeepPath = path.join(folderPath, '.gitkeep');
  if (!fs.existsSync(gitkeepPath)) {
    fs.writeFileSync(gitkeepPath, '', 'utf8');
  }
}

// Ensure all project directories exist
if (!fs.existsSync(PROJECT_DIR)) {
  fs.mkdirSync(PROJECT_DIR, { recursive: true });
  console.log('Created project directory:', PROJECT_DIR);
}

// Create asset folder structure
for (const folder of ASSET_FOLDERS) {
  const folderPath = path.join(PROJECT_DIR, folder);
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
    createGitkeep(folderPath);
  }
}

console.log('Asset folder structure initialized');
console.log('[CHARACTER CONSISTENCY READY] Asset system loaded');

export function loadProject() {
  try {
    if (fs.existsSync(PROJECT_FILE)) {
      const data = fs.readFileSync(PROJECT_FILE, 'utf8');
      const project = JSON.parse(data);
      console.log(`Loaded project: Episodes=${project.episodes?.length || 0}, Characters=${project.characters?.length || 0}`);
      return project;
    }
  } catch (error) {
    console.error('Failed to load project:', error);
  }
  
  console.log('No project file - returning empty');
  return {
    characters: [],
    episodes: [],
    prompts: [],
    voices: [],
    renderJobs: [],
    mediaAssets: [],
    subtitleTracks: [],
    stylePresets: [],
    publishTargets: [],
    settings: {}
  };
}

export function saveProject(projectData) {
  const tempFile = PROJECT_FILE + '.tmp';
  
  try {
    // Create timestamped backup before saving
    if (fs.existsSync(PROJECT_FILE)) {
      const now = new Date();
      const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
      const backupFile = path.join(BACKUPS_DIR, `project-backup-${timestamp}.json`);
      
      fs.copyFileSync(PROJECT_FILE, backupFile);
      console.log('Backup created:', backupFile);
      
      // Cleanup old backups
      cleanupOldBackups();
    }
    
    // Atomic write: write to temp file first
    fs.writeFileSync(tempFile, JSON.stringify(projectData, null, 2), 'utf8');
    
    // Rename temp to actual file (atomic on most systems)
    fs.renameSync(tempFile, PROJECT_FILE);
    
    console.log(`Project saved successfully: Episodes=${projectData.episodes?.length || 0}, Characters=${projectData.characters?.length || 0}`);
    return true;
  } catch (error) {
    console.error('Failed to save project:', error);
    
    // Cleanup temp file if it exists
    if (fs.existsSync(tempFile)) {
      try {
        fs.unlinkSync(tempFile);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    return false;
  }
}

function cleanupOldBackups() {
  try {
    const backups = fs.readdirSync(BACKUPS_DIR)
      .filter(file => file.startsWith('project-backup-') && file.endsWith('.json'))
      .map(file => ({
        name: file,
        path: path.join(BACKUPS_DIR, file),
        time: fs.statSync(path.join(BACKUPS_DIR, file)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time); // Sort newest first
    
    // Keep only MAX_BACKUPS most recent
    if (backups.length > MAX_BACKUPS) {
      const toDelete = backups.slice(MAX_BACKUPS);
      toDelete.forEach(backup => {
        fs.unlinkSync(backup.path);
      });
      console.log(`Backup cleanup completed: Removed ${toDelete.length} old backups, kept ${MAX_BACKUPS}`);
    }
  } catch (error) {
    console.error('Backup cleanup failed:', error);
  }
}
