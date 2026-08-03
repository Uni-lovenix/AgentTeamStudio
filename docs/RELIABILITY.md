# Reliability -- Observability, Secrets, Clean State, Benchmarking

## Structured Logging

All services emit single-line JSON log entries:

```json
{
  "timestamp": "2026-08-01T03:00:00.000Z",
  "level": "INFO",
  "service": "team-generation-service",
  "message": "Team generated",
  "data": { "source": "local", "agentCount": 5, "llmAttempted": false }
}
```

Levels:

- DEBUG: routine data access, file reads, settings reads.
- INFO: generation, save, export, reset, settings changes.
- WARN: LLM failure fallback, missing non-critical data.
- ERROR: failures, parse errors, export errors.

Set `LOG_LEVEL=DEBUG|INFO|WARN|ERROR` to control output. Default is DEBUG.

## LLM API Key Handling

- API keys never return to the renderer.
- Settings snapshots expose only `hasApiKey`.
- Keys are encrypted with Electron `safeStorage` on supported systems.
- Keys are never written into target project directories.
- If encryption is unavailable, saving an API key fails with a clear error.
- LLM connection tests return structured failure results for missing keys, HTTP errors, and network failures so the renderer can display the reason.
- LLM generation and connection requests use a 60-second timeout that also covers response parsing; timeout failures are returned as structured errors and trigger the normal local fallback path.

## Clean State Reset

The in-app Reset button and `app:reset` IPC:

- Clear local project drafts and settings.
- Recreate the local app data directory.
- Never delete or modify files inside user-selected project directories.

## Cleanup Scanner

`bash scripts/cleanup-scanner.sh` checks:

- Required harness files and docs exist.
- No stale `.tmp` or `.bak` files in source, test, or script directories.
- Detects an unbundled sandbox preload and missing service/shared build outputs when `dist/` exists.
- Reports missing build or harness artifacts.

## Renderer and Windows Smoke

- `test/renderer-smoke.test.tsx` runs in jsdom with Testing Library and exercises the renderer critical path: draft creation, team generation, role editing, custom role addition, target selection, validation, and export.
- `test/ipc-channels.test.ts` enforces the documented 15 IPC channel count.
- `AGENT_TEAM_STUDIO_SMOKE=1` switches the Electron main process into an isolated smoke mode that verifies window load, IPC registration, local generation, export, and harness validation.
- `.github/workflows/windows-smoke.yml` and `scripts/windows-smoke.ps1` build, install, launch, and verify the packaged Windows application. The workflow must be executed on a Windows runner before Windows smoke evidence is recorded as passed.

## Benchmarking

`bash scripts/benchmark.sh` runs the production build and then measures:

- Local requirement analysis for 5 requirements across 5 runs.
- Atomic project export for 10 writes.
- Generated team validation.

Targets:

- Average analysis: under 500ms.
- Average export: under 100ms.
- Generated agent count: at least 3.
- Generated team contains Planner, Evaluator, and at least one Developer role.
- Generated team is schema v3 and every role has a valid `kind`.
- Generated team contains RUP process management with four phases.
- Generated workflow contains a project-start step, iteration-protocol step, and an evaluation/feedback step.
- Generated harness passes on-disk validation, including `agents.json`, role files, rule maps, `progress.md` content markers, `quality-document.md`, `evaluator-rubric.md`, `clean-state-checklist.md`, and `init.sh`.

## Cross-Platform Packaging

`electron-builder.yml` defines macOS DMG and Windows NSIS targets.
`dist/` is a local build-output directory and is not tracked by Git; release packages are regenerated with `npm run dist:mac` and `npm run dist:win`.

- Run `npm run dist:mac` on macOS.
- Run `npm run dist:win` on Windows or a compatible CI environment.
- Actual Windows smoke testing requires a Windows environment or CI runner.
