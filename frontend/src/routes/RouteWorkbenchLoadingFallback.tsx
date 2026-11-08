import { useLocation } from 'react-router-dom';
import { WorkbenchSkeleton } from '../components/workbench/WorkbenchSkeleton';
import { resolveWorkbenchSurface } from './workbenchSurfaceRegistry';

export function RouteWorkbenchLoadingFallback() {
  const location = useLocation();
  const surface = resolveWorkbenchSurface(location.pathname, location.search);
  return <WorkbenchSkeleton geometry={surface.geometry} />;
}
