import { useState, useEffect, useCallback, useRef } from 'react';

export function useTypewriter(targetText: string, speed = 15) {
  const [index, setIndex] = useState(0);
  const skipRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    setIndex(0);
    skipRef.current = false;
    lastTimeRef.current = 0;
  }, [targetText]);

  useEffect(() => {
    if (index >= targetText.length) return;
    if (skipRef.current) {
      setIndex(targetText.length);
      return;
    }

    const step = (time: number) => {
      if (skipRef.current) {
        setIndex(targetText.length);
        return;
      }
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const elapsed = time - lastTimeRef.current;
      if (elapsed >= speed) {
        const charsToAdd = Math.min(Math.floor(elapsed / speed), targetText.length - index);
        setIndex((prev) => Math.min(prev + charsToAdd, targetText.length));
        lastTimeRef.current = time;
      }
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [index, targetText, speed]);

  const skip = useCallback(() => {
    skipRef.current = true;
    setIndex(targetText.length);
  }, [targetText]);

  return {
    displayedText: targetText.slice(0, index),
    isAnimating: index < targetText.length,
    skip,
  };
}
