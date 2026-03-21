"use client";

import { useRef, useCallback } from "react";

interface LongPressOptions {
  threshold?: number;
  onLongPress: (event: React.TouchEvent | React.MouseEvent) => void;
  onPress?: () => void;
}

export function useLongPress({
  threshold = 500,
  onLongPress,
  onPress,
}: LongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onTouchStart = useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0];
    startPosRef.current = { x: touch.clientX, y: touch.clientY };
    isLongPressRef.current = false;

    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      onLongPress(event);
    }, threshold);
  }, [threshold, onLongPress]);

  const onTouchMove = useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0];
    const moveDistance = Math.sqrt(
      Math.pow(touch.clientX - startPosRef.current.x, 2) +
      Math.pow(touch.clientY - startPosRef.current.y, 2)
    );

    if (moveDistance > 10) {
      clear();
    }
  }, [clear]);

  const onTouchEnd = useCallback(() => {
    if (!isLongPressRef.current && onPress) {
      onPress();
    }
    clear();
  }, [clear, onPress]);

  const onContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
  }, []);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onContextMenu,
  };
}
