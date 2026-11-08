type ReportEmptyRowProps = {
  colSpan: number;
  isError?: boolean;
  label?: string;
};

export function ReportEmptyRow({ colSpan, isError = false, label = 'Chưa có bản ghi báo cáo.' }: ReportEmptyRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-8 text-center text-slate-500">
        {isError ? 'Dữ liệu báo cáo chưa được xác nhận.' : label}
      </td>
    </tr>
  );
}
