/**
 * 부재 복귀 catch-up — 절전/탭 부재 후 복귀하면 오래된 프레임에서 현재로 확 넘어가는 스냅 대신,
 * 서버 버퍼(frame-buffer TTL 15분)에 남은 프레임을 25fps 가속 재생(타임랩스)해 자연스럽게 따라잡는다.
 * 재생은 표시(gif/시각)만 소장 — 색칠/사운드/알림은 applyFrameData가 재생 중에도 실시간으로 처리.
 */
import { applyFrameDisplay } from './realtime-img';
import type { FrameEvent } from './realtime-img';

const GAP_MS = 30_000; // 표시 프레임 대비 이 이상 밀렸을 때 되감기 전환 (그 이하는 라이브 스냅)
const REPLAY_INTERVAL_MS = 40; // 1초 프레임 → 25fps 가속 (100장 ≈ 4초)

/** 14자리 JST → ms (JST를 UTC로 읽어도 두 시각의 차는 정확) */
function jstMs(t: string): number {
  return Date.UTC(+t.slice(0, 4), +t.slice(4, 6) - 1, +t.slice(6, 8), +t.slice(8, 10), +t.slice(10, 12), +t.slice(12, 14));
}

/** 부재 사이 밀림 판정 — prevTime은 직전에 표시했던 프레임 시각 */
export function needsCatchUp(prevTime: string | null, nextTime: string): boolean {
  return prevTime !== null && jstMs(nextTime) - jstMs(prevTime) > GAP_MS;
}

let playing = false;
let pendingLatest: FrameEvent | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

export function catchUpPlaying(): boolean {
  return playing;
}

/** 재생 중 도착한 라이브 프레임 — 마지막 것을 재생 종료 시 표시해 라이브로 자연 연결 */
export function trackLatest(e: FrameEvent): void {
  pendingLatest = e;
}

function finish(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  const last = pendingLatest;
  pendingLatest = null;
  playing = false;
  if (last) applyFrameDisplay(last);
}

/** from 이후 서버 버퍼 프레임을 가속 재생 — 버퍼 비었음(서버 재시작 등)/fetch 실패 시 기존대로 스냅 */
export function startCatchUp(fromTime: string): void {
  if (playing) return;
  playing = true;
  pendingLatest = null;
  fetch(`/api/frame-history?from=${fromTime}`)
    .then(r => r.json())
    .then(body => {
      const frames: { time: string; gif: string }[] = Array.isArray(body?.frames) ? body.frames : [];
      if (frames.length === 0) return finish();
      let i = 0;
      timer = setInterval(() => {
        applyFrameDisplay(frames[i]);
        i += 1;
        if (i >= frames.length) finish();
      }, REPLAY_INTERVAL_MS);
    })
    .catch(finish);
}
