# CLAUDE.md -- Agent Team Studio Quick Reference

## Project

Cross-platform Electron desktop app that turns a project requirement description into an editable multi-agent team configuration and writes it to an existing project directory as `AGENTS.md` plus `agents.json`.

## Commands

```bash
bash init.sh            # install, check, test, build, verify harness
npm run dev             # build and launch Electron
npm run check           # strict TypeScript checks
npm test                # Vitest unit tests
npm run build           # compile main/preload/renderer
npm run dist:mac        # package macOS
npm run dist:win        # package Windows
bash scripts/benchmark.sh
bash scripts/cleanup-scanner.sh
```

## Architecture

Renderer React -> `window.agentTeamStudio` -> preload -> IPC -> main handlers -> services -> filesystem.

All IPC channels and shared types live in `src/shared/types.ts`. Do not create a second channel source of truth.

## Services

- `ProjectService`: local project draft CRUD.
- `RequirementAnalyzer`: local keyword-based team generation.
- `LlmClient`: optional OpenAI-compatible `/chat/completions` client.
- `TeamGenerationService`: local/LLM generation with validation and fallback.
- `ProjectWriter`: atomic export of `AGENTS.md` and `agents.json`.
- `SettingsService`: LLM settings with encrypted API key storage.
- `PersistenceService`: JSON persistence under Electron `userData`.

## Output Files

- `AGENTS.md`: human/agent-readable team, workflow, and engineering conventions.
- `agents.json`: schema version 1 machine-readable team config.

## Boundaries

- Renderer must not import Node.js modules.
- Filesystem and dialogs stay in main process.
- API keys never enter renderer or target project directories.
- Reset clears local app data only; it never deletes target project files.
