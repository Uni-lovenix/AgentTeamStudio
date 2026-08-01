# Product Description -- Agent Team Studio

## What Is This?

A cross-platform desktop application for Windows and macOS. Users paste a project requirement description, the app generates a multi-agent team configuration, and the user can edit the team before writing `AGENTS.md` and `agents.json` into an existing project directory.

## Core Features

### Project Drafts
- Create, save, switch, and delete local requirement drafts.
- Drafts persist across application restarts.
- Deleting a draft does not modify target project directories.

### Requirement Analysis
- Accept Chinese or English requirement text.
- Support optional tech stack hints.
- Validate that requirement text is at least 10 characters.
- Detect project types including web, backend, mobile, desktop, AI/data, and CLI.

### Local Team Generation
- Generate a default team from keywords and templates.
- Base team includes product, architecture, development, QA, and documentation roles.
- Add backend, frontend/client, and AI/data roles based on detected stack.
- Generate a collaboration workflow and engineering conventions.

### Optional LLM Generation
- OpenAI-compatible Base URL and model configuration.
- API key stored locally with Electron `safeStorage`.
- LLM output is schema-normalized before display.
- LLM failure falls back to local generation with a visible warning.

### Team Preview and Editing
- Rename and remove roles.
- Edit mission, responsibilities, skills, tools, deliverables, dependencies, and notifications.
- Add custom roles.
- Edit workflow step names, descriptions, and owners.
- Edit branch, commit, PR, testing, and documentation conventions.

### Export to Project Directory
- Select an existing project directory with a native dialog.
- Inspect whether `AGENTS.md` or `agents.json` already exist.
- Require user confirmation before overwriting.
- Write both files atomically.

### Settings and Status
- Enable or disable LLM generation.
- Test provider connection.
- Status bar shows project count, LLM state, key state, and recent activity.

## User Interface

The first screen is the working tool: left sidebar for project drafts, center area for requirement input and editable team preview, right rail for export, and a bottom status bar. The UI is in Chinese.

## Constraints

- First version exports team configuration only; it does not execute agents.
- Export target must be an existing project directory.
- No new project scaffolding in this version.
- No network requests except optional LLM calls.
- Generated files are only `AGENTS.md` and `agents.json`.
