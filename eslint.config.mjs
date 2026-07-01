// ESLint flat config — enforces module-boundary rules from
// docs/architecture/module-boundaries.md as CI-checkable gates.
//
// Strategy: security red-lines are `error` (zero current hits, pure
// regression guard). Structural-boundary rules start as `warn` so the
// existing backlog (~60 direct window.orisonDesktop sites, one layer
// inversion) does not block CI today; they get promoted to `error`
// per-area as Phase D clears them. See docs/internal/lint-baseline.md.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import i18next from 'eslint-plugin-i18next';
import reactHooks from 'eslint-plugin-react-hooks';

const NO_BRIDGE_IN_FEATURES = {
  selector:
    "MemberExpression[object.name='window'][property.name='orisonDesktop']",
  message:
    '禁止在 features/store 直接访问 window.orisonDesktop，请通过 shared/api/*.ts 收口（boundary rule）。',
};

const NO_RAW_HTTP = {
  selector:
    "CallExpression[callee.name='fetch'] > Literal.arguments:first-child[value=/^https?:\\/\\//]",
  message:
    '禁止 renderer 直连 HTTP，请走 preload IPC + shared/api（boundary rule）。',
};

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.d.ts',
      '**/.turbo/**',
      'packages/shared-utils/**',
      'packages/ui-kit/**',
      'scripts/**',
      '**/*.config.{js,mjs,cjs,ts}',
      '**/vite.config.*',
      '**/electron.vite.config.*',
      '**/vitest.config.*',
    ],
  },

  // Base JS/TS rules (NOT type-checked — keeps the first rollout fast and
  // avoids flooding the backlog with type-aware findings).
  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Baseline rollout: this pass enforces module-BOUNDARY + security rules
      // as errors. General code-quality rules from the recommended presets are
      // demoted to `warn` so the existing backlog does not block CI. Tighten
      // these to `error` in a later code-quality pass.
      '@typescript-eslint/no-unused-expressions': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'warn',
      'no-control-regex': 'warn',
      'no-useless-escape': 'warn',
      'no-empty': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // ── Security red-line: agent library must never call providers directly ──
  {
    files: ['apps/desktop/agent/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'openai', message: 'agent 不得直连 provider（DI only）。' },
            { name: 'axios', message: 'agent 不得直连 provider（DI only）。' },
            { name: 'node-fetch', message: 'agent 不得直连 provider（DI only）。' },
          ],
          patterns: [
            { group: ['@ai-sdk/*'], message: 'agent 不得直连 provider（DI only）。' },
            {
              group: ['**/engine/*', '**/nodes/*'],
              message: 'engine/nodes 是历史死代码，禁止重新接线。',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'agent 不得直连第三方模型，LLM 能力只能经 DI。' },
      ],
    },
  },

  // ── Structural boundary: renderer features/store must go through shared/api ──
  {
    files: [
      'apps/desktop/client/ui/src/features/**/*.{ts,tsx}',
      'apps/desktop/client/ui/src/shared/store/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-syntax': ['warn', NO_BRIDGE_IN_FEATURES, NO_RAW_HTTP],
    },
  },

  // ── i18n: flag hardcoded display strings in renderer JSX (warn-only) ──
  {
    files: [
      'apps/desktop/client/ui/src/features/**/*.tsx',
      'apps/desktop/client/ui/src/pages/**/*.tsx',
    ],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'warn',
        {
          mode: 'jsx-text-only',
          'should-validate-template': false,
          words: {
            exclude: [
              // Material Symbols icon names used across the app
              'account_tree', 'add', 'add_circle', 'add_photo_alternate',
              'arrow_back', 'arrow_forward', 'assistant', 'attach_file',
              'auto_awesome', 'auto_fix_high', 'backspace', 'broken_image',
              'cancel', 'check', 'check_circle', 'chevron_left', 'chevron_right',
              'close', 'cloud_done', 'code', 'commit', 'content_copy', 'content_paste',
              'dark_mode', 'delete', 'delete_sweep', 'description', 'done',
              'download', 'drag_indicator', 'edit', 'edit_document', 'edit_note',
              'error', 'expand_less', 'expand_more', 'extension',
              'folder', 'folder_open', 'fork_right', 'format_quote',
              'help', 'history', 'home', 'hub',
              'image', 'info', 'ink_pen', 'insert_drive_file',
              'keyboard_arrow_down', 'keyboard_arrow_up',
              'light_mode', 'link', 'list', 'location_on',
              'map', 'markdown', 'menu', 'mic', 'more_horiz', 'more_vert',
              'movie', 'movie_edit', 'navigate_before', 'navigate_next',
              'open_in_new', 'palette', 'perm_media', 'photo_camera', 'photo_library',
              'play_arrow', 'play_circle', 'progress_activity', 'psychology', 'push_pin',
              'refresh', 'restart_alt',
              'save', 'schedule', 'search', 'send', 'settings', 'skip_next', 'skip_previous',
              'smart_toy', 'sort_by_alpha', 'spin', 'stop', 'sync',
              'text_fields', 'tune',
              'undo', 'upload', 'videocam', 'view_sidebar', 'visibility', 'visibility_off',
              'warning',
            ],
          },
        },
      ],
    },
  },

  // Test files: relax noise.
  {
    files: ['**/*.{test,spec}.{ts,tsx}', '**/test/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
);
