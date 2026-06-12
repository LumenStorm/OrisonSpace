import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WorkspaceLayout } from '../src/widgets/layout/WorkspaceLayout';
import { useAppStore } from '../src/shared/store/appStore';

describe('WorkspaceLayout', () => {
  beforeEach(() => {
    useAppStore.setState({ activePage: 'overview' });
  });

  afterEach(() => {
    cleanup();
    useAppStore.setState({ activePage: 'overview' });
  });

  it('renders the standalone overview page by default', async () => {
    render(<WorkspaceLayout />);

    expect(screen.getByRole('navigation', { name: 'Main Navigation' })).toBeInTheDocument();
    // OverviewPage is lazy-loaded; its project-name input renders the translated placeholder.
    expect(await screen.findByPlaceholderText('Project Name')).toBeInTheDocument();
  });

  it('renders editor workspace and bottom panel for non-standalone modules', () => {
    useAppStore.setState({ activePage: 'novel', bottomPanelOpen: true, agentPanelOpen: true });

    render(<WorkspaceLayout />);

    expect(screen.getByRole('navigation', { name: 'Main Navigation' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Bottom Panel Tabs' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse panel' })).toBeInTheDocument();
    expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0);
  });
});
