# Product Description -- Agent Team Studio

## What Is This?

A cross-platform desktop application for Windows and macOS. Users paste a project requirement description, the app generates a multi-agent team configuration, and the user can edit the team before writing `AGENTS.team.md`, `agents.json`, a core RUP harness, and fillable scoring templates into an existing project directory.

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
- Planner decomposes tasks, designs the solution, coordinates the process, and creates an iteration protocol before every iteration.
- Evaluator checks developer results against the iteration protocol and phase exit criteria, then sends issues back to the responsible developer for changes.
- Developer roles are generated from requirement-specific responsibility areas such as account/permissions, transaction/payment, content/review, messaging, data/reporting, AI/agent, security/compliance, performance, integration/migration, and other areas when the requirement mentions them; there can be multiple developers.
- Also include documentation/handoff responsibilities.
- Every role gets a mission, concrete responsibilities, skills, tools, deliverables, dependencies, and notifications derived from the requirement.
- Every role has a stable `kind` semantic field (`planner`, `evaluator`, `developer`, `documentation`, or `custom`), so renaming a role does not lose its planning/evaluation/development identity.
- Generate RUP process management with Inception, Elaboration, Construction, and Transition phases, phase milestones, and iterations.
- Generate a collaboration workflow that starts with project start and iteration protocol, then development, evaluation and feedback, iteration review, phase acceptance, transition acceptance, and engineering conventions.

### Optional LLM Generation
- OpenAI-compatible or Anthropic-compatible Base URL, protocol, and model configuration.
- MiniMax Anthropic-compatible endpoints are supported with protocol set to `anthropic`.
- API key stored locally with Electron `safeStorage`.
- LLM output is schema-normalized before display, and mandatory Planner/Evaluator/Developer roles are reinserted by `kind` if missing.
- The LLM prompt requires responsibility-driven developer roles, explicitly discourages frontend/backend function-split roles, and mandates the RUP phase/iteration workflow.
- LLM requests use a 60-second timeout; failure, timeout, or invalid output falls back to requirement-driven local generation with a visible warning.

### Team Preview and Editing
- Rename and remove roles.
- Edit a role's semantic `kind` so custom roles can be marked as planner, evaluator, developer, documentation, or custom.
- Edit mission, responsibilities, skills, tools, deliverables, dependencies, and notifications.
- Add custom roles.
- Edit workflow step names, descriptions, and owners.
- Edit RUP phase goals, deliverables, milestones, exit criteria, iteration scope/plans/status, and owner roles.
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
- Before writing, validate and auto-repair required role kinds, unique IDs, workflow owners, RUP phase/iteration references, and missing roles; block export when unfixable validation errors remain.
- Always initialize missing core harness and scoring files: `AGENTS.md`, `CLAUDE.md`, `feature_list.json`, `progress.md`, `session-handoff.md`, `quality-document.md`, `evaluator-rubric.md`, `clean-state-checklist.md`, `init.sh`, and `docs/PROCESS.md`.
- Missing `AGENTS.md` and `CLAUDE.md` are initialized as compact rule maps and agent maps, not operating manuals; role details remain in `agents/*.md` and are loaded only for the current role.
- If `AGENTS.md` or `CLAUDE.md` already exists, append only a pointer to `AGENTS.team.md` while preserving the existing rules.
- Existing harness files are never overwritten; `feature_list.json`, `progress.md`, `session-handoff.md`, `quality-document.md`, `evaluator-rubric.md`, `clean-state-checklist.md`, `init.sh`, and `docs/PROCESS.md` are skipped when already present.
- `quality-document.md` starts as a pending A/B/C/D scorecard with verification commands, Evidence of Quality, and Verified Against; `evaluator-rubric.md` starts as a pending 1-5 review table with Overall score and Accept/Revise/Block conclusion; `clean-state-checklist.md` starts as a fillable clean-state checklist.
- The generated `feature_list.json` starts with a passing `harness-bootstrap` entry, one not-started entry per construction iteration, and a transition/handoff entry.
- Exported harness validation checks `progress.md` content markers and verifies that the transition/handoff feature entry references the actual transition iteration from `processManagement`.

### Settings and Status
- Enable or disable LLM generation.
- Choose OpenAI or Anthropic compatible protocol.
- Test provider connection.
- Status bar shows project count, LLM state, key state, and recent activity.

## User Interface

The first screen is the working tool: left sidebar for project drafts, center area for requirement input, generation log and editable team preview, right rail for export, and a bottom status bar. The UI is in Chinese.

## Constraints

- First version exports team configuration, core RUP harness, and scoring template files; it does not execute agents.
- Export target must be an existing project directory.
- No new source-code project scaffolding is generated; only harness and team files are initialized.
- No network requests except optional LLM calls.
- Generated files are `AGENTS.team.md`, `agents.json`, `agents/*.md`, the core harness files listed above, `quality-document.md`, `evaluator-rubric.md`, and `clean-state-checklist.md`.
- Generated teams must contain Planner, Evaluator, and one or more Developer roles, with RUP process management and iteration protocol, development, evaluation, and feedback workflow steps.
- Generated `agents.json` uses schema v3 and every role must carry a valid `kind`.
- No separate RUP roles such as architect, tester, deployment engineer, or project manager are generated; the Planner, Evaluator, Developer, and documentation handoff roles carry the process responsibilities.
- Generated `processManagement` must include the four RUP phases and at least one iteration per phase.
- Existing `AGENTS.md` and `CLAUDE.md` are never overwritten; each existing rule file only receives an appended pointer to `AGENTS.team.md`. Missing rule files are initialized as maps.
