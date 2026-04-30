import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, register, authError, authLoading, resolvedLocale } = useAppStore();
  const { t } = useI18n(resolvedLocale);

  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  const switchMode = (next: 'login' | 'register') => {
    setMode(next);
    useAppStore.setState({ authError: null });
    // Focus first input after mode switch
    requestAnimationFrame(() => {
      const first = formRef.current?.querySelector<HTMLInputElement>('input');
      first?.focus();
    });
  };

  // Focus error message when it appears
  useEffect(() => {
    if (authError && errorRef.current) {
      errorRef.current.focus();
    }
  }, [authError]);

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

        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={`auth-tab${mode === 'login' ? ' is-active' : ''}`}
            onClick={() => switchMode('login')}
          >
            {t('auth.login')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={`auth-tab${mode === 'register' ? ' is-active' : ''}`}
            onClick={() => switchMode('register')}
          >
            {t('auth.register')}
          </button>
        </div>

        <form className="auth-form" ref={formRef} onSubmit={handleSubmit}>
          {mode === 'register' && (
            <input
              className="auth-input"
              type="text"
              placeholder={t('auth.displayName')}
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          )}
          <input
            className="auth-input"
            type="email"
            placeholder={t('auth.email')}
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="auth-input-group">
            <input
              className="auth-input"
              type={showPassword ? 'text' : 'password'}
              placeholder={t('auth.password')}
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                {showPassword ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>

          {authError && (
            <p className="auth-error" ref={errorRef} tabIndex={-1} role="alert">
              {authError}
            </p>
          )}

          <button className="auth-submit" type="submit" disabled={authLoading}>
            {authLoading ? t('auth.pleaseWait') : mode === 'login' ? t('auth.signIn') : t('auth.createAccount')}
          </button>
        </form>
      </div>
    </div>
  );
}
