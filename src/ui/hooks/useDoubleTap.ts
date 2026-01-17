"use client";

import { useMemo, useRef } from "react";

export function useDoubleTap(onDoubleTap: () => void, delayMs = 280) {
  const lastTapRef = useRef<number | null>(null);

  return useMemo(() => {
    return {
      onTouchEnd: () => {
        const now = Date.now();
        const last = lastTapRef.current;
        lastTapRef.current = now;
        if (last && now - last <= delayMs) {
          lastTapRef.current = null;
          onDoubleTap();
        }
      }
    };
  }, [delayMs, onDoubleTap]);
}

