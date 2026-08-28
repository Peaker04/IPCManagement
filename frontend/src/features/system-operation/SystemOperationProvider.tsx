import type { ReactNode } from 'react'
import { useGetSystemOperationModeQuery } from './systemOperationApi'
import { SystemOperationContext } from './systemOperationContext'
import { getCapabilityConfigurationError } from './systemOperationEligibility'
export function SystemOperationProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, isError } = useGetSystemOperationModeQuery()
  if (isLoading) return <div className="ipc-operational-frame" aria-busy="true"><span className="sr-only">Đang tải chế độ vận hành...</span></div>
  if (isError || !data) return <section className="ipc-operational-frame" role="alert"><h2>Không thể xác định chế độ vận hành</h2><p>Vui lòng thử lại hoặc liên hệ quản trị viên.</p></section>
  const configurationError = getCapabilityConfigurationError(data)
  if (configurationError) return <section className="ipc-operational-frame" role="alert"><h2>Lỗi phiên bản/cấu hình hệ thống</h2><p>{configurationError}</p><p>Khởi động lại API từ bản dựng hiện tại rồi tải lại trang. Không tiếp tục thao tác trên giao diện một phần.</p></section>
  return <SystemOperationContext.Provider value={data}>{children}</SystemOperationContext.Provider>
}
