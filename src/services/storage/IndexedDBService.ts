import type { AppData } from './LocalStorageService';

const DB_NAME = 'studio-ai-db';
const DB_VERSION = 1;
const STORE_NAME = 'app-data';
const PROJECT_KEY = 'project-main';

export class IndexedDBService {
  private db: IDBDatabase | null = null;

  async init(): Promise<boolean> {
    try {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          this.db = request.result;
          console.log('IndexedDB initialized');
          resolve(true);
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
      });
    } catch (error) {
      console.error('IndexedDB init failed:', error);
      return false;
    }
  }

  async save(data: AppData): Promise<boolean> {
    if (!this.db) {
      await this.init();
      if (!this.db) {
        console.error('Cannot save - DB not initialized');
        return false;
      }
    }

    try {
      console.log(`SAVE PROJECT key=${PROJECT_KEY}: Episodes=${data.episodes?.length}, Characters=${data.characters?.length}, Prompts=${data.prompts?.length}, RenderJobs=${data.renderJobs?.length}`);
      
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(data, PROJECT_KEY);

        request.onsuccess = () => {
          console.log(`✓ SAVED to IndexedDB`);
          resolve(true);
        };
        request.onerror = () => {
          console.error('✗ Save error:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Save failed:', error);
      return false;
    }
  }

  async load(): Promise<AppData | null> {
    if (!this.db) {
      await this.init();
      if (!this.db) {
        console.error('Cannot load - DB not initialized');
        return null;
      }
    }

    try {
      console.log(`LOAD PROJECT key=${PROJECT_KEY} FROM IndexedDB...`);
      
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(PROJECT_KEY);

        request.onsuccess = () => {
          const data = request.result as AppData | undefined;
          if (data) {
            console.log(`✓ LOADED PROJECT: Episodes=${data.episodes?.length}, Characters=${data.characters?.length}, Prompts=${data.prompts?.length}, RenderJobs=${data.renderJobs?.length}`);
          } else {
            console.log('✗ No saved project found');
          }
          resolve(data || null);
        };
        request.onerror = () => {
          console.error('✗ Load error:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Load failed:', error);
      return null;
    }
  }
}

export const indexedDBService = new IndexedDBService();
