import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { documentTitleForPath } from './routeTitles'

export function RouteDocumentTitle() {
  const { pathname } = useLocation()

  useEffect(() => {
    document.title = documentTitleForPath(pathname)
  }, [pathname])

  return null
}
