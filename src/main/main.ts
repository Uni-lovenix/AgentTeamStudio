import { app, BrowserWindow, ipcMain, safeStorage } from 'electron';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { registerIpcHandlers, ServiceRegistry } from './ipc-handlers';
import { PersistenceService } from '../services/persistence-service';
import { ProjectService } from '../services/project-service';
import { SettingsService, SecretStore } from '../services/settings-service';
import { LlmClient } from '../services/llm-client';
import { TeamGenerationService } from '../services/team-generation-service';
import { ProjectWriter } from '../services/project-writer';
import {
  repairTeamConfig,
  validateGeneratedHarness,
  validateTeamConfig,
} from '../services/team-config-validator';
import { IPC_CHANNELS } from '../shared/types';
import { logger } from '../services/logger';

let mainWindow: BrowserWindow | null = null;
let services: ServiceRegistry | null = null;

const SMOKE_MODE = process.env.AGENT_TEAM_STUDIO_SMOKE === '1';
const SMOKE_OUTPUT = process.env.AGENT_TEAM_STUDIO_SMOKE_OUTPUT;
const SMOKE_DATA_DIR = SMOKE_MODE
  ? fs.mkdtempSync(path.join(os.tmpdir(), 'agent-team-studio-smoke-data-'))
  : null;

if (SMOKE_DATA_DIR) {
  app.setPath('userData', SMOKE_DATA_DIR);
}

interface SmokeResult {
  passed: boolean;
  ipcChannels: number;
  windowLoaded: boolean;
  generated: boolean;
  exported: boolean;
  harnessValid: boolean;
  message: string;
}

function finishSmoke(result: SmokeResult): void {
  const serialized = JSON.stringify(result, null, 2);
  if (SMOKE_OUTPUT) {
    fs.writeFileSync(SMOKE_OUTPUT, serialized, 'utf8');
  } else {
    console.log(`[smoke] ${serialized}`);
  }
  if (SMOKE_DATA_DIR) {
    fs.rmSync(SMOKE_DATA_DIR, { recursive: true, force: true });
  }
  app.quit();
}

async function runSmoke(activeServices: ServiceRegistry, windowLoaded: boolean): Promise<void> {
  const result: SmokeResult = {
    passed: false,
    ipcChannels: Object.values(IPC_CHANNELS).length,
    windowLoaded,
    generated: false,
    exported: false,
    harnessValid: false,
    message: '',
  };
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-team-studio-smoke-'));
  try {
    activeServices.projectService.create('Smoke Project');
    const generated = await activeServices.teamGenerationService.generate({
      projectName: 'Smoke Project',
      requirement:
        '一个 Windows 桌面应用，用于生成多智能体团队配置，支持项目草稿、团队生成、校验和导出。',
      useLlm: false,
    });
    const repaired = repairTeamConfig(generated.team);
    const validation = validateTeamConfig(repaired);
    if (!validation.ok) {
      throw new Error(`团队校验失败：${validation.errors.map((item) => item.message).join('；')}`);
    }
    const written = activeServices.projectWriter.writeToDirectory(repaired, target, true);
    const harnessValidation = validateGeneratedHarness(target, repaired, written.createdFiles);
    result.generated = true;
    result.exported =
      written.createdFiles.includes('AGENTS.team.md') &&
      written.createdFiles.includes('agents.json') &&
      written.createdFiles.some((file) => file.startsWith('agents/'));
    result.harnessValid = harnessValidation.ok;
    result.message = `created ${written.createdFiles.length} files, harness ${harnessValidation.ok ? 'valid' : 'invalid'}`;
  } catch (error) {
    result.message = error instanceof Error ? error.message : String(error);
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
    result.passed =
      result.ipcChannels === Object.values(IPC_CHANNELS).length &&
      result.windowLoaded &&
      result.generated &&
      result.exported &&
      result.harnessValid;
    finishSmoke(result);
  }
}

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

  if (SMOKE_MODE) {
    mainWindow?.webContents.once('did-finish-load', () => {
      if (!services) {
        finishSmoke({
          passed: false,
          ipcChannels: Object.values(IPC_CHANNELS).length,
          windowLoaded: false,
          generated: false,
          exported: false,
          harnessValid: false,
          message: 'services unavailable',
        });
        return;
      }
      void runSmoke(services, Boolean(mainWindow));
    });
    if (!mainWindow) {
      finishSmoke({
        passed: false,
        ipcChannels: Object.values(IPC_CHANNELS).length,
        windowLoaded: false,
        generated: false,
        exported: false,
        harnessValid: false,
        message: 'window unavailable',
      });
    }
  }

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
