import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '../ui/button';
import { DirtyNavigationContext } from './dirty-navigation-context';

export function DirtyNavigationProvider({ children }: { children: ReactNode }) {
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(() => new Set());
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const isDirty = dirtyKeys.size > 0;

  const registerDirty = useCallback((key: string) => {
    setDirtyKeys((current) => new Set(current).add(key));
    return () => setDirtyKeys((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  }, []);

  const requestNavigation = useCallback((action: () => void) => {
    if (!isDirty) return true;
    setPendingNavigation(() => action);
    return false;
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', handleBeforeUnload);

    const handlePopState = () => {
      if (typeof window !== 'undefined' && window.history) {
        window.history.pushState(null, '', window.location.href);
      }
      setPendingNavigation(() => () => {
        if (typeof window !== 'undefined' && window.history) {
          window.history.back();
        }
      });
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isDirty]);

  const value = useMemo(() => ({ isDirty, registerDirty, requestNavigation }), [isDirty, registerDirty, requestNavigation]);

  return (
    <DirtyNavigationContext.Provider value={value}>
      {children}
      {pendingNavigation && (
        <div role="alertdialog" aria-modal="true" aria-labelledby="dirty-navigation-title" aria-describedby="dirty-navigation-description" className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
            <h2 id="dirty-navigation-title" className="text-sm font-semibold text-slate-900">Hủy thay đổi chưa lưu?</h2>
            <p id="dirty-navigation-description" className="mt-1 text-xs leading-relaxed text-slate-600">Các thay đổi chưa được lưu sẽ bị mất nếu bạn rời khỏi màn hình này.</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setPendingNavigation(null)} autoFocus>Tiếp tục chỉnh sửa</Button>
              <Button variant="destructive" size="sm" onClick={() => {
                const action = pendingNavigation;
                setPendingNavigation(null);
                setDirtyKeys(new Set());
                action();
              }}>Hủy thay đổi</Button>
            </div>
          </div>
        </div>
      )}
    </DirtyNavigationContext.Provider>
  );
}
