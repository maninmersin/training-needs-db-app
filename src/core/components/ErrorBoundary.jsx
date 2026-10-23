import React from 'react';
import { TriangleAlert } from 'lucide-react';
import { debugError } from '@core/utils/consoleUtils';
import { Button } from '@/components/ui';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    debugError('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
      hasError: true
    });

    // Report to error reporting service if available
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback(
          this.state.error, 
          this.handleRetry,
          this.state.retryCount
        );
      }

      // Default fallback UI
      const { retryCount, error, errorInfo } = this.state;
      return (
        <div role="alert" className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 p-6 text-center">
          <TriangleAlert className="size-10 text-destructive" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <p className="text-sm text-muted-foreground">We're sorry, but something unexpected happened.</p>

          {import.meta.env.DEV && (
            <details className="w-full rounded-md border border-border bg-card p-3 text-left text-xs">
              <summary className="cursor-pointer font-medium">Error Details (Development Only)</summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap">
                {error && error.toString()}
                <br />
                {errorInfo?.componentStack}
              </pre>
            </details>
          )}

          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="default" onClick={this.handleRetry} disabled={retryCount >= 3}>
              {retryCount >= 3 ? 'Max Retries Reached' : 'Try Again'}
            </Button>
            <Button onClick={this.handleReload}>Reload Page</Button>
            {this.props.onGoHome && <Button onClick={this.props.onGoHome}>Go to Home</Button>}
          </div>

          {retryCount > 0 && <p className="text-xs text-muted-foreground">Retry attempts: {retryCount}/3</p>}
        </div>
      );
    }

    return this.props.children;
  }
}

// HOC for functional components
export const withErrorBoundary = (Component, errorBoundaryProps = {}) => {
  const WrappedComponent = (props) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};

// Hook for error reporting in functional components
export const useErrorHandler = () => {
  const handleError = React.useCallback((error, errorInfo) => {
    debugError('Manual error report:', error, errorInfo);
    
    // Could integrate with error reporting service here
    if (import.meta.env.PROD) {
      // Example: Sentry.captureException(error);
    }
  }, []);

  return handleError;
};

export default ErrorBoundary;