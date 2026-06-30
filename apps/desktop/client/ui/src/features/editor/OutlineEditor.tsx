import { useState, useEffect, useRef } from 'react';
import type { z } from 'zod';
import type { outlineV2Schema, outlinePhaseSchema } from '@orison/shared-contracts';
import { TiptapEditor } from './TiptapEditor';
import { PhaseBlock } from './PhaseBlock';
import { OutlineToggle } from './OutlineToggle';
import { Skeleton } from '../../shared/components/Skeleton';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

type OutlineV2 = z.infer<typeof outlineV2Schema>;
type OutlinePhase = z.infer<typeof outlinePhaseSchema>;

const DEBOUNCE_MS = 500;

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function useDragReorder<T>(items: T[], setItems: (items: T[]) => void, onEdit: () => void) {
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

  const [storyType, setStoryType] = useState('');
  const [writingStyle, setWritingStyle] = useState('');
  const [mainGoal, setMainGoal] = useState('');
  const [centralConflict, setCentralConflict] = useState('');
  const [endingDirection, setEndingDirection] = useState('');
  const [phases, setPhases] = useState<OutlinePhase[]>([]);
  const [characters, setCharacters] = useState('');
  const [growthCurve, setGrowthCurve] = useState('');
  const [pacingCurveText, setPacingCurveText] = useState('');
  const [turningPoints, setTurningPoints] = useState<string[]>([]);
  const [constraints, setConstraints] = useState<string[]>([]);

  const userEditedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastWrittenRef = useRef<OutlineV2 | undefined>(undefined);

  const buildOutline = (): OutlineV2 => ({
    story_type: storyType || undefined,
    writing_style: writingStyle || undefined,
    main_goal: mainGoal || undefined,
    central_conflict: centralConflict || undefined,
    ending_direction: endingDirection || undefined,
    phases,
    characters: characters || undefined,
    growth_curve: growthCurve || undefined,
    pacing_curve_text: pacingCurveText || undefined,
    major_turning_points: turningPoints,
    constraints,
  });
  const latestRef = useRef<OutlineV2>(buildOutline());
  latestRef.current = buildOutline();

  const flush = () => {
    if (!userEditedRef.current || !projectDocumentHydrated) return;
    const next = latestRef.current;
    lastWrittenRef.current = next;
    userEditedRef.current = false;
    updateField('outline', next);
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;

  useEffect(() => {
    if (storeOutline && storeOutline === lastWrittenRef.current) return;
    userEditedRef.current = false;
    if (!storeOutline) return;
    setStoryType(storeOutline.story_type ?? '');
    setWritingStyle(storeOutline.writing_style ?? '');
    setMainGoal(storeOutline.main_goal ?? '');
    setCentralConflict(storeOutline.central_conflict ?? '');
    setEndingDirection(storeOutline.ending_direction ?? '');
    setPhases(storeOutline.phases ?? []);
    setCharacters(storeOutline.characters ?? '');
    setGrowthCurve(storeOutline.growth_curve ?? '');
    setPacingCurveText(storeOutline.pacing_curve_text ?? '');
    setTurningPoints(storeOutline.major_turning_points ?? []);
    setConstraints(storeOutline.constraints ?? []);
  }, [storeOutline]);

  const markEdited = () => {
    userEditedRef.current = true;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => flushRef.current(), DEBOUNCE_MS);
  };

  useEffect(() => () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = undefined;
    }
    flushRef.current();
  }, []);

  if (!projectDocumentHydrated) return <Skeleton />;

  const addPhase = () => {
    markEdited();
    setPhases([...phases, { id: genId(), title: t('outline.newPhase') }]);
  };

  const updatePhase = (id: string, patch: Partial<OutlinePhase>) => {
    markEdited();
    setPhases(phases.map((p) => p.id === id ? { ...p, ...patch } : p));
  };

  const removePhase = (id: string) => {
    markEdited();
    setPhases(phases.filter((p) => p.id !== id));
  };

  const addTurningPoint = () => { markEdited(); setTurningPoints([...turningPoints, '']); };
  const updateTurningPoint = (i: number, v: string) => { markEdited(); setTurningPoints(turningPoints.map((tp, idx) => idx === i ? v : tp)); };
  const removeTurningPoint = (i: number) => { markEdited(); setTurningPoints(turningPoints.filter((_, idx) => idx !== i)); };

  const addConstraint = () => { markEdited(); setConstraints([...constraints, '']); };
  const updateConstraint = (i: number, v: string) => { markEdited(); setConstraints(constraints.map((c, idx) => idx === i ? v : c)); };
  const removeConstraint = (i: number) => { markEdited(); setConstraints(constraints.filter((_, idx) => idx !== i)); };

  const phaseDrag = useDragReorder(phases, setPhases, markEdited);
  const tpDrag = useDragReorder(turningPoints, setTurningPoints, markEdited);
  const cDrag = useDragReorder(constraints, setConstraints, markEdited);

  return (
    <div className="outline-editor">
      {/* ── Story Core ── */}
      <section className="outline-core">
        <h2 className="outline-heading">{t('outline.storyCore')}</h2>

        <div className="outline-tag-row">
          <span className="outline-tag-label">{t('outline.storyType')}</span>
          <input className="outline-tag-input" value={storyType} onChange={(e) => { markEdited(); setStoryType(e.target.value); }} placeholder={t('outline.storyTypePlaceholder')} />
          <span className="outline-tag-label">{t('outline.writingStyle')}</span>
          <input className="outline-tag-input" value={writingStyle} onChange={(e) => { markEdited(); setWritingStyle(e.target.value); }} placeholder={t('outline.writingStylePlaceholder')} />
        </div>

        <div className="outline-core-field">
          <label className="outline-core-label">{t('outline.centralConflict')}</label>
          <textarea className="outline-input outline-core-textarea" value={centralConflict} onChange={(e) => { markEdited(); setCentralConflict(e.target.value); }} placeholder={t('outline.centralConflictPlaceholder')} rows={2} />
        </div>

        <div className="outline-core-field">
          <label className="outline-core-label">{t('outline.mainGoal')}</label>
          <textarea className="outline-input outline-core-textarea" value={mainGoal} onChange={(e) => { markEdited(); setMainGoal(e.target.value); }} placeholder={t('outline.mainGoalPlaceholder')} rows={2} />
        </div>

        <div className="outline-core-field">
          <label className="outline-core-label">{t('outline.endingDirection')}</label>
          <textarea className="outline-input outline-core-textarea" value={endingDirection} onChange={(e) => { markEdited(); setEndingDirection(e.target.value); }} placeholder={t('outline.endingDirectionPlaceholder')} rows={2} />
        </div>
      </section>

      <hr className="outline-divider" />

      {/* ── Phases ── */}
      <section className="outline-phases">
        <div className="outline-phases-header">
          <h2 className="outline-heading">{t('outline.phases')}</h2>
        </div>

        {phases.map((phase, i) => (
          <PhaseBlock
            key={phase.id}
            phase={phase}
            index={i}
            onUpdate={updatePhase}
            onRemove={removePhase}
            onDragStart={phaseDrag.onDragStart(i)}
            onDragOver={phaseDrag.onDragOver(i)}
            onDragEnd={phaseDrag.onDragEnd}
            t={t}
          />
        ))}

        <button type="button" className="outline-add-block" onClick={addPhase}>
          <span className="material-symbols-outlined">add</span>
          {t('outline.addPhase')}
        </button>
      </section>

      <hr className="outline-divider" />

      {/* ── Auxiliary ── */}
      <section className="outline-auxiliary">
        <h2 className="outline-heading">{t('outline.auxiliary')}</h2>

        <OutlineToggle title={t('outline.characters')}>
          <TiptapEditor content={characters} placeholder={t('outline.charactersPlaceholder')} onChange={(v) => { markEdited(); setCharacters(v); }} format="markdown" />
        </OutlineToggle>

        <OutlineToggle title={t('outline.growthCurve')}>
          <TiptapEditor content={growthCurve} placeholder={t('outline.growthCurvePlaceholder')} onChange={(v) => { markEdited(); setGrowthCurve(v); }} format="markdown" />
        </OutlineToggle>

        <OutlineToggle title={t('outline.pacingCurve')}>
          <TiptapEditor content={pacingCurveText} placeholder={t('outline.pacingCurvePlaceholder')} onChange={(v) => { markEdited(); setPacingCurveText(v); }} format="markdown" />
        </OutlineToggle>

        <OutlineToggle title={t('outline.turningPoints')} onAdd={addTurningPoint}>
          <div className="outline-list">
            {turningPoints.map((tp, i) => (
              <div key={i} className="outline-list-item" draggable onDragStart={tpDrag.onDragStart(i)} onDragOver={tpDrag.onDragOver(i)} onDragEnd={tpDrag.onDragEnd}>
                <span className="outline-list-drag material-symbols-outlined">drag_indicator</span>
                <input className="outline-list-input" value={tp} onChange={(e) => updateTurningPoint(i, e.target.value)} placeholder={t('outline.turningPointPlaceholder')} />
                <button type="button" className="outline-list-remove" onClick={() => removeTurningPoint(i)}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            ))}
          </div>
        </OutlineToggle>

        <OutlineToggle title={t('outline.constraints')} onAdd={addConstraint}>
          <div className="outline-list">
            {constraints.map((c, i) => (
              <div key={i} className="outline-list-item" draggable onDragStart={cDrag.onDragStart(i)} onDragOver={cDrag.onDragOver(i)} onDragEnd={cDrag.onDragEnd}>
                <span className="outline-list-drag material-symbols-outlined">drag_indicator</span>
                <input className="outline-list-input" value={c} onChange={(e) => updateConstraint(i, e.target.value)} placeholder={t('outline.constraintPlaceholder')} />
                <button type="button" className="outline-list-remove" onClick={() => removeConstraint(i)}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            ))}
          </div>
        </OutlineToggle>
      </section>
    </div>
  );
}
