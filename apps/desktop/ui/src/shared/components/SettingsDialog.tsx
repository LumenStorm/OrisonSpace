import { useCallback, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useI18n } from '../i18n/useI18n';
import { useShallow } from 'zustand/react/shallow';

type Props = { onClose: () => void };

export function SettingsDialog({ onClose }: Props) {
  const {
    resolvedLocale, theme, setTheme, locale, setLocale,
    modelConfig, setModelConfig,
    autoApplyPatches, setAutoApplyPatches,
  } = useAppStore(useShallow((s) => ({
    resolvedLocale: s.resolvedLocale,
    theme: s.theme, setTheme: s.setTheme,
    locale: s.locale, setLocale: s.setLocale,
    modelConfig: s.modelConfig, setModelConfig: s.setModelConfig,
    autoApplyPatches: s.autoApplyPatches, setAutoApplyPatches: s.setAutoApplyPatches,
  })));

  const { t } = useI18n(resolvedLocale);
  const [showApiKey, setShowApiKey] = useState(false);

  const handleModelConfigChange = useCallback((field: 'apiKey' | 'baseUrl' | 'model', value: string) => {
    setModelConfig({ ...modelConfig, [field]: value });
  }, [modelConfig, setModelConfig]);

  return (
    <div className="topbar-new-dialog-overlay" onClick={onClose}>
      <div className="settings-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="settings-dialog-header">
          <h2 className="settings-dialog-title">{t('nav.settings')}</h2>
          <button type="button" className="settings-dialog-close" onClick={onClose} aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="settings-dialog-body">
          <div className="sidebar-settings-row">
            <span className="sidebar-settings-label">{t('settings.theme')}</span>
            <div className="sidebar-settings-options">
              {(['system', 'light', 'dark'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`sidebar-settings-option${theme === opt ? ' is-active' : ''}`}
                  onClick={() => setTheme(opt)}
                >
                  {t(`settings.theme${opt[0].toUpperCase()}${opt.slice(1)}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar-settings-row">
            <span className="sidebar-settings-label">{t('settings.language')}</span>
            <div className="sidebar-settings-options">
              {(['system', 'en-US', 'zh-CN'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`sidebar-settings-option${locale === opt ? ' is-active' : ''}`}
                  onClick={() => setLocale(opt)}
                >
                  {opt === 'system' ? t('settings.languageSystem') : opt}
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar-settings-divider" />

          <div className="sidebar-settings-row">
            <span className="sidebar-settings-label">{t('settings.model')}</span>
            <div className="sidebar-settings-input-row">
              <span className="sidebar-settings-input-label">{t('settings.apiKey')}</span>
              <div className="sidebar-settings-input-wrap">
                <input
                  className="sidebar-settings-input"
                  type={showApiKey ? 'text' : 'password'}
                  placeholder={t('settings.apiKeyPlaceholder')}
                  value={modelConfig.apiKey}
                  onChange={(e) => handleModelConfigChange('apiKey', e.target.value)}
                />
                <button
                  type="button"
                  className="sidebar-settings-input-toggle"
                  onClick={() => setShowApiKey((v) => !v)}
                  aria-label={showApiKey ? t('settings.hideKey') : t('settings.showKey')}
                >
                  <span className="material-symbols-outlined">
                    {showApiKey ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>
            <div className="sidebar-settings-input-row">
              <span className="sidebar-settings-input-label">{t('settings.baseUrl')}</span>
              <input
                className="sidebar-settings-input"
                type="text"
                placeholder={t('settings.baseUrlPlaceholder')}
                value={modelConfig.baseUrl}
                onChange={(e) => handleModelConfigChange('baseUrl', e.target.value)}
              />
            </div>
            <div className="sidebar-settings-input-row">
              <span className="sidebar-settings-input-label">{t('settings.modelName')}</span>
              <input
                className="sidebar-settings-input"
                type="text"
                placeholder={t('settings.modelNamePlaceholder')}
                value={modelConfig.model}
                onChange={(e) => handleModelConfigChange('model', e.target.value)}
              />
            </div>
          </div>

          <div className="sidebar-settings-divider" />

          <div className="sidebar-settings-row">
            <label className="sidebar-settings-toggle-row">
              <input
                type="checkbox"
                className="sidebar-settings-checkbox"
                checked={autoApplyPatches}
                onChange={(e) => setAutoApplyPatches(e.target.checked)}
              />
              <span className="sidebar-settings-label">{t('settings.autoApply')}</span>
            </label>
            <span className="sidebar-settings-hint">{t('settings.autoApplyDesc')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
