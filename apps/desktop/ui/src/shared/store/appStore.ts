import { create } from 'zustand';
import type { z } from 'zod';
import type { taskRequestSchema, taskResultSchema, patchOperationSchema } from '@orison/shared-contracts';
import { detectSystemLocale, availableLocales } from '../i18n/useI18n';

export type WorkspaceModule = 'outline' | 'script' | 'storyboard' | 'video';
export type ThemeSetting = 'system' | 'light' | 'dark' | (string & {});
export type LocaleSetting = 'system' | (string & {});
type TaskRequest = z.infer<typeof taskRequestSchema>;
type TaskResult = z.infer<typeof taskResultSchema>;
type PatchOperation = z.infer<typeof patchOperationSchema>;

const API_BASE = 'http://localhost:4000';

export type TaskAdapter = {
  submitTask: (request: TaskRequest) => Promise<{ taskId: string; status: string }>;
  getTaskResult: (taskId: string) => Promise<TaskResult>;
};

type TaskEntry = {
  request: TaskRequest;
  result: TaskResult | null;
};

type UserInfo = {
  id: string;
  email: string;
  displayName?: string;
};

type ProjectMeta = {
  name: string;
  path: string;
};

type AppState = {
  // ── Auth ──
  token: string | null;
  user: UserInfo | null;
  authError: string | null;
  authLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;

  // ── Project ──
  currentProject: ProjectMeta | null;
  openProject: (project: ProjectMeta) => void;
  closeProject: () => void;

  // ── Workspace ──
  activeModule: WorkspaceModule;
  setActiveModule: (module: WorkspaceModule) => void;

  // ── Tasks ──
  taskAdapter: TaskAdapter | null;
  setTaskAdapter: (adapter: TaskAdapter) => void;
  currentTask: TaskEntry | null;
  submitRewrite: (instruction: string) => Promise<void>;
  acceptTaskResult: () => void;
  acceptedPatches: PatchOperation[];

  // ── Theme ──
  theme: ThemeSetting;
  setTheme: (theme: ThemeSetting) => void;

  // ── Locale ──
  locale: LocaleSetting;
  resolvedLocale: string;
  setLocale: (locale: LocaleSetting) => void;
};

export const useAppStore = create<AppState>((set, get) => ({
  // ── Auth ──
  token: localStorage.getItem('orison_token'),
  user: (() => {
    try { return JSON.parse(localStorage.getItem('orison_user') || 'null'); } catch { return null; }
  })(),
  authError: null,
  authLoading: false,

  async login(email, password) {
    set({ authLoading: true, authError: null });
    try {
      const res = await fetch(`${API_BASE}/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Login failed');
      }
      const data = await res.json();
      localStorage.setItem('orison_token', data.accessToken);
      localStorage.setItem('orison_user', JSON.stringify(data.user));
      set({ token: data.accessToken, user: data.user, authLoading: false });
    } catch (e: any) {
      set({ authError: e.message, authLoading: false });
    }
  },

  async register(email, password, displayName) {
    set({ authLoading: true, authError: null });
    try {
      const res = await fetch(`${API_BASE}/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Registration failed');
      }
      const data = await res.json();
      localStorage.setItem('orison_token', data.accessToken);
      localStorage.setItem('orison_user', JSON.stringify(data.user));
      set({ token: data.accessToken, user: data.user, authLoading: false });
    } catch (e: any) {
      set({ authError: e.message, authLoading: false });
    }
  },

  logout() {
    localStorage.removeItem('orison_token');
    localStorage.removeItem('orison_user');
    set({ token: null, user: null, currentProject: null });
  },

  // ── Project ──
  currentProject: null,
  openProject: (project) => set({ currentProject: project }),
  closeProject: () => set({ currentProject: null }),

  // ── Workspace ──
  activeModule: 'outline',
  setActiveModule: (activeModule) => set({ activeModule }),

  // ── Tasks ──
  taskAdapter: null,
  setTaskAdapter: (adapter) => set({ taskAdapter: adapter }),
  currentTask: null,

  async submitRewrite(instruction: string) {
    const adapter = get().taskAdapter;
    if (!adapter) return;

    const request: TaskRequest = {
      taskId: `task_${Date.now()}`,
      taskType: 'outline.rewrite',
      projectFingerprint: 'local_project',
      selectedScope: { module: 'outline', entityId: 'act_1' },
      contextPayload: { outline: { title: 'Current Story' } },
      userInstruction: instruction,
      privacyLevel: 'minimal',
      expectedOutputType: 'patch'
    };

    const { taskId } = await adapter.submitTask(request);
    set({ currentTask: { request, result: null } });

    const poll = async () => {
      const result = await adapter.getTaskResult(taskId);
      set({ currentTask: { request, result } });
      if (result.status !== 'completed' && result.status !== 'failed') {
        await new Promise((r) => setTimeout(r, 100));
        return poll();
      }
    };
    await poll();
  },

  acceptTaskResult() {
    const task = get().currentTask;
    if (!task?.result?.outputPayload?.operations) return;

    set({
      acceptedPatches: [
        ...get().acceptedPatches,
        ...task.result.outputPayload.operations
      ],
      currentTask: null
    });
  },

  acceptedPatches: [],

  // ── Theme ──
  theme: (localStorage.getItem('orison_theme') as ThemeSetting) || 'system',
  setTheme(theme) {
    localStorage.setItem('orison_theme', theme);
    applyTheme(theme);
    set({ theme });
  },

  // ── Locale ──
  locale: (localStorage.getItem('orison_locale') as LocaleSetting) || 'system',
  resolvedLocale: resolveLocale((localStorage.getItem('orison_locale') as LocaleSetting) || 'system'),
  setLocale(locale) {
    localStorage.setItem('orison_locale', locale);
    set({ locale, resolvedLocale: resolveLocale(locale) });
  },
}));

/* ── Theme helpers ── */
function applyTheme(theme: ThemeSetting) {
  document.documentElement.dataset.theme = theme;
}

function resolveLocale(locale: LocaleSetting): string {
  if (locale === 'system') return detectSystemLocale();
  if (availableLocales.includes(locale)) return locale;
  return 'en-US';
}

// 初始化：应用已保存的主题
applyTheme((localStorage.getItem('orison_theme') as ThemeSetting) || 'system');
