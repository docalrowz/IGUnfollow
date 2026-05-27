import React from 'react';

/**
 * Top-level error boundary. Catches any render-time exception thrown
 * by descendants and falls back to a hardcoded recovery screen that
 * does not depend on hooks, context, or state — so it stays useful
 * even when the rest of the app is on fire.
 *
 * Lives outside DialogProvider so dialog-related crashes do not loop.
 */

interface ErrorBoundaryState {
  readonly error: Error | null;
}

interface ErrorBoundaryProps {
  readonly children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { readonly componentStack?: string }) {
    console.error('[InstagramUnfollowers] crashed:', error, info.componentStack);
  }

  render() {
    if (this.state.error === null) {
      return this.props.children;
    }
    return (
      <section
        className='error-screen'
        role='alert'
        style={{ minHeight: '60vh' }}
      >
        <h2>Something went wrong</h2>
        <p>The app crashed and could not recover.</p>
        <pre
          style={{
            maxWidth: '720px',
            overflowX: 'auto',
            padding: '12px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#a3a3a3',
          }}
        >
          {this.state.error.message}
        </pre>
        <button type='button' onClick={() => location.reload()}>
          Reload Instagram
        </button>
      </section>
    );
  }
}
