type SessionExpiredListener = () => void;

const listeners = new Set<SessionExpiredListener>();
let isSessionExpiryNotified = false;

export const subscribeSessionExpired = (listener: SessionExpiredListener) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

export const notifySessionExpired = () => {
  if (isSessionExpiryNotified) {
    return;
  }

  isSessionExpiryNotified = true;
  listeners.forEach((listener) => listener());
};

export const resetSessionExpiredNotice = () => {
  isSessionExpiryNotified = false;
};
