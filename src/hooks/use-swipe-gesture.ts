"use client";

import { useRef, useCallback, useState } from "react";

interface SwipeGestureOptions {
  threshold?: number;
  onSwipeRight?: () => void;
  enabled?: boolean;
}

interface SwipeGestureReturn {
  swipeOffset: number;
  isSwiping: boolean;
  handlers: {
    onTouchStart: (event: React.TouchEvent) => void;
    onTouchMove: (event: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
}

export function useSwipeGesture({
  threshold = 60,
  onSwipeRight,
  enabled = true,
}: SwipeGestureOptions): SwipeGestureReturn {
  const startX = useRef(0);
  const startY = useRef(0);
  const isTracking = useRef(false);
  const directionLocked = useRef<"horizontal" | "vertical" | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const onTouchStart = useCallback((event: React.TouchEvent) => {
    if (!enabled) return;
    const touch = event.touches[0];
    // Avoid conflict with iOS edge swipe — ignore touches within 50px of screen edges
    if (touch.clientX < 50 || touch.clientX > window.innerWidth - 50) return;

    startX.current = touch.clientX;
    startY.current = touch.clientY;
    isTracking.current = true;
    directionLocked.current = null;
  }, [enabled]);

  const onTouchMove = useCallback((event: React.TouchEvent) => {
    if (!isTracking.current || !enabled) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - startX.current;
    const deltaY = touch.clientY - startY.current;

    if (!directionLocked.current) {
      if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        directionLocked.current = Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
      }
      return;
    }

    if (directionLocked.current === "vertical") {
      isTracking.current = false;
      return;
    }

    // Only track right swipe
    if (deltaX > 0) {
      const dampedOffset = Math.min(deltaX * 0.6, 100);
      setSwipeOffset(dampedOffset);
      setIsSwiping(true);
    }
  }, [enabled]);

  const onTouchEnd = useCallback(() => {
    if (!isTracking.current) return;
    isTracking.current = false;

    if (swipeOffset >= threshold && onSwipeRight) {
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
      onSwipeRight();
    }

    setSwipeOffset(0);
    setIsSwiping(false);
  }, [swipeOffset, threshold, onSwipeRight]);

  return {
    swipeOffset,
    isSwiping,
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
  };
}
