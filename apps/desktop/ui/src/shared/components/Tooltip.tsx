import { useState, useRef, useCallback, useEffect, type ReactElement, cloneElement, isValidElement } from 'react';
import { createPortal } from 'react-dom';

/* ── Types ── */

type Placement = 'top' | 'right' | 'bottom' | 'left';

type TooltipProps = {
  label: string;
  placement?: Placement;
  delay?: number;
  children: ReactElement;
};

/* ── Constants ── */

const TOOLTIP_GAP = 6;
const VIEWPORT_PADDING = 4;

/* ── Helpers ── */

type ChildProps = Record<string, unknown>;

function calcPos(
  rect: DOMRect,
  placement: Placement,
  bubbleW: number,
  bubbleH: number,
) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let x = 0;
  let y = 0;

  switch (placement) {
    case 'right':
      x = rect.right + TOOLTIP_GAP;
      y = rect.top + (rect.height - bubbleH) / 2;
      break;
    case 'left':
      x = rect.left - TOOLTIP_GAP - bubbleW;
      y = rect.top + (rect.height - bubbleH) / 2;
      break;
    case 'top':
      x = rect.left + (rect.width - bubbleW) / 2;
      y = rect.top - TOOLTIP_GAP - bubbleH;
      break;
    case 'bottom':
      x = rect.left + (rect.width - bubbleW) / 2;
      y = rect.bottom + TOOLTIP_GAP;
      break;
  }

  // Clamp to viewport
  if (bubbleW > 0) {
    if (x + bubbleW > vw - VIEWPORT_PADDING) x = vw - bubbleW - VIEWPORT_PADDING;
    if (x < VIEWPORT_PADDING) x = VIEWPORT_PADDING;
  }
  if (bubbleH > 0) {
    if (y + bubbleH > vh - VIEWPORT_PADDING) y = vh - bubbleH - VIEWPORT_PADDING;
    if (y < VIEWPORT_PADDING) y = VIEWPORT_PADDING;
  }

  return { x, y };
}

/* ── Component ── */

export function Tooltip({ label, placement = 'right', delay = 380, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const bubbleRef = useRef<HTMLDivElement>(null);

  // Clean up pending timer on unmount
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const show = useCallback((e: React.MouseEvent) => {
    const target = e.currentTarget as HTMLElement;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const rect = target.getBoundingClientRect();
      setPos(calcPos(rect, placement, 0, 0));
      setVisible(true);
      // Refine position once bubble is rendered and measurable
      requestAnimationFrame(() => {
        const bubble = bubbleRef.current;
        if (!bubble) return;
        setPos(calcPos(rect, placement, bubble.offsetWidth, bubble.offsetHeight));
      });
    }, delay);
  }, [placement, delay]);

  const hide = useCallback(() => {
    clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  if (!isValidElement(children)) return children;

  const childProps = (children as ReactElement<ChildProps>).props;

  const child = cloneElement(children as ReactElement<ChildProps>, {
    onMouseEnter: (e: React.MouseEvent) => {
      show(e);
      if (typeof childProps.onMouseEnter === 'function') {
        (childProps.onMouseEnter as (e: React.MouseEvent) => void)(e);
      }
    },
    onMouseLeave: (e: React.MouseEvent) => {
      hide();
      if (typeof childProps.onMouseLeave === 'function') {
        (childProps.onMouseLeave as (e: React.MouseEvent) => void)(e);
      }
    },
  });

  return (
    <>
      {child}
      {visible &&
        createPortal(
          <div
            ref={bubbleRef}
            className="tooltip-bubble"
            style={{ left: pos.x, top: pos.y }}
            role="tooltip"
          >
            {label}
          </div>,
          document.body,
        )}
    </>
  );
}
