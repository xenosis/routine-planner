## 프로젝트 개요
- 안드로이드 개인 일정/루틴 관리 앱 (앱 이름: **Doro**)
- 플랫폼: Android (React Native + Expo)
- 패키지: com.sewoong.routineplanner

## 기술 스택
- Framework: React Native (Expo) / TypeScript
- DB: expo-sqlite (루틴/할일) + Supabase PostgreSQL (일정)
- 알람: expo-notifications
- 차트: react-native-gifted-charts
- 지도: react-native-webview + 카카오 지도 JS API (장소 검색 모달)
- 네비게이션: react-navigation (bottom-tabs + stack)
- UI: React Native Paper v5
- 상태관리: Zustand
- 달력: 자체 구현 MonthCalendar (react-native-calendars는 성과 탭 월간뷰에만 사용)
- 빌드: EAS Build (preview: APK, production: AAB)

## 라이브러리 정책
- 새 라이브러리 필요 시 사용자에게 먼저 물어볼 것
- Expo native 모듈은 반드시 `npx expo install` (npm install 금지)

## 디자인 원칙
→ 상세: `docs/design-system.md`
- 모던하고 세련된 UI, 다크모드 지원, 미니멀
- SafeArea: `edges={['top', 'left', 'right']}` (하단은 탭 바가 처리)
- 모달 footer: `paddingBottom: insets.bottom > 0 ? insets.bottom : spacing.sm`
- Paper TextInput 한글 입력 규칙
  - **절대 금지**: `value={field || ' '}` — 한글 자모 분리 버그
  - **절대 금지**: `value={labelsReady ? field : ''}` (한글 입력 필드에) — `''` 폴백이 IME composition 파괴
  - **한글 입력 필드** (title, memo, location, nameTag 등): 반드시 `value={field}` 직접 사용
  - **메모 multiline**: `value={memo}` + `scrollEnabled={false}`
- Paper TextInput label 딜레이 버그: **`labelsReady` 패턴** (날짜·시각·카테고리 등 비한글 필드에만)
  ```tsx
  const [labelsReady, setLabelsReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setLabelsReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  // 날짜·숫자 등 비한글 TextInput에만: value={labelsReady ? field : ''}
  // 한글 TextInput에는 절대 사용 금지 — value={field} 직접 사용
  ```
  - 전제: 부모 **조건부 렌더링** (`{visible && <Screen />}`) + 자식 **`useState(() => prop?.value ?? '')`**
  - `AddScheduleScreen`은 `Portal` 기반 전체화면 (ScheduleScreen에서 `{modalVisible && <AddScheduleScreen />}`)

---

## 현재 구현 상태 (2026-04-28 기준)

### 탭 구조
일정 / 할일 / 루틴 / 성과 / 계정 (미로그인 시 LoginScreen 표시)

### 파일 구조 요약
```
src/
  db/       - database.ts, scheduleDb.ts, routineDb.ts, achievementDb.ts, todoDb.ts
  lib/      - supabase.ts
  store/    - authStore.ts, scheduleStore.ts, routineStore.ts, todoStore.ts
  utils/    - date.ts, nameTag.ts, navigationRef.ts, scheduleAlarms.ts
              achievementCalc.ts, streakCalc.ts, repeatDate.ts  ← 순수 계산 함수 (테스트 대상)
  screens/  - auth/, account/, schedule/, routine/, todo/, achievement/
  components/ - calendar/MonthCalendar, common/TimeInput, schedule/, routine/, todo/
  navigation/ - AppNavigator.tsx
  theme/    - index.ts
__tests__/  - achievementCalc.test.ts, streakCalc.test.ts, repeatDate.test.ts
scripts/    - make-notification-icon.js
```
→ 상세: `docs/architecture.md`

### 핵심 구현 사항
→ 세부 계산 로직: `docs/api-patterns.md` / 알람 전략: `docs/architecture.md`

- **일정**: Supabase 연동, 반복 일정 (`matchesRepeatDate` → `src/utils/repeatDate.ts`), 여러날/이름표/장소
- **루틴**: daily / weekly_days / weekly_count, 스트릭 계산 (`src/utils/streakCalc.ts`)
- **할일**: 마감 후속 알람 자동 등록 (`{todoId}_late_0/1/2`)
- **성과탭 주간 달성률**: `getThisWeekDays(today)` 기준 (최근 7일 X), 루틴별 계산 후 평균
  - `weekly_days` 이번 주 예정일 없는 루틴은 `null` 반환 → 평균 제외 (분모 왜곡 방지)
  - 주간 차트 0%인 날은 "0%" 레이블 표시
- **성과탭 월간/루틴별**: `quotaMetBeforeThisDay` 집합으로 weekly_count quota 달성 루틴 분모 제외
- **루틴 탭 오늘 목록**: `weekly_count` quota 달성 AND 오늘 미체크 시 목록·카운트에서 제외
- **Android 알람**: 반복 알람은 다음 발생 1건만 예약, 탭 시 재등록
- **알림 탭 이동 (killed 상태)**: `App.tsx` `getLastNotificationResponseAsync` → `setPendingNotifType` 저장 → `AppNavigator` auth 완료 후 `consumePendingNotifType` 소비 + `requestAnimationFrame` 재귀로 `navigationRef.isReady()` true 될 때까지 대기 후 이동
  - **주의**: `setPendingNotifType` 없으면 타입 저장 안 됨 / `isReady()` 직접 호출하면 Tab.Navigator mount 전이라 무시됨

### 테스트
- `npm test` — Jest 단위 테스트 (53개, `jest-expo` 프리셋)
- 테스트 파일: `__tests__/achievementCalc.test.ts`, `streakCalc.test.ts`, `repeatDate.test.ts`
- 수동 회귀 체크리스트: `docs/test-checklist.md`
- 계산 로직 변경 시 → `npm test` 먼저 실행 후 체크리스트 관련 항목 수동 확인

### DB 컬럼명 주의
- routines 테이블의 주 N회 컬럼: **`weekly_count`** (snake_case) — JS 객체에서는 `weeklyCount`
- SQL 쿼리에서 반드시 `weekly_count` 사용, camelCase 혼용 시 SQLite 에러 발생

---

## 참조 문서
- `docs/design-system.md` — UI/디자인 규칙, 화면 레이아웃, 카드 구성, 동작 방식
- `docs/architecture.md` — 파일 구조, 스토어 API, 인증, Android 알람, 앱 정보
- `docs/api-patterns.md` — Supabase 패턴, 카카오 장소 검색, 달성률 계산 세부 로직
- `docs/data-models.md` — DB 스키마, 알람 ID 패턴, 스트릭/달성률 계산, 카테고리 색상
- `docs/test-checklist.md` — 수동 회귀 테스트 시나리오 목록
- `docs/build-commands.md` — 개발 서버, 로컬 APK 빌드, EAS 빌드 명령어 모음
