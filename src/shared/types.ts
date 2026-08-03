/** Cross-boundary type definitions shared between main, preload, and renderer. */

export type GenerationSource = 'local' | 'llm';
export type LlmProtocol = 'openai' | 'anthropic';
export type ProcessPhaseId = 'inception' | 'elaboration' | 'construction' | 'transition';
export type IterationStatus = 'planned' | 'active' | 'completed' | 'blocked';

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  ownerRoleId: string;
}

export interface AgentRole {
  id: string;
  name: string;
  mission: string;
  responsibilities: string[];
  skills: string[];
  tools: string[];
  deliverables: string[];
  dependsOn: string[];
  notifies: string[];
}

export interface EngineeringConventions {
  branch: string;
  commits: string;
  pullRequests: string;
  testing: string;
  documentation: string;
}

export interface RupIteration {
  id: string;
  phaseId: ProcessPhaseId;
  name: string;
  objective: string;
  scope: string[];
  plan: string[];
  exitCriteria: string[];
  deliverables: string[];
  ownerRoleId: string;
  feedbackTargetRoleId: string;
  status: IterationStatus;
}

export interface RupPhase {
  id: ProcessPhaseId;
  name: string;
  purpose: string;
  goals: string[];
  deliverables: string[];
  milestone: string;
  exitCriteria: string[];
  ownerRoleId: string;
  iterationIds: string[];
}

export interface ProcessManagement {
  framework: 'rup';
  currentPhaseId: ProcessPhaseId;
  phases: RupPhase[];
  iterations: RupIteration[];
  rules: string[];
}

export interface GenerationLogEntry {
  step: string;
  detail: string;
  evidence?: string;
  role?: string;
  outcome?: string;
}

export interface TeamConfig {
  schemaVersion: 2;
  projectName: string;
  requirement: string;
  techStackHints: string[];
  generatedBy: GenerationSource;
  createdAt: string;
  workflow: WorkflowStep[];
  agents: AgentRole[];
  processManagement: ProcessManagement;
  conventions: EngineeringConventions;
  generationLog?: GenerationLogEntry[];
}

export interface ProjectDraft {
  id: string;
  projectName: string;
  requirement: string;
  techStackHints: string;
  team: TeamConfig | null;
  targetPath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateTeamInput {
  projectName?: string;
  requirement: string;
  techStackHints?: string;
  useLlm?: boolean;
}

export interface GenerateTeamResult {
  team: TeamConfig;
  warnings: string[];
  llmAttempted: boolean;
}

export interface WriteTeamInput {
  team: TeamConfig;
  targetDirectory: string;
  overwrite: boolean;
}

export interface WriteTeamResult {
  targetDirectory: string;
  createdFiles: string[];
  overwrittenFiles: string[];
  appendedFiles: string[];
}

export interface TargetInspection {
  directoryExists: boolean;
  existingFiles: string[];
  existingRuleFiles: string[];
}

export interface LlmSettings {
  enabled: boolean;
  baseUrl: string;
  model: string;
  protocol: LlmProtocol;
}

export interface SettingsSnapshot {
  llm: LlmSettings;
  hasApiKey: boolean;
}

export interface SaveSettingsInput {
  llm: LlmSettings;
  apiKey?: string;
  clearApiKey?: boolean;
}

export interface ConnectionTestInput {
  llm: LlmSettings;
  apiKey?: string;
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
  latencyMs: number;
}

export interface AppStatus {
  projectCount: number;
  llmEnabled: boolean;
  hasApiKey: boolean;
  lastActivity: string;
}

/** IPC channel names -- single source of truth. */
export const IPC_CHANNELS = {
  LIST_PROJECTS: 'projects:list',
  CREATE_PROJECT: 'projects:create',
  GET_PROJECT: 'projects:get',
  SAVE_PROJECT: 'projects:save',
  DELETE_PROJECT: 'projects:delete',
  GENERATE_TEAM: 'team:generate',
  INSPECT_TARGET: 'team:inspect',
  WRITE_TEAM: 'team:write',
  SELECT_DIRECTORY: 'dialog:select-directory',
  GET_SETTINGS: 'settings:get',
  SAVE_SETTINGS: 'settings:save',
  TEST_LLM: 'settings:test',
  RESET_DATA: 'app:reset',
  GET_STATUS: 'app:status',
} as const;
