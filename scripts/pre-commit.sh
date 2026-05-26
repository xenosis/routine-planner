#!/bin/sh
# 버전 bump 누락 방지: src/ 변경 시 app.json 버전도 함께 올렸는지 확인

STAGED=$(git diff --cached --name-only)

# src/ 또는 android/kotlin 변경 여부 확인
SRC_CHANGED=$(echo "$STAGED" | grep -E '^src/|\.kt$' | head -1)

if [ -z "$SRC_CHANGED" ]; then
  exit 0
fi

# app.json 버전 변경 여부 확인
VERSION_CHANGED=$(echo "$STAGED" | grep -E '^app\.json$|^package\.json$' | head -1)

if [ -z "$VERSION_CHANGED" ]; then
  echo ""
  echo "⚠️  버전 bump 누락 경고"
  echo "   src/ 파일이 변경되었지만 app.json / package.json 버전이 그대로입니다."
  echo "   기능 변경·버그 수정이라면 버전을 올려주세요:"
  echo "     patch (버그 수정): 1.2.4 → 1.2.5"
  echo "     minor (새 기능):   1.2.x → 1.3.0"
  echo "   리팩토링·문서 수정만이라면 무시해도 됩니다."
  echo ""
  echo "   계속 커밋하려면 --no-verify 플래그를 사용하세요."
  echo ""
  exit 1
fi

exit 0
