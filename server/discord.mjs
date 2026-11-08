// Discord HTTP 전송 플럼빙 — webhook.mjs에서 분리 (200줄 규칙). 임베드 조립·정책은 webhook.mjs 담당.

/** Discord API 호출 — 성공 시 wait면 메시지 JSON, 아니면 {}. 실패/타임아웃 null */
export async function requestDiscord(url, method, body, wait) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(wait ? `${url}?wait=true` : url, {
      method,
      body,
      headers: body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return wait ? await res.json().catch(() => null) : {};
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 감지 임베드 발송 페이로드 — 이미지 있으면 multipart 첨부(attachment 참조), 없으면 JSON */
export function detectPayload(embed, image) {
  if (image) {
    embed.image = { url: 'attachment://map.png' };
    const payload = new FormData();
    payload.append('payload_json', JSON.stringify({ embeds: [embed] }));
    payload.append('files[0]', new Blob([image], { type: 'image/png' }), 'map.png');
    return payload;
  }
  return JSON.stringify({ embeds: [embed] });
}

/** 웹후크 미설정/쿨다운 등 기능 꺼짐 응답 */
export function disabled(res) {
  res.status(204).end();
}
