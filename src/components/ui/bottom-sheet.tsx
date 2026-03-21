"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { createPortal } from "react-dom";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  snapPoints?: number[];
  initialSnap?: number;
  title?: string;
}

const DRAG_CLOSE_THRESHOLD = 0.25;
const VELOCITY_CLOSE_THRESHOLD = 800;

export function BottomSheet({
  isOpen,
  onClose,
  children,
  snapPoints = [0.5, 0.75, 1],
  initialSnap = 0,
  title,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragCurrentY = useRef(0);
  const lastTimestamp = useRef(0);
  const lastY = useRef(0);
  const velocityY = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [translateY, setTranslateY] = useState(0);
  const [currentSnapIndex, setCurrentSnapIndex] = useState(initialSnap);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setCurrentSnapIndex(initialSnap);
      setTranslateY(0);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, initialSnap]);

  const getSheetHeight = useCallback(() => {
    return window.innerHeight * snapPoints[currentSnapIndex];
  }, [snapPoints, currentSnapIndex]);

  const handleDragStart = useCallback((clientY: number) => {
    dragStartY.current = clientY;
    dragCurrentY.current = clientY;
    lastTimestamp.current = Date.now();
    lastY.current = clientY;
    velocityY.current = 0;
    setIsDragging(true);
  }, []);

  const handleDragMove = useCallback((clientY: number) => {
    const deltaY = clientY - dragStartY.current;
    const now = Date.now();
    const timeDelta = now - lastTimestamp.current;

    if (timeDelta > 0) {
      velocityY.current = ((clientY - lastY.current) / timeDelta) * 1000;
    }

    lastTimestamp.current = now;
    lastY.current = clientY;
    dragCurrentY.current = clientY;

    if (deltaY > 0) {
      setTranslateY(deltaY);
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    const sheetHeight = getSheetHeight();
    const dragDistance = translateY / sheetHeight;

    if (dragDistance > DRAG_CLOSE_THRESHOLD || velocityY.current > VELOCITY_CLOSE_THRESHOLD) {
      onClose();
    } else {
      const closestSnapIndex = snapPoints.reduce((closest, snap, index) => {
        const currentDistance = Math.abs(snap * window.innerHeight - (sheetHeight - translateY));
        const closestDistance = Math.abs(snapPoints[closest] * window.innerHeight - (sheetHeight - translateY));
        return currentDistance < closestDistance ? index : closest;
      }, currentSnapIndex);

      setCurrentSnapIndex(closestSnapIndex);
    }
    setTranslateY(0);
  }, [translateY, getSheetHeight, onClose, snapPoints, currentSnapIndex]);

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-sheet-scrollable]")) {
      const scrollable = target.closest("[data-sheet-scrollable]") as HTMLElement;
      if (scrollable.scrollTop > 0) return;
    }
    handleDragStart(event.touches[0].clientY);
  }, [handleDragStart]);

  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    if (!isDragging) return;
    handleDragMove(event.touches[0].clientY);
  }, [isDragging, handleDragMove]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    handleDragEnd();
  }, [isDragging, handleDragEnd]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  const sheetHeight = snapPoints[currentSnapIndex] * 100;

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black/40 z-50 transition-opacity duration-200"
        onClick={onClose}
        style={{ opacity: isDragging ? 1 - translateY / (window.innerHeight * snapPoints[currentSnapIndex]) : 1 }}
      />

      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-xl flex flex-col"
        style={{
          height: `${sheetHeight}vh`,
          transform: `translateY(${translateY}px)`,
          transition: isDragging ? "none" : "transform 300ms cubic-bezier(0.32, 0.72, 0, 1), height 300ms cubic-bezier(0.32, 0.72, 0, 1)",
          paddingBottom: "var(--sai-bottom, 0px)",
          maxHeight: "95vh",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing shrink-0">
          <div className="w-9 h-1 rounded-full bg-neutral-300" />
        </div>

        {title && (
          <div className="px-4 pb-3 pt-1 shrink-0">
            <h3 className="text-sm font-semibold text-neutral-800">{title}</h3>
          </div>
        )}

        <div className="flex-1 overflow-y-auto overscroll-contain" data-sheet-scrollable>
          {children}
        </div>
      </div>
    </>,
    document.body,
  );
}
