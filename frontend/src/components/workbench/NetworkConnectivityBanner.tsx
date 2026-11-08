import { useState, useEffect } from 'react';
import { InlineBanner } from '../ui/inline-banner';
import { offlineMutationQueue } from '../../store/offlineMutationQueue';

export interface NetworkConnectivityBannerProps {
  className?: string;
}

/**
 * Enterprise Network Resilience & Connectivity Banner (Rule NFR-02)
 * Warns operators when network is disconnected at the kitchen/warehouse and displays offline queue depth.
 */
export function NetworkConnectivityBanner({ className }: NetworkConnectivityBannerProps) {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  const [queueCount, setQueueCount] = useState<number>(() => offlineMutationQueue.getAll().length);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    const unsubscribe = offlineMutationQueue.subscribe((count) => setQueueCount(count));

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  if (isOnline && queueCount === 0) {
    return null;
  }

  if (!isOnline) {
    return (
      <InlineBanner
        variant="offline"
        title="Mất kết nối mạng tại trạm vận hành"
        role="alert"
        aria-live="assertive"
        className={`rounded-none border-x-0 border-t-0 bg-zinc-900 text-white border-zinc-700 shadow-md ${className || ''}`}
      >
        <span>
          Hệ thống đang hoạt động ở chế độ Ngoại tuyến. Các thao tác ghi hợp lệ sẽ được lưu tạm vào hàng đợi
          cục bộ ({queueCount} lệnh) và tự động đồng bộ khi có mạng lại.
        </span>
      </InlineBanner>
    );
  }

  return (
    <InlineBanner
      variant="info"
      title="Đang đồng bộ hàng đợi ngoại tuyến"
      className={`rounded-none border-x-0 border-t-0 ${className || ''}`}
    >
      <span>Có {queueCount} thao tác ngoại tuyến đang được tự động gửi lên máy chủ...</span>
    </InlineBanner>
  );
}
