import React, { useState, useEffect, useCallback } from 'react';

/**
 * Custom React hook that tracks whether the frameless Electron window is maximized.
 * Automatically synchronizes with Electron's maximize/unmaximize window events.
 */
export function useWindowMaximize() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const horizonWindow = (window as any).horizon?.window;
    if (!horizonWindow) return;

    // Check initial state
    horizonWindow.isMaximized?.().then((max: boolean) => {
      if (typeof max === 'boolean') {
        setIsMaximized(max);
      }
    }).catch(() => {});

    // Listen to maximize and unmaximize events from main process
    const unsubscribe = horizonWindow.onMaximizeChange?.((max: boolean) => {
      setIsMaximized(max);
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const toggleMaximize = useCallback(async () => {
    const horizonWindow = (window as any).horizon?.window;
    if (horizonWindow?.maximize) {
      try {
        const result = await horizonWindow.maximize();
        if (typeof result === 'boolean') {
          setIsMaximized(result);
        }
      } catch (e) {
        console.error('Failed to toggle maximize:', e);
      }
    } else {
      setIsMaximized(prev => !prev);
    }
  }, []);

  return { isMaximized, toggleMaximize };
}

/**
 * Clean Windows-style restore (unmaximize) icon depicting two overlapping squares.
 */
export function RestoreIcon({ size = 12, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Background square */}
      <path d="M5.5 3.5H12C12.5523 3.5 13 3.94772 13 4.5V10.5" />
      {/* Foreground square */}
      <rect x="3" y="5.5" width="8" height="8" rx="1" />
    </svg>
  );
}

