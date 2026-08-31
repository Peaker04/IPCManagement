import { createContext, useContext } from 'react'
import type { SystemOperationSnapshot } from './systemOperationTypes'
export const SystemOperationContext = createContext<SystemOperationSnapshot | null>(null)
export const useSystemOperation = () => useContext(SystemOperationContext)
