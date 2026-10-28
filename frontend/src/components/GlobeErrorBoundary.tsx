import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches WebGL context loss and rendering crashes inside LunarGlobe.
 * Shows a recovery UI instead of white-screening the entire app.
 */
export class GlobeErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[GlobeErrorBoundary] Caught rendering error:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const isWebGL =
        this.state.error?.message?.toLowerCase().includes('webgl') ||
        this.state.error?.message?.toLowerCase().includes('context');

      return (
        <div className="flex items-center justify-center h-full bg-slate-950/90 backdrop-blur-sm rounded-xl border border-red-900/50">
          <div className="text-center max-w-md px-6 py-8">
            <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">
              {isWebGL ? 'WebGL Context Lost' : 'Rendering Error'}
            </h2>
            <p className="text-sm text-slate-400 mb-4">
              {isWebGL
                ? 'The 3D graphics context was lost. This can happen when the browser throttles the tab or the GPU runs out of memory.'
                : 'An unexpected error occurred while rendering the lunar globe.'}
            </p>
            <p className="text-xs text-slate-500 font-mono mb-6 break-all">
              {this.state.error?.message}
            </p>
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Globe
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
