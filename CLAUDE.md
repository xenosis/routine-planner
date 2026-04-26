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
- Paper TextInput label float: `value={field || ' '}` + `onChangeText={(v) => setter(v.trimStart())}`
  - **주의**: multiline 메모 필드에는 `|| ' '` 트릭 사용 금지 → 한글 IME 자모 분리 버그 발생
  - 메모 필드는 `value={memo}` + `scrollEnabled={false}` (numberOfLines 고정 금지)
  - **주의**: `nameTag` 등 일반 단일행 필드도 `|| ' '` 트릭 사용 시 한글 입력 버그 발생 → 사용 금지
- Paper TextInput label 딜레이 버그: 항상 마운트된 모달 컴포넌트에서 `useLayoutEffect`로 state를 채울 때 발생
  - 해결: 부모에서 **조건부 렌더링** (`{visible && <Modal />}`) + 자식에서 **`useState(() => prop?.value ?? '')`** 초기값 함수 사용
  - `AddScheduleScreen`이 이 패턴으로 구현되어 있음 (ScheduleScreen에서 `{modalVisible && <AddScheduleScreen visible={true} .../>}`)

---

## 현재 구현 상태 (2026-04-27 기준)

### 탭 구조
일정 / 할일 / 루틴 / 성과 / 계정 (미로그인 시 LoginScreen 표시)

### 파일 구조 요약
```
src/
  db/           - database.ts, scheduleDb.ts, routineDb.ts, achievementDb.ts, todoDb.ts
  lib/          - supabase.ts
  store/        - authStore.ts, scheduleStore.ts, routineStore.ts, todoStore.ts
  utils/        - date.ts, nameTag.ts, navigationRef.ts, scheduleAlarms.ts
  screens/      - auth/, account/, schedule/, routine/, todo/, achievement/
  components/   - calendar/MonthCalendar, common/TimeInput, schedule/(LocationSearchModal), routine/, todo/
  navigation/   - AppNavigator.tsx
  theme/        - index.ts
scripts/        - make-notification-icon.js (알림 아이콘 배경 투명 변환용)
```
→ 상세 구조 및 스토어 API: `docs/architecture.md`

### 핵심 구현 사항

#### 일정 (Supabase 연동)
- Supabase RLS: 로그인 사용자 전체 읽기/쓰기 허용 (공유 일정)
- 실시간 구독: `postgres_changes`로 상대방 변경 자동 반영
- 여러 날 일정: `endDate` 컬럼, range bar 표시
- 이름표(nameTag): `participants` 컬럼 → 앱 내 `nameTag`로 매핑, 색상 dot
- 장소 검색: 카카오 로컬 API (REST 키) + 카카오 지도 JS API (JS 키) WebView
  - `src/components/schedule/LocationSearchModal.tsx`
  - 카카오 개발자 콘솔: OPEN_AND_LOCAL 서비스 활성화 + 플랫폼 키 > JavaScript 키 > JS SDK 도메인에 `http://localhost` 등록 필요
  - WebView: `source={{ html, baseUrl: 'http://localhost' }}` + `mixedContentMode="always"`
  - RN → WebView 통신: `injectJavaScript()`로 `MessageEvent` dispatch (Android postMessage 대체)
- 반복 일정: `repeat` 컬럼 (`daily` / `weekly` / `monthly` / `yearly` / `minutes:N` 테스트용)
  - `repeatUntil`: 반복 종료일 (없으면 무한)
  - `matchesRepeatDate()`: 반복 패턴이 특정 날짜와 일치하는지 판단 — `minutes:N`은 시작일 당일만 표시
  - FlatList key: 반복 일정은 `${id}_${date}` (날짜별 key 충돌 방지)
  - 카드 시각 표시: `startTime === endTime`이면 단일 시각만 표시 (ScheduleItem)

#### 루틴 (SQLite)
- frequency: `daily` / `weekly_days` / `weekly_count`
- weekdays: JS getDay() 기준 JSON 배열 (0=일~6=토)
  - weekly_days: 예정 요일 / weekly_count: 알람 요일 (독립)
- 스트릭: daily=연속일수, weekly_days=연속회수, weekly_count=연속주수
- quota 달성 시 카드 흐려짐 + 체크 비활성 (오늘 체크한 것은 취소 가능)

#### 할일 (SQLite)
- 후속 알람 자동 등록: 마감 +1일/+1주/+1달 (`{todoId}_late_0/1/2`)
- 완료 처리 시 기본 + 후속 알람 전부 취소

#### 성과탭 주간달성률
- `getThisWeekDays(today)`: 이번 주 월~오늘 날짜 배열 (최근 7일 X)
- 루틴별 계산 후 평균:
  - `daily` / `weekly_days`: 이번 주 예정 일수 대비 완료 일수
  - `weekly_count`: `min(완료횟수, quota) / quota`
