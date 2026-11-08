/**
 * SSE /api/events 구독 — 서버 감지 전환으로 클라이언트 데이터 수신은 이 스트림 하나뿐 (폴링 제거).
 * frame → realtime-img 반영 / quake → p2p 소식 / eew → wolfx·p2p 매핑 후 funnel.
 * 재접속은 EventSource 내장(자동 리트라이).
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

let es: EventSource | null = null;

export function stopServerEvents(): void {
  es?.close();
  es = null;
}

export function startServerEvents(handlers: ServerEventsHandlers): void {
  stopServerEvents();
  es = new EventSource('/api/events');

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
      applyFrameEvent(JSON.parse((ev as MessageEvent).data) as FrameEvent, handlers.host);
    } catch (err) {
      console.warn('frame 이벤트 처리 실패:', err);
    }
  });

  es.addEventListener('quake', ev => {
    try {
      p2pQuakeService.ingest551(JSON.parse((ev as MessageEvent).data), handlers.onQuake);
    } catch (err) {
      console.warn('quake 이벤트 처리 실패:', err);
    }
  });

  es.addEventListener('eew', ev => {
    try {
      const { kind, data } = JSON.parse((ev as MessageEvent).data);
      const mapped = kind === 'wolfx' ? wolfxEewService.mapWolfx(data) : p2pQuakeService.map556ToEew(data);
      if (mapped) handlers.onEew(mapped);
    } catch (err) {
      console.warn('eew 이벤트 처리 실패:', err);
    }
  });

  es.onerror = () => {
    // EventSource가 자동 재접속 — 여기선 상태 로그만
    console.warn('SSE 연결 끊김 — 자동 재접속 대기');
  };
}
