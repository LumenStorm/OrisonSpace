import { useEffect, useState } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { storyboardFrames } from '../../shared/data/workspaceData';

// NOTE: Storyboard is intentionally NOT reachable from the UI right now. No
// nav entry (side-nav/navItems.ts) and no `setActivePage('storyboard')` call
// exists, so this page never mounts in normal use. It overlaps with the
// Outline/Overview features and still falls back to mock `storyboardFrames`
// data, so it's parked rather than removed — the component, route case in
// WorkspaceLayout, and the `storyboard` schema are kept for a future rework.
// Do not wire a nav entry back in without finishing the real shot pipeline.

type Shot = { id: string; sort_order: number; description: string; image_url?: string };

export function StoryboardCanvas() {
  const projectPath = useAppStore((s) => s.currentProject?.path);
  const hydrated = useAppStore((s) => s.projectDocumentHydrated);
  const [shots, setShots] = useState<Shot[]>([]);

  useEffect(() => {
    if (!projectPath || !hydrated) return;
    window.orisonDesktop?.loadProjectDocument(projectPath).then((doc: any) => {
      if (doc?.storyboard?.shots?.length) {
        setShots(doc.storyboard.shots.sort((a: Shot, b: Shot) => a.sort_order - b.sort_order));
      }
    });
  }, [projectPath, hydrated]);

  const frames = shots.length > 0
    ? shots.map((s) => ({ id: s.id, title: s.description }))
    : storyboardFrames;

  return (
    <div className="storyboard-grid" aria-label="Storyboard Canvas">
      {frames.map((frame, index) => (
        <article key={frame.id} className="storyboard-card">
          <div className={`storyboard-frame${index === 0 ? ' storyboard-frameActive' : ''}`}>
            <div className="storyboard-badge">{frame.id}</div>
          </div>
          <p className="storyboard-copy">{frame.title}</p>
        </article>
      ))}
    </div>
  );
}
