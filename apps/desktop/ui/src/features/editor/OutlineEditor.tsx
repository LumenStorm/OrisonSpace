import { useState, useEffect, useRef, useCallback } from 'react';
import type { z } from 'zod';
import type { outlineV2Schema } from '@orison/shared-contracts';
import { TiptapEditor } from './TiptapEditor';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

type OutlineV2 = z.infer<typeof outlineV2Schema>;

const DEBOUNCE_MS = 500;

export function OutlineEditor() {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);
  const storeOutline = useAppStore((s) => s.creativeFields.outline) as OutlineV2 | undefined;
  const updateField = useAppStore((s) => s.updateField);

  const [title, setTitle] = useState('');
  const [logline, setLogline] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [theme, setTheme] = useState('');
  const [genre, setGenre] = useState('');
  const [centralConflict, setCentralConflict] = useState('');
  const [endingDirection, setEndingDirection] = useState('');
  const [turningPoints, setTurningPoints] = useState<string[]>([]);
  const [constraints, setConstraints] = useState<string[]>([]);

  // Track whether we're syncing from store to avoid feedback loops
  const syncingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Hydrate from store on mount and when store changes externally
  useEffect(() => {
    if (!storeOutline) return;
    syncingRef.current = true;
    setTitle(storeOutline.title ?? '');
    setLogline(storeOutline.logline ?? '');
    setSynopsis(storeOutline.synopsis ?? '');
    setTheme(storeOutline.theme ?? '');
    setGenre(storeOutline.genre ?? '');
    setCentralConflict(storeOutline.central_conflict ?? '');
    setEndingDirection(storeOutline.ending_direction ?? '');
    setTurningPoints(storeOutline.major_turning_points ?? []);
    setConstraints(storeOutline.constraints ?? []);
    // Allow next tick before re-enabling persist
    requestAnimationFrame(() => { syncingRef.current = false; });
  }, [storeOutline]);

  // Persist to store with debounce
  const persist = useCallback(() => {
    if (syncingRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const data: OutlineV2 = {
        title,
        logline: logline || undefined,
        synopsis: synopsis || undefined,
        theme: theme || undefined,
        genre: genre || undefined,
        central_conflict: centralConflict || undefined,
        major_turning_points: turningPoints.filter(Boolean),
        ending_direction: endingDirection || undefined,
        constraints: constraints.filter(Boolean),
      };
      updateField('outline', data);
    }, DEBOUNCE_MS);
  }, [title, logline, synopsis, theme, genre, centralConflict, endingDirection, turningPoints, constraints, updateField]);

  useEffect(() => {
    persist();
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [persist]);

  const addTurningPoint = () => setTurningPoints([...turningPoints, '']);
  const updateTurningPoint = (i: number, v: string) =>
    setTurningPoints(turningPoints.map((tp, idx) => (idx === i ? v : tp)));
  const removeTurningPoint = (i: number) =>
    setTurningPoints(turningPoints.filter((_, idx) => idx !== i));

  const addConstraint = () => setConstraints([...constraints, '']);
  const updateConstraint = (i: number, v: string) =>
    setConstraints(constraints.map((c, idx) => (idx === i ? v : c)));
  const removeConstraint = (i: number) =>
    setConstraints(constraints.filter((_, idx) => idx !== i));

  return (
    <div className="outline-editor">
      <div className="outline-header">
        <input
          className="outline-title-input"
          placeholder={t('outline.projectTitle')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="outline-logline-input"
          placeholder={t('outline.loglinePlaceholder')}
          value={logline}
          onChange={(e) => setLogline(e.target.value)}
          rows={2}
        />
      </div>

      <div className="outline-fields">
        <div className="outline-field">
          <label className="outline-field-label">{t('outline.synopsis')}</label>
          <TiptapEditor
            content={synopsis}
            placeholder={t('outline.synopsisPlaceholder')}
            onChange={(html) => setSynopsis(html)}
          />
        </div>

        <div className="outline-style-grid">
          <div className="outline-style-field">
            <label className="outline-style-label">{t('outline.genre')}</label>
            <input
              className="outline-style-input"
              placeholder={t('outline.genre')}
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
            />
          </div>
          <div className="outline-style-field">
            <label className="outline-style-label">{t('outline.theme')}</label>
            <input
              className="outline-style-input"
              placeholder={t('outline.theme')}
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
            />
          </div>
        </div>

        <div className="outline-field">
          <label className="outline-field-label">{t('outline.centralConflict')}</label>
          <textarea
            className="outline-textarea"
            placeholder={t('outline.centralConflictPlaceholder')}
            value={centralConflict}
            onChange={(e) => setCentralConflict(e.target.value)}
            rows={3}
          />
        </div>

        <div className="outline-field">
          <label className="outline-field-label">{t('outline.endingDirection')}</label>
          <textarea
            className="outline-textarea"
            placeholder={t('outline.endingDirectionPlaceholder')}
            value={endingDirection}
            onChange={(e) => setEndingDirection(e.target.value)}
            rows={2}
          />
        </div>

        <div className="outline-field">
          <div className="outline-list-header">
            <label className="outline-field-label">{t('outline.turningPoints')}</label>
            <button type="button" className="outline-add-btn" onClick={addTurningPoint}>
              <span className="material-symbols-outlined" aria-hidden="true">add</span>
            </button>
          </div>
          {turningPoints.map((tp, i) => (
            <div key={i} className="outline-list-item">
              <input
                className="outline-list-input"
                placeholder={t('outline.turningPointPlaceholder')}
                value={tp}
                onChange={(e) => updateTurningPoint(i, e.target.value)}
              />
              <button type="button" className="outline-remove-btn" onClick={() => removeTurningPoint(i)}>
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </div>
          ))}
        </div>

        <div className="outline-field">
          <div className="outline-list-header">
            <label className="outline-field-label">{t('outline.constraints')}</label>
            <button type="button" className="outline-add-btn" onClick={addConstraint}>
              <span className="material-symbols-outlined" aria-hidden="true">add</span>
            </button>
          </div>
          {constraints.map((c, i) => (
            <div key={i} className="outline-list-item">
              <input
                className="outline-list-input"
                placeholder={t('outline.constraintPlaceholder')}
                value={c}
                onChange={(e) => updateConstraint(i, e.target.value)}
              />
              <button type="button" className="outline-remove-btn" onClick={() => removeConstraint(i)}>
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
