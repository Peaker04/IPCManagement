import type { ReactNode } from 'react'
import { useGetSystemOperationModeQuery } from './systemOperationApi'
import { SystemOperationContext } from './systemOperationContext'
export function SystemOperationProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, isError } = useGetSystemOperationModeQuery()
  if (isLoading) return <div className="ipc-operational-frame" aria-busy="true"><span className="sr-only">Đang tải chế độ vận hành...</span></div>
  if (isError || !data) return <section className="ipc-operational-frame" role="alert"><h2>Không thể xác định chế độ vận hành</h2><p>Vui lòng thử lại hoặc liên hệ quản trị viên.</p></section>
  return <SystemOperationContext.Provider value={data}>{children}</SystemOperationContext.Provider>
}
