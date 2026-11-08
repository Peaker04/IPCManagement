export interface ReconciliationMutationError {
  message: string
  canRefetch: boolean
}

export function describeReconciliationError(error: unknown): ReconciliationMutationError {
  const candidate = error as { status?: number | string; data?: { message?: string; error?: string } }
  const status = candidate?.status
  const serverMessage = candidate?.data?.message ?? candidate?.data?.error
  const canRefetch = status === 409 || (typeof serverMessage === 'string' && /chế độ|mode|phiên bản|thay đổi/i.test(serverMessage))
  return {
    message: serverMessage || (status === 403
      ? 'Bạn không có quyền thực hiện thao tác này.'
      : status === 409
        ? 'Dữ liệu đã thay đổi. Hãy tải lại trước khi tiếp tục.'
        : 'Không thể lưu thay đổi. Vui lòng kiểm tra dữ liệu và thử lại.'),
    canRefetch,
  }
}
