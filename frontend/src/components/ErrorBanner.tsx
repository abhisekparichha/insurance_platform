import { AlertTriangle } from 'lucide-react';

const ErrorBanner = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <div className="flex items-center justify-between rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
    <div className="flex items-center gap-2">
      <AlertTriangle className="h-4 w-4" />
      <span>{message}</span>
    </div>
    {onRetry && (
      <button className="rounded-xl border border-red-400/50 px-3 py-1 text-xs" onClick={onRetry}>
        Retry
      </button>
    )}
  </div>
);

export default ErrorBanner;
