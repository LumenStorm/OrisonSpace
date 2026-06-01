# Windows Installer Packaging

Orison Space uses `electron-builder` to produce a Windows NSIS installer.

## Build Commands

From the repository root:

```powershell
pnpm install
pnpm package:desktop
```

The installer is written to the root-level `release/` directory:

```text
release/Orison Space-Setup-0.1.0.exe
```

For a portable unpacked build without generating an installer, run:

```powershell
pnpm package:desktop:portable
```

The portable build is written to:

```text
release/portable/win-unpacked/Orison Space.exe
```

Copy the whole `release/portable/win-unpacked/` directory together. `Orison Space.exe` is the launcher.

## Python Requirement

The portable build bundles an embeddable Python runtime under `resources/python-runtime/`, so end users do **not** need to install Python — it works out of the box.

The NSIS installer does not bundle Python; for that flow users must install Python 3.10 or newer and make it available on `PATH` as `python`, then install dependencies with:

```powershell
python -m pip install -r apps/desktop/agent/python/requirements.txt
```

Advanced users can override the Python command before launching the app:

```powershell
$env:ORISON_PYTHON_COMMAND = "py -3.11"
```

## Packaged Agent Resources

The Python agent scripts are copied into Electron resources as:

```text
resources/python/
```

The embeddable interpreter (portable build only) lives at:

```text
resources/python-runtime/python.exe
```

It is produced at packaging time by `scripts/prepare-python-runtime.mjs` (invoked by `pack:portable`); this step never runs during development. At runtime, the Python command is resolved in this order:

1. `ORISON_PYTHON_COMMAND`, when set.
2. The embedded `resources/python-runtime/python.exe`, when present (portable build).
3. `python` from `PATH`, for development and the NSIS installer.

Python agent scripts are resolved via:

1. `ORISON_AGENT_PYTHON_DIR`, when set.
2. Packaged `resources/python`, when present.
3. Source-tree `apps/desktop/agent/python`, for development.

Native Node modules such as `better-sqlite3` are unpacked from asar so Electron can load their `.node` files.
