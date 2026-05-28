import { useState, useEffect, useRef, useCallback } from 'react';
import type { z } from 'zod';
import type { outlineV2Schema } from '@orison/shared-contracts';
import { TiptapEditor } from './TiptapEditor';
import { Skeleton } from '../../shared/components/Skeleton';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

type OutlineV2 = z.infer<typeof outlineV2Schema>;

const DEBOUNCE_MS = 500;

function useDragReorder(items: string[], setItems: (items: string[]) => void, onEdit: () => void) {
  const dragIdx = useRef<number | null>(null);

  const onDragStart = (i: number) => (e: React.DragEvent) => {
    dragIdx.current = i;
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (i: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === i) return;
    const next = [...items];
    const [moved] = next.splice(dragIdx.current, 1);
    next.splice(i, 0, moved);
    dragIdx.current = i;
    onEdit();
    setItems(next);
  };

  const onDragEnd = () => { dragIdx.current = null; };

  return { onDragStart, onDragOver, onDragEnd };
}

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

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const syncingRef = useRef(false);
  const userEditedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    syncingRef.current = true;
    userEditedRef.current = false;
    if (!storeOutline) {
      syncingRef.current = false;
      return;
    }
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
    if (!userEditedRef.current) return;
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
  }, [centralConflict, endingDirection, turningPoints, constraints, characters, growthCurve, pacingCurveText, updateField, projectDocumentHydrated]);

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

  const tpDrag = useDragReorder(turningPoints, setTurningPoints, markEdited);
  const cDrag = useDragReorder(constraints, setConstraints, markEdited);

  const toggle = (key: string) => setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  if (!projectDocumentHydrated) {
    return (
      <div className="outline-editor">
        <div className="outline-fields" style={{ opacity: 0.4, pointerEvents: 'none' }}>
          <Skeleton height="2rem" />
          <Skeleton height="2rem" />
          <Skeleton height="2rem" />
        </div>
      </div>
    );
  }

  return (
    <div className="outline-editor">
      <div className="outline-fields">
        {/* Characters */}
        <div className="outline-act-card">
          <div className="outline-act-header" onClick={() => toggle('characters')}>
            <span className={`material-symbols-outlined outline-act-toggle ${collapsed['characters'] ? '' : 'is-open'}`}>chevron_right</span>
            <span className="outline-act-title-input">{t('outline.characters')}</span>
          </div>
          {!collapsed['characters'] && (
            <div className="outline-act-body">
              <TiptapEditor
                content={characters}
                onChange={(v) => { markEdited(); setCharacters(v); }}
                placeholder={t('outline.charactersPlaceholder')}
              />
            </div>
          )}
        </div>

        {/* Growth Curve */}
        <div className="outline-act-card">
          <div className="outline-act-header" onClick={() => toggle('growth')}>
            <span className={`material-symbols-outlined outline-act-toggle ${collapsed['growth'] ? '' : 'is-open'}`}>chevron_right</span>
            <span className="outline-act-title-input">{t('outline.growthCurve')}</span>
          </div>
          {!collapsed['growth'] && (
            <div className="outline-act-body">
              <TiptapEditor
                content={growthCurve}
                onChange={(v) => { markEdited(); setGrowthCurve(v); }}
                placeholder={t('outline.growthCurvePlaceholder')}
              />
            </div>
          )}
        </div>

        {/* Central Conflict */}
        <div className="outline-act-card">
          <div className="outline-act-header" onClick={() => toggle('conflict')}>
            <span className={`material-symbols-outlined outline-act-toggle ${collapsed['conflict'] ? '' : 'is-open'}`}>chevron_right</span>
            <span className="outline-act-title-input">{t('outline.centralConflict')}</span>
          </div>
          {!collapsed['conflict'] && (
            <div className="outline-act-body">
              <TiptapEditor
                content={centralConflict}
                onChange={(v) => { markEdited(); setCentralConflict(v); }}
                placeholder={t('outline.centralConflictPlaceholder')}
              />
            </div>
          )}
        </div>

        {/* Ending Direction */}
        <div className="outline-act-card">
          <div className="outline-act-header" onClick={() => toggle('ending')}>
            <span className={`material-symbols-outlined outline-act-toggle ${collapsed['ending'] ? '' : 'is-open'}`}>chevron_right</span>
            <span className="outline-act-title-input">{t('outline.endingDirection')}</span>
          </div>
          {!collapsed['ending'] && (
            <div className="outline-act-body">
              <TiptapEditor
                content={endingDirection}
                onChange={(v) => { markEdited(); setEndingDirection(v); }}
                placeholder={t('outline.endingDirectionPlaceholder')}
              />
            </div>
          )}
        </div>

        {/* Pacing Curve */}
        <div className="outline-act-card">
          <div className="outline-act-header" onClick={() => toggle('pacing')}>
            <span className={`material-symbols-outlined outline-act-toggle ${collapsed['pacing'] ? '' : 'is-open'}`}>chevron_right</span>
            <span className="outline-act-title-input">{t('outline.pacingCurve')}</span>
          </div>
          {!collapsed['pacing'] && (
            <div className="outline-act-body">
              <TiptapEditor
                content={pacingCurveText}
                onChange={(v) => { markEdited(); setPacingCurveText(v); }}
                placeholder={t('outline.pacingCurvePlaceholder')}
              />
            </div>
          )}
        </div>

        {/* Turning Points — draggable */}
        <div className="outline-act-card">
          <div className="outline-act-header" onClick={() => toggle('tp')}>
            <span className={`material-symbols-outlined outline-act-toggle ${collapsed['tp'] ? '' : 'is-open'}`}>chevron_right</span>
            <span className="outline-act-title-input">{t('outline.turningPoints')}</span>
            <button type="button" className="outline-add-btn" onClick={(e) => {
              e.stopPropagation();
              markEdited();
              addTurningPoint();
            }}>
              <span className="material-symbols-outlined" aria-hidden="true">add</span>
            </button>
          </div>
          {!collapsed['tp'] && (
            <div className="outline-act-body">
              {turningPoints.map((tp, i) => (
                <div
                  key={i}
                  className="outline-list-item"
                  draggable
                  onDragStart={tpDrag.onDragStart(i)}
                  onDragOver={tpDrag.onDragOver(i)}
                  onDragEnd={tpDrag.onDragEnd}
                >
                  <span className="material-symbols-outlined outline-drag-handle">drag_indicator</span>
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
          )}
        </div>

        {/* Constraints — draggable */}
        <div className="outline-act-card">
          <div className="outline-act-header" onClick={() => toggle('constraints')}>
            <span className={`material-symbols-outlined outline-act-toggle ${collapsed['constraints'] ? '' : 'is-open'}`}>chevron_right</span>
            <span className="outline-act-title-input">{t('outline.constraints')}</span>
            <button type="button" className="outline-add-btn" onClick={(e) => {
              e.stopPropagation();
              markEdited();
              addConstraint();
            }}>
              <span className="material-symbols-outlined" aria-hidden="true">add</span>
            </button>
          </div>
          {!collapsed['constraints'] && (
            <div className="outline-act-body">
              {constraints.map((c, i) => (
                <div
                  key={i}
                  className="outline-list-item"
                  draggable
                  onDragStart={cDrag.onDragStart(i)}
                  onDragOver={cDrag.onDragOver(i)}
                  onDragEnd={cDrag.onDragEnd}
                >
                  <span className="material-symbols-outlined outline-drag-handle">drag_indicator</span>
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
          )}
        </div>
      </div>
    </div>
  );
}
