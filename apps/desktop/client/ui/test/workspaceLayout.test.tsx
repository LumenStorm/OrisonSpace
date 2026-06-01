import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WorkspaceLayout } from '../src/widgets/layout/WorkspaceLayout';
import { useAppStore } from '../src/shared/store/appStore';

describe('WorkspaceLayout', () => {
  beforeEach(() => {
    useAppStore.setState({ activeModule: 'overview' });
  });

  afterEach(() => {
    cleanup();
    useAppStore.setState({ activeModule: 'overview' });
  });

  it('renders the standalone overview page by default', () => {
    render(<WorkspaceLayout />);

    expect(screen.getByRole('navigation', { name: 'Main Navigation' })).toBeInTheDocument();
    expect(screen.getByText('Untitled Project')).toBeInTheDocument();
  });

  it('renders editor workspace and bottom panel for non-standalone modules', () => {
    useAppStore.setState({ activeModule: 'novel' });

    render(<WorkspaceLayout />);

    expect(screen.getByRole('navigation', { name: 'Main Navigation' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Bottom Panel Tabs' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse panel' })).toBeInTheDocument();
    expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0);
  });
});
