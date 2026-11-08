const MESSAGES: Record<string, string> = {
  MRX_SOURCE_STALE: 'Dữ liệu đã thay đổi. Vui lòng tải lại rồi thử lại.',
  MRX_BATCH_COMPLETED: 'Lô đã hoàn tất, không thể sửa.',
  MRX_SERVINGS_SPLIT_REQUIRED: 'Cần nhập đủ số suất Mặn và Chay.',
  MRX_BOM_MISSING: 'Món thay thế chưa có định mức cho ngày phục vụ.',
};

interface MrxErrorShape {
  code?: unknown;
  message?: unknown;
  lockedDates?: unknown;
}

export function toMrxErrorMessage(error: unknown): { code?: string; message: string; lockedDates: string[] } {
  const source = error && typeof error === 'object' ? error as MrxErrorShape : {};
  const code = typeof source.code === 'string' ? source.code : undefined;
  const lockedDates = Array.isArray(source.lockedDates)
    ? source.lockedDates.filter((date): date is string => typeof date === 'string')
    : [];

  if (code === 'MRX_DAY_LOCKED') {
    const dates = lockedDates
      .map((date) => /^(\d{4})-(\d{2})-(\d{2})$/.exec(date))
      .filter((parts): parts is RegExpExecArray => parts !== null)
      .map((parts) => `${parts[3]}/${parts[2]}`);
    return {
      code,
      message: dates.length > 0
        ? `Các ngày đã xuất kho không thể sửa: ${dates.join(', ')}`
        : 'Các ngày đã xuất kho không thể sửa.',
      lockedDates,
    };
  }

  return {
    code,
    message: code && MESSAGES[code]
      ? MESSAGES[code]
      : typeof source.message === 'string' && source.message.trim()
        ? source.message
        : 'Không thể cập nhật dữ liệu đối soát.',
    lockedDates,
  };
}
