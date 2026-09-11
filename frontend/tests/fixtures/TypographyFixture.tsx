import { typography } from '../../src/lib/typography'
import { cn } from '../../src/lib/utils'

export function TypographyFixture() {
  return (
    <section aria-labelledby="typography-fixture-title" className={cn(typography.body, 'grid gap-3')}>
      <h2 id="typography-fixture-title" className={typography.sectionTitle}>Đối chiếu nguyên liệu và chứng từ</h2>
      <p className={typography.body}>Suất ăn chiều thứ Bảy cần bổ sung nguyên liệu có dấu tiếng Việt dài.</p>
      <code className={cn(typography.code, 'break-all')}>PR-ANV-20260811-LONG-DOCUMENT-IDENTIFIER-000042</code>
      <div className="grid grid-cols-3 gap-2 text-right" role="group" aria-label="Cột số liệu canh hàng">
        <span className={typography.numeric}>1.250,50</span>
        <span className={typography.numeric}>98,75</span>
        <span className={typography.numeric}>0,00</span>
      </div>
      <button type="button" className="ipc-button ipc-button-primary">Kiểm tra focus ring</button>
      <input className="ipc-input" aria-label="Mã chứng từ kiểm thử" defaultValue="PR-ANV-000042" />
    </section>
  )
}
