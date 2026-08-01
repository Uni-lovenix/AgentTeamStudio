import { BrowserWindow, dialog, IpcMain } from 'electron';
import {
  ConnectionTestInput,
  GenerateTeamInput,
  IPC_CHANNELS,
  ProjectDraft,
  SaveSettingsInput,
  WriteTeamInput,
} from '../shared/types';
import { PersistenceService } from '../services/persistence-service';
import { ProjectService } from '../services/project-service';
import { SettingsService } from '../services/settings-service';
import { LlmClient } from '../services/llm-client';
import { TeamGenerationService } from '../services/team-generation-service';
import { ProjectWriter } from '../services/project-writer';
import { logger } from '../services/logger';

const SERVICE = 'ipc-handlers';

export interface ServiceRegistry {
  persistence: PersistenceService;
  projectService: ProjectService;
  settingsService: SettingsService;
  llmClient: LlmClient;
  teamGenerationService: TeamGenerationService;
  projectWriter: ProjectWriter;
}

export function registerIpcHandlers(ipcMain: IpcMain, services: ServiceRegistry): void {
  const {
    persistence,
    projectService,
    settingsService,
    llmClient,
    teamGenerationService,
    projectWriter,
  } = services;

  ipcMain.handle(IPC_CHANNELS.LIST_PROJECTS, async () => {
    logger.debug(SERVICE, 'IPC: LIST_PROJECTS');
    return projectService.list();
  });

  ipcMain.handle(IPC_CHANNELS.CREATE_PROJECT, async (_event, projectName?: string) => {
    logger.info(SERVICE, 'IPC: CREATE_PROJECT', { projectName: projectName ?? '未命名项目' });
    return projectService.create(projectName);
  });

  ipcMain.handle(IPC_CHANNELS.GET_PROJECT, async (_event, id: string) => {
    logger.debug(SERVICE, 'IPC: GET_PROJECT', { id });
    return projectService.get(id);
  });

  ipcMain.handle(IPC_CHANNELS.SAVE_PROJECT, async (_event, draft: ProjectDraft) => {
    logger.info(SERVICE, 'IPC: SAVE_PROJECT', { id: draft.id });
    return projectService.save(draft);
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_PROJECT, async (_event, id: string) => {
    logger.info(SERVICE, 'IPC: DELETE_PROJECT', { id });
    return projectService.delete(id);
  });

  ipcMain.handle(IPC_CHANNELS.GENERATE_TEAM, async (_event, input: GenerateTeamInput) => {
    logger.info(SERVICE, 'IPC: GENERATE_TEAM', {
      requirementLength: input.requirement.length,
      useLlm: Boolean(input.useLlm),
    });
    return teamGenerationService.generate(input);
  });

  ipcMain.handle(IPC_CHANNELS.INSPECT_TARGET, async (_event, targetDirectory: string) => {
    logger.debug(SERVICE, 'IPC: INSPECT_TARGET', { targetDirectory });
    return projectWriter.inspectTarget(targetDirectory);
  });

  ipcMain.handle(IPC_CHANNELS.WRITE_TEAM, async (_event, input: WriteTeamInput) => {
    logger.info(SERVICE, 'IPC: WRITE_TEAM', {
      targetDirectory: input.targetDirectory,
      overwrite: Boolean(input.overwrite),
      agentCount: input.team.agents.length,
    });
    return projectWriter.writeToDirectory(
      input.team,
      input.targetDirectory,
      Boolean(input.overwrite)
    );
  });

  ipcMain.handle(IPC_CHANNELS.SELECT_DIRECTORY, async (event) => {
    const owner = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const result = owner
      ? await dialog.showOpenDialog(owner, {
          properties: ['openDirectory', 'createDirectory'],
          title: '选择目标项目目录',
        })
      : await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: '选择目标项目目录',
        });
    logger.info(SERVICE, 'IPC: SELECT_DIRECTORY', {
      canceled: result.canceled,
      selected: result.filePaths[0] ?? null,
    });
    return result.filePaths[0] ?? null;
  });

  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, async () => {
    logger.debug(SERVICE, 'IPC: GET_SETTINGS');
    return settingsService.getSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.SAVE_SETTINGS, async (_event, input: SaveSettingsInput) => {
    logger.info(SERVICE, 'IPC: SAVE_SETTINGS', {
      enabled: input.llm.enabled,
      baseUrl: input.llm.baseUrl,
      model: input.llm.model,
    });
    return settingsService.save(input);
  });

  ipcMain.handle(IPC_CHANNELS.TEST_LLM, async (_event, input: ConnectionTestInput) => {
    logger.info(SERVICE, 'IPC: TEST_LLM', { baseUrl: input.llm.baseUrl, model: input.llm.model });
    const storedApiKey = settingsService.getClientSettings().apiKey;
    return llmClient.testConnection({
      ...input.llm,
      apiKey: input.apiKey || storedApiKey,
    });
  });

  ipcMain.handle(IPC_CHANNELS.RESET_DATA, async () => {
    logger.warn(SERVICE, 'IPC: RESET_DATA -- resetting all application data');
    persistence.resetAll();
    settingsService.reset();
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.GET_STATUS, async () => {
    logger.debug(SERVICE, 'IPC: GET_STATUS');
    const projects = projectService.list();
    const settings = settingsService.getSnapshot();
    return {
      projectCount: projects.length,
      llmEnabled: settings.llm.enabled,
      hasApiKey: settings.hasApiKey,
      lastActivity: projects[0]?.updatedAt ?? '',
    };
  });

  logger.info(SERVICE, 'All IPC handlers registered', {
    channels: Object.values(IPC_CHANNELS).length,
  });
}
