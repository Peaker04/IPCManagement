import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { isRouteEligible } from '@/lib/systemOperationEligibility'
import { useSystemOperation } from '@/lib/systemOperationContext'
import { ModeUnavailable } from './ModeUnavailable'
export function ModeGuard({ children }: { children: ReactNode }) { const mode = useSystemOperation(); const location = useLocation(); return mode && isRouteEligible(mode.mode, location.pathname) ? children : <ModeUnavailable /> }
