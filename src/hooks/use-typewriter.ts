"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const CHAR_INTERVAL_MS = 80;
const MIN_LENGTH_TO_ANIMATE = 20;

interface UseTypewriterOptions {
  enabled: boolean;
}

export function useTypewriter(fullText: string, options: UseTypewriterOptions) {
  const { enabled } = options;
  const lockedTextRef = useRef(fullText);
  const [visibleLength, setVisibleLength] = useState(enabled ? 0 : fullText.length);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const skippedRef = useRef(false);

  if (!enabled) {
    lockedTextRef.current = fullText;
  }

  const textLength = lockedTextRef.current.length;
  const shouldAnimate = enabled && textLength >= MIN_LENGTH_TO_ANIMATE;
  const isAnimating = shouldAnimate && visibleLength < textLength && !skippedRef.current;

  useEffect(() => {
    if (!shouldAnimate) {
      setVisibleLength(textLength);
      return;
    }

    setVisibleLength(0);
    skippedRef.current = false;
    lastTimeRef.current = 0;

    function animate(timestamp: number) {
      if (skippedRef.current) return;

      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
      }

      const elapsed = timestamp - lastTimeRef.current;
      const charsToShow = Math.floor(elapsed / CHAR_INTERVAL_MS);

      if (charsToShow >= textLength) {
        setVisibleLength(textLength);
        return;
      }

      setVisibleLength(charsToShow);
      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [shouldAnimate, textLength]);

  const skip = useCallback(() => {
    skippedRef.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setVisibleLength(textLength);
  }, [textLength]);

  return {
    displayText: lockedTextRef.current.slice(0, visibleLength),
    isAnimating,
    isComplete: visibleLength >= textLength,
    skip,
  };
}
