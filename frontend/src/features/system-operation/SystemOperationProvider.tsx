import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useStore } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppDispatch } from '@/app/hooks'
import { clearReconciliationSelection } from '@/lib/navigationPreferences'
import { clearReconciliationApiResidue } from '@/features/reconciliation/reconciliationApi'
import { useGetSystemOperationModeQuery, type SystemOperationSnapshot } from './systemOperationApi'
import { SystemOperationContext } from './systemOperationContext'
import { getCapabilityConfigurationError } from './systemOperationEligibility'
import { normalizeAuthorityLocation } from './systemOperationLocation'
import {
  authorityFromSnapshot,
  getSystemOperationAuthorityChannel,
  isSystemOperationAuthorityNewer,
  type SystemOperationAuthorityChannel,
  type SystemOperationAuthorityLike,
} from './systemOperationAuthorityChannel'

const loadingFrame = (message = 'Đang tải chế độ vận hành...') => (
  <div className="ipc-operational-frame" aria-busy="true"><span className="sr-only">{message}</span></div>
)

interface SystemOperationProviderProps {
  children: ReactNode
  authorityChannel?: SystemOperationAuthorityChannel
  storage?: Storage
}

export function SystemOperationProvider({ children, authorityChannel, storage }: SystemOperationProviderProps) {
  const dispatch = useAppDispatch()
  const store = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const channelRef = useRef(authorityChannel ?? getSystemOperationAuthorityChannel())
  const acceptedAuthorityRef = useRef<SystemOperationAuthorityLike | null>(null)
  const hintedAuthorityRef = useRef<SystemOperationAuthorityLike | null>(null)
  const [acceptedSnapshot, setAcceptedSnapshot] = useState<SystemOperationSnapshot | null>(null)
  const [hintedAuthority, setHintedAuthority] = useState<SystemOperationAuthorityLike | null>(null)
  const { data, isLoading, isError, refetch } = useGetSystemOperationModeQuery()

  useEffect(() => channelRef.current.subscribe((message) => {
    const current = hintedAuthorityRef.current ?? acceptedAuthorityRef.current
    if (current && !isSystemOperationAuthorityNewer(current, message)) return
    hintedAuthorityRef.current = message
    setHintedAuthority(message)
  }), [])

  useLayoutEffect(() => {
    if (!data) return
    const current = acceptedAuthorityRef.current
    const latestHint = hintedAuthorityRef.current
    if (latestHint && isSystemOperationAuthorityNewer(data, latestHint)) {
      void refetch()
      return
    }
    const acceptedAuthority = authorityFromSnapshot(data)
    if (!current) {
      if (data.mode !== 'MATERIAL_RECONCILIATION') clearReconciliationSelection(storage)
      acceptedAuthorityRef.current = acceptedAuthority
      hintedAuthorityRef.current = acceptedAuthority
      setHintedAuthority(acceptedAuthority)
      setAcceptedSnapshot(data)
      return
    }
    if (!isSystemOperationAuthorityNewer(current, data)) return
    if (data.mode !== 'MATERIAL_RECONCILIATION') {
      if (current.mode === 'MATERIAL_RECONCILIATION') {
        clearReconciliationApiResidue(dispatch, store.getState())
      }
      clearReconciliationSelection(storage)
    }
    acceptedAuthorityRef.current = acceptedAuthority
    hintedAuthorityRef.current = acceptedAuthority
    setHintedAuthority(acceptedAuthority)
    setAcceptedSnapshot(data)
  }, [data, dispatch, hintedAuthority, refetch, storage, store])

  const acceptedAuthority = useMemo(() => acceptedSnapshot ? authorityFromSnapshot(acceptedSnapshot) : null, [acceptedSnapshot])
  const awaitingNewerAuthority = useMemo(() => {
    if (!hintedAuthority) return false
    return !acceptedAuthority || isSystemOperationAuthorityNewer(acceptedAuthority, hintedAuthority)
  }, [acceptedAuthority, hintedAuthority])

  const relocationTarget = useMemo(
    () => acceptedSnapshot ? normalizeAuthorityLocation(acceptedSnapshot.mode, location.pathname, location.search) : null,
    [acceptedSnapshot, location.pathname, location.search],
  )

  useLayoutEffect(() => {
    if (relocationTarget) navigate(relocationTarget, { replace: true })
  }, [navigate, relocationTarget])

  if (isLoading && !acceptedSnapshot) return loadingFrame()
  if (isError && !acceptedSnapshot && !awaitingNewerAuthority) {
    return <section className="ipc-operational-frame" role="alert"><h2>Không thể xác định chế độ vận hành</h2><p>Vui lòng thử lại hoặc liên hệ quản trị viên.</p></section>
  }
  if (!acceptedSnapshot || awaitingNewerAuthority || relocationTarget) return loadingFrame('Đang cập nhật chế độ vận hành...')

  const configurationError = getCapabilityConfigurationError(acceptedSnapshot)
  if (configurationError) return <section className="ipc-operational-frame" role="alert"><h2>Lỗi phiên bản/cấu hình hệ thống</h2><p>{configurationError}</p><p>Khởi động lại API từ bản dựng hiện tại rồi tải lại trang. Không tiếp tục thao tác trên giao diện một phần.</p></section>
  return <SystemOperationContext.Provider value={acceptedSnapshot}>{children}</SystemOperationContext.Provider>
}
