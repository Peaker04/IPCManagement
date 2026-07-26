import { RefreshCw } from 'lucide-react';
import { InlineAlert } from './InlineAlert';

interface QueryErrorAlertProps {
  title: string;
  children: React.ReactNode;
  onRetry: () => unknown;
  isRetrying?: boolean;
}

export function QueryErrorAlert({ title, children, onRetry, isRetrying = false }: QueryErrorAlertProps) {
  return (
    <div role="alert" aria-live="assertive">
      <InlineAlert
        title={title}
        variant="danger"
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
