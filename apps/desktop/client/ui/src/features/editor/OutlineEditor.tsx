import { useState, useEffect, useRef } from 'react';
import type { z } from 'zod';
import type { outlineV2Schema, outlinePhaseSchema } from '@orison/shared-contracts';
import { TiptapEditor } from './TiptapEditor';
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

  // Top-level fields
  const [storyType, setStoryType] = useState('');
  const [writingStyle, setWritingStyle] = useState('');
  const [mainGoal, setMainGoal] = useState('');
  const [centralConflict, setCentralConflict] = useState('');
  const [endingDirection, setEndingDirection] = useState('');

  // Phases
  const [phases, setPhases] = useState<OutlinePhase[]>([]);
  const [phaseCollapsed, setPhaseCollapsed] = useState<Record<string, boolean>>({});

  // Auxiliary fields
  const [characters, setCharacters] = useState('');
  const [growthCurve, setGrowthCurve] = useState('');
  const [pacingCurveText, setPacingCurveText] = useState('');
  const [turningPoints, setTurningPoints] = useState<string[]>([]);
  const [constraints, setConstraints] = useState<string[]>([]);
  const [auxCollapsed, setAuxCollapsed] = useState<Record<string, boolean>>({
    characters: true, growthCurve: true, pacingCurveText: true,
    turningPoints: true, constraints: true,
  });

  // Tracks whether the user has actually edited since the last store sync.
  // Gates the debounced + unmount flush so we never write back a value we
  // merely loaded from the store.
  const userEditedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The exact object we last wrote to the store. Used to distinguish our own
  // writes (which must NOT re-hydrate local state — that round-trip was the
  // bug: it clobbered the in-flight keystroke with a one-render-stale value)
  // from external changes (project load, agent patch accept).
  const lastWrittenRef = useRef<OutlineV2 | undefined>(undefined);

  // Build the current OutlineV2 from local state. Kept in a ref so the
  // debounced/unmount flush always reads the latest values without making
  // `persist` depend on every field (which is what forced the effect to
  // re-run — and prematurely flush — on every keystroke).
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
  // Keep the unmount handler pointing at the latest `flush` so it doesn't fire
  // with a stale closure (projectDocumentHydrated was false on first render).
  const flushRef = useRef(flush);
  flushRef.current = flush;

  // Hydrate local state from the store. Skips our own writes (reference match)
  // so a debounced save never bounces back and overwrites what the user just
  // typed. Runs for project load and external (agent) patches.
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

  // Mark a user edit and (re)arm the debounce. Called from every onChange.
  const markEdited = () => {
    userEditedRef.current = true;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => flushRef.current(), DEBOUNCE_MS);
  };

  // Flush any pending edit on unmount only (mount-once effect — does NOT
  // re-run per keystroke, so it can't pre-empt the debounce).
  useEffect(() => () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = undefined;
    }
    flushRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!projectDocumentHydrated) return <Skeleton />;

  // Phase helpers
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

  const togglePhaseCollapse = (id: string) => {
    setPhaseCollapsed((c) => ({ ...c, [id]: !c[id] }));
  };

  // Turning points / constraints helpers
  const addTurningPoint = () => { markEdited(); setTurningPoints([...turningPoints, '']); };
  const updateTurningPoint = (i: number, v: string) => { markEdited(); setTurningPoints(turningPoints.map((tp, idx) => idx === i ? v : tp)); };
  const removeTurningPoint = (i: number) => { markEdited(); setTurningPoints(turningPoints.filter((_, idx) => idx !== i)); };

  const addConstraint = () => { markEdited(); setConstraints([...constraints, '']); };
  const updateConstraint = (i: number, v: string) => { markEdited(); setConstraints(constraints.map((c, idx) => idx === i ? v : c)); };
  const removeConstraint = (i: number) => { markEdited(); setConstraints(constraints.filter((_, idx) => idx !== i)); };

  const phaseDrag = useDragReorder(phases, setPhases, markEdited);
  const tpDrag = useDragReorder(turningPoints, setTurningPoints, markEdited);
  const cDrag = useDragReorder(constraints, setConstraints, markEdited);

  const toggleAux = (key: string) => setAuxCollapsed((c) => ({ ...c, [key]: !c[key] }));

  return (
    <div className="outline-editor">
      {/* ── Top Section: Core Settings ── */}
      <section className="outline-top-section">
        <div className="outline-style-grid">
          <div className="outline-style-field">
            <label className="outline-style-label">{t('outline.storyType')}</label>
            <input className="outline-style-input" value={storyType} onChange={(e) => { markEdited(); setStoryType(e.target.value); }} placeholder={t('outline.storyTypePlaceholder')} />
          </div>
          <div className="outline-style-field">
            <label className="outline-style-label">{t('outline.writingStyle')}</label>
            <input className="outline-style-input" value={writingStyle} onChange={(e) => { markEdited(); setWritingStyle(e.target.value); }} placeholder={t('outline.writingStylePlaceholder')} />
          </div>
        </div>

        <div className="outline-field">
          <label className="outline-field-label">{t('outline.centralConflict')}</label>
          <textarea className="outline-textarea" value={centralConflict} onChange={(e) => { markEdited(); setCentralConflict(e.target.value); }} placeholder={t('outline.centralConflictPlaceholder')} rows={2} />
        </div>

        <div className="outline-field">
          <label className="outline-field-label">{t('outline.mainGoal')}</label>
          <textarea className="outline-textarea" value={mainGoal} onChange={(e) => { markEdited(); setMainGoal(e.target.value); }} placeholder={t('outline.mainGoalPlaceholder')} rows={2} />
        </div>

        <div className="outline-field">
          <label className="outline-field-label">{t('outline.endingDirection')}</label>
          <textarea className="outline-textarea" value={endingDirection} onChange={(e) => { markEdited(); setEndingDirection(e.target.value); }} placeholder={t('outline.endingDirectionPlaceholder')} rows={2} />
        </div>
      </section>

      {/* ── Middle Section: Phases ── */}
      <section className="outline-phases-section">
        <div className="outline-section-header">
          <h3 className="outline-section-title">{t('outline.phases')}</h3>
          <button type="button" className="outline-add-btn" onClick={addPhase}>
            <span className="material-symbols-outlined" aria-hidden="true">add</span>
            {t('outline.addPhase')}
          </button>
        </div>

        {phases.map((phase, i) => (
          <div
            key={phase.id}
            className="outline-phase-card"
            draggable
            onDragStart={phaseDrag.onDragStart(i)}
            onDragOver={phaseDrag.onDragOver(i)}
            onDragEnd={phaseDrag.onDragEnd}
          >
            <div className="outline-phase-card-header">
              <span className="material-symbols-outlined outline-drag-handle">drag_indicator</span>
              <input
                className="outline-phase-title-input"
                value={phase.title}
                onChange={(e) => updatePhase(phase.id, { title: e.target.value })}
                placeholder={t('outline.phaseTitle')}
              />
              <button type="button" className="outline-collapse-btn" onClick={() => togglePhaseCollapse(phase.id)}>
                <span className="material-symbols-outlined">{phaseCollapsed[phase.id] ? 'expand_more' : 'expand_less'}</span>
              </button>
              <button type="button" className="outline-remove-btn" onClick={() => removePhase(phase.id)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {!phaseCollapsed[phase.id] && (
              <div className="outline-phase-card-body">
                <div className="outline-phase-field">
                  <label className="outline-phase-label">{t('outline.phaseGoal')}</label>
                  <input className="outline-phase-input" value={phase.goal ?? ''} onChange={(e) => updatePhase(phase.id, { goal: e.target.value })} />
                </div>
                <div className="outline-phase-field">
                  <label className="outline-phase-label">{t('outline.phaseAntagonist')}</label>
                  <input className="outline-phase-input" value={phase.antagonist ?? ''} onChange={(e) => updatePhase(phase.id, { antagonist: e.target.value })} />
                </div>
                <div className="outline-phase-field">
                  <label className="outline-phase-label">{t('outline.phaseClimax')}</label>
                  <input className="outline-phase-input" value={phase.climax ?? ''} onChange={(e) => updatePhase(phase.id, { climax: e.target.value })} />
                </div>
                <div className="outline-phase-field">
                  <label className="outline-phase-label">{t('outline.phaseHook')}</label>
                  <input className="outline-phase-input" value={phase.hook ?? ''} onChange={(e) => updatePhase(phase.id, { hook: e.target.value })} />
                </div>
                <div className="outline-phase-field">
                  <label className="outline-phase-label">{t('outline.estimatedChapters')}</label>
                  <input className="outline-phase-input" type="number" min={0} value={phase.estimated_chapters ?? ''} onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') { updatePhase(phase.id, { estimated_chapters: undefined }); return; }
                    // Clamp to a non-negative integer: guards against negative
                    // or NaN (paste / spinner) corrupting phase-progress math.
                    const n = Math.max(0, Math.floor(Number(raw)));
                    updatePhase(phase.id, { estimated_chapters: Number.isFinite(n) ? n : undefined });
                  }} />
                </div>
              </div>
            )}
          </div>
        ))}

        {phases.length === 0 && (
          <div className="outline-empty-hint">{t('outline.noPhasesHint')}</div>
        )}
      </section>

      {/* ── Bottom Section: Auxiliary Settings ── */}
      <section className="outline-auxiliary-section">
        <h3 className="outline-section-title">{t('outline.auxiliary')}</h3>

        {/* Characters */}
        <div className="outline-act">
          <div className="outline-act-header" onClick={() => toggleAux('characters')}>
            <span className="material-symbols-outlined outline-act-chevron">{auxCollapsed.characters ? 'chevron_right' : 'expand_more'}</span>
            <span className="outline-act-title">{t('outline.characters')}</span>
          </div>
          {!auxCollapsed.characters && (
            <div className="outline-act-body">
              <TiptapEditor content={characters} placeholder={t('outline.charactersPlaceholder')} onChange={(v) => { markEdited(); setCharacters(v); }} format="markdown" />
            </div>
          )}
        </div>

        {/* Growth Curve */}
        <div className="outline-act">
          <div className="outline-act-header" onClick={() => toggleAux('growthCurve')}>
            <span className="material-symbols-outlined outline-act-chevron">{auxCollapsed.growthCurve ? 'chevron_right' : 'expand_more'}</span>
            <span className="outline-act-title">{t('outline.growthCurve')}</span>
          </div>
          {!auxCollapsed.growthCurve && (
            <div className="outline-act-body">
              <TiptapEditor content={growthCurve} placeholder={t('outline.growthCurvePlaceholder')} onChange={(v) => { markEdited(); setGrowthCurve(v); }} format="markdown" />
            </div>
          )}
        </div>

        {/* Pacing Curve */}
        <div className="outline-act">
          <div className="outline-act-header" onClick={() => toggleAux('pacingCurveText')}>
            <span className="material-symbols-outlined outline-act-chevron">{auxCollapsed.pacingCurveText ? 'chevron_right' : 'expand_more'}</span>
            <span className="outline-act-title">{t('outline.pacingCurve')}</span>
          </div>
          {!auxCollapsed.pacingCurveText && (
            <div className="outline-act-body">
              <TiptapEditor content={pacingCurveText} placeholder={t('outline.pacingCurvePlaceholder')} onChange={(v) => { markEdited(); setPacingCurveText(v); }} format="markdown" />
            </div>
          )}
        </div>

        {/* Turning Points */}
        <div className="outline-act">
          <div className="outline-act-header" onClick={() => toggleAux('turningPoints')}>
            <span className="material-symbols-outlined outline-act-chevron">{auxCollapsed.turningPoints ? 'chevron_right' : 'expand_more'}</span>
            <span className="outline-act-title">{t('outline.turningPoints')}</span>
            <button type="button" className="outline-add-inline-btn" onClick={(e) => { e.stopPropagation(); addTurningPoint(); }}>
              <span className="material-symbols-outlined">add</span>
            </button>
          </div>
          {!auxCollapsed.turningPoints && (
            <div className="outline-act-body">
              {turningPoints.map((tp, i) => (
                <div key={i} className="outline-list-item" draggable onDragStart={tpDrag.onDragStart(i)} onDragOver={tpDrag.onDragOver(i)} onDragEnd={tpDrag.onDragEnd}>
                  <span className="material-symbols-outlined outline-drag-handle">drag_indicator</span>
                  <input className="outline-list-input" value={tp} onChange={(e) => updateTurningPoint(i, e.target.value)} placeholder={t('outline.turningPointPlaceholder')} />
                  <button type="button" className="outline-remove-btn" onClick={() => removeTurningPoint(i)}>
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Constraints */}
        <div className="outline-act">
          <div className="outline-act-header" onClick={() => toggleAux('constraints')}>
            <span className="material-symbols-outlined outline-act-chevron">{auxCollapsed.constraints ? 'chevron_right' : 'expand_more'}</span>
            <span className="outline-act-title">{t('outline.constraints')}</span>
            <button type="button" className="outline-add-inline-btn" onClick={(e) => { e.stopPropagation(); addConstraint(); }}>
              <span className="material-symbols-outlined">add</span>
            </button>
          </div>
          {!auxCollapsed.constraints && (
            <div className="outline-act-body">
              {constraints.map((c, i) => (
                <div key={i} className="outline-list-item" draggable onDragStart={cDrag.onDragStart(i)} onDragOver={cDrag.onDragOver(i)} onDragEnd={cDrag.onDragEnd}>
                  <span className="material-symbols-outlined outline-drag-handle">drag_indicator</span>
                  <input className="outline-list-input" value={c} onChange={(e) => updateConstraint(i, e.target.value)} placeholder={t('outline.constraintPlaceholder')} />
                  <button type="button" className="outline-remove-btn" onClick={() => removeConstraint(i)}>
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
