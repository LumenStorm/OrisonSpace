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
  const projectDocumentHydrated = useAppStore((s) => s.projectDocumentHydrated);
  const updateField = useAppStore((s) => s.updateField);

  const [centralConflict, setCentralConflict] = useState('');
  const [endingDirection, setEndingDirection] = useState('');
  const [turningPoints, setTurningPoints] = useState<string[]>([]);
  const [constraints, setConstraints] = useState<string[]>([]);
  const [characters, setCharacters] = useState('');
  const [growthCurve, setGrowthCurve] = useState('');
  const [pacingCurveText, setPacingCurveText] = useState('');

  const syncingRef = useRef(false);
  const userEditedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    userEditedRef.current = false;
    if (!storeOutline) return;
    syncingRef.current = true;
    setCentralConflict(storeOutline.central_conflict ?? '');
    setEndingDirection(storeOutline.ending_direction ?? '');
    setTurningPoints(storeOutline.major_turning_points ?? []);
    setConstraints(storeOutline.constraints ?? []);
    setCharacters(storeOutline.characters ?? '');
    setGrowthCurve(storeOutline.growth_curve ?? '');
    setPacingCurveText(storeOutline.pacing_curve_text ?? '');
    requestAnimationFrame(() => { syncingRef.current = false; });
  }, [storeOutline]);

  const persist = useCallback(() => {
    if (syncingRef.current) return;
    if (!projectDocumentHydrated) return;
    if (!userEditedRef.current && !storeOutline) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const data: OutlineV2 = {
        central_conflict: centralConflict || undefined,
        major_turning_points: turningPoints.filter(Boolean),
        ending_direction: endingDirection || undefined,
        constraints: constraints.filter(Boolean),
        characters: characters || undefined,
        growth_curve: growthCurve || undefined,
        pacing_curve_text: pacingCurveText || undefined,
      };
      updateField('outline', data);
    }, DEBOUNCE_MS);
  }, [centralConflict, endingDirection, turningPoints, constraints, characters, growthCurve, pacingCurveText, updateField, projectDocumentHydrated, storeOutline]);

  useEffect(() => {
    persist();
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [persist]);

  const markEdited = () => {
    userEditedRef.current = true;
  };

  const addTurningPoint = () => setTurningPoints([...turningPoints, '']);
  const updateTurningPoint = (i: number, v: string) => {
    const next = [...turningPoints];
    next[i] = v;
    setTurningPoints(next);
  };
  const removeTurningPoint = (i: number) => setTurningPoints(turningPoints.filter((_, idx) => idx !== i));

  const addConstraint = () => setConstraints([...constraints, '']);
  const updateConstraint = (i: number, v: string) => {
    const next = [...constraints];
    next[i] = v;
    setConstraints(next);
  };
  const removeConstraint = (i: number) => setConstraints(constraints.filter((_, idx) => idx !== i));

  return (
    <div className="outline-editor">
      <div className="outline-fields">
        <div className="outline-field">
          <label className="outline-field-label">{t('outline.characters')}</label>
          <TiptapEditor
            content={characters}
            onChange={(v) => { markEdited(); setCharacters(v); }}
            placeholder={t('outline.charactersPlaceholder')}
          />
        </div>

        <div className="outline-field">
          <label className="outline-field-label">{t('outline.growthCurve')}</label>
          <TiptapEditor
            content={growthCurve}
            onChange={(v) => { markEdited(); setGrowthCurve(v); }}
            placeholder={t('outline.growthCurvePlaceholder')}
          />
        </div>

        <div className="outline-field">
          <label className="outline-field-label">{t('outline.centralConflict')}</label>
          <TiptapEditor
            content={centralConflict}
            onChange={(v) => { markEdited(); setCentralConflict(v); }}
            placeholder={t('outline.centralConflictPlaceholder')}
          />
        </div>

        <div className="outline-field">
          <label className="outline-field-label">{t('outline.endingDirection')}</label>
          <TiptapEditor
            content={endingDirection}
            onChange={(v) => { markEdited(); setEndingDirection(v); }}
            placeholder={t('outline.endingDirectionPlaceholder')}
          />
        </div>

        <div className="outline-field">
          <label className="outline-field-label">{t('outline.pacingCurve')}</label>
          <TiptapEditor
            content={pacingCurveText}
            onChange={(v) => { markEdited(); setPacingCurveText(v); }}
            placeholder={t('outline.pacingCurvePlaceholder')}
          />
        </div>

        <div className="outline-field">
          <div className="outline-list-header">
            <label className="outline-field-label">{t('outline.turningPoints')}</label>
            <button type="button" className="outline-add-btn" onClick={() => {
              markEdited();
              addTurningPoint();
            }}>
              <span className="material-symbols-outlined" aria-hidden="true">add</span>
            </button>
          </div>
          {turningPoints.map((tp, i) => (
            <div key={i} className="outline-list-item">
              <input
                className="outline-list-input"
                placeholder={t('outline.turningPointPlaceholder')}
                value={tp}
                onChange={(e) => {
                  markEdited();
                  updateTurningPoint(i, e.target.value);
                }}
              />
              <button type="button" className="outline-remove-btn" onClick={() => {
                markEdited();
                removeTurningPoint(i);
              }}>
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </div>
          ))}
        </div>

        <div className="outline-field">
          <div className="outline-list-header">
            <label className="outline-field-label">{t('outline.constraints')}</label>
            <button type="button" className="outline-add-btn" onClick={() => {
              markEdited();
              addConstraint();
            }}>
              <span className="material-symbols-outlined" aria-hidden="true">add</span>
            </button>
          </div>
          {constraints.map((c, i) => (
            <div key={i} className="outline-list-item">
              <input
                className="outline-list-input"
                placeholder={t('outline.constraintPlaceholder')}
                value={c}
                onChange={(e) => {
                  markEdited();
                  updateConstraint(i, e.target.value);
                }}
              />
              <button type="button" className="outline-remove-btn" onClick={() => {
                markEdited();
                removeConstraint(i);
              }}>
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
