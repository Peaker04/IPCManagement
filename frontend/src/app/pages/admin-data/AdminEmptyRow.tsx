type AdminEmptyRowProps = { colSpan: number; label?: string };

export function AdminEmptyRow({ colSpan, label = 'Chưa có bản ghi quản trị.' }: AdminEmptyRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-8 text-center text-slate-500">{label}</td>
    </tr>
  );
}
