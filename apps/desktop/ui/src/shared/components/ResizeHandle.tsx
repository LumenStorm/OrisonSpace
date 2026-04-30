import { useCallback, useEffect, useRef } from 'react';

type Props = {
  onResize: (delta: number) => void;
  direction?: 'horizontal' | 'vertical';
  className?: string;
  style?: React.CSSProperties;
};

export function ResizeHandle({ onResize, direction = 'horizontal', className = '', style }: Props) {
  const startPos = useRef(0);
  const onResizeRef = useRef(onResize);

  useEffect(() => {
    onResizeRef.current = onResize;
  });

  const isVertical = direction === 'vertical';

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startPos.current = isVertical ? e.clientY : e.clientX;
    const onMove = (ev: MouseEvent) => {
      const pos = isVertical ? ev.clientY : ev.clientX;
      const delta = pos - startPos.current;
      startPos.current = pos;
      onResizeRef.current(delta);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = isVertical ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';
  }, [isVertical]);

  const cls = isVertical ? 'resize-handle resize-handle-vertical' : 'resize-handle';

  return <div className={`${cls} ${className}`} style={style} onMouseDown={onMouseDown} />;
}
