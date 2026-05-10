import { useCallback, useEffect, useState } from 'react';
import yaml from 'js-yaml';

/* ── 自动扫描 i18n/*.yaml ── */
const yamlModules = import.meta.glob('./*.yaml', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;

// 从文件路径提取 locale 标识：./zh-CN.yaml → zh-CN
function localeFromPath(p: string): string {
  return p.replace(/^.*\//, '').replace(/\.yaml$/, '');
}

/** 可用 locale 列表（由文件系统驱动） */
export const availableLocales = Object.keys(yamlModules).map(localeFromPath);

type Messages = Record<string, unknown>;
const cache = new Map<string, Messages>();

async function loadMessages(locale: string): Promise<Messages> {
  if (cache.has(locale)) return cache.get(locale)!;

  const key = Object.keys(yamlModules).find((k) => localeFromPath(k) === locale);
  if (!key) throw new Error(`[i18n] locale "${locale}" not found`);

  const raw = (await yamlModules[key]()) as string;
  const obj = yaml.load(raw) as Messages;
  cache.set(locale, obj);
  return obj;
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
  // Electron preload 暴露的 getLocale 优先
  const electronLocale = (window as unknown as Record<string, unknown>).orisonDesktop as
    | { getLocale?: () => string }
    | undefined;
  const raw = electronLocale?.getLocale?.() ?? navigator.language ?? 'en-US';
  // zh 开头 → zh-CN，其余匹配已有 locale 或回退 en-US
  if (raw.startsWith('zh')) return 'zh-CN';
  const match = availableLocales.find((l) => raw.startsWith(l.split('-')[0]));
  return match ?? 'en-US';
}

/* ── Hook ── */
export function useI18n(locale: string) {
  const [messages, setMessages] = useState<Messages | null>(cache.get(locale) ?? null);
  const [fallback, setFallback] = useState<Messages | null>(cache.get('en-US') ?? null);

  useEffect(() => {
    let cancelled = false;
    // 同时加载目标语言和 fallback
    Promise.all([loadMessages(locale), loadMessages('en-US')]).then(([msgs, fallbackMsgs]) => {
      if (!cancelled) {
        setMessages(msgs);
        setFallback(fallbackMsgs);
      }
    });
    return () => { cancelled = true; };
  }, [locale]);

  /** 翻译函数 */
  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      const val = get(messages, key) ?? get(fallback, key);
      if (typeof val === 'string') return interpolate(val, vars);
      if (Array.isArray(val)) return val.join(', ');
      return key; // 未找到则返回 key 本身
    },
    [messages, fallback],
  );

  /** 获取数组值（如 options 列表） */
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
