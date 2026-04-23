import { useState } from 'react';
import { TiptapEditor } from './TiptapEditor';

type Act = {
  id: string;
  title: string;
  summary: string;
};

export function OutlineEditor() {
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

  return (
    <div className="outline-editor">
      <div className="outline-header">
        <input
          className="outline-title-input"
          placeholder="Project Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="outline-logline-input"
          placeholder="Logline — one sentence that captures the story"
          value={logline}
          onChange={(e) => setLogline(e.target.value)}
          rows={2}
        />
        <div className="outline-style-grid">
          {([
            ['visual', 'Visual Style'],
            ['narrative', 'Narrative Style'],
            ['pacing', 'Pacing'],
            ['reference', 'Reference'],
          ] as const).map(([key, label]) => (
            <div key={key} className="outline-style-field">
              <label className="outline-style-label">{label}</label>
              <input
                className="outline-style-input"
                placeholder={label}
                value={style[key]}
                onChange={(e) => setStyle({ ...style, [key]: e.target.value })}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="outline-acts">
        <div className="outline-acts-header">
          <h3 className="outline-acts-title">Acts</h3>
          <button type="button" className="outline-add-btn" onClick={addAct}>
            <span className="material-symbols-outlined" aria-hidden="true">add</span>
            Add Act
          </button>
        </div>

        {acts.length === 0 && (
          <p style={{ color: 'var(--outline)', fontSize: '0.88rem', margin: 0 }}>
            No acts yet. Add one to start structuring your story.
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
                  placeholder="Act title"
                  value={act.title}
                  onChange={(e) => updateAct(act.id, { title: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              {isOpen && (
                <div className="outline-act-body">
                  <TiptapEditor
                    content={act.summary}
                    placeholder="Write the act summary..."
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
