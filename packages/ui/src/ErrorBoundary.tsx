// A page that throws shows a message instead of blanking the whole app.

import { Component, type ErrorInfo, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('page error', error, info.componentStack)
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="mx-auto my-16 max-w-xl rounded-2xl border border-bad/40 bg-card p-6 text-center">
        <h1 className="text-xl font-bold">Something went wrong on this page</h1>
        <p className="mt-2 text-sm text-muted">{this.state.error.message.split('\n')[0]}</p>
        <button className="mt-4 cursor-pointer rounded-xl border border-line px-4 py-2 text-sm" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    )
  }
}
