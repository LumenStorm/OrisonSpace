import { useEffect, useMemo, useRef, useState } from 'react';

export type FindReplaceMode = 'find' | 'replace';
import { useI18n } from '../../shared/i18n/useI18n';
import { useAppStore } from '../../shared/store/appStore';

export type FindMatch = {
  index: number;
  start: number;
  end: number;
};

export type FindReplaceAdapter = {
  getText: () => string;
  highlight: (match: FindMatch) => void;
  replaceOne: (match: FindMatch, replacement: string) => void;
  replaceAll: (matches: FindMatch[], replacement: string) => void;
};

type Props = {
  adapter: FindReplaceAdapter;
  onClose: () => void;
  /** Initial mode: 'find' = find only, 'replace' = show replace row too */
  initialMode?: 'find' | 'replace';
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

export function FindReplaceBar({ adapter, onClose, initialMode = 'find' }: Props) {
  const locale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(locale);

  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [expanded, setExpanded] = useState(initialMode === 'replace');
  const queryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialMode === 'replace') setExpanded(true);
  }, [initialMode]);

  const matches = useMemo(
    () => computeMatches(adapter.getText(), query, caseSensitive),
    [adapter, query, caseSensitive],
  );

  useEffect(() => {
    queryRef.current?.focus();
    queryRef.current?.select();
  }, []);

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
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) goPrev(); else goNext();
    }
  };

  return (
    <div className="find-replace-bar">
      <button
        type="button"
        className="find-replace-expand"
        title={t('findReplace.toggleReplace')}
        onClick={() => setExpanded(!expanded)}
        aria-label={t('findReplace.toggleReplace')}
        aria-expanded={expanded}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          {expanded ? 'expand_more' : 'chevron_right'}
        </span>
      </button>

      <div className="find-replace-rows">
        {/* Find row */}
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

        {/* Replace row */}
        {expanded && (
          <div className="find-replace-row find-replace-row--replace">
            <input
              type="text"
              className="find-replace-input"
              placeholder={t('findReplace.replacePlaceholder')}
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') doReplaceOne();
                if (e.key === 'Escape') { e.preventDefault(); onClose(); }
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
    </div>
  );
}
