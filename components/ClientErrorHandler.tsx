'use client';

import { useEffect } from 'react';

export function ClientErrorHandler() {
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // If the rejection reason is a generic Event instance or lacks error information
      if (
        event.reason instanceof Event ||
        (event.reason && typeof event.reason === 'object' && event.reason.type === 'error') ||
        (event.reason && event.reason.name === 'AbortError')
      ) {
        event.preventDefault();
        console.warn('Suppressed unhandled [Event] rejection:', event.reason);
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
}
