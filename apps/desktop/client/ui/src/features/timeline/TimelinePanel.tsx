import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useShallow } from 'zustand/react/shallow';
import { useI18n } from '../../shared/i18n/useI18n';
import { useToastStore } from '../../shared/store/toastStore';
import type { GitCommitEntry, GitFileDiff } from '@orison/shared-contracts';
import {
  gitIsRepo, gitInit, gitLog, gitListBranches, gitCurrentBranch,
  gitCommitDiff, gitCreateNode, gitCheckoutBranch, gitCreateBranch, gitStatusCount,
  gitRestoreVersion,
} from '../../shared/api/git';

function errorReason(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function formatRelativeTime(timestamp: number, t: (key: string, vars?: Record<string, string | number>) => string): string {
  const now = Date.now();
  const diff = now - timestamp * 1000;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t('timeline.timeJustNow');
  if (minutes < 60) return t('timeline.timeMinutesAgo', { value: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('timeline.timeHoursAgo', { value: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return t('timeline.timeDaysAgo', { value: days });
  const months = Math.floor(days / 30);
  if (months < 12) return t('timeline.timeMonthsAgo', { value: months });
  return t('timeline.timeYearsAgo', { value: Math.floor(months / 12) });
}

/* ── Graph layout ── */

type GraphNode = {
  commit: GitCommitEntry;
  col: number;
  lines: { fromCol: number; toCol: number; type: 'straight' | 'merge' | 'fork' }[];
};

function computeGraph(commits: GitCommitEntry[]): GraphNode[] {
  if (commits.length === 0) return [];

  // Active columns: each slot holds the OID that "owns" that column going downward
  const activeCols: (string | null)[] = [];
  const result: GraphNode[] = [];

  function findCol(oid: string): number {
    const idx = activeCols.indexOf(oid);
    return idx >= 0 ? idx : -1;
  }

  function allocCol(): number {
    const idx = activeCols.indexOf(null);
    if (idx >= 0) return idx;
    activeCols.push(null);
    return activeCols.length - 1;
  }

  for (const commit of commits) {
    let col = findCol(commit.oid);
    if (col === -1) {
      col = allocCol();
      activeCols[col] = commit.oid;
    }

    const lines: GraphNode['lines'] = [];

    // First parent continues in the same column
    if (commit.parents.length > 0) {
      activeCols[col] = commit.parents[0];
      lines.push({ fromCol: col, toCol: col, type: 'straight' });
    } else {
      activeCols[col] = null;
    }

    // Additional parents = merge lines coming from other columns
    for (let i = 1; i < commit.parents.length; i++) {
      const parentOid = commit.parents[i];
      let parentCol = findCol(parentOid);
      if (parentCol === -1) {
        parentCol = allocCol();
        activeCols[parentCol] = parentOid;
      }
      lines.push({ fromCol: parentCol, toCol: col, type: 'merge' });
    }

    // Check for forks: if a parent appears in multiple active slots, that's a fork visualization
    // Also draw pass-through lines for other active columns
    for (let c = 0; c < activeCols.length; c++) {
      if (c === col) continue;
      if (activeCols[c] !== null) {
        lines.push({ fromCol: c, toCol: c, type: 'straight' });
      }
    }

    result.push({ commit, col, lines });
  }

  return result;
}

/* ── Constants ── */
const COL_WIDTH = 18;
const NODE_RADIUS = 6;
const ROW_HEIGHT = 52;
const BRANCH_COLORS = ['var(--accent)', '#4a86c5', '#b07a3d', '#c44444', '#4caf50', '#9c27b0'];

export function TimelinePanel() {
  const { currentProject, locale } = useAppStore(
    useShallow((s) => ({
      currentProject: s.currentProject,
      locale: s.resolvedLocale,
    })),
  );
  const { t } = useI18n(locale);
  const showToast = useToastStore((s) => s.showToast);

  const [isRepo, setIsRepo] = useState(false);
  const [commits, setCommits] = useState<GitCommitEntry[]>([]);
  const [selectedOid, setSelectedOid] = useState<string | null>(null);
  const [diff, setDiff] = useState<GitFileDiff[]>([]);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [initError, setInitError] = useState(false);

  const [branches, setBranches] = useState<string[]>([]);
  const [currentBranch, setCurrentBranch] = useState('');

  const [showCreateNode, setShowCreateNode] = useState(false);
  const [nodeMessage, setNodeMessage] = useState('');
  const [nodeTag, setNodeTag] = useState('');

  const [showCreateBranch, setShowCreateBranch] = useState<string | null>(null);
  const [branchName, setBranchName] = useState('');
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);

  const projectDir = currentProject?.path ?? null;

  const refresh = useCallback(async () => {
    if (!projectDir) return;
    const repo = await gitIsRepo(projectDir);
    setIsRepo(repo);
    if (!repo) return;
    setLoading(true);
    const [log, branchList, branch] = await Promise.all([
      gitLog(projectDir, 50),
      gitListBranches(projectDir),
      gitCurrentBranch(projectDir),
    ]);
    setCommits(log);
    setBranches(branchList);
    setCurrentBranch(branch);
    setLoading(false);
  }, [projectDir]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const unsub = window.orisonDesktop?.onToolEvent((data) => {
      if (data.type === 'git:changed') void refresh();
    });
    return () => { unsub?.(); };
  }, [refresh]);

  const graph = useMemo(() => computeGraph(commits), [commits]);
  const maxCol = useMemo(() => Math.max(0, ...graph.map((n) => n.col)), [graph]);
  const graphWidth = (maxCol + 1) * COL_WIDTH + 8;

  const handleSelectCommit = useCallback(async (oid: string) => {
    if (!projectDir) return;
    setSelectedOid(oid === selectedOid ? null : oid);
    if (oid !== selectedOid) {
      const d = await gitCommitDiff(projectDir, oid);
      setDiff(d);
    } else {
      setDiff([]);
    }
  }, [projectDir, selectedOid]);

  const handleCreateNode = useCallback(async () => {
    if (!projectDir || !nodeMessage.trim()) return;
    try {
      await gitCreateNode(projectDir, nodeMessage.trim(), nodeTag.trim() || undefined);
      setNodeMessage('');
      setNodeTag('');
      setShowCreateNode(false);
      showToast(t('timeline.nodeCreated'), 'success');
    } catch (err) {
      showToast(t('timeline.nodeCreateFailed', { reason: errorReason(err) }), 'error');
    }
  }, [projectDir, nodeMessage, nodeTag, showToast, t]);

  const handleCreateBranch = useCallback(async () => {
    if (!projectDir || !branchName.trim() || !showCreateBranch) return;
    try {
      await gitCreateBranch(projectDir, branchName.trim(), showCreateBranch);
      setBranchName('');
      setShowCreateBranch(null);
      await refresh();
      showToast(t('timeline.branchCreated'), 'success');
    } catch (err) {
      showToast(t('timeline.branchCreateFailed', { reason: errorReason(err) }), 'error');
    }
  }, [projectDir, branchName, showCreateBranch, refresh, showToast, t]);

  const handleCheckout = useCallback(async (name: string) => {
    if (!projectDir) return;
    const dirty = await gitStatusCount(projectDir);
    if (dirty > 0) {
      if (!window.confirm(t('timeline.dirtyWarning'))) return;
    }
    try {
      await gitCheckoutBranch(projectDir, name);
    } catch (err) {
      showToast(t('timeline.checkoutFailed', { reason: errorReason(err) }), 'error');
    }
  }, [projectDir, t, showToast]);

  const handleRestoreVersion = useCallback(async (oid: string) => {
    if (!projectDir) return;
    const dirty = await gitStatusCount(projectDir);
    if (dirty > 0) {
      if (!window.confirm(t('timeline.dirtyWarning'))) return;
    }
    try {
      // Restores land as a new node on the current branch (linear history)
      // instead of permanently creating a restore-* branch per click.
      await gitRestoreVersion(projectDir, oid, t('timeline.restoreMessage', { id: oid.slice(0, 7) }));
      await refresh();
      showToast(t('timeline.restoreSuccess'), 'success');
    } catch (err) {
      showToast(t('timeline.restoreFailed', { reason: errorReason(err) }), 'error');
    }
  }, [projectDir, t, refresh, showToast]);

  const handleInit = useCallback(async () => {
    if (!projectDir) return;
    setInitializing(true);
    setInitError(false);
    try {
      await gitInit(projectDir);
      await refresh();
    } catch {
      setInitError(true);
    } finally {
      setInitializing(false);
    }
  }, [projectDir, refresh]);

  if (!projectDir) {
    return <div className="timeline-empty">{t('timeline.noProject')}</div>;
  }
  if (!isRepo) {
    return (
      <div className="timeline-onboard">
        <span className="material-symbols-outlined timeline-onboard-icon" aria-hidden="true">history</span>
        <h3 className="timeline-onboard-title">{t('timeline.initTitle')}</h3>
        <p className="timeline-onboard-desc">{t('timeline.initDescription')}</p>
        <button
          type="button"
          className="timeline-onboard-btn"
          onClick={() => { void handleInit(); }}
          disabled={initializing}
        >
          {initializing ? t('timeline.initializing') : t('timeline.initButton')}
        </button>
        {initError && <p className="timeline-onboard-error">{t('timeline.initFailed')}</p>}
      </div>
    );
  }
  if (loading) {
    return <div className="timeline-empty" role="status" aria-live="polite">{t('timeline.loading')}</div>;
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

      {/* Commit graph list */}
      <div className="timeline-list">
        {graph.map((node, idx) => {
          const isDimmed = hoveredCol !== null && hoveredCol !== node.col;
          return (
          <div
            key={node.commit.oid}
            className={`timeline-commit${selectedOid === node.commit.oid ? ' is-selected' : ''}${isDimmed ? ' is-dimmed' : ''}`}
            onMouseEnter={() => setHoveredCol(node.col)}
            onMouseLeave={() => setHoveredCol(null)}
          >
            {/* SVG graph rail */}
            <svg
              className="timeline-graph-svg"
              width={graphWidth}
              height={ROW_HEIGHT}
              aria-hidden="true"
            >
              {node.lines.map((line, li) => {
                const x1 = line.fromCol * COL_WIDTH + COL_WIDTH / 2;
                const x2 = line.toCol * COL_WIDTH + COL_WIDTH / 2;
                const midY = ROW_HEIGHT / 2;
                const color = BRANCH_COLORS[line.fromCol % BRANCH_COLORS.length];
                if (line.type === 'straight') {
                  return (
                    <line
                      key={li}
                      x1={x1} y1={0} x2={x2} y2={ROW_HEIGHT}
                      className="timeline-graph-line"
                      stroke={color}
                    />
                  );
                }
                return (
                  <path
                    key={li}
                    d={`M${x1},${ROW_HEIGHT} C${x1},${midY} ${x2},${midY} ${x2},${midY}`}
                    className="timeline-graph-line timeline-graph-merge"
                    stroke={color}
                  />
                );
              })}
              {/* Node dot */}
              <circle
                cx={node.col * COL_WIDTH + COL_WIDTH / 2}
                cy={ROW_HEIGHT / 2}
                r={NODE_RADIUS}
                className="timeline-graph-node"
                fill={BRANCH_COLORS[node.col % BRANCH_COLORS.length]}
              />
            </svg>

            {/* Commit info */}
            <button
              type="button"
              className="timeline-commit-main"
              onClick={() => { void handleSelectCommit(node.commit.oid); }}
            >
              <span className="timeline-commit-msg">
                {node.commit.tag && <span className="timeline-tag">{node.commit.tag}</span>}
                {node.commit.message.split('\n')[0]}
              </span>
              <span className="timeline-commit-meta">
                {formatRelativeTime(node.commit.timestamp, t)}
              </span>
            </button>
            <button
              type="button"
              className="timeline-branch-btn"
              title={t('timeline.restoreVersion')}
              onClick={() => { void handleRestoreVersion(node.commit.oid); }}
            >
              <span className="material-symbols-outlined">history</span>
            </button>
            <button
              type="button"
              className="timeline-branch-btn"
              title={t('timeline.createBranchFrom')}
              onClick={() => setShowCreateBranch(node.commit.oid)}
            >
              <span className="material-symbols-outlined">fork_right</span>
            </button>
          </div>
          );
        })}
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
                <span className="timeline-diff-path">{d.filepath.split('/').pop()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
