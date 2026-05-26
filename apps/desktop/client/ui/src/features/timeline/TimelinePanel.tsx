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

  const [branches, setBranches] = useState<string[]>([]);
  const [currentBranch, setCurrentBranch] = useState('');

  const [showCreateNode, setShowCreateNode] = useState(false);
  const [nodeMessage, setNodeMessage] = useState('');
  const [nodeTag, setNodeTag] = useState('');

  const [showCreateBranch, setShowCreateBranch] = useState<string | null>(null);
  const [branchName, setBranchName] = useState('');

  const projectDir = currentProject?.path ?? null;

  const refresh = useCallback(async () => {
    if (!projectDir) return;
    const repo = await window.orisonDesktop?.gitIsRepo(projectDir);
    setIsRepo(!!repo);
    if (!repo) return;
    setLoading(true);
    const [log, branchList, branch] = await Promise.all([
      window.orisonDesktop?.gitLog(projectDir, 50),
      window.orisonDesktop?.gitListBranches(projectDir),
      window.orisonDesktop?.gitCurrentBranch(projectDir),
    ]);
    setCommits(log ?? []);
    setBranches(branchList ?? []);
    setCurrentBranch(branch ?? 'HEAD');
    setLoading(false);
  }, [projectDir]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Listen for git:changed events to auto-refresh
  useEffect(() => {
    const unsub = window.orisonDesktop?.onToolEvent((data) => {
      if (data.type === 'git:changed') void refresh();
    });
    return () => { unsub?.(); };
  }, [refresh]);

  const handleSelectCommit = useCallback(async (oid: string) => {
    if (!projectDir) return;
    setSelectedOid(oid === selectedOid ? null : oid);
    if (oid !== selectedOid) {
      const d = await window.orisonDesktop?.gitCommitDiff(projectDir, oid);
      setDiff(d ?? []);
    } else {
      setDiff([]);
    }
  }, [projectDir, selectedOid]);

  const handleCreateNode = useCallback(async () => {
    if (!projectDir || !nodeMessage.trim()) return;
    await window.orisonDesktop?.gitCreateNode(projectDir, nodeMessage.trim(), nodeTag.trim() || undefined);
    setNodeMessage('');
    setNodeTag('');
    setShowCreateNode(false);
  }, [projectDir, nodeMessage, nodeTag]);

  const handleCreateBranch = useCallback(async () => {
    if (!projectDir || !branchName.trim() || !showCreateBranch) return;
    await window.orisonDesktop?.gitCreateBranch(projectDir, branchName.trim(), showCreateBranch);
    setBranchName('');
    setShowCreateBranch(null);
    await refresh();
  }, [projectDir, branchName, showCreateBranch, refresh]);

  const handleCheckout = useCallback(async (name: string) => {
    if (!projectDir) return;
    await window.orisonDesktop?.gitCheckoutBranch(projectDir, name);
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
      {/* Branch header */}
      <div className="timeline-header">
        <select
          className="timeline-branch-select"
          value={currentBranch}
          onChange={(e) => { void handleCheckout(e.target.value); }}
        >
          {branches.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <button
          type="button"
          className="timeline-action-btn"
          onClick={() => setShowCreateNode(!showCreateNode)}
          title={t('timeline.createNode')}
        >
          <span className="material-symbols-outlined">add_circle</span>
        </button>
      </div>

      {/* Create node form */}
      {showCreateNode && (
        <div className="timeline-create-form">
          <input
            className="timeline-input"
            placeholder={t('timeline.nodeMessage')}
            value={nodeMessage}
            onChange={(e) => setNodeMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleCreateNode(); }}
          />
          <input
            className="timeline-input"
            placeholder={t('timeline.nodeTag')}
            value={nodeTag}
            onChange={(e) => setNodeTag(e.target.value)}
          />
          <button
            type="button"
            className="timeline-submit-btn"
            onClick={() => { void handleCreateNode(); }}
            disabled={!nodeMessage.trim()}
          >
            {t('timeline.save')}
          </button>
        </div>
      )}

      {/* Create branch form */}
      {showCreateBranch && (
        <div className="timeline-create-form">
          <input
            className="timeline-input"
            placeholder={t('timeline.branchName')}
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleCreateBranch(); }}
            autoFocus
          />
          <div className="timeline-form-actions">
            <button
              type="button"
              className="timeline-submit-btn"
              onClick={() => { void handleCreateBranch(); }}
              disabled={!branchName.trim()}
            >
              {t('timeline.create')}
            </button>
            <button
              type="button"
              className="timeline-cancel-btn"
              onClick={() => setShowCreateBranch(null)}
            >
              {t('timeline.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Commit list */}
      <div className="timeline-list">
        {commits.map((c) => (
          <div key={c.oid} className={`timeline-commit${selectedOid === c.oid ? ' is-selected' : ''}`}>
            <button
              type="button"
              className="timeline-commit-main"
              onClick={() => { void handleSelectCommit(c.oid); }}
            >
              <span className="timeline-commit-msg">
                {c.tag && <span className="timeline-tag">{c.tag}</span>}
                {c.message.split('\n')[0]}
              </span>
              <span className="timeline-commit-meta">
                {c.author} · {new Date(c.timestamp * 1000).toLocaleDateString()}
              </span>
            </button>
            <button
              type="button"
              className="timeline-branch-btn"
              title={t('timeline.createBranchFrom')}
              onClick={() => setShowCreateBranch(c.oid)}
            >
              <span className="material-symbols-outlined">fork_right</span>
            </button>
          </div>
        ))}
        {commits.length === 0 && (
          <div className="timeline-empty">{t('timeline.noCommits')}</div>
        )}
      </div>

      {/* Diff section */}
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
