import React from 'react';
import { usePlatform } from '../../context/PlatformContext';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = usePlatform();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-20 lg:bottom-5 right-4 lg:right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const iconName =
          toast.tone === 'success'
            ? 'check_circle'
            : toast.tone === 'error'
              ? 'error'
              : 'info';
        const iconTone =
          toast.tone === 'success'
            ? 'text-primary'
            : toast.tone === 'error'
              ? 'text-error'
              : 'text-secondary';

        return (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto bg-surface-container-lowest rounded-2xl shadow-[0_6px_24px_rgba(11,28,48,0.12)] p-3.5 flex items-start gap-3 transition-all duration-150"
          >
            <span className={`material-symbols-outlined text-[20px] shrink-0 mt-0.5 ${iconTone}`}>
              {iconName}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-on-surface leading-tight">
                {toast.title}
              </p>
              <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                {toast.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="text-outline hover:text-on-surface p-1 rounded-full transition-colors shrink-0"
              aria-label="Dismiss notification"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        );
      })}
    </div>
  );
};
