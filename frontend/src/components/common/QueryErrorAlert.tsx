import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => onRetry()}
            disabled={isRetrying}
          >
            <RefreshCw size={16} aria-hidden="true" />
            {isRetrying ? 'Đang tải lại…' : 'Thử tải lại'}
          </Button>
        )}
      >
        {children}
      </InlineAlert>
    </div>
  );
}
