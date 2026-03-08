import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('UI boundary caught error', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main>
          <section className="card">
            <h2>Something went wrong</h2>
            <p className="muted">Please reload the page.</p>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
