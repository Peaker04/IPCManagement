import { RefreshCw } from 'lucide-react';
import { InlineAlert } from './InlineAlert';

interface QueryErrorAlertProps {
  title: React.ReactNode;
  children: React.ReactNode;
  onRetry: () => unknown;
  isRetrying?: boolean;
  className?: string;
}

export function QueryErrorAlert({ title, children, onRetry, isRetrying = false, className }: QueryErrorAlertProps) {
  return (
    <div role="alert" aria-live="assertive">
      <InlineAlert
        title={title}
        variant="danger"
        className={className}
        action={(
          <button
            type="button"
            className="ipc-button ipc-button-ghost min-h-11"
            onClick={() => onRetry()}
            disabled={isRetrying}
          >
            <RefreshCw size={16} aria-hidden="true" />
            {isRetrying ? 'Đang tải lại…' : 'Thử tải lại'}
          </button>
        )}
      >
        {children}
      </InlineAlert>
    </div>
  );
}
