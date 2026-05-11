import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../shared/i18n/useI18n';
import { useAppStore } from '../../shared/store/appStore';

export type FindReplaceMode = 'find' | 'replace';

export type FindMatch = {
  index: number;
  start: number;
  end: number;
};

export type FindReplaceAdapter = {
  /** Full plain-text content used for search. */
  getText: () => string;
  /** Highlight + scroll to a match. */
  highlight: (match: FindMatch) => void;
  /** Replace a single match with the given string. */
  replaceOne: (match: FindMatch, replacement: string) => void;
  /** Replace all matches with the given string. */
  replaceAll: (matches: FindMatch[], replacement: string) => void;
};

type Props = {
  mode: FindReplaceMode;
  adapter: FindReplaceAdapter;
  onClose: () => void;
};

function computeMatches(text: string, query: string, caseSensitive: boolean): FindMatch[] {
  if (!query) return [];
  const matches: FindMatch[] = [];
  const flags = caseSensitive ? 'g' : 'gi';
  let re: RegExp;
  try {
    re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
  } catch {
    return [];
  }
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    matches.push({ index: i++, start: m.index, end: m.index + m[0].length });
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return matches;
}

export function FindReplaceBar({ mode, adapter, onClose }: Props) {
  const locale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(locale);

  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const queryRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(
    () => computeMatches(adapter.getText(), query, caseSensitive),
    [adapter, query, caseSensitive],
  );

  useEffect(() => {
    queryRef.current?.focus();
    queryRef.current?.select();
  }, [mode]);

  useEffect(() => {
    if (matches.length === 0) {
      setActiveIndex(0);
      return;
    }
    const idx = activeIndex >= matches.length ? 0 : activeIndex;
    setActiveIndex(idx);
    adapter.highlight(matches[idx]);
  }, [matches]); // eslint-disable-line react-hooks/exhaustive-deps

  const goNext = () => {
    if (matches.length === 0) return;
    const next = (activeIndex + 1) % matches.length;
    setActiveIndex(next);
    adapter.highlight(matches[next]);
  };

  const goPrev = () => {
    if (matches.length === 0) return;
    const next = (activeIndex - 1 + matches.length) % matches.length;
    setActiveIndex(next);
    adapter.highlight(matches[next]);
  };

  const doReplaceOne = () => {
    if (matches.length === 0) return;
    adapter.replaceOne(matches[activeIndex], replacement);
  };

  const doReplaceAll = () => {
    if (matches.length === 0) return;
    adapter.replaceAll(matches, replacement);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.shiftKey ? goPrev() : goNext();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="find-replace-bar" role="search">
      <div className="find-replace-row">
        <input
          ref={queryRef}
          type="text"
          className="find-replace-input"
          placeholder={t('findReplace.findPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKey}
        />
        <span className="find-replace-count" aria-live="polite">
          {matches.length === 0 ? '0/0' : `${activeIndex + 1}/${matches.length}`}
        </span>
        <button
          type="button"
          className={`find-replace-toggle${caseSensitive ? ' is-active' : ''}`}
          title={t('findReplace.caseSensitive')}
          onClick={() => setCaseSensitive((v) => !v)}
        >
          Aa
        </button>
        <button type="button" className="find-replace-btn" onClick={goPrev} title={t('findReplace.previous')} aria-label={t('findReplace.previous')}>
          <span className="material-symbols-outlined" aria-hidden="true">keyboard_arrow_up</span>
        </button>
        <button type="button" className="find-replace-btn" onClick={goNext} title={t('findReplace.next')} aria-label={t('findReplace.next')}>
          <span className="material-symbols-outlined" aria-hidden="true">keyboard_arrow_down</span>
        </button>
        <button type="button" className="find-replace-btn" onClick={onClose} title={t('findReplace.close')} aria-label={t('findReplace.close')}>
          <span className="material-symbols-outlined" aria-hidden="true">close</span>
        </button>
      </div>
      {mode === 'replace' && (
        <div className="find-replace-row">
          <input
            type="text"
            className="find-replace-input"
            placeholder={t('findReplace.replacePlaceholder')}
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') doReplaceOne();
              if (e.key === 'Escape') onClose();
            }}
          />
          <button type="button" className="find-replace-action" onClick={doReplaceOne} disabled={matches.length === 0}>
            {t('findReplace.replace')}
          </button>
          <button type="button" className="find-replace-action" onClick={doReplaceAll} disabled={matches.length === 0}>
            {t('findReplace.replaceAll')}
          </button>
        </div>
      )}
    </div>
  );
}
