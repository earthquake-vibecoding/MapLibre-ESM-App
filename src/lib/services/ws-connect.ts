/**
 * WebSocket 재접속 공통 스캐폴딩: 이전 소켓 정리 + 지수 백오프 재접속.
 * 재접속은 setTimeout 기반 — 백그라운드 탭에서 rAF가 멈춰도 유지됨.
 */

import { TIMING } from '../config';

export interface WsRetryHandle {
  disconnect(): void;
}

export interface WsRetryOpts {
  /** 로그 식별자 */
  name: string;
  onMessage: (data: any) => void;
  onOpen?: () => void;
  onError?: () => void;
  baseDelay?: number;
  maxDelay?: number;
}

export function connectWithRetry(url: string, opts: WsRetryOpts): WsRetryHandle {
  let ws: WebSocket | null = null;
  let attempt = 0;
  let intentional = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  const base = opts.baseDelay ?? TIMING.wsBaseMs;
  const max = opts.maxDelay ?? TIMING.wsMaxMs;

  const connect = () => {
    if (typeof WebSocket === 'undefined') return;
    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch (e) {
      console.warn(`${opts.name} WebSocket connect failed`, e);
      return;
    }
    ws = socket;

    socket.onopen = () => {
      attempt = 0;
      opts.onOpen?.();
    };
    socket.onerror = () => opts.onError?.();
    socket.onmessage = (ev: MessageEvent) => {
      try {
        opts.onMessage(JSON.parse(ev.data));
      } catch (e) {
        console.warn(`${opts.name} WS parse error`, e);
      }
    };
    socket.onclose = () => {
      if (ws !== socket || intentional) return;
      ws = null;
      const delay = Math.min(base * Math.pow(TIMING.wsBackoff, attempt), max);
      attempt++;
      console.log(`${opts.name} WebSocket disconnected. Reconnecting in ${Math.round(delay / 1000)}s...`);
      retryTimer = setTimeout(() => {
        if (!intentional) connect();
      }, delay);
    };
  };

  connect();

  return {
    disconnect() {
      intentional = true;
      if (retryTimer !== null) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      if (ws) {
        const s = ws;
        ws = null;
        try {
          s.onclose = null;
          s.onerror = null;
          s.onmessage = null;
          s.close();
        } catch {
          // ignore
        }
      }
    }
  };
}
