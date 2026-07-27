type ReportEmptyRowProps = {
  colSpan: number;
  isError?: boolean;
};

export function ReportEmptyRow({ colSpan, isError = false }: ReportEmptyRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-8 text-center text-slate-500">
        {isError ? 'Không tải được dữ liệu, xem cảnh báo phía trên.' : 'Chưa có dữ liệu để hiển thị'}
      </td>
    </tr>
  );
}
