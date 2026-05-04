import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { AuthForm } from '../../features/auth/AuthForm';

export function AuthPage() {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-brand">{t('auth.brand')}</h1>
        <p className="auth-tagline">{t('auth.tagline')}</p>
        <AuthForm />
      </div>
    </div>
  );
}
