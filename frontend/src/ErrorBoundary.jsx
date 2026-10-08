import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[aloca render error]', error, errorInfo)
  }

  reload = () => window.location.reload()

  render() {
    if (!this.state.hasError) return this.props.children

    return <main className="render-error-screen" role="alert" aria-live="assertive">
      <section className="render-error-card">
        <p>Aloca</p>
        <h1>Ocorreu um erro inesperado</h1>
        <p>Não foi possível exibir esta tela. Recarregue a página para tentar novamente.</p>
        <button type="button" className="primary render-error-action" onClick={this.reload}>Recarregar página</button>
      </section>
    </main>
  }
}
