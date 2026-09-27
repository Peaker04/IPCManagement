import { routeMetadataForPath } from './routeRegistry'

export const documentTitleForPath = (pathname: string) => {
  const title = routeMetadataForPath(pathname)?.documentTitle
  return title ? `${title} · IPC Management` : 'IPC Management'
}
