import { useState } from 'react';
import { TiptapEditor } from './TiptapEditor';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

type Act = {
  id: string;
  title: string;
  summary: string;
};

export function OutlineEditor() {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);

  const [title, setTitle] = useState('');
  const [logline, setLogline] = useState('');
  const [style, setStyle] = useState({ visual: '', narrative: '', pacing: '', reference: '' });
  const [acts, setActs] = useState<Act[]>([]);
  const [openActIds, setOpenActIds] = useState<Set<string>>(new Set());

  const addAct = () => {
    const id = `act-${Date.now()}`;
    setActs([...acts, { id, title: '', summary: '' }]);
    setOpenActIds((prev) => new Set(prev).add(id));
  };

  const updateAct = (id: string, patch: Partial<Act>) => {
    setActs(acts.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const toggleAct = (id: string) => {
    setOpenActIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const styleFields = [
    ['visual', 'outline.visualStyle'],
    ['narrative', 'outline.narrativeStyle'],
    ['pacing', 'outline.pacing'],
    ['reference', 'outline.reference'],
  ] as const;

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
        <div className="outline-style-grid">
          {styleFields.map(([key, i18nKey]) => (
            <div key={key} className="outline-style-field">
              <label className="outline-style-label">{t(i18nKey)}</label>
              <input
                className="outline-style-input"
                placeholder={t(i18nKey)}
                value={style[key]}
                onChange={(e) => setStyle({ ...style, [key]: e.target.value })}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="outline-acts">
        <div className="outline-acts-header">
          <h3 className="outline-acts-title">{t('outline.acts')}</h3>
          <button type="button" className="outline-add-btn" onClick={addAct}>
            <span className="material-symbols-outlined" aria-hidden="true">add</span>
            {t('outline.addAct')}
          </button>
        </div>

        {acts.length === 0 && (
          <p style={{ color: 'var(--outline)', fontSize: '0.88rem', margin: 0 }}>
            {t('outline.noActs')}
          </p>
        )}

        {acts.map((act) => {
          const isOpen = openActIds.has(act.id);
          return (
            <div key={act.id} className="outline-act-card">
              <div className="outline-act-header" onClick={() => toggleAct(act.id)}>
                <span className={`material-symbols-outlined outline-act-toggle${isOpen ? ' is-open' : ''}`}>
                  chevron_right
                </span>
                <input
                  className="outline-act-title-input"
                  placeholder={t('outline.actTitle')}
                  value={act.title}
                  onChange={(e) => updateAct(act.id, { title: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              {isOpen && (
                <div className="outline-act-body">
                  <TiptapEditor
                    content={act.summary}
                    placeholder={t('outline.actSummary')}
                    onChange={(html) => updateAct(act.id, { summary: html })}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
