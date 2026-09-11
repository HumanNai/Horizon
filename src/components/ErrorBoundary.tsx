import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface Props {
  children: ReactNode
  fallbackTitle?: string
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  public componentDidUpdate(prevProps: Props) {
    if (prevProps.children !== this.props.children && this.state.hasError) {
      this.setState({ hasError: false, error: null, errorInfo: null })
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    window.location.hash = '#/dashboard'
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] h-full p-8 text-center bg-[#0A1024]/60 rounded-2xl border border-red-500/20 backdrop-blur-md m-4">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-4 shadow-[0_0_20px_rgba(239,68,68,0.15)]">
            <AlertTriangle size={28} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            {this.props.fallbackTitle || 'Something went wrong rendering this view'}
          </h2>
          <p className="text-xs text-gray-400 max-w-md mb-6 leading-relaxed">
            An unexpected error occurred while loading component data. You can attempt to retry rendering or navigate back to the overview.
          </p>

          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={this.handleReload}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#15203D] hover:bg-[#1E2D52] text-white text-xs font-semibold border border-[#233566] transition-colors"
            >
              <RefreshCw size={14} /> Retry View
            </button>
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#2E5EFF] to-[#4F77FF] hover:opacity-90 text-white text-xs font-semibold shadow-lg shadow-[#2E5EFF]/25 transition-all"
            >
              <Home size={14} /> Back to Dashboard
            </button>
          </div>

          {this.state.error && (
            <div className="w-full max-w-lg p-3 rounded-xl bg-[#070B19] border border-[#172242] text-left">
              <span className="text-[10px] font-mono uppercase text-red-400 font-bold block mb-1">
                {this.state.error.name}: {this.state.error.message}
              </span>
              {this.state.errorInfo?.componentStack && (
                <pre className="text-[9px] text-gray-500 font-mono overflow-x-auto max-h-24 custom-scrollbar whitespace-pre-wrap">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>
          )}
        </div>
      )
    }

    return this.props.children
  }
}

