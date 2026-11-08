import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '../ui/button';
import { Modal } from '../ui/modal';
import { DirtyNavigationContext } from './dirty-navigation-context';

export function DirtyNavigationProvider({ children }: { children: ReactNode }) {
  const [dirtyKeys, setDirtyKeys] = useState<Map<string, boolean>>(() => new Map());
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const isDirty = dirtyKeys.size > 0;
  const isPending = [...dirtyKeys.values()].some(Boolean);
  const historyTraversal = useRef<{ restoring: boolean; replaying: boolean; delta: number } | null>(null);

  const registerDirty = useCallback((key: string, options?: { blockNavigation?: boolean }) => {
    setDirtyKeys((current) => new Map(current).set(key, Boolean(options?.blockNavigation)));
    return () => setDirtyKeys((current) => {
      const next = new Map(current);
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

    const currentIndex = window.history.state?.idx;
    const handlePopState = (event: PopStateEvent) => {
      if (historyTraversal.current?.replaying) { historyTraversal.current = null; return; }
      if (historyTraversal.current?.restoring) {
        event.stopImmediatePropagation();
        const delta = historyTraversal.current.delta;
        historyTraversal.current.restoring = false;
        setPendingNavigation(() => () => {
          historyTraversal.current = { restoring: false, replaying: true, delta };
          window.history.go(-delta);
        });
        return;
      }
      // React Router owns indexed same-document history; cross-document exits use beforeunload.
      if (typeof currentIndex !== 'number' || typeof event.state?.idx !== 'number') return;
      const delta = currentIndex - event.state.idx;
      if (!delta) return;
      event.stopImmediatePropagation();
      historyTraversal.current = { restoring: true, replaying: false, delta };
      window.history.go(delta);
    };

    window.addEventListener('popstate', handlePopState, true);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState, true);
      historyTraversal.current = null;
    };
  }, [isDirty]);

  const value = useMemo(() => ({ isDirty, registerDirty, requestNavigation }), [isDirty, registerDirty, requestNavigation]);

  return (
    <DirtyNavigationContext.Provider value={value}>
      {children}
      {pendingNavigation && <Modal isOpen role="alertdialog" onClose={() => setPendingNavigation(null)}
        title={isPending ? 'Đang xử lý thay đổi' : 'Hủy thay đổi chưa lưu?'}
        description={isPending ? 'Vui lòng chờ thao tác hoàn tất trước khi rời trang.' : 'Các thay đổi chưa được lưu sẽ bị mất nếu bạn rời khỏi màn hình này.'}
        maxWidth="max-w-sm"
        footer={<><Button variant="outline" size="sm" onClick={() => setPendingNavigation(null)} autoFocus>Tiếp tục chỉnh sửa</Button>
          {!isPending && <Button variant="destructive" size="sm" onClick={() => {
            const action = pendingNavigation;
            setPendingNavigation(null);
            setDirtyKeys(new Map());
            action();
          }}>Hủy thay đổi</Button>}</>}><></></Modal>}
    </DirtyNavigationContext.Provider>
  );
}
