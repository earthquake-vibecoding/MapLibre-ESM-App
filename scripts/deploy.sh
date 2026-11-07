#!/bin/bash
# eqm 배포: 로컬 빌드 → dist + server/*.mjs 업로드 → 원자적 교체(dist/server 각 1세대 롤백 보존) → eqm 재시작
# 대상: ubuntu@129.225.201.148 /home/ubuntu/eqm (svelte 버전, 443 HTTPS)
# 서버 상시 파일(상관없음: start.sh, .env, cert/key, tjma2020a, node_modules, data/)은 업로드하지 않음
set -euo pipefail

HOST="129.225.201.148"
USER="ubuntu"
KEY="$HOME/Documents/111.key"
REMOTE_DIR="/home/ubuntu/eqm"
SSH_OPTS=(-i "$KEY" -o ConnectTimeout=15 -o BatchMode=yes)

cd "$(dirname "$0")/.." # scripts/ → 저장소 루트

[ -f "$KEY" ] || { echo "❌ SSH 키 없음: $KEY"; exit 1; }

echo "==> 1/4 로컬 빌드"
pnpm run build
[ -d dist ] || { echo "❌ 빌드 실패: dist 없음"; exit 1; }

echo "==> 2/4 스테이징 업로드"
# 주의: dist.new를 미리 만들면 scp -r가 dist.new/dist로 중접 복사한다 — scp가 새로 만들게 둬야 함
ssh "${SSH_OPTS[@]}" "$USER@$HOST" "rm -rf $REMOTE_DIR/dist.new $REMOTE_DIR/server.new && mkdir -p $REMOTE_DIR/server.new"
scp "${SSH_OPTS[@]}" -r dist "$USER@$HOST:$REMOTE_DIR/dist.new" >/dev/null
scp "${SSH_OPTS[@]}" server/index.mjs server/api.mjs server/webhook.mjs server/history.mjs \
  server/kmoni-poll.mjs server/frame-buffer.mjs \
  "$USER@$HOST:$REMOTE_DIR/server.new/" >/dev/null

echo "==> 3/4 교체 (dist.old / server.old 1세대 보존)"
ssh "${SSH_OPTS[@]}" "$USER@$HOST" "cd $REMOTE_DIR && \
  rm -rf dist.old server.old && \
  if [ -d dist ]; then mv dist dist.old; fi && \
  if [ -d server ]; then mv server server.old; fi && \
  mv dist.new dist && \
  mv server.new server"

echo "==> 4/4 서비스 재시작"
ssh "${SSH_OPTS[@]}" "$USER@$HOST" "sudo -n systemctl restart eqm && sleep 1 && systemctl is-active eqm"

echo "✅ 배포 완료 — https://eqm.dododada.me"
