import { app, BrowserWindow, ipcMain, safeStorage } from 'electron';
import * as path from 'path';
import { registerIpcHandlers, ServiceRegistry } from './ipc-handlers';
import { PersistenceService } from '../services/persistence-service';
import { ProjectService } from '../services/project-service';
import { SettingsService, SecretStore } from '../services/settings-service';
import { LlmClient } from '../services/llm-client';
import { TeamGenerationService } from '../services/team-generation-service';
import { ProjectWriter } from '../services/project-writer';
import { logger } from '../services/logger';

let mainWindow: BrowserWindow | null = null;
let services: ServiceRegistry | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Agent Team Studio',
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  logger.info('main', 'BrowserWindow created', { isDev: !app.isPackaged });
}

function initializeServices(): ServiceRegistry {
  const dataDir = path.join(app.getPath('userData'), 'agent-team-studio-data');
  logger.info('main', 'Initializing services', { dataDir });

  const persistence = new PersistenceService(dataDir);
  const secretStore: SecretStore = {
    isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
    encryptString: (value) => safeStorage.encryptString(value).toString('base64'),
    decryptString: (encoded) =>
      safeStorage.decryptString(Buffer.from(encoded, 'base64')),
  };
  const settingsService = new SettingsService(persistence, secretStore);
  const llmClient = new LlmClient();
  const projectService = new ProjectService(persistence);
  const teamGenerationService = new TeamGenerationService(llmClient, settingsService);
  const projectWriter = new ProjectWriter();

  return {
    persistence,
    projectService,
    settingsService,
    llmClient,
    teamGenerationService,
    projectWriter,
  };
}

app.whenReady().then(() => {
  logger.info('main', 'Application ready, initializing services');
  services = initializeServices();
  registerIpcHandlers(ipcMain, services);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  logger.info('main', 'All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  logger.info('main', 'Application shutting down');
});
