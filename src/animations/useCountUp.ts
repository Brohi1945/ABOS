import { useState, useEffect, useRef } from "react";

interface UseCountUpOptions {
  duration?: number;
  delay?: number;
}

// Matches formatted numbers like "Rs 12,450", "$99.50", "23.4%", "1,204" —
// a plain number optionally wrapped in a currency prefix and/or a percent
// suffix. Anything else (product names, statuses, "—", etc.) is treated as
// non-numeric text and shown exactly as given, with no count-up animation.
const FORMATTED_NUMBER_RE = /^(Rs\s?|\$)?([\d,]+(?:\.\d+)?)(%)?$/;

export function useCountUp(
  target: number | string,
  options: UseCountUpOptions = {}
): string | number {
  const { duration = 800, delay = 0 } = options;

  const isString = typeof target === "string";
  const match = isString ? target.trim().match(FORMATTED_NUMBER_RE) : null;

  // If it's a string we don't recognise as a formatted number (e.g. a
  // product name like "Basmati Rice 5kg" or a dash placeholder "—"), skip
  // animation entirely and just show it as given — don't try to parse a
  // stray digit out of it.
  const canAnimate = !isString || !!match;

  const prefix = match?.[1] || "";
  const suffix = match?.[3] || "";
  const numericTarget = isString
    ? match
      ? parseFloat(match[2].replace(/,/g, "")) || 0
      : 0
    : target;

  const [value, setValue] = useState(0);
  const [started, setStarted] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!canAnimate || numericTarget === 0) {
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
  }, [numericTarget, delay, canAnimate]);

  useEffect(() => {
    if (!started || !canAnimate) return;

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
  }, [started, numericTarget, duration, canAnimate]);

  if (!canAnimate) {
    // Non-numeric string — return exactly as given (e.g. product name).
    return target as string;
  }

  if (isString) {
    return `${prefix}${value.toLocaleString()}${suffix}`;
  }

  return value;
}
