type ApprovalSearchFieldProps = {
  value: string
  onChange: (value: string) => void
}

export function ApprovalSearchField({ value, onChange }: ApprovalSearchFieldProps) {
  return (
    <input
      id="approval-inbox-search"
      type="search"
      aria-label="Tìm chứng từ hoặc nguyên liệu"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Mã phiếu, nhà cung cấp, nguyên liệu..."
      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    />
  )
}
