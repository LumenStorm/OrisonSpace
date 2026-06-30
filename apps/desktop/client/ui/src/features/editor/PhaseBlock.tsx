import { useState, useRef } from 'react';
import type { z } from 'zod';
import type { outlinePhaseSchema } from '@orison/shared-contracts';
import { useI18n } from '../../shared/i18n/useI18n';
import { useAppStore } from '../../shared/store/appStore';

type OutlinePhase = z.infer<typeof outlinePhaseSchema>;

type Props = {
  phase: OutlinePhase;
  index: number;
  onUpdate: (id: string, patch: Partial<OutlinePhase>) => void;
  onRemove: (id: string) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  t: (key: string) => string;
};

export function PhaseBlock({ phase, index, onUpdate, onRemove, onDragStart, onDragOver, onDragEnd, t }: Props) {
  const [open, setOpen] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const chapters = phase.estimated_chapters ?? 0;

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    titleRef.current?.focus();
  };

  return (
    <div
      className={`outline-phase${open ? ' is-open' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="outline-phase-header" onClick={() => setOpen((v) => !v)}>
        <span className="outline-drag-handle material-symbols-outlined" onMouseDown={(e) => e.stopPropagation()}>
          drag_indicator
        </span>
        <span className="outline-phase-chevron material-symbols-outlined">
          chevron_right
        </span>
        <span className="outline-phase-index">{index + 1}</span>
        <input
          ref={titleRef}
          className="outline-phase-title"
          value={phase.title}
          onChange={(e) => onUpdate(phase.id, { title: e.target.value })}
          onClick={handleTitleClick}
          placeholder={t('outline.phaseTitle')}
        />
        {chapters > 0 && (
          <span className="outline-phase-chapters">
            <span className="material-symbols-outlined">menu_book</span>
            {chapters}
          </span>
        )}
      </div>

      {open && (
        <div className="outline-phase-body">
          <div className="outline-phase-property">
            <span className="outline-phase-property-label">{t('outline.phaseGoal')}</span>
            <input
              className="outline-phase-property-value"
              value={phase.goal ?? ''}
              onChange={(e) => onUpdate(phase.id, { goal: e.target.value })}
              placeholder="—"
            />
          </div>
          <div className="outline-phase-property">
            <span className="outline-phase-property-label">{t('outline.phaseAntagonist')}</span>
            <input
              className="outline-phase-property-value"
              value={phase.antagonist ?? ''}
              onChange={(e) => onUpdate(phase.id, { antagonist: e.target.value })}
              placeholder="—"
            />
          </div>
          <div className="outline-phase-property">
            <span className="outline-phase-property-label">{t('outline.phaseClimax')}</span>
            <input
              className="outline-phase-property-value"
              value={phase.climax ?? ''}
              onChange={(e) => onUpdate(phase.id, { climax: e.target.value })}
              placeholder="—"
            />
          </div>
          <div className="outline-phase-property">
            <span className="outline-phase-property-label">{t('outline.phaseHook')}</span>
            <input
              className="outline-phase-property-value"
              value={phase.hook ?? ''}
              onChange={(e) => onUpdate(phase.id, { hook: e.target.value })}
              placeholder="—"
            />
          </div>
          <div className="outline-phase-property">
            <span className="outline-phase-property-label">{t('outline.estimatedChapters')}</span>
            <input
              className="outline-phase-property-value"
              type="number"
              min={0}
              value={phase.estimated_chapters ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') { onUpdate(phase.id, { estimated_chapters: undefined }); return; }
                const n = Math.max(0, Math.floor(Number(raw)));
                onUpdate(phase.id, { estimated_chapters: Number.isFinite(n) ? n : undefined });
              }}
              placeholder="—"
            />
          </div>
          <div className="outline-phase-actions">
            <button type="button" className="outline-remove-action" onClick={() => onRemove(phase.id)}>
              <span className="material-symbols-outlined">delete</span>
              {t('outline.removePhase')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
