import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useShallow } from 'zustand/react/shallow';
import { useI18n } from '../../shared/i18n/useI18n';
import type { GitCommitEntry, GitFileDiff } from '@orison/shared-contracts';

export function TimelinePanel() {
  const { currentProject, locale } = useAppStore(
    useShallow((s) => ({
      currentProject: s.currentProject,
      locale: s.resolvedLocale,
    })),
  );
  const { t } = useI18n(locale);

  const [isRepo, setIsRepo] = useState(false);
  const [commits, setCommits] = useState<GitCommitEntry[]>([]);
  const [selectedOid, setSelectedOid] = useState<string | null>(null);
  const [diff, setDiff] = useState<GitFileDiff[]>([]);
  const [loading, setLoading] = useState(false);

  const projectDir = currentProject?.path ?? null;

  useEffect(() => {
    if (!projectDir) return;
    void (async () => {
      const repo = await window.orisonDesktop?.gitIsRepo(projectDir);
      setIsRepo(!!repo);
      if (repo) {
        setLoading(true);
        const log = await window.orisonDesktop?.gitLog(projectDir, 50);
        setCommits(log ?? []);
        setLoading(false);
      }
    })();
  }, [projectDir]);

  const handleSelectCommit = useCallback(async (oid: string) => {
    if (!projectDir) return;
    setSelectedOid(oid);
    const d = await window.orisonDesktop?.gitCommitDiff(projectDir, oid);
    setDiff(d ?? []);
  }, [projectDir]);

  if (!projectDir) {
    return <div className="timeline-empty">{t('timeline.noProject')}</div>;
  }

  if (!isRepo) {
    return <div className="timeline-empty">{t('timeline.notARepo')}</div>;
  }

  if (loading) {
    return <div className="timeline-empty">{t('timeline.loading')}</div>;
  }

  return (
    <div className="timeline-panel">
      <div className="timeline-list">
        {commits.map((c) => (
          <button
            key={c.oid}
            type="button"
            className={`timeline-commit${selectedOid === c.oid ? ' is-selected' : ''}`}
            onClick={() => { void handleSelectCommit(c.oid); }}
          >
            <span className="timeline-commit-msg">{c.message.split('\n')[0]}</span>
            <span className="timeline-commit-meta">
              {c.author} · {new Date(c.timestamp * 1000).toLocaleDateString()}
            </span>
          </button>
        ))}
        {commits.length === 0 && (
          <div className="timeline-empty">{t('timeline.noCommits')}</div>
        )}
      </div>
      {selectedOid && diff.length > 0 && (
        <div className="timeline-diff">
          <h4 className="timeline-diff-title">{t('timeline.changedFiles')}</h4>
          <ul className="timeline-diff-list">
            {diff.map((d) => (
              <li key={d.filepath} className={`timeline-diff-item timeline-diff-${d.status}`}>
                <span className="timeline-diff-status">{d.status[0].toUpperCase()}</span>
                <span className="timeline-diff-path">{d.filepath}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
