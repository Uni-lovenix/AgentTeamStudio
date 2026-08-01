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
- Extract goals, users, core business processes, constraints, and the responsibility areas needed to complete the requirement.

### Local Team Generation
- Generate roles from the requirement instead of splitting the work by frontend, backend, or other implementation functions.
- Always include requirement acceptance, delivery coordination, and documentation/handoff responsibilities.
- Add requirement-specific roles such as account/permissions, transaction/payment, content/review, messaging, data/reporting, AI/agent, security/compliance, performance, integration/migration, and other responsibility areas when the requirement mentions them.
- Every role gets a mission, concrete responsibilities, skills, tools, deliverables, dependencies, and notifications derived from the requirement.
- Generate a collaboration workflow and engineering conventions.

### Optional LLM Generation
- OpenAI-compatible or Anthropic-compatible Base URL, protocol, and model configuration.
- MiniMax Anthropic-compatible endpoints are supported with protocol set to `anthropic`.
- API key stored locally with Electron `safeStorage`.
- LLM output is schema-normalized before display.
- The LLM prompt requires responsibility-driven roles with concrete responsibilities and explicitly discourages frontend/backend function-split roles.
- LLM failure falls back to requirement-driven local generation with a visible warning.

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
- Choose OpenAI or Anthropic compatible protocol.
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
