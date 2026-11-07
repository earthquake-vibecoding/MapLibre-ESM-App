/**
 * 감지 중 프레임 스냅샷 — kmoni 원본 프레임 + 감지 관측소 빨간 사각형 합성 PNG(data URL).
 * Discord 첨부용(reacct-eqm-1 buildSingleMapGif 패리티). 감지 중 2초 스로틀 갱신,
 * 에피소드 종료 시 ticker가 takeDetectSnapshot()으로 회수. node 환경(테스트/SSR)은 noop.
 */
const SNAP_GAP_MS = 2000;
const RECT_HALF = 4; // 감지 격자 사각형 반경(px) — kmoni 이미지 좌표계

let lastAt = 0;
let pending: string | null = null;
let canvas: HTMLCanvasElement | null = null;

export function updateDetectSnapshot(
  imageData: Uint8ClampedArray,
  width: number,
  height: number,
  features: any[],
  stationsState: Map<string, any>
): void {
  if (typeof document === 'undefined') return;
  const now = Date.now();
  if (now - lastAt < SNAP_GAP_MS) return;

  const hits: { x: number; y: number }[] = [];
  for (const f of features) {
    const px = f.properties.px;
    const py = f.properties.py;
    if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
    if (stationsState.get(f.properties.code)?.event) hits.push({ x: px, y: py });
  }
  if (hits.length === 0) return;
  lastAt = now;

  if (!canvas) canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const frame = ctx.createImageData(width, height);
  frame.data.set(imageData);
  ctx.putImageData(frame, 0, 0);
  ctx.strokeStyle = '#ff2020';
  ctx.lineWidth = 2;
  for (const h of hits) {
    ctx.strokeRect(h.x - RECT_HALF, h.y - RECT_HALF, RECT_HALF * 2, RECT_HALF * 2);
  }
  pending = canvas.toDataURL('image/png');
}

/** 에피소드 종료 시 마지막 스냅샷 회수 (감지가 없었다면 null) */
export function takeDetectSnapshot(): string | null {
  const s = pending;
  pending = null;
  return s;
}
