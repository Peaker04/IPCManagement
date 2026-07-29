import type { UnknownAction } from '@reduxjs/toolkit'
import type { ThunkDispatch } from '@reduxjs/toolkit'
import { useDispatch } from 'react-redux'

export type AppDispatch = ThunkDispatch<unknown, unknown, UnknownAction>

export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
