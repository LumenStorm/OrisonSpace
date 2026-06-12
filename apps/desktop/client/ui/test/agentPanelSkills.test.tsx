import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentPanel } from '../src/features/agent-panel/AgentPanel';
import { useAppStore } from '../src/shared/store/appStore';

// NOTE: The inline skill-run list and the continuation/resumable-run "workbench"
// these tests used to cover were intentionally removed from the product
// (commit 92f73d9 — "remove unused continuation-related state from agent slices").
// AgentPanel now only loads skills on mount via loadAgentSkills(); the skill UI
// surfaced to users is the skill-package manager in AgentSettings, reached through
// the panel's settings button. These tests cover that current behavior.

const skillPackagesFixture = [
  {
    name: 'story-tools',
    path: 'I:/echo/project/.orison/skills/story-tools',
    enabled: true,
    skills: [
      { name: 'story-setup', description: 'Prepare story context', enabled: true },
      { name: 'scene-expander', description: 'Expand scenes', enabled: false },
    ],
  },
];

describe('AgentPanel skills', () => {
  let loadAgentSkills: ReturnType<typeof vi.fn>;
  let loadSkillPackages: ReturnType<typeof vi.fn>;
  let toggleSkillPackage: ReturnType<typeof vi.fn>;
  let toggleSkill: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    loadAgentSkills = vi.fn().mockResolvedValue(undefined);
    loadSkillPackages = vi.fn().mockResolvedValue(undefined);
    toggleSkillPackage = vi.fn().mockResolvedValue(undefined);
    toggleSkill = vi.fn().mockResolvedValue(undefined);

    useAppStore.setState({
      currentProject: {
        projectId: 'p1',
        name: 'Cold City',
        path: 'I:/echo/project',
        type: 'novel',
      },
      resolvedLocale: 'en-US',
      agentMessages: [],
      agentLoading: false,
      agentError: null,
      agentSessionId: 'session-1',
      agentSkills: [],
      agentSkillError: null,
      loadAgentSkills,
      skillPackages: [],
      skillPackagesLoading: false,
      loadSkillPackages,
      toggleSkillPackage,
      toggleSkill,
    } as any);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('loads project skills on mount and lists skill packages in settings', async () => {
    useAppStore.setState({ skillPackages: skillPackagesFixture } as any);

    render(<AgentPanel />);

    // Skills are loaded for the active project when the panel mounts.
    expect(loadAgentSkills).toHaveBeenCalled();

    // Open the skill-package manager via the settings button.
    await userEvent.click(screen.getByRole('button', { name: /Settings/i }));

    // The package manager loads packages and renders the package name.
    expect(loadSkillPackages).toHaveBeenCalled();
    expect(screen.getByText('story-tools')).toBeInTheDocument();
    expect(screen.getByText('I:/echo/project/.orison/skills/story-tools')).toBeInTheDocument();
  });

  it('expands a package and toggles an individual skill', async () => {
    useAppStore.setState({ skillPackages: skillPackagesFixture } as any);

    render(<AgentPanel />);
    await userEvent.click(screen.getByRole('button', { name: /Settings/i }));

    // Skill rows are hidden until the package is expanded.
    expect(screen.queryByText('story-setup')).not.toBeInTheDocument();

    const pkgRow = screen.getByText('story-tools').closest('.agent-settings-pkg') as HTMLElement;
    expect(pkgRow).toBeTruthy();
    await userEvent.click(within(pkgRow).getByRole('button'));

    // Both skills render once expanded, with their descriptions.
    expect(screen.getByText('story-setup')).toBeInTheDocument();
    expect(screen.getByText('Prepare story context')).toBeInTheDocument();
    const expanderRow = screen.getByText('scene-expander').closest('.agent-settings-skill-row') as HTMLElement;
    expect(expanderRow).toBeTruthy();

    // Enabling the currently-disabled scene-expander skill forwards to the store.
    await userEvent.click(within(expanderRow).getByRole('checkbox'));
    expect(toggleSkill).toHaveBeenCalledWith('story-tools', 'scene-expander', true);
  });

  it('toggles a whole skill package on and off', async () => {
    useAppStore.setState({ skillPackages: skillPackagesFixture } as any);

    render(<AgentPanel />);
    await userEvent.click(screen.getByRole('button', { name: /Settings/i }));

    const pkgRow = screen.getByText('story-tools').closest('.agent-settings-pkg-row') as HTMLElement;
    expect(pkgRow).toBeTruthy();

    // The package is enabled in the fixture; toggling it forwards `false`.
    await userEvent.click(within(pkgRow).getByRole('checkbox'));
    expect(toggleSkillPackage).toHaveBeenCalledWith('story-tools', false);
  });
});
