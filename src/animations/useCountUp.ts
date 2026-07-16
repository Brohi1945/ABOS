import { useState, useEffect, useRef } from "react";

interface UseCountUpOptions {
  duration?: number;
  delay?: number;
}

export function useCountUp(
  target: number | string,
  options: UseCountUpOptions = {}
): string | number {
  const { duration = 800, delay = 0 } = options;

  const numericTarget = typeof target === "string"
    ? parseFloat(target.replace(/[^0-9.-]/g, "")) || 0
    : target;

  const [value, setValue] = useState(0);
  const [started, setStarted] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (numericTarget === 0) {
      setValue(0);
      setStarted(false);
      return;
    }

    const timer = setTimeout(() => {
      setStarted(true);
      startTimeRef.current = null;
      frameRef.current = null;
    }, delay);

    return () => clearTimeout(timer);
  }, [numericTarget, delay]);

  useEffect(() => {
    if (!started) return;

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const progress = Math.min(
        1,
        (timestamp - startTimeRef.current) / duration
      );

      const eased = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.round(eased * numericTarget);

      setValue(currentValue);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setValue(numericTarget);
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [started, numericTarget, duration]);

  if (typeof target === "string") {
    return value.toLocaleString();
  }

  return value;
}
