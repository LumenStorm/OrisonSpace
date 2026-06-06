# Security Policy

Orison Space is a **local-first** desktop application: project files, model API
keys, and preferences are stored on the user's own machine, and there is no
backend server. Even so, we take security seriously — especially around API key
handling and the IPC / path-sandbox boundary.

## Supported versions

Orison Space is in **Alpha**. Security fixes are applied to the latest release
only.

| Version | Supported |
|---------|-----------|
| 0.1.x (latest) | ✅ |
| older | ❌ |

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, report privately via GitHub's
[private vulnerability reporting](https://github.com/LumenStorm/OrisonSpace/security/advisories/new)
(Security → Advisories → Report a vulnerability).

Please include:

- A description of the vulnerability and its impact
- Steps to reproduce (proof-of-concept if possible)
- Affected version / platform
- Any suggested remediation

We aim to acknowledge reports within a few days and will keep you updated on
remediation progress.

## Scope

Areas of particular interest:

- **API key handling** — keys are stored encrypted under `~/.orison/model/keys/`
  and decrypted only in the Electron main process; they must never reach the
  renderer or the agent library.
- **IPC surface** — the contracts in `@orison/shared-contracts` define the trust
  boundary between renderer and main.
- **Path sandbox** — file access is constrained to project directories; escapes
  are in scope.
- **Custom protocol** — the `orison-file://` handler serving local files.

## Out of scope

- Issues requiring physical access to an already-unlocked machine.
- Vulnerabilities in third-party model providers the user connects to.
- Social-engineering attacks against the user.