- DB: `getWeeklyCompletionsByRoutine(weekStart, weekEnd)` — 루틴별 주간 완료 횟수

#### 성과탭 루틴별 달성률
- `weekly_count` totalDays: **경과 주수 × quota** (생성일~오늘 일수 X)
  - `totalWeeks = Math.ceil((diffDays + 1) / 7)`, `totalDays = totalWeeks * quota`
- 오늘 완료 카운트: `quotaMetBeforeToday` 집합 활용
  - 오늘 체크분을 제외한 주간 완료 횟수가 quota 이상인 weekly_count 루틴 ID 집합
  - `todayScheduled`·`todayCompleted` 모두에서 해당 루틴 제외
  - 오늘 체크로 quota를 처음 채운 경우는 오늘 완료로 정상 집계됨

#### 루틴 탭 오늘의 루틴
- `weekly_count` 루틴: **quota 달성 AND 오늘 미체크** 시 오늘 목록·카운트 모수에서 제외
  - 오늘 체크된 것은 quota 달성 후에도 목록에 유지 (취소 가능하도록)
  - 조건: `isQuotaMet && !isCheckedToday` → `todayRoutines` 필터에서 제외
- 완료 카운트·진행률: `todayRoutines` 기준으로만 계산 (별도 집계 없음)

#### Android 알람
- 권한: `SCHEDULE_EXACT_ALARM` + `USE_EXACT_ALARM` (Android 12+)
- 채널: `setNotificationChannelAsync('default', ...)` (Android 8+)
- 모든 트리거에 `channelId: 'default'` 명시
- 첫 실행 시 구형 알람 일괄 초기화 (`alarm_reset_v1` AsyncStorage 플래그)
- 알림 아이콘: `assets/notification-icon.png` (보라색 그라데이션 배경 + 흰색 실루엣, 외곽만 투명)
- 알람 유틸: `src/utils/scheduleAlarms.ts`
  - `scheduleAlarmNotifications(schedule)`: 비반복 일정 복수 알람 등록 (`{id}_{i}`)
  - `scheduleNextRepeatAlarm(schedule)`: 반복 일정 다음 발생 1건만 등록 (`{id}_repeat_{i}`)
  - `cancelRepeatAlarms(scheduleId, count)`: 반복 알람 일괄 취소
  - `getNextRepeatOccurrence(schedule)`: 다음 반복 발생일 계산

#### 반복 일정 알람 재등록 전략
- **1건만 등록** 방식: 반복 알람은 다음 발생 1건만 예약 (OS 알람 슬롯 절약)
- **알람 탭 시**: `App.tsx` — `_repeat_` 포함 identifier 감지 → `scheduleNextRepeatAlarm()` 즉시 재등록
- **앱 시작 시**: `AppNavigator.tsx` — `reRegisterMissingRepeatAlarms()` — 예약 목록에 없는 반복 알람 보완 등록
- **저장 순서 주의**: `onSave()` 완료 후 알람 등록 필수 (scheduleStore가 onSave 중 기존 알람 취소하므로 순서 역전 시 덮어쓰기 버그)
- **반복 일정 UI**:
  - 반복 활성 시 기존 시작/종료 시간 알람 UI 숨김, 독립 `repeatAlarmTime` 입력으로 대체
  - 알람 시각 + 반복 종료일 2열 레이아웃 (`repeatTimeRow`)

#### 알림 탭 → 화면 이동
- `src/utils/navigationRef.ts`: `navigationRef`, `navigateToTab`, `setPendingNotifType`, `consumePendingNotifType` 관리
- **앱 실행 중/백그라운드**: `addNotificationResponseReceivedListener` → `navigateToTab()` 즉시 호출
- **앱 완전 종료(killed)**: `getLastNotificationResponseAsync()` 결과를 `setPendingNotifType()`으로 저장 → `AppNavigator`에서 auth `loading` 완료 후 `consumePendingNotifType()`으로 처리
  - 이유: killed 상태에서는 `navigationRef.isReady()`가 false이고 탭 네비게이터도 미마운트 상태이므로 즉시 navigate 불가

#### DB 컬럼명 주의
- routines 테이블의 주 N회 컬럼명: **`weekly_count`** (snake_case) — JS 객체에서는 `weeklyCount`
- SQL 쿼리에서 반드시 `weekly_count` 사용, camelCase 혼용 시 SQLite 에러 발생

---

## 참조 문서
- `docs/design-system.md` — UI/디자인 규칙, 화면 레이아웃, 카드 구성, 동작 방식
- `docs/architecture.md` — 파일 구조, 스토어 API, 인증, Android 알람, 앱 정보
- `docs/api-patterns.md` — Supabase 패턴, 카카오 장소 검색, 달성률 계산
- `docs/data-models.md` — DB 스키마, 알람 ID 패턴, 스트릭/달성률 계산, 카테고리 색상
