import { useCallback, useEffect, useRef } from 'react';

type Props = {
  onResize: (delta: number) => void;
  direction?: 'horizontal' | 'vertical';
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
  step?: number;
  largeStep?: number;
};

export function ResizeHandle({
  onResize,
  direction = 'horizontal',
  className = '',
  style,
  'aria-label': ariaLabel = 'Resize',
  step = 4,
  largeStep = 16,
}: Props) {
  const onResizeRef = useRef(onResize);
  useEffect(() => { onResizeRef.current = onResize; });

  const isVertical = direction === 'vertical';

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    let lastPos = isVertical ? e.clientY : e.clientX;

    const onMove = (ev: PointerEvent) => {
      const pos = isVertical ? ev.clientY : ev.clientX;
      const delta = pos - lastPos;
      lastPos = pos;
      onResizeRef.current(delta);
    };

    const onUp = (ev: PointerEvent) => {
      el.releasePointerCapture(ev.pointerId);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
  }, [isVertical]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const positiveKey = isVertical ? 'ArrowDown' : 'ArrowRight';
    const negativeKey = isVertical ? 'ArrowUp' : 'ArrowLeft';
    const amount = e.shiftKey ? largeStep : step;

    if (e.key === positiveKey) {
      e.preventDefault();
      onResizeRef.current(amount);
    } else if (e.key === negativeKey) {
      e.preventDefault();
      onResizeRef.current(-amount);
    }
  }, [isVertical, step, largeStep]);

  const cls = isVertical ? 'resize-handle resize-handle-vertical' : 'resize-handle';

  return (
    <div
      className={`${cls} ${className}`}
      style={style}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      role="separator"
      aria-orientation={isVertical ? 'horizontal' : 'vertical'}
      aria-label={ariaLabel}
      tabIndex={0}
    />
  );
}
