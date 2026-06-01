import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

type Props = { onClose: () => void };

export function AgentSettings({ onClose }: Props) {
  const {
    resolvedLocale, skillPackages, skillPackagesLoading,
    loadSkillPackages, toggleSkillPackage, toggleSkill,
  } = useAppStore(useShallow((s) => ({
    resolvedLocale: s.resolvedLocale,
    skillPackages: s.skillPackages,
    skillPackagesLoading: s.skillPackagesLoading,
    loadSkillPackages: s.loadSkillPackages,
    toggleSkillPackage: s.toggleSkillPackage,
    toggleSkill: s.toggleSkill,
  })));

  const { t } = useI18n(resolvedLocale);
  const [expandedPkg, setExpandedPkg] = useState<string | null>(null);

  useEffect(() => { void loadSkillPackages(); }, [loadSkillPackages]);

  return (
    <div className="agent-settings">
      <div className="agent-settings-header">
        <span className="agent-settings-title">{t('agent.settings')}</span>
        <button type="button" className="agent-panel-icon-btn" onClick={onClose}>
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      <div className="agent-settings-body">
        {/* Skills section */}
        <div className="agent-settings-section">
          <div className="agent-settings-section-title">{t('agent.skills')}</div>
          {skillPackagesLoading && (
            <div className="agent-settings-placeholder">{t('agent.loading')}</div>
          )}
          {!skillPackagesLoading && skillPackages.length === 0 && (
            <div className="agent-settings-placeholder">{t('agent.noSkillPackages')}</div>
          )}
          {skillPackages.map((pkg) => (
            <div key={pkg.name} className="agent-settings-pkg">
              <div className="agent-settings-pkg-row">
                <button
                  type="button"
                  className="agent-settings-pkg-expand"
                  onClick={() => setExpandedPkg(expandedPkg === pkg.name ? null : pkg.name)}
                >
                  <span className="material-symbols-outlined">
                    {expandedPkg === pkg.name ? 'expand_more' : 'chevron_right'}
                  </span>
                </button>
                <span className="agent-settings-pkg-name">{pkg.name}</span>
                <span className="agent-settings-pkg-count">{pkg.skills.length}</span>
                <label className="agent-toggle">
                  <input
                    type="checkbox"
                    checked={pkg.enabled}
                    onChange={(e) => toggleSkillPackage(pkg.name, e.target.checked)}
                  />
                  <span className="agent-toggle-track" />
                </label>
              </div>
              {expandedPkg === pkg.name && (
                <div className="agent-settings-skills-list">
                  {pkg.skills.map((sk) => (
                    <div key={sk.name} className="agent-settings-skill-row">
                      <span className="agent-settings-skill-name">{sk.name}</span>
                      {sk.description && (
                        <span className="agent-settings-skill-desc">{sk.description}</span>
                      )}
                      <label className="agent-toggle agent-toggle-sm">
                        <input
                          type="checkbox"
                          checked={sk.enabled}
                          disabled={!pkg.enabled}
                          onChange={(e) => toggleSkill(pkg.name, sk.name, e.target.checked)}
                        />
                        <span className="agent-toggle-track" />
                      </label>
                    </div>
                  ))}
                </div>
              )}
              <div className="agent-settings-pkg-path">{pkg.path}</div>
            </div>
          ))}
        </div>

        {/* MCP section */}
        <div className="agent-settings-section">
          <div className="agent-settings-section-title">{t('agent.mcp')}</div>
          <div className="agent-settings-placeholder">{t('agent.comingSoon')}</div>
        </div>

        {/* Plugins section */}
        <div className="agent-settings-section">
          <div className="agent-settings-section-title">{t('agent.plugins')}</div>
          <div className="agent-settings-placeholder">{t('agent.comingSoon')}</div>
        </div>
      </div>
    </div>
  );
}
