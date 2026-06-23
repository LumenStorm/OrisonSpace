import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react';
import { translate } from '../i18n/useI18n';
import { useAppStore } from '../store/appStore';

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null; resetKey: number };

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, resetKey: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    void window.orisonDesktop?.writeLog?.({
      level: 'error',
      message: error.message || 'Unhandled renderer error',
      meta: {
        stack: error.stack,
        componentStack: info.componentStack ?? undefined,
      },
    });
  }

  // Bump resetKey so the child subtree is forced to remount with fresh state.
  // Just clearing hasError kept the same element tree, so a deterministic render
  // error re-threw immediately and the user was stuck on this screen.
  private handleReset = () => {
    this.setState((s) => ({ hasError: false, error: null, resetKey: s.resetKey + 1 }));
  };

  private handleReload = () => {
    window.location.reload();
  };

  private t(key: string): string {
    let locale = 'en-US';
    try { locale = useAppStore.getState().resolvedLocale ?? 'en-US'; } catch { /* store not ready */ }
    return translate(locale, `errorBoundary.${key}`);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <span className="material-symbols-outlined error-boundary-icon" aria-hidden="true">
            error
          </span>
          <h2 className="error-boundary-title">{this.t('title')}</h2>
          <p className="error-boundary-message">
            {this.state.error?.message || this.t('message')}
          </p>
          <div className="error-boundary-actions">
            <button type="button" className="error-boundary-btn" onClick={this.handleReset}>
              {this.t('tryAgain')}
            </button>
            <button type="button" className="error-boundary-btn" onClick={this.handleReload}>
              {this.t('reload')}
            </button>
          </div>
        </div>
      );
    }
    return <Fragment key={this.state.resetKey}>{this.props.children}</Fragment>;
  }
}
