import { Component } from 'react';
import { Link } from 'react-router-dom';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="empty" style={{ padding: '3rem 1.5rem' }}>
          <h2 style={{ marginBottom: '0.75rem' }}>Something went wrong</h2>
          <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            This page could not be displayed. Try going back or opening the page in Confluence.
          </p>
          <p className="mono" style={{ fontSize: '0.8rem', marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
            {this.state.error.message}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
            <Link to="/" className="btn btn-primary">
              Go home
            </Link>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
