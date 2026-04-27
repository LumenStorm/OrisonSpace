import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useI18n } from '../i18n/useI18n';
import { ensureProjectRegistration } from '../api/projects';

type Props = {
  onClose: () => void;
};

export function NewProjectDialog({ onClose }: Props) {
  const openProject = useAppStore((s) => s.openProject);
  const token = useAppStore((s) => s.token);
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);

  const [name, setName] = useState('');
  const [type, setType] = useState<'novel' | 'script'>('novel');
  const [parentDir, setParentDir] = useState('');
  const [coverSrc, setCoverSrc] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const handlePickDir = async () => {
    const dir = await window.orisonDesktop?.pickProjectDirectory();
    if (dir) setParentDir(dir);
  };

  const handlePickCover = async () => {
    const file = await window.orisonDesktop?.pickCoverImage();
    if (file) setCoverSrc(file);
  };

  const handleRemoveCover = () => setCoverSrc(null);

  const canCreate = name.trim() && parentDir;

  const handleCreate = async () => {
    if (!canCreate || creating) return;
    setCreating(true);
    try {
      const projectDir = await window.orisonDesktop.createProjectDirectory(parentDir, name.trim());

      let coverImage: string | undefined;
      if (coverSrc) {
        coverImage = await window.orisonDesktop.copyCoverImage(coverSrc, projectDir);
      }

      let projectId: string | undefined;
      if (token) {
        try {
          projectId = await ensureProjectRegistration({
            token,
            project: { name: name.trim(), type, path: projectDir }
          });
        } catch {
          projectId = undefined;
        }
      }

      const meta = {
        name: name.trim(),
        type,
        coverImage: coverImage ?? null,
        projectId: projectId ?? null
      };
      await window.orisonDesktop.saveProjectMeta(projectDir, meta);

      openProject({ projectId, name: name.trim(), path: projectDir, type, coverImage });
      onClose();
    } catch {
      setCreating(false);
    }
  };

  return (
    <div className="topbar-new-dialog-overlay" onClick={onClose}>
      <div className="settings-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="settings-dialog-header">
          <h2 className="settings-dialog-title">{t('projects.newProject')}</h2>
          <button type="button" className="settings-dialog-close" onClick={onClose} aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="settings-dialog-body">
          {/* 项目名称 */}
          <div className="sidebar-settings-row">
            <span className="sidebar-settings-label">{t('projects.projectName')}</span>
            <input
              className="auth-input"
              type="text"
              placeholder={t('projects.projectName')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>

          {/* 项目类型 */}
          <div className="sidebar-settings-row">
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

          {/* 存储位置 */}
          <div className="sidebar-settings-row">
            <span className="sidebar-settings-label">{t('projects.location')}</span>
            <div className="new-project-dir-row">
              <input
                className="auth-input new-project-dir-input"
                type="text"
                readOnly
                value={parentDir}
                placeholder={t('projects.locationPlaceholder')}
              />
              <button type="button" className="new-project-dir-btn" onClick={handlePickDir}>
                <span className="material-symbols-outlined">folder_open</span>
              </button>
            </div>
          </div>

          {/* 封面图（可选） */}
          <div className="sidebar-settings-row">
            <span className="sidebar-settings-label">
              {t('projects.coverImage')}
              <span className="sidebar-settings-hint" style={{ marginLeft: '0.4rem', marginTop: 0 }}>
                {t('projects.optional')}
              </span>
            </span>
            {coverSrc ? (
              <div className="new-project-cover-preview">
                <img src={`file://${coverSrc}`} alt="Cover" className="new-project-cover-img" />
                <button type="button" className="new-project-cover-remove" onClick={handleRemoveCover} aria-label="Remove">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            ) : (
              <button type="button" className="new-project-cover-pick" onClick={handlePickCover}>
                <span className="material-symbols-outlined">add_photo_alternate</span>
                <span>{t('projects.pickCover')}</span>
              </button>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="topbar-new-dialog-actions">
            <button
              type="button"
              className="auth-submit"
              onClick={handleCreate}
              disabled={!canCreate || creating}
            >
              {creating ? t('auth.pleaseWait') : t('projects.create')}
            </button>
            <button type="button" className="projects-cancel" onClick={onClose}>
              {t('projects.cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
