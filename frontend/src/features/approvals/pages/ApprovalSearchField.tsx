import { Input } from '@/components/ui/input'

type ApprovalSearchFieldProps = {
  value: string
  onChange: (value: string) => void
}

export function ApprovalSearchField({ value, onChange }: ApprovalSearchFieldProps) {
  return (
    <Input
      id="approval-inbox-search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Mã phiếu, nhà cung cấp, nguyên liệu..."
      className="h-9"
    />
  )
}
