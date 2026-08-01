import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const IDLE_TIMEOUT_MS = 60 * 60 * 1000;

export function useSessionTimeout(): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSignOut = useCallback(async (): Promise<void> => {
    await supabase.auth.signOut();
    window.location.href = '/app';
  }, []);

  const resetTimer = useCallback((): void => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      void handleSignOut();
    }, IDLE_TIMEOUT_MS);
  }, [handleSignOut]);

  useEffect(() => {
    const EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'] as const;

    const handleActivity = (): void => {
      resetTimer();
    };

    EVENTS.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    resetTimer();

    return () => {
      EVENTS.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [resetTimer]);
}
