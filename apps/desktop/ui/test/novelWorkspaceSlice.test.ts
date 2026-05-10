import { describe, expect, it } from 'vitest';
import { useAppStore } from '../src/shared/store/appStore';

describe('novelWorkspaceSlice', () => {
  it('defaults novel projects to novel home and switches object categories explicitly', () => {
    useAppStore.setState({
      currentProject: {
        name: 'Memory City',
        path: 'C:/Projects/MemoryCity',
        type: 'novel',
      },
    } as any);

    useAppStore.getState().enterNovelWorkspace();
    expect(useAppStore.getState().novelWorkspace.route).toBe('home');

    useAppStore.getState().selectNovelObjectCategory('characters');
    expect(useAppStore.getState().novelWorkspace.route).toBe('objects');
    expect(useAppStore.getState().novelWorkspace.objectCategory).toBe('characters');
  });
});
