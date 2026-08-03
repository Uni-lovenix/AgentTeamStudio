import type {
  AppStatus,
  ConnectionTestInput,
  ConnectionTestResult,
  GenerateTeamInput,
  GenerateTeamResult,
  ProjectDraft,
  SaveSettingsInput,
  SettingsSnapshot,
  TargetInspection,
  ValidateTeamResult,
  WriteTeamInput,
  WriteTeamResult,
} from '../shared/types';

declare global {
  interface Window {
    agentTeamStudio: {
      projects: {
        list: () => Promise<ProjectDraft[]>;
        create: (projectName?: string) => Promise<ProjectDraft>;
        get: (id: string) => Promise<ProjectDraft | null>;
        save: (draft: ProjectDraft) => Promise<ProjectDraft>;
        delete: (id: string) => Promise<boolean>;
      };
      team: {
        generate: (input: GenerateTeamInput) => Promise<GenerateTeamResult>;
        inspect: (targetDirectory: string) => Promise<TargetInspection>;
        validate: (team: TeamConfig) => Promise<ValidateTeamResult>;
        write: (input: WriteTeamInput) => Promise<WriteTeamResult>;
      };
      dialog: {
        selectDirectory: () => Promise<string | null>;
      };
      settings: {
        get: () => Promise<SettingsSnapshot>;
        save: (input: SaveSettingsInput) => Promise<SettingsSnapshot>;
        test: (input: ConnectionTestInput) => Promise<ConnectionTestResult>;
      };
      app: {
        reset: () => Promise<{ success: boolean }>;
        status: () => Promise<AppStatus>;
      };
    };
  }
}

export {};
