// dependency-cruiser — enforces cross-layer / cross-package direction rules
// from docs/architecture/module-boundaries.md. Run via `pnpm lint`.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-shared-to-features',
      comment:
        'shared/* 不得依赖 features/*（层级倒置）。UI 分层：app→pages→widgets→features→shared，只能高依赖低。',
      severity: 'warn', // 存量 SettingsDialog→ModelSettingsPage 一例，D 阶段清后升 error
      from: { path: 'apps/desktop/client/ui/src/shared' },
      to: { path: 'apps/desktop/client/ui/src/features' },
    },
    {
      name: 'renderer-no-electron-node-fs',
      comment:
        'renderer 不得直接依赖 electron / node fs；必须走 preload IPC。',
      severity: 'error',
      from: {
        path: 'apps/desktop/client/ui/src',
        pathNot: 'apps/desktop/client/ui/src/shared/themes/buildThemes\\.ts$', // build-time CLI
      },
      to: { path: '^(electron|fs|node:fs|node:path)$' },
    },
    {
      name: 'renderer-no-local-bff',
      comment: 'renderer 不得直接 import local-bff，写入必须走 preload→shell→local-bff。',
      severity: 'error',
      from: { path: 'apps/desktop/client/ui/src' },
      to: { path: 'apps/desktop/local-bff' },
    },
    {
      name: 'agent-no-legacy-engine-nodes',
      comment: 'agent 历史死代码 engine/nodes 已弃用，禁止从其余代码重新接线。',
      severity: 'error',
      from: {
        path: 'apps/desktop/agent/src',
        pathNot: 'apps/desktop/agent/src/(engine|nodes)',
      },
      to: { path: 'apps/desktop/agent/src/(engine|nodes)' },
    },
    {
      name: 'no-circular',
      comment: '禁止模块循环依赖（type-only imports 不计入）。',
      severity: 'warn',
      from: {},
      to: { circular: true, dependencyTypesNot: ['type-only'] },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(node_modules|dist|\\.d\\.ts$|\\.test\\.|\\.spec\\.)' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
  },
};
