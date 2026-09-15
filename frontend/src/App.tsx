import { Component, type ReactNode } from 'react'
import { AppRouter } from './routes/AppRouter'
import { ToastProvider } from './components/common/ToastProvider'
import { Button } from './components/ui/button'

export class AppErrorBoundary extends Component<{ children: ReactNode; onReload?: () => void }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
          <section role="alert" className="w-full max-w-lg rounded-lg border border-red-200 bg-white p-6 shadow-sm">
            <h1 className="text-xl font-semibold text-slate-950">Không thể hiển thị ứng dụng</h1>
            <p className="mt-2 text-sm text-slate-700">Một phần ứng dụng tải không thành công. Hãy tải lại để lấy phiên bản mới nhất.</p>
            <Button type="button" className="mt-4" onClick={this.props.onReload ?? (() => window.location.reload())}>
              Tải lại ứng dụng
            </Button>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}

function App() {
  return (
    <AppErrorBoundary>
      <ToastProvider>
        <AppRouter />
      </ToastProvider>
    </AppErrorBoundary>
  )
}

export default App
