import { SearchField } from '@/components/common';

type ApprovalSearchFieldProps = {
  value: string
  onChange: (value: string) => void
}

export function ApprovalSearchField({ value, onChange }: ApprovalSearchFieldProps) {
  return (
    <SearchField
      id="approval-inbox-search"
      label="Tìm chứng từ hoặc nguyên liệu"
      hideLabel
      width="full"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Mã phiếu, nhà cung cấp, nguyên liệu..."
    />
  )
}
