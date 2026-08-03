import { contextBridge, ipcRenderer } from 'electron';
import {
  ConnectionTestInput,
  GenerateTeamInput,
  IPC_CHANNELS,
  ProjectDraft,
  SaveSettingsInput,
  TeamConfig,
  ValidateTeamResult,
  WriteTeamInput,
} from '../shared/types';

const api = {
  projects: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.LIST_PROJECTS),
    create: (projectName?: string) => ipcRenderer.invoke(IPC_CHANNELS.CREATE_PROJECT, projectName),
    get: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.GET_PROJECT, id),
    save: (draft: ProjectDraft) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_PROJECT, draft),
    delete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_PROJECT, id),
  },
  team: {
    generate: (input: GenerateTeamInput) => ipcRenderer.invoke(IPC_CHANNELS.GENERATE_TEAM, input),
    inspect: (targetDirectory: string) => ipcRenderer.invoke(IPC_CHANNELS.INSPECT_TARGET, targetDirectory),
    validate: (team: TeamConfig) =>
      ipcRenderer.invoke(IPC_CHANNELS.VALIDATE_TEAM, team) as Promise<ValidateTeamResult>,
    write: (input: WriteTeamInput) => ipcRenderer.invoke(IPC_CHANNELS.WRITE_TEAM, input),
  },
  dialog: {
    selectDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.SELECT_DIRECTORY),
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),
    save: (input: SaveSettingsInput) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_SETTINGS, input),
    test: (input: ConnectionTestInput) => ipcRenderer.invoke(IPC_CHANNELS.TEST_LLM, input),
  },
  app: {
    reset: () => ipcRenderer.invoke(IPC_CHANNELS.RESET_DATA),
    status: () => ipcRenderer.invoke(IPC_CHANNELS.GET_STATUS),
  },
};

contextBridge.exposeInMainWorld('agentTeamStudio', api);
