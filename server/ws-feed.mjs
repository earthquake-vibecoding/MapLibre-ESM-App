// 외부 WS 수신 공용 — 재접속 백오프(5s→30s×1.5, 성공 시 리셋). Node 내장 WebSocket.
// 백오프 상수는 서버 로컬 — 클라 config.ts(클라 SSE 전용)와 무관하게 여기서만 튜닝.
const BASE_MS = 5000;
const MAX_MS = 30000;
const MULT = 1.5;

export function connectWithBackoff(url, { name, onMessage }) {
  let delay = BASE_MS;
  const connect = () => {
    const ws = new WebSocket(url);
    ws.onopen = () => {
      delay = BASE_MS;
      console.log(`[${name}] WS 연결`);
    };
    ws.onmessage = ev => {
      try {
        onMessage(JSON.parse(ev.data));
      } catch {
        // JSON 외 메시지 무시
      }
    };
    ws.onclose = () => {
      setTimeout(connect, delay);
      delay = Math.min(MAX_MS, Math.round(delay * MULT));
    };
    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        // onclose가 재접속 처리
      }
    };
  };
  connect();
}
