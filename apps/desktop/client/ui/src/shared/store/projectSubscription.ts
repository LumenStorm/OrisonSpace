import type { ProjectMeta } from './types';
import { runProjectResets } from './resetRegistry';
import { chaptersFromProjectDocument, deriveChaptersFromDisk } from './chapterDiskDerivation';

type AppStoreApi = {
  subscribe: (listener: (state: any) => void) => () => void;
  getState: () => any;
  setState: (partial: any) => void;
};

let prevProject: ProjectMeta | null = null;
let installed = false;

export function installProjectSubscription(useAppStore: AppStoreApi) {
  if (installed) return;
  installed = true;

  useAppStore.subscribe((state) => {
    const project = state.currentProject;
    if (project === prevProject) return;
    const prev = prevProject;
    prevProject = project;

    // Compare by PATH, not object reference: editing project meta (rename,
    // logline…) produces a new currentProject object with the SAME path. That
    // must NOT be treated as a project switch — otherwise resetAll() flushes +
    // wipes ALL project-scoped state (open files, creative fields, agent…) and
    // reloads the document, clobbering in-flight Outline edits on every rename
    // keystroke. Only a genuine path change is a real switch.
    const isSwitch = (project?.path ?? null) !== (prev?.path ?? null);
    if (!isSwitch) return;

    // Flush the previous project's dirty open files to disk before tearing down
    // its state. The reset clears `openFiles`, so an un-flushed buffer would be
    // lost silently. Fire-and-forget: saveFile writes by absolute path, which is
    // still valid even after the store has moved on to the new project.
    const flushPrevDirty = () => {
      const s = useAppStore.getState() as any;
      if (prev && typeof s.saveAllOpenFiles === 'function' && s.hasDirtyFiles?.()) {
        void s.saveAllOpenFiles();
      }
    };

    // Drop ALL project-scoped slice state (open files, chapters, creative fields,
    // agent conversation, pending diffs, split view…) via the reset registry, so
    // nothing bleeds across projects. Each slice owns its own reset.
    const resetAll = () => {
      flushPrevDirty();
      runProjectResets();
    };

    if (!project && prev) {
      resetAll();
      useAppStore.setState({
        chapterCandidate: null,
        chapterCandidateStatus: 'idle',
        chapterCandidateError: null,
      } as any);
      return;
    }

    if (project && project !== prev) {
      resetAll();
      useAppStore.setState({
        chapterCandidate: null,
        chapterCandidateStatus: 'idle',
        chapterCandidateError: null,
        projectDocumentHydrated: false,
      } as any);

      state.addRecentProject(project);
      state.loadBgTasks();

      if (project.path && window.orisonDesktop?.loadProjectDocument) {
        window.orisonDesktop.loadProjectDocument(project.path).then(async (doc) => {
          const current = useAppStore.getState();
          if (current.currentProject?.path !== project.path) return;
          if (doc) current.loadCreativeFields(doc as any);
          const storedChapters = chaptersFromProjectDocument(doc);
          const chapters = await deriveChaptersFromDisk(project.path, storedChapters);
          const latest = useAppStore.getState();
          if (latest.currentProject?.path !== project.path) return;
          latest.setNovelChapters(chapters);
          await latest.restoreProjectTabs?.(project.path);
          if (useAppStore.getState().currentProject?.path !== project.path) return;
          useAppStore.setState({ projectDocumentHydrated: true });
          latest.refreshWordCount();
        }).catch(() => {
          if (useAppStore.getState().currentProject?.path === project.path) {
            useAppStore.setState({ projectDocumentHydrated: true });
          }
        });
      }
    }
  });
}
