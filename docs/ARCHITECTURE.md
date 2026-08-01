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
|  TeamGenerationService | ProjectWriter | SettingsService  |
|  PersistenceService | Logger                               |
+-----------------------------------------------------------+
```

## Electron Layers

### Main Process

- Creates a secure `BrowserWindow` with `contextIsolation: true` and `nodeIntegration: false`.
- Registers all IPC channels from `src/shared/types.ts`.
- Opens native directory selection dialogs.
- Uses Electron `safeStorage` to encrypt saved API keys.

### Preload

Exposes `window.agentTeamStudio` with these namespaces:

```typescript
window.agentTeamStudio = {
  projects: { list, create, get, save, delete },
  team:     { generate, inspect, write },
  dialog:   { selectDirectory },
  settings: { get, save, test },
  app:      { reset, status },
}
```

### Renderer

React 18 application bundled by Vite:

- `Sidebar` -- local project draft list, create/delete, settings entry.
- `RequirementEditor` -- project name, requirement text, tech stack hints, generation controls.
- `TeamPreview` -- editable agent roles, workflow, and engineering conventions.
- `ExportPanel` -- select target directory and write generated files.
- `SettingsPanel` -- optional LLM provider settings and connection test.
- `StatusBar` -- project count, LLM status, key status, last activity.

## Data Flow

### Local Team Generation

1. User enters requirement and clicks Generate.
2. Renderer calls `window.agentTeamStudio.team.generate`.
3. `TeamGenerationService` validates the requirement and calls `buildTeamConfig`.
4. `RequirementAnalyzer` detects project type and stack keywords.
5. It returns roles, workflow, and conventions.
6. Renderer saves the result as a local `ProjectDraft`.

### Optional LLM Generation

1. User enables LLM and configures Base URL, model, and API key.
2. `SettingsService` stores the API key encrypted with Electron `safeStorage`.
3. `LlmClient` calls `/chat/completions` from the main process.
4. `normalizeTeamConfig` validates the returned JSON and applies fallback defaults.
5. On failure, `TeamGenerationService` falls back to local generation and returns a warning.

### Export Flow

1. User selects an existing project directory with a native dialog.
2. Renderer calls `team.inspect` to list existing `AGENTS.md` and `agents.json`.
3. User confirms overwrite when needed.
4. Renderer calls `team.write`.
5. `ProjectWriter` writes both files atomically with temp-file rename.
6. Result is persisted on the local draft and shown in the status bar.

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
| `team:write` | R -> M | Write `AGENTS.md` and `agents.json` |
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
AGENTS.md        # generated multi-agent instructions
agents.json      # schema version 1 machine-readable team config
```
