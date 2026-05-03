import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WorkspaceLayout } from '../src/widgets/layout/WorkspaceLayout';

describe('WorkspaceLayout', () => {
  it('renders the navigation rail, editor workspace, and bottom inspector panel', () => {
    render(<WorkspaceLayout />);

    expect(screen.getByRole('navigation', { name: 'Main Navigation' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Bottom Panel Tabs' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse panel' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('outline.projectTitle')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0);
  });
});
