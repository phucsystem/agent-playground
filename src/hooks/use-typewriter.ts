"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const CHAR_INTERVAL_MS = 15;
const MIN_LENGTH_TO_ANIMATE = 20;

interface UseTypewriterOptions {
  enabled: boolean;
}

export function useTypewriter(fullText: string, options: UseTypewriterOptions) {
  const { enabled } = options;
  const [visibleLength, setVisibleLength] = useState(enabled ? 0 : fullText.length);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const skippedRef = useRef(false);

  const isAnimating = enabled && visibleLength < fullText.length && !skippedRef.current;
  const shouldAnimate = enabled && fullText.length >= MIN_LENGTH_TO_ANIMATE;

  useEffect(() => {
    if (!shouldAnimate) {
      setVisibleLength(fullText.length);
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

      if (charsToShow >= fullText.length) {
        setVisibleLength(fullText.length);
        return;
      }

      setVisibleLength(charsToShow);
      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [fullText, shouldAnimate]);

  const skip = useCallback(() => {
    skippedRef.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setVisibleLength(fullText.length);
  }, [fullText.length]);

  return {
    displayText: fullText.slice(0, visibleLength),
    isAnimating: shouldAnimate && isAnimating,
    isComplete: visibleLength >= fullText.length,
    skip,
  };
}
