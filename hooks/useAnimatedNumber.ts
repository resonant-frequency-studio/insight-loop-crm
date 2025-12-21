"use client";

import { useState, useEffect, useRef } from "react";

interface UseAnimatedNumberOptions {
  duration?: number; // Animation duration in milliseconds
  easing?: (t: number) => number; // Easing function
}

// Ease-out cubic function for smooth animation
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Hook to animate a number from its current value to a target value
 * @param target - The target number to animate to
 * @param options - Animation options (duration, easing)
 * @returns The current animated value
 */
export function useAnimatedNumber(
  target: number,
  options: UseAnimatedNumberOptions = {}
): number {
  const { duration = 600, easing = easeOutCubic } = options;
  const [animatedValue, setAnimatedValue] = useState(0);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const startValueRef = useRef(0);
  const targetRef = useRef(target);
  const easingRef = useRef(easing);
  const animatedValueRef = useRef(0);

  // Update easing ref when it changes
  useEffect(() => {
    easingRef.current = easing;
  }, [easing]);

  // Update animatedValueRef when animatedValue changes
  useEffect(() => {
    animatedValueRef.current = animatedValue;
  }, [animatedValue]);

  useEffect(() => {
    // Update target ref when target changes
    targetRef.current = target;

    // If target is 0 or less, set immediately
    if (target <= 0) {
      queueMicrotask(() => {
        setAnimatedValue(0);
      });
      startValueRef.current = 0;
      animatedValueRef.current = 0;
      return;
    }

    // If we're already at the target, no need to animate
    if (Math.abs(animatedValueRef.current - target) < 0.01) {
      return;
    }

    // Start animation
    startValueRef.current = animatedValueRef.current;
    startTimeRef.current = null;

    const animate = (currentTime: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = currentTime;
      }

      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easingRef.current(progress);

      const currentValue = startValueRef.current + (targetRef.current - startValueRef.current) * easedProgress;
      setAnimatedValue(Math.round(currentValue));

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Ensure we end exactly at the target
        setAnimatedValue(targetRef.current);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [target, duration]);

  return animatedValue;
}

