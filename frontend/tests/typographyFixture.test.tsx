import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { typography } from '../src/lib/typography'
import { TypographyFixture } from './fixtures/TypographyFixture'

describe('TypographyFixture', () => {
  it('locks Vietnamese copy, long identifiers and tabular numeric alignment', () => {
    render(<TypographyFixture />)

    expect(screen.getByRole('heading', { level: 2, name: 'Đối chiếu nguyên liệu và chứng từ' })).toHaveClass(...typography.sectionTitle.split(' '))
    expect(screen.getByText('PR-ANV-20260811-LONG-DOCUMENT-IDENTIFIER-000042')).toHaveClass(...typography.code.split(' '))
    const numericRegion = screen.getByRole('group', { name: 'Cột số liệu canh hàng' })
    expect(numericRegion.querySelectorAll('.tabular-nums')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Kiểm tra focus ring' })).toBeVisible()
    expect(screen.getByRole('textbox', { name: 'Mã chứng từ kiểm thử' })).toBeVisible()
  })
})
