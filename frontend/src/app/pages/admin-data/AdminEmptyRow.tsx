type AdminEmptyRowProps = { colSpan: number };

export function AdminEmptyRow({ colSpan }: AdminEmptyRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-8 text-center text-slate-500">Chưa có dữ liệu để hiển thị</td>
    </tr>
  );
}
