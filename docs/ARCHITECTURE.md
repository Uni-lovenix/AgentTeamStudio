# Architecture -- Agent Team Studio

## System Overview

Agent Team Studio is an Electron desktop application built with TypeScript and React. It supports Windows and macOS. Users enter a project requirement description, generate and edit a multi-agent team, then export the team configuration into an existing project directory.

## Layer Diagram

```
+-----------------------------------------------------------+
|                     Renderer (React)                      |
|  Sidebar, RequirementEditor, TeamPreview, ExportPanel,    |
|  SettingsPanel, StatusBar                                 |
+-----------------------------------------------------------+
         |  window.agentTeamStudio.* (typed IPC bridge)
+-----------------------------------------------------------+
|                     Preload Script                         |
|  contextBridge.exposeInMainWorld ->                       |
|    projects, team, dialog, settings, app                   |
+-----------------------------------------------------------+
         |  ipcRenderer.invoke(IPC_CHANNELS.*)
+-----------------------------------------------------------+
|                     Main Process                           |
|  main.ts -> createWindow(), initializeServices()          |
|  ipc-handlers.ts -> registerIpcHandlers()                 |
+-----------------------------------------------------------+
         |  Service method calls
+-----------------------------------------------------------+
|                     Services Layer                         |
|  ProjectService | RequirementAnalyzer | LlmClient         |
|  TeamGenerationService | ProjectWriter | HarnessTemplates | SettingsService  |
|  TeamConfigValidator | ProcessManagement | PersistenceService | Logger |
+-----------------------------------------------------------+
```

## Electron Layers

### Main Process

- Creates a secure `BrowserWindow` with `contextIsolation: true` and `nodeIntegration: false`.
- Registers all IPC channels from `src/shared/types.ts`.
- Opens native directory selection dialogs.
- Uses Electron `safeStorage` to encrypt saved API keys.

### Preload

Preload is bundled into a single CommonJS file with esbuild because Electron's sandboxed preload cannot require project modules such as `../shared/types` at runtime.

Exposes `window.agentTeamStudio` with these namespaces:

```typescript
window.agentTeamStudio = {
  projects: { list, create, get, save, delete },
  team:     { generate, inspect, validate, write },
  dialog:   { selectDirectory },
  settings: { get, save, test },
  app:      { reset, status },
}
```

### Renderer

React 18 application bundled by Vite:

- `Sidebar` -- local project draft list, create/delete, settings entry.
- `RequirementEditor` -- project name, requirement text, tech stack hints, generation controls.
- `GenerationLog` -- renders the decision log explaining why each responsibility area and role was generated.
- `TeamPreview` -- editable agent roles, workflow, RUP process management, and engineering conventions.
- `ProcessManagementEditor` -- editable RUP phases, milestones, iterations, and exit criteria.
- `ExportPanel` -- select target directory and write generated files.
- `SettingsPanel` -- optional LLM provider settings and connection test.
- `StatusBar` -- project count, LLM status, key status, last activity.

## Data Flow

### Local Team Generation

1. User enters requirement and clicks Generate.
2. Renderer calls `window.agentTeamStudio.team.generate`.
3. `TeamGenerationService` validates the requirement and calls `buildTeamConfig`.
4. `RequirementAnalyzer` scans the requirement and tech hints to identify responsibility areas that must be completed.
5. Planner and Evaluator roles are always added with stable `kind` semantics. Each responsibility area becomes a Developer role with a mission, concrete responsibilities, skills, tools, and deliverables.
6. `ProcessManagement` builds RUP phases and iterations. The workflow starts with project start and iteration protocol creation by Planner, proceeds through developer implementation, evaluation/feedback, iteration review, phase acceptance, and transition acceptance.
7. The generated `TeamConfig` includes a `generationLog` that records the decision steps.
8. Renderer saves the result as a local `ProjectDraft` and renders the log in `GenerationLog`.

### Optional LLM Generation

1. User enables LLM and configures Base URL, model, protocol, and API key.
2. `SettingsService` stores the API key encrypted with Electron `safeStorage`.
3. `LlmClient` calls OpenAI-compatible `/chat/completions` or Anthropic-compatible `/v1/messages` from the main process with a 60-second request timeout.
4. `normalizeTeamConfig` validates the returned JSON and applies fallback defaults.
5. `TeamConfigValidator` repairs required role kinds, IDs, workflow owners, and RUP references.
6. On failure or invalid repaired output, `TeamGenerationService` falls back to requirement-driven local generation and returns a warning.

