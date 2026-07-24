'use client'

import { useEffect, useState } from 'react'
import { LOCK_TIME } from '@/lib/constants'

export function useCountdown() {
  const [timeRemaining, setTimeRemaining] = useState<string>('--:--:--')
  const [isPastCutoff, setIsPastCutoff] = useState(false)

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const lockTime = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        LOCK_TIME.hours,
        LOCK_TIME.minutes,
        0
      )

      if (now >= lockTime) {
        setIsPastCutoff(true)
        setTimeRemaining('00:00:00')
      } else {
        setIsPastCutoff(false)
        const diff = lockTime.getTime() - now.getTime()
        const hours = Math.floor(diff / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((diff % (1000 * 60)) / 1000)

        setTimeRemaining(
          `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
        )
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)

    return () => clearInterval(interval)
  }, [])

  return { timeRemaining, isPastCutoff }
}
