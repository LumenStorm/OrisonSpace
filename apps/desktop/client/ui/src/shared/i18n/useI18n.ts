import { useCallback, useEffect, useState } from 'react';
import yaml from 'js-yaml';

/* ── 扫描 i18n/<locale>/*.yaml（eager = 同步加载） ── */
const yamlModules = import.meta.glob('./*/*.yaml', { query: '?raw', import: 'default', eager: true }) as unknown as Record<string, string>;

function parseLocaleFromPath(p: string): string {
  // path like ./zh-CN/agent.yaml → "zh-CN"
  const parts = p.split('/');
  return parts[parts.length - 2];
}

/** 可用 locale 列表（由文件系统驱动） */
export const availableLocales = [...new Set(Object.keys(yamlModules).map(parseLocaleFromPath))];

type Messages = Record<string, unknown>;
const cache = new Map<string, Messages>();

// 同步解析并按 locale 合并
for (const [path, raw] of Object.entries(yamlModules)) {
  const locale = parseLocaleFromPath(path);
  const obj = yaml.load(raw) as Messages;
  const existing = cache.get(locale) ?? {};
  cache.set(locale, { ...existing, ...obj });
}

function getMessages(locale: string): Messages | null {
  return cache.get(locale) ?? null;
}

/**
 * Non-hook translator for code outside React (store slices, plain modules).
 * Resolves `key` against the given locale, falling back to en-US then the key
 * itself — same lookup the `useI18n` hook uses.
 */
export function translate(locale: string, key: string, vars?: Record<string, string | number>): string {
  const val = get(getMessages(locale), key) ?? get(getMessages('en-US'), key);
  if (typeof val === 'string') return interpolate(val, vars);
  if (Array.isArray(val)) return val.join(', ');
  return key;
}

/* ── 深层取值 ── */
function get(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

/* ── 插值 ── */
function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

/* ── 检测系统语言 ── */
export function detectSystemLocale(): string {
  const electronLocale = (window as unknown as Record<string, unknown>).orisonDesktop as
    | { getLocale?: () => string }
    | undefined;
  const raw = electronLocale?.getLocale?.() ?? navigator.language ?? 'en-US';
  if (raw.startsWith('zh')) return 'zh-CN';
  const match = availableLocales.find((l) => raw.startsWith(l.split('-')[0]));
  return match ?? 'en-US';
}

/* ── Hook ── */
export function useI18n(locale: string) {
  const [messages, setMessages] = useState<Messages | null>(() => getMessages(locale));
  const [fallback] = useState<Messages | null>(() => getMessages('en-US'));

  useEffect(() => {
    const msgs = getMessages(locale);
    setMessages(msgs);
  }, [locale]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      const val = get(messages, key) ?? get(fallback, key);
      if (typeof val === 'string') return interpolate(val, vars);
      if (Array.isArray(val)) return val.join(', ');
      return key;
    },
    [messages, fallback],
  );

  const tArray = useCallback(
    (key: string): string[] => {
      const val = get(messages, key) ?? get(fallback, key);
      if (Array.isArray(val)) return val as string[];
      return [];
    },
    [messages, fallback],
  );

  return { t, tArray, ready: messages !== null };
}
