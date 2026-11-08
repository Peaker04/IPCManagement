import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { notifySessionExpired, resetSessionExpiredNotice } from '@/lib/auth/sessionEvents'
import { SessionTimeoutModal } from './SessionTimeoutModal'

function LocationProbe() {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <output aria-label="Vị trí hiện tại">{`${location.pathname}|${String(location.state?.from ?? '')}`}</output>
      <button type="button" onClick={() => navigate('/login', { replace: true })}>Mô phỏng route guard</button>
    </>
  )
}

describe('SessionTimeoutModal expired-session recovery', () => {
  afterEach(() => resetSessionExpiredNotice())

  it('blocks the current route and returns to login with the deep-link origin preserved', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/reports?view=purchase#price-panel']}>
        <SessionTimeoutModal />
        <LocationProbe />
      </MemoryRouter>,
    )

    act(() => notifySessionExpired())

    const dialog = await screen.findByRole('dialog', { name: 'Phiên đăng nhập đã hết hạn' })
    expect(dialog).toHaveTextContent('Vui lòng đăng nhập lại để tiếp tục thao tác.')

    await user.click(screen.getByRole('button', { name: 'Mô phỏng route guard' }))
    await user.click(screen.getByRole('button', { name: 'Đăng nhập lại' }))

    await waitFor(() => expect(screen.getByLabelText('Vị trí hiện tại')).toHaveTextContent('/login|/reports?view=purchase#price-panel'))
    expect(screen.queryByRole('dialog', { name: 'Phiên đăng nhập đã hết hạn' })).toBeNull()
  })
})
