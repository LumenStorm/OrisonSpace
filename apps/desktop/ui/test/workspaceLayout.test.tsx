import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WorkspaceLayout } from '../src/widgets/layout/WorkspaceLayout';

describe('WorkspaceLayout', () => {
  it('renders icon rail, editor area, and inspector', () => {
    render(<WorkspaceLayout />);

    expect(screen.getByText('Orison Space')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main Navigation' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Inspector Panel' })).toBeInTheDocument();
  });
});
