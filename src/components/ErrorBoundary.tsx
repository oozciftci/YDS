import { Component, type ErrorInfo, type ReactNode } from 'react'
import { logger } from '../services/logger'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('system', `React Render Hatası: ${error.message}`, {
      stack: error.stack,
      componentStack: errorInfo.componentStack || undefined,
    })
    this.setState({ errorInfo })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleReset = () => {
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch {
      // ignore
    }
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            backgroundColor: '#0d1020',
            color: '#f8fafc',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              maxWidth: '540px',
              width: '100%',
              background: '#161b33',
              border: '1px solid #2e355b',
              borderRadius: '16px',
              padding: '2rem',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>⚠️</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem', color: '#ffffff' }}>
              Bir Yükleme Hatası Oluştu
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.92rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Uygulama çalışırken beklenmeyen bir hata oluştu. Endişelenmeyin, yerel verileriniz cihazınızda güvendedir.
            </p>

            <div
              style={{
                background: '#0a0d1a',
                border: '1px solid #ef4444',
                borderRadius: '8px',
                padding: '0.75rem',
                color: '#fca5a5',
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                textAlign: 'left',
                marginBottom: '1.5rem',
                wordBreak: 'break-word',
                maxHeight: '160px',
                overflowY: 'auto',
              }}
            >
              <strong>Hata Mesajı:</strong> {this.state.error?.message || 'Bilinmeyen Hata'}
              {this.state.error?.stack && (
                <pre style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'pre-wrap' }}>
                  {this.state.error.stack.slice(0, 400)}
                </pre>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  padding: '0.65rem 1.25rem',
                  borderRadius: '8px',
                  background: '#7c5cff',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                🔄 Sayfayı Yenile
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  padding: '0.65rem 1.25rem',
                  borderRadius: '8px',
                  background: 'transparent',
                  color: '#94a3b8',
                  border: '1px solid #2e355b',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                🗑️ Önbelleği Sıfırla ve Başlat
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
