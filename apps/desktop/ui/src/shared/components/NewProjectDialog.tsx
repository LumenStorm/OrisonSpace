import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useI18n } from '../i18n/useI18n';

type Props = {
  onClose: () => void;
};

export function NewProjectDialog({ onClose }: Props) {
  const openProject = useAppStore((s) => s.openProject);
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);
  const [name, setName] = useState('');
  const [type, setType] = useState<'novel' | 'script'>('novel');

  const handleCreate = () => {
    if (!name.trim()) return;
    openProject({ name: name.trim(), path: '', type });
    onClose();
  };

  return (
    <div className="topbar-new-dialog-overlay" onClick={onClose}>
      <div className="topbar-new-dialog" onClick={(e) => e.stopPropagation()}>
        <input
          className="auth-input"
          type="text"
          placeholder={t('projects.projectName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          autoFocus
        />
        <div className="projects-type-selector">
          <span className="sidebar-settings-label">{t('projects.projectType')}</span>
          <div className="sidebar-settings-options">
            <button
              type="button"
              className={`sidebar-settings-option${type === 'novel' ? ' is-active' : ''}`}
              onClick={() => setType('novel')}
            >
              {t('projects.typeNovel')}
            </button>
            <button
              type="button"
              className={`sidebar-settings-option${type === 'script' ? ' is-active' : ''}`}
              onClick={() => setType('script')}
            >
              {t('projects.typeScript')}
            </button>
          </div>
        </div>
        <div className="topbar-new-dialog-actions">
          <button type="button" className="auth-submit" onClick={handleCreate}>{t('projects.create')}</button>
          <button type="button" className="projects-cancel" onClick={onClose}>{t('projects.cancel')}</button>
        </div>
      </div>
    </div>
  );
}
