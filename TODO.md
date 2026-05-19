# TODO

This file tracks cleanup items found during the apps-focused drift, dependency, and documentation review. Items marked done are kept here so future reviews can see why the repository moved to the current dependency shape.

## Done In This Cleanup

- Standardized local installs on pnpm workspace and restored `pnpm-lock.yaml` as the single committed lockfile.
- Removed stale npm lockfiles from the root and app directories.
- Ignored future npm lockfile drift via `.gitignore`.
- Removed committed `apps/agent/test-tmp-*` runtime artifacts and ignored future generated test temp directories.
- Removed unused direct dependencies: `pino-roll` from server/shell, `@swc/core` from desktop shell, and `@orison/model-protocols` from desktop-ui.
- Kept native build-script allowance centralized in root `package.json` under `pnpm.onlyBuiltDependencies`.
- Updated stale server tests to import the current agent proxy module path.
- Updated the agent env test to import the current `src/env` path.
- Narrowed the default agent test script to currently valid runtime, route, persistence, context, env, and skill tests.
- Added a README section documenting dependency, lockfile, native dependency, and `node_modules` expectations.

## Remaining Drift And Cleanup

- Revisit old `apps/agent/src/engine` and `apps/agent/src/nodes` test coverage. Either migrate those scenarios to the current runtime/skill architecture or archive them explicitly outside the default test entry.
- Audit `plan.md` before using it for implementation work. It is historical and contains stale migration notes, so current guidance should come from `README.md`, `docs/`, and live `apps/` source first.
- Fix the agent test entry so it is cross-platform. The current `routes.*` / `runtime.*` / `skill.*` arguments are not expanded by PowerShell, so the default Windows run only executes exact file paths.
- Investigate the newly exposed agent runtime/skill tests after the remote `test` branch updates. Explicitly running the active routes/runtime/skill set currently surfaces failures in skill invocation, runtime workflow artifact/reference expectations, runtime config defaults, and workflow executor reference handling.
- Decide whether desktop dependencies should stay in the default full install. Electron is the largest fixed dependency cost; meaningful install-size reduction requires a filtered install profile or a clearer desktop/non-desktop install split.
- Keep dependency ownership local to the package that imports it. Do not add app-level dependencies only for transient scripts or tests.
- Periodically run dependency drift checks after large feature merges, especially when `apps/desktop/*` or `apps/agent` add new build tooling.

## Node Modules Notes

- A clean pnpm install reduced the local root `node_modules` footprint from roughly 1.56 GB to roughly 560 MB.
- Electron accounts for roughly 318 MB of the clean install and is expected while the desktop shell is installed.
- Cross-platform package duplication was removed by reinstalling from a single pnpm lockfile rather than maintaining mixed npm and pnpm installs.
