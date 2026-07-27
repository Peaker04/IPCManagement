const escapeCsvValue = (value: unknown) => {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const buildCsv = <T,>(rows: T[], columns: Array<[string, (row: T) => unknown]>) => {
  const headerLine = columns.map(([label]) => escapeCsvValue(label)).join(',');
  const rowLines = rows.map((row) => columns.map(([, getValue]) => escapeCsvValue(getValue(row))).join(','));
  return ['\uFEFF' + headerLine, ...rowLines].join('\r\n');
};

export const downloadCsv = (csv: string, filename: string) => {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
