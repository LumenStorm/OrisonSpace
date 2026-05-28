import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { GeneratedImageItem } from './ImageGenEditor';
import { useDialogA11y } from '../../shared/hooks/useDialogA11y';

type ImageEditTool = 'brush' | 'circle' | 'mask' | 'crop';

type Point = {
  x: number;
  y: number;
};

type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type HistoryEntry = {
  image: string;
  mask: string;
};

type ImageEditIntent = 'save' | 'generate';

type ImageEditDialogProps = {
  item: GeneratedImageItem;
  onCancel: () => void;
  /**
   * `intent`:
   * - `'save'` (default, no button change) — persist the edited raster directly to temp as a new asset.
   * - `'generate'` — forward image (and mask for OpenAI) to the image model as an edit request.
   *   For Gemini adapters the mask is dropped and the image is used as a reference with the prompt.
   */
  onSave: (payload: {
    b64Json: string;
    mimeType: string;
    maskB64Json?: string;
    intent: ImageEditIntent;
  }) => Promise<void>;
};

const COLOR_SWATCHES = ['#ff4d4f', '#faad14', '#52c41a', '#1677ff', '#ffffff', '#111827'];

export function ImageEditDialog({ item, onCancel, onSave }: ImageEditDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const startRef = useRef<Point | null>(null);
  const lastRef = useRef<Point | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<ImageEditTool>('brush');
  const [color, setColor] = useState('#ff4d4f');
  const [size, setSize] = useState(12);
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [saving, setSaving] = useState(false);
  const [hasMask, setHasMask] = useState(false);

  useDialogA11y(dialogRef, onCancel);

  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      const canvas = canvasRef.current;
      const overlay = overlayRef.current;
      const mask = maskRef.current;
      if (!canvas || !overlay || !mask) return;

      const maxSide = 1400;
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));

      for (const layer of [canvas, overlay, mask]) {
        layer.width = width;
        layer.height = height;
      }

      const ctx = canvas.getContext('2d');
      const maskCtx = mask.getContext('2d');
      if (!ctx || !maskCtx) return;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);
      maskCtx.clearRect(0, 0, width, height);
      setHistory([snapshotLayers()]);
      setHistoryIndex(0);
      setCropRect(null);
    };
    image.src = item.dataUrl;
  }, [item.dataUrl]);

  function getPoint(event: PointerEvent<HTMLCanvasElement>): Point {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function pushHistory() {
    const next = snapshotLayers();
    setHistory((current) => [...current.slice(0, historyIndex + 1), next]);
    setHistoryIndex((current) => current + 1);
  }

  function snapshotLayers(): HistoryEntry {
    return {
      image: canvasRef.current?.toDataURL('image/png') ?? '',
      mask: maskRef.current?.toDataURL('image/png') ?? '',
    };
  }

  function clearOverlay() {
    const overlay = overlayRef.current;
    const ctx = overlay?.getContext('2d');
    if (!overlay || !ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
  }

  function drawLine(from: Point, to: Point) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size;
    ctx.strokeStyle = tool === 'mask' ? withAlpha(color, 0.45) : color;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    if (tool === 'mask') {
      const mask = maskRef.current;
      const maskCtx = mask?.getContext('2d');
      if (!mask || !maskCtx) return;
      maskCtx.lineCap = 'round';
      maskCtx.lineJoin = 'round';
      maskCtx.lineWidth = size;
      maskCtx.strokeStyle = '#ffffff';
      maskCtx.beginPath();
      maskCtx.moveTo(from.x, from.y);
      maskCtx.lineTo(to.x, to.y);
      maskCtx.stroke();
      setHasMask(true);
    }
  }

  function drawPreview(start: Point, end: Point) {
    const overlay = overlayRef.current;
    const ctx = overlay?.getContext('2d');
    if (!overlay || !ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    const rect = normalizeRect(start, end);

    ctx.lineWidth = Math.max(2, size / 4);
    ctx.setLineDash(tool === 'crop' ? [8, 6] : []);
    ctx.strokeStyle = tool === 'crop' ? '#ffffff' : color;
    if (tool === 'circle') {
      ctx.beginPath();
      ctx.ellipse(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
        rect.width / 2,
        rect.height / 2,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    } else if (tool === 'crop') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.fillRect(0, 0, overlay.width, overlay.height);
      ctx.clearRect(rect.x, rect.y, rect.width, rect.height);
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }
    ctx.setLineDash([]);
  }

  function commitCircle(start: Point, end: Point) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const rect = normalizeRect(start, end);
    ctx.lineWidth = size;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.ellipse(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
      rect.width / 2,
      rect.height / 2,
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getPoint(event);
    drawingRef.current = true;
    startRef.current = point;
    lastRef.current = point;
    setCropRect(null);
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || !startRef.current || !lastRef.current) return;
    const point = getPoint(event);
    if (tool === 'brush' || tool === 'mask') {
      drawLine(lastRef.current, point);
      lastRef.current = point;
      return;
    }
    drawPreview(startRef.current, point);
  }

  function handlePointerUp(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || !startRef.current) return;
    const point = getPoint(event);
    drawingRef.current = false;

    if (tool === 'brush' || tool === 'mask') {
      pushHistory();
      return;
    }

    if (tool === 'circle') {
      commitCircle(startRef.current, point);
      clearOverlay();
      pushHistory();
      return;
    }

    if (tool === 'crop') {
      setCropRect(normalizeRect(startRef.current, point));
    }
  }

  function applyCrop() {
    const canvas = canvasRef.current;
    const mask = maskRef.current;
    if (!canvas || !mask || !cropRect || cropRect.width < 8 || cropRect.height < 8) return;
    cropCanvas(canvas, cropRect);
    cropCanvas(mask, cropRect);
    const overlay = overlayRef.current;
    if (overlay) {
      overlay.width = canvas.width;
      overlay.height = canvas.height;
    }
    setCropRect(null);
    clearOverlay();
    pushHistory();
  }

  function restoreFromHistory(nextIndex: number) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const mask = maskRef.current;
    const maskCtx = mask?.getContext('2d');
    const source = history[nextIndex];
    if (!canvas || !ctx || !source) return;
    const image = new Image();
    image.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      setHistoryIndex(nextIndex);
      clearOverlay();
      setCropRect(null);
    };
    image.src = source.image;

    if (mask && maskCtx) {
      if (source.mask) {
        const maskImage = new Image();
        maskImage.onload = () => {
          maskCtx.clearRect(0, 0, mask.width, mask.height);
          maskCtx.drawImage(maskImage, 0, 0, mask.width, mask.height);
          setHasMask(canvasHasPaint(mask));
        };
        maskImage.src = source.mask;
      } else {
        maskCtx.clearRect(0, 0, mask.width, mask.height);
        setHasMask(false);
      }
    }
  }

  function handleResetToOriginal() {
    if (history.length === 0) return;
    if (!window.confirm('Reset to the original image?')) return;
    restoreFromHistory(0);
  }

  async function handleSave(intent: ImageEditIntent = 'save') {
    const canvas = canvasRef.current;
    const mask = maskRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const maskDataUrl = mask && canvasHasPaint(mask) ? mask.toDataURL('image/png') : null;
      await onSave({
        b64Json: dataUrlToBase64(dataUrl),
        mimeType: 'image/png',
        maskB64Json: maskDataUrl ? dataUrlToBase64(maskDataUrl) : undefined,
        intent,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="image-edit-overlay" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="image-edit-dialog" ref={dialogRef} tabIndex={-1} onClick={(event) => event.stopPropagation()}>
        <div className="image-edit-toolbar">
          <div className="image-edit-toolbar-group">
            <ToolButton icon="brush" label="Brush" active={tool === 'brush'} onClick={() => setTool('brush')} />
            <ToolButton icon="radio_button_unchecked" label="Circle" active={tool === 'circle'} onClick={() => setTool('circle')} />
            <ToolButton icon="texture" label="Mask" active={tool === 'mask'} onClick={() => setTool('mask')} />
            <ToolButton icon="crop" label="Crop" active={tool === 'crop'} onClick={() => setTool('crop')} />
          </div>

          {tool === 'crop' ? (
            <div className="image-edit-toolbar-group image-edit-toolbar-style">
              <button type="button" onClick={applyCrop} disabled={!cropRect}>Apply Crop</button>
              <button type="button" onClick={() => setCropRect(null)} disabled={!cropRect}>Reset Crop</button>
            </div>
          ) : (
            <div className="image-edit-toolbar-group image-edit-toolbar-style">
              <div className="image-edit-colors" aria-label="Colors">
                {COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    className={swatch === color ? 'is-active' : ''}
                    style={{ backgroundColor: swatch }}
                    aria-label={`Color ${swatch}`}
                    onClick={() => setColor(swatch)}
                  />
                ))}
                <input aria-label="Custom color" type="color" value={color} onChange={(event) => setColor(event.target.value)} />
              </div>
              <label className="image-edit-size">
                <span>Size</span>
                <input type="range" min={2} max={64} value={size} onChange={(event) => setSize(Number(event.target.value))} />
              </label>
            </div>
          )}

          <div className="image-edit-toolbar-group image-edit-history">
            <ToolButton
              icon="restart_alt"
              label="Reset"
              disabled={history.length === 0 || historyIndex === 0}
              onClick={handleResetToOriginal}
            />
            <ToolButton icon="undo" label="Undo" disabled={historyIndex <= 0} onClick={() => restoreFromHistory(historyIndex - 1)} />
            <ToolButton icon="redo" label="Redo" disabled={historyIndex >= history.length - 1} onClick={() => restoreFromHistory(historyIndex + 1)} />
          </div>

          <div className="image-edit-actions">
            <button type="button" onClick={onCancel}>Cancel</button>
            <button
              type="button"
              onClick={() => void handleSave('generate')}
              disabled={saving}
              title="Send this image (and mask, for OpenAI) back to the image model as an edit request"
            >
              {saving ? 'Working...' : 'Generate Variant'}
            </button>
            <button type="button" className="primary" onClick={() => void handleSave('save')} disabled={saving}>
              {saving ? 'Saving...' : 'Save Edit'}
            </button>
          </div>
        </div>
        <div className="image-edit-stage">
          <div className="image-edit-canvas-wrap">
            <canvas ref={canvasRef} />
            <canvas
              ref={overlayRef}
              className="image-edit-overlay-canvas"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={() => { drawingRef.current = false; clearOverlay(); }}
            />
            <canvas
              ref={maskRef}
              className={
                tool === 'mask' || hasMask
                  ? 'image-edit-mask-canvas is-visible'
                  : 'image-edit-mask-canvas'
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

type ToolButtonProps = {
  icon: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

function ToolButton({ icon, label, active = false, disabled = false, onClick }: ToolButtonProps) {
  return (
    <button
      type="button"
      className={active ? 'is-active' : ''}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
    </button>
  );
}

function normalizeRect(start: Point, end: Point): CropRect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

function cropCanvas(canvas: HTMLCanvasElement, rect: CropRect) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const x = Math.max(0, Math.floor(rect.x));
  const y = Math.max(0, Math.floor(rect.y));
  const width = Math.min(canvas.width - x, Math.max(1, Math.floor(rect.width)));
  const height = Math.min(canvas.height - y, Math.max(1, Math.floor(rect.height)));
  const imageData = ctx.getImageData(x, y, width, height);
  canvas.width = width;
  canvas.height = height;
  ctx.putImageData(imageData, 0, 0);
}

function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.split(',')[1] ?? '';
}

function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized;
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function canvasHasPaint(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] !== 0) return true;
  }
  return false;
}
