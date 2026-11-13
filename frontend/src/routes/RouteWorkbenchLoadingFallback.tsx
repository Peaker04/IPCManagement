import { useLocation } from 'react-router-dom';
import { WorkbenchSkeleton } from '../components/workbench/WorkbenchSkeleton';
import { resolveWorkbenchSurface } from './workbenchSurfaceRegistry';
import { CANONICAL_ROUTES } from './routeRegistry';
import { WorkspaceFrame } from '../components/workbench/WorkspaceFrame';
import { WorkspaceHeader } from '../components/workbench/WorkspaceHeader';

export function RouteWorkbenchLoadingFallback() {
  const location = useLocation();
  const surface = resolveWorkbenchSurface(location.pathname, location.search);
  const route = CANONICAL_ROUTES.find(item => item.path === location.pathname);
  const view = new URLSearchParams(location.search).get('view');
  const leaf = route?.leaves?.find(item => new URLSearchParams(item.to.split('?')[1]).get('view') === view);
  const title = leaf?.label || route?.title || 'Không gian làm việc';
  return <WorkspaceFrame.Root>
    <WorkspaceHeader title={title} responsive />
    <WorkspaceFrame.Body><WorkbenchSkeleton geometry={surface.geometry} /></WorkspaceFrame.Body>
  </WorkspaceFrame.Root>;
}