### Export Flow

1. User selects an existing project directory with a native dialog.
2. Renderer calls `team.inspect` to check existing `AGENTS.team.md`, `agents.json`, `agents/`, and whether `AGENTS.md` or `CLAUDE.md` exists.
3. User confirms overwrite when `AGENTS.team.md` or `agents.json` already exist.
4. Renderer calls `team.validate` to repair the team and block unfixable validation errors before prompting overwrite.
5. Renderer calls `team.write`.
6. `ProjectWriter` writes `AGENTS.team.md` as the team-level router, `agents.json`, and one Markdown file per agent under `agents/` atomically with temp-file rename.
7. `ProjectWriter` uses `HarnessTemplates` to initialize missing `AGENTS.md`, `CLAUDE.md`, `feature_list.json`, `progress.md`, `session-handoff.md`, `quality-document.md`, `evaluator-rubric.md`, `clean-state-checklist.md`, `init.sh`, and `docs/PROCESS.md`; missing rule files are rendered as maps.
8. For each existing rule file (`AGENTS.md`, `CLAUDE.md`), it appends only a pointer to `AGENTS.team.md` without overwriting existing rules.
9. `TeamConfigValidator` validates the generated harness on disk, including `progress.md` content markers and transition feature references; result is persisted on the local draft and shown in the status bar.

## IPC Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `projects:list` | R -> M | List local project drafts |
| `projects:create` | R -> M | Create a blank draft |
| `projects:get` | R -> M | Get one draft |
| `projects:save` | R -> M | Save/update a draft |
| `projects:delete` | R -> M | Delete a draft |
| `team:generate` | R -> M | Generate team config |
| `team:inspect` | R -> M | Inspect target directory files |
| `team:validate` | R -> M | Repair and validate a team before export |
| `team:write` | R -> M | Write `AGENTS.team.md`, `agents.json`, `agents/*.md`, and missing core RUP harness/scoring files; append only a pointer to existing `AGENTS.md` / `CLAUDE.md` |
| `dialog:select-directory` | R -> M | Open native directory picker |
| `settings:get` | R -> M | Get LLM settings snapshot |
| `settings:save` | R -> M | Save LLM settings |
| `settings:test` | R -> M | Test LLM connection |
| `app:reset` | R -> M | Reset local app data |
| `app:status` | R -> M | Get status bar data |

## Data Storage

Local app data lives in `app.getPath('userData')/agent-team-studio-data/`:

```
projects.json    # local project drafts
settings.json    # LLM settings and encrypted API key material
```

Exported project data:

```
AGENTS.team.md    # team-level rules and agent routing index
agents.json       # schema version 3 machine-readable team config
agents/           # one Markdown file per agent
AGENTS.md         # initialized Codex rule/agent map; existing files only receive pointer
CLAUDE.md         # initialized Claude rule/agent map; existing files only receive pointer
feature_list.json # RUP feature state tracker
progress.md       # session progress and next action
session-handoff.md# cross-session handoff
quality-document.md # fillable quality scorecard
evaluator-rubric.md # fillable iteration review rubric
clean-state-checklist.md # fillable clean-state checklist
init.sh           # standard startup and verification path
docs/PROCESS.md   # RUP phases, milestones, and iteration protocol
```

## Automated Verification

- `test/renderer-smoke.test.tsx` uses jsdom and Testing Library to cover the renderer critical path: creating a draft, generating a team, editing roles, adding a custom role, selecting a target directory, validating, and writing the exported harness.
- `test/ipc-channels.test.ts` keeps the IPC channel count locked to the documented 15 channels.
- Main process smoke mode (`AGENT_TEAM_STUDIO_SMOKE=1`) uses an isolated `userData` directory and verifies window load, all IPC registrations, local generation, export, and on-disk harness validation.
- `.github/workflows/windows-smoke.yml` builds and installs the Windows package, then `scripts/windows-smoke.ps1` launches the installed app in smoke mode.
