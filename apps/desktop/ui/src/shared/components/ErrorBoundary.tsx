import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
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

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <span className="material-symbols-outlined error-boundary-icon" aria-hidden="true">
            error
          </span>
          <h2 className="error-boundary-title">Something went wrong</h2>
          <p className="error-boundary-message">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            type="button"
            className="error-boundary-btn"
            onClick={this.handleReload}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
