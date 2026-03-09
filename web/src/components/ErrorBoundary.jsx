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

  reset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <main>
          <section className="card">
            <h2>Something went wrong</h2>
            <p className="muted">Try resetting the UI state.</p>
            <button onClick={this.reset}>Reset View</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
