#!/bin/bash
# 서버(oracle 오사카) eqm 서비스 기동 스크립트의 미러 — deploy.sh가 업로드하지 않고 서버 측에 상시 존재.
# 여기서는 수정하지 말 것. 재구축 시 이 파일이 서버 start.sh의 유일한 기록.
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

export PORT=443

pnpm run start