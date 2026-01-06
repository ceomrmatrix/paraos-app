import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at center, #0a0a1a 0%, #000011 50%, #0a001a 100%)',
          color: '#ffffff',
          fontFamily: 'Inter, sans-serif',
          textAlign: 'center',
          padding: '20px'
        }}>
          <div>
            <h1 style={{
              color: '#ff00ff',
              textShadow: '0 0 10px currentColor',
              marginBottom: '20px'
            }}>
              🚨 SYSTEM MALFUNCTION
            </h1>
            <p style={{
              color: '#00ffff',
              fontSize: '18px',
              marginBottom: '20px'
            }}>
              Neural interface has encountered a critical error.
            </p>
            <details style={{
              background: 'rgba(15, 15, 35, 0.8)',
              border: '1px solid rgba(0, 255, 255, 0.3)',
              borderRadius: '8px',
              padding: '15px',
              marginBottom: '20px',
              textAlign: 'left'
            }}>
              <summary style={{
                cursor: 'pointer',
                color: '#00ffff',
                fontWeight: 'bold'
              }}>
                Technical Details
              </summary>
              <pre style={{
                color: '#ffffff',
                fontSize: '12px',
                marginTop: '10px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {this.state.error?.stack}
              </pre>
            </details>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: 'linear-gradient(135deg, #00ffff, #ff00ff)',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 24px',
                color: 'white',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 0 15px rgba(0, 255, 255, 0.3)',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 0 25px rgba(0, 255, 255, 0.5)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 255, 255, 0.3)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              🔄 REINITIALIZE SYSTEM
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}