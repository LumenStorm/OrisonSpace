import { useState } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const { login, register, authError, authLoading, resolvedLocale } = useAppStore();
  const { t } = useI18n(resolvedLocale);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      await login(email, password);
    } else {
      await register(email, password, displayName || undefined);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-brand">{t('auth.brand')}</h1>
        <p className="auth-tagline">{t('auth.tagline')}</p>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab${mode === 'login' ? ' is-active' : ''}`}
            onClick={() => setMode('login')}
          >
            {t('auth.login')}
          </button>
          <button
            type="button"
            className={`auth-tab${mode === 'register' ? ' is-active' : ''}`}
            onClick={() => setMode('register')}
          >
            {t('auth.register')}
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <input
              className="auth-input"
              type="text"
              placeholder={t('auth.displayName')}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          )}
          <input
            className="auth-input"
            type="email"
            placeholder={t('auth.email')}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="auth-input"
            type="password"
            placeholder={t('auth.password')}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {authError && <p className="auth-error">{authError}</p>}

          <button className="auth-submit" type="submit" disabled={authLoading}>
            {authLoading ? t('auth.pleaseWait') : mode === 'login' ? t('auth.signIn') : t('auth.createAccount')}
          </button>
        </form>
      </div>
    </div>
  );
}
