/**
 * SSE /api/events 구독 — 서버 감지 전환으로 클라이언트 데이터 수신은 이 스트림 하나뿐 (폴링 제거).
 * frame → realtime-img 반영 / quake → p2p 소식 / eew → wolfx·p2p 매핑 후 funnel.
 * 재접속: EventSource 내장 재시도는 실패 후에도 3초 간격으로 계속 시도해 절전 해제 직후 오류가 도배되므로,
 * 끊기면 닫고 지수 백오프로 직접 재접속. 온라인 복귀·탭 복귀 시엔 백오프 대기를 무시하고 즉시 재접속.
 */
import { applyFrameEvent, type FrameEvent, type RealtimeHost } from '../detect/realtime-img';
import { p2pQuakeService } from './p2p-quake.svelte';
import { wolfxEewService } from './wolfx-eew.svelte';
import { ui } from '../state.svelte';

export interface ServerEventsHandlers {
  host: RealtimeHost;
  onQuake: (data: any) => void;
  onEew: (mappedEew: any) => void;
}

const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 15000, 30000];

let handlers: ServerEventsHandlers | null = null;
let es: EventSource | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryIdx = 0;

function clearRetry(): void {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
}

function connect(): void {
  if (!handlers || es) return;
  es = new EventSource('/api/events');

  es.onopen = () => {
    retryIdx = 0;
    ui.sseConnected = true;
  };

  es.addEventListener('hello', ev => {
    try {
      const data = JSON.parse((ev as MessageEvent).data);
      if (data.latestTime) ui.latestTime = data.latestTime; // 서버가 'YYYY/MM/DD HH:MM:SS'로 표기
    } catch {
      // 무시
    }
  });

  es.addEventListener('frame', ev => {
    try {
      applyFrameEvent(JSON.parse((ev as MessageEvent).data) as FrameEvent, handlers!.host);
    } catch (err) {
      console.warn('frame 이벤트 처리 실패:', err);
    }
  });

  es.addEventListener('quake', ev => {
    try {
      p2pQuakeService.ingest551(JSON.parse((ev as MessageEvent).data), handlers!.onQuake);
    } catch (err) {
      console.warn('quake 이벤트 처리 실패:', err);
    }
  });

  es.addEventListener('eew', ev => {
    try {
      const { kind, data } = JSON.parse((ev as MessageEvent).data);
      const mapped = kind === 'wolfx' ? wolfxEewService.mapWolfx(data) : p2pQuakeService.map556ToEew(data);
      if (mapped) handlers!.onEew(mapped);
    } catch (err) {
      console.warn('eew 이벤트 처리 실패:', err);
    }
  });

  es.onerror = () => {
    ui.sseConnected = false;
    const delay = RETRY_DELAYS_MS[Math.min(retryIdx, RETRY_DELAYS_MS.length - 1)];
    retryIdx++;
    console.warn(`SSE 연결 끊김 — ${delay / 1000}초 후 재접속`);
    es?.close();
    es = null;
    clearRetry();
    retryTimer = setTimeout(connect, delay);
  };
}

/** 절전 해제·네트워크 복구 — 백오프 대기 중이면 즉시 재접속 (숨은 탭은 복귀 시점에 처리) */
function wakeReconnect(): void {
  if (es || !handlers || document.visibilityState === 'hidden') return;
  clearRetry();
  retryIdx = 0;
  connect();
}

export function stopServerEvents(): void {
  clearRetry();
  es?.close();
  es = null;
  handlers = null;
  ui.sseConnected = false;
  window.removeEventListener('online', wakeReconnect);
  document.removeEventListener('visibilitychange', wakeReconnect);
}

export function startServerEvents(h: ServerEventsHandlers): void {
  stopServerEvents();
  handlers = h;
  window.addEventListener('online', wakeReconnect);
  document.addEventListener('visibilitychange', wakeReconnect);
  connect();
}
