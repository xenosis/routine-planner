## 프로젝트 개요
- 안드로이드 개인 일정/루틴 관리 앱 (앱 이름: **Doro**)
- 플랫폼: Android (React Native + Expo)
- 패키지: com.sewoong.routineplanner

## 기술 스택
- Framework: React Native (Expo) / TypeScript
- DB: expo-sqlite (루틴/할일) + Supabase PostgreSQL (일정)
- 알람: expo-notifications
- 차트: react-native-gifted-charts
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

---

## 현재 구현 상태 (2026-04-23 기준)

### 탭 구조
일정 / 할일 / 루틴 / 성과 / 계정 (미로그인 시 LoginScreen 표시)

### 파일 구조 요약
```
src/
  db/           - database.ts, scheduleDb.ts, routineDb.ts, achievementDb.ts, todoDb.ts
  lib/          - supabase.ts
  store/        - authStore.ts, scheduleStore.ts, routineStore.ts, todoStore.ts
  utils/        - date.ts, nameTag.ts
  screens/      - auth/, account/, schedule/, routine/, todo/, achievement/
  components/   - calendar/MonthCalendar, common/TimeInput, schedule/(LocationSearchModal), routine/, todo/
  navigation/   - AppNavigator.tsx
  theme/        - index.ts
```
→ 상세 구조 및 스토어 API: `docs/architecture.md`

### 핵심 구현 사항

#### 일정 (Supabase 연동)
- Supabase RLS: 로그인 사용자 전체 읽기/쓰기 허용 (공유 일정)
- 실시간 구독: `postgres_changes`로 상대방 변경 자동 반영
- 여러 날 일정: `endDate` 컬럼, range bar 표시
- 이름표(nameTag): `participants` 컬럼 → 앱 내 `nameTag`로 매핑, 색상 dot

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

#### 루틴 탭 완료 카운트
- `weekly_count` 루틴: **오늘 체크했거나 quota 달성** 시 완료로 판단 (OR 조건)
- 오늘 체크 여부: `completedIds.includes(r.id)`

#### Android 알람
- 권한: `SCHEDULE_EXACT_ALARM` + `USE_EXACT_ALARM` (Android 12+)
- 채널: `setNotificationChannelAsync('default', ...)` (Android 8+)
- 모든 트리거에 `channelId: 'default'` 명시
- 첫 실행 시 구형 알람 일괄 초기화 (`alarm_reset_v1` AsyncStorage 플래그)
- 알림 아이콘: `assets/notification-icon.png` (투명 배경 + 흰색 실루엣, Android 필수)

---

## 참조 문서
- `docs/design-system.md` — UI/디자인 규칙, 화면 레이아웃, 카드 구성, 동작 방식
- `docs/architecture.md` — 파일 구조, 스토어 API, 인증, Android 알람, 앱 정보
- `docs/api-patterns.md` — Supabase 패턴, 카카오 장소 검색, 달성률 계산
- `docs/data-models.md` — DB 스키마, 알람 ID 패턴, 스트릭/달성률 계산, 카테고리 색상
