# Product Description -- Agent Team Studio

## What Is This?

A cross-platform desktop application for Windows and macOS. Users paste a project requirement description, the app generates a multi-agent team configuration, and the user can edit the team before writing `AGENTS.team.md` and `agents.json` into an existing project directory.

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
- Always include a Planner (`规划者`), Evaluator (`评估者`), and at least one Developer (`开发者`) role.
- Planner decomposes tasks, designs the solution, coordinates the process, and creates a sprint protocol before every task.
- Evaluator checks developer results against the sprint protocol and sends issues back to the responsible developer for changes.
- Developer roles are generated from requirement-specific responsibility areas such as account/permissions, transaction/payment, content/review, messaging, data/reporting, AI/agent, security/compliance, performance, integration/migration, and other areas when the requirement mentions them; there can be multiple developers.
- Also include documentation/handoff responsibilities.
- Every role gets a mission, concrete responsibilities, skills, tools, deliverables, dependencies, and notifications derived from the requirement.
- Generate a collaboration workflow that starts with a sprint protocol, then development, then evaluation and feedback, and engineering conventions.

### Optional LLM Generation
- OpenAI-compatible or Anthropic-compatible Base URL, protocol, and model configuration.
- MiniMax Anthropic-compatible endpoints are supported with protocol set to `anthropic`.
- API key stored locally with Electron `safeStorage`.
- LLM output is schema-normalized before display, and mandatory Planner/Evaluator/Developer roles are reinserted if missing.
- The LLM prompt requires responsibility-driven developer roles, explicitly discourages frontend/backend function-split roles, and mandates the sprint-protocol workflow.
- LLM failure falls back to requirement-driven local generation with a visible warning.

### Team Preview and Editing
- Rename and remove roles.
- Edit mission, responsibilities, skills, tools, deliverables, dependencies, and notifications.
- Add custom roles.
- Edit workflow step names, descriptions, and owners.
- Edit branch, commit, PR, testing, and documentation conventions.

### Generation Log
- Show the concrete generation chain: which requirement signal was detected, which role was created, and what that role is responsible for.
- Record requirement input, responsibility-area detection, role creation, LLM fallback, and workflow decisions.
- Persist the decision log with the project draft and include it in the machine-readable team config.

### Export to Project Directory
- Select an existing project directory with a native dialog.
- Inspect whether `AGENTS.team.md` or `agents.json` already exist.
- Inspect whether the `agents/` directory already exists.
- Require user confirmation before overwriting generated team files.
- Write `AGENTS.team.md` as the team-level router, `agents.json`, and one Markdown file per agent under `agents/` atomically.
- Role details live only in `agents/*.md`; `AGENTS.team.md` routes each agent to its own file instead of duplicating them.
- If `AGENTS.md` or `CLAUDE.md` exists, append a pointer to `AGENTS.team.md` plus the sprint-protocol collaboration flow while preserving the existing rules.

### Settings and Status
- Enable or disable LLM generation.
- Choose OpenAI or Anthropic compatible protocol.
- Test provider connection.
- Status bar shows project count, LLM state, key state, and recent activity.

## User Interface

The first screen is the working tool: left sidebar for project drafts, center area for requirement input, generation log and editable team preview, right rail for export, and a bottom status bar. The UI is in Chinese.

## Constraints

- First version exports team configuration only; it does not execute agents.
- Export target must be an existing project directory.
- No new project scaffolding in this version.
- No network requests except optional LLM calls.
- Generated files are `AGENTS.team.md`, `agents.json`, and `agents/*.md` for each agent.
- Generated teams must contain Planner, Evaluator, and one or more Developer roles, with sprint protocol, development, evaluation, and feedback workflow steps.
- Existing `AGENTS.md` and `CLAUDE.md` are never overwritten; each existing rule file only receives an appended pointer plus the sprint-protocol collaboration flow.
