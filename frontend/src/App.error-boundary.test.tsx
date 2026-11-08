import { Suspense, lazy } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppErrorBoundary } from './App'

describe('AppErrorBoundary', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => undefined))
  afterEach(() => vi.restoreAllMocks())

  it('replaces a rejected lazy route with an accessible reload recovery', async () => {
    const reload = vi.fn()
    const BrokenRoute = lazy(() => Promise.reject(new Error('chunk failed')))

    render(
      <AppErrorBoundary onReload={reload}>
        <Suspense fallback={<p>Đang tải</p>}>
          <BrokenRoute />
        </Suspense>
      </AppErrorBoundary>,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể hiển thị ứng dụng')
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại ứng dụng' }))
    expect(reload).toHaveBeenCalledOnce()
  })
})
