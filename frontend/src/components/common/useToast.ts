import { useContext } from 'react';
import { ToastContext } from './toast-context';

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast phải được gọi bên trong ToastProvider.');
  return context;
}
