import type { ProjectMeta } from './types';

let prevProject: ProjectMeta | null = null;
let installed = false;

export function installProjectSubscription(useAppStore: typeof import('./appStore').useAppStore) {
  if (installed) return;
  installed = true;

  useAppStore.subscribe((state) => {
    const project = state.currentProject;
    if (project === prevProject) return;
    const prev = prevProject;
    prevProject = project;

    if (!project && prev) {
      useAppStore.setState({
        creativeFields: {},
        fieldMetadata: {},
        novelChapters: [],
        activeChapterId: null,
        chapterCandidate: null,
        chapterCandidateStatus: 'idle',
        chapterCandidateError: null,
      } as any);
      return;
    }

    if (project && project !== prev) {
      state.addRecentProject(project);
      state.loadBgTasks();

      if (project.path && window.orisonDesktop?.loadProjectDocument) {
        window.orisonDesktop.loadProjectDocument(project.path).then((doc) => {
          const current = useAppStore.getState();
          if (current.currentProject?.path !== project.path) return;
          if (!doc) {
            useAppStore.setState({ projectDocumentHydrated: true });
            return;
          }
          current.loadCreativeFields(doc as any);
          const chapters = Array.isArray((doc as any).novel?.chapters)
            ? (doc as any).novel.chapters.map((ch: any) => ({
              id: ch.id,
              title: ch.title,
              sortOrder: ch.sort_order,
              status: ch.status ?? 'draft',
              summary: ch.summary,
              summarySource: ch.summary_source,
              sections: (ch.sections ?? []).map((s: any) => ({
                id: s.id,
                title: s.title,
                sortOrder: s.sort_order,
                contentFile: s.content_file,
                wordCount: s.word_count,
              })),
            }))
            : [];
          current.setNovelChapters(chapters);
          useAppStore.setState({ projectDocumentHydrated: true });
          current.refreshWordCount();
        }).catch(() => {
          if (useAppStore.getState().currentProject?.path === project.path) {
            useAppStore.setState({ projectDocumentHydrated: true });
          }
        });
      }
    }
  });
}
