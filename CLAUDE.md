## 프로젝트 개요
- 안드로이드 개인 일정/루틴 관리 앱
- 플랫폼: Android (React Native + Expo)

## 기술 스택
- Framework: React Native (Expo)
- Language: TypeScript
- DB: expo-sqlite
- 알람: expo-notifications
- 차트: react-native-gifted-charts
- 네비게이션: react-navigation
- UI: React Native Paper
- 상태관리: Zustand
- 캘린더: react-native-calendars (미사용, 자체 구현 MonthCalendar 사용 중)
- 빌드: EAS Build (eas.json — preview: APK, production: AAB)

## 라이브러리 정책
- 새로운 라이브러리가 필요하면 사용자에게 먼저 물어보고 설치할 것
- 직접 구현보다 검증된 라이브러리가 있으면 설치 여부를 제안할 것
- Expo 프로젝트에서 native 모듈은 반드시 `npx expo install`로 설치할 것 (npm install 사용 금지)
- react-native-screens, react-native-safe-area-context 등 RN 코어 패키지는 특히 주의

## 디자인 원칙
- 모던하고 세련된 UI
- 다크모드 지원
- 불필요한 요소 제거, 미니멀하게

---

## 현재 구현 상태 (2026-04-17 기준)

### 파일 구조
```
src/
  db/
    database.ts        - DB 초기화 (SQLite 싱글톤, 테이블 생성, 마이그레이션)
    scheduleDb.ts      - 일정 CRUD (Schedule 타입 포함)
    routineDb.ts       - 루틴 CRUD (Routine 타입, 스트릭, 주간 완료 조회)
    achievementDb.ts   - 달성률 조회 (frequency/weekdays 반영)
  store/
    scheduleStore.ts   - 일정 Zustand 스토어
    routineStore.ts    - 루틴 Zustand 스토어 (weekCompletions 포함)
  screens/
    schedule/
      ScheduleScreen.tsx     - 일정 메인 화면 (달력 + 목록, 삭제 기능 포함)
      AddScheduleScreen.tsx  - 일정 추가/수정 모달 (하단 삭제/저장 분리 버튼)
    routine/
      RoutineScreen.tsx      - 루틴 화면 (탭 구조: 오늘의 루틴 / 내 루틴 관리)
      AddRoutineScreen.tsx   - 루틴 추가/수정 모달 (하단 삭제/저장 분리 버튼)
    achievement/
      AchievementScreen.tsx  - 달성률 화면
  components/
    calendar/
      MonthCalendar.tsx      - 자체 구현 월 달력 컴포넌트
    schedule/
      ScheduleItem.tsx       - 일정 카드 (우측 삭제 버튼 포함)
    routine/
      RoutineItem.tsx        - 루틴 카드 (주간 완료 도트, 삭제/체크 버튼, 빈도 라벨)
  navigation/
    AppNavigator.tsx
  theme/
    index.ts           - 라이트/다크 테마, spacing, borderRadius 토큰
```

### DB 스키마

#### schedules 테이블
```sql
id TEXT PRIMARY KEY
title TEXT NOT NULL
date TEXT NOT NULL          -- YYYY-MM-DD
startTime TEXT NOT NULL     -- HH:mm
endTime TEXT NOT NULL       -- HH:mm
category TEXT NOT NULL DEFAULT '기타'   -- '업무'|'개인'|'건강'|'기타'
color TEXT NOT NULL DEFAULT '#6366F1'
memo TEXT
alarm INTEGER NOT NULL DEFAULT 0        -- 0|1 (boolean)
alarmMinutes INTEGER                    -- 하위 호환용 (구형 단일 알람)
alarmTimes TEXT                         -- JSON 배열 문자열 (신형 복수 알람, 분 단위)
location TEXT
participants TEXT                        -- 참석자 (쉼표 구분 자유 텍스트)
```
- `alarmTimes`, `participants`는 `ALTER TABLE` 마이그레이션으로 추가된 컬럼 (기존 DB 호환)
- 알람 읽기 우선순위: `alarmTimes`(신형 JSON) → `alarmMinutes`(구형 정수) 순

#### routines 테이블
```sql
id TEXT PRIMARY KEY
title TEXT NOT NULL
category TEXT NOT NULL DEFAULT '기타'   -- '운동'|'공부'|'청소'|'관리'|'기타'
color TEXT NOT NULL DEFAULT '#94A3B8'
frequency TEXT NOT NULL DEFAULT 'daily' -- 'daily'|'weekly_days'
weekdays TEXT                           -- JSON 배열, JS getDay() 기준 (0=일,1=월...6=토)
alarm INTEGER NOT NULL DEFAULT 0
alarmTime TEXT                          -- HH:mm (daily 단일 알람)
streak INTEGER NOT NULL DEFAULT 0
createdAt TEXT NOT NULL
```
- `frequency`, `weekdays`는 `ALTER TABLE` 마이그레이션으로 추가된 컬럼
- `targetMinutes`는 UI에서 제거됨 (DB 컬럼은 잔존, 무시)

#### routine_completions 테이블
```sql
id TEXT PRIMARY KEY
routineId TEXT NOT NULL
date TEXT NOT NULL          -- YYYY-MM-DD
UNIQUE(routineId, date)
```

### 루틴 카테고리 색상
```
운동=#10B981 (에메랄드)
공부=#6366F1 (인디고)
청소=#06B6D4 (시안)
관리=#F59E0B (앰버)
기타=#94A3B8 (슬레이트)
```

### 루틴 알람 시스템
- **daily**: 단일 DAILY 트리거, 알람 ID = `{routineId}`
- **weekly_days**: 선택된 요일마다 WEEKLY 트리거, 알람 ID = `{routineId}_{index}`
- Expo WEEKLY trigger 요일 변환: `jsDay === 0 ? 1 : jsDay + 1` (Expo는 1=일 기준)
- 루틴 삭제 시 `{id}_0` ~ `{id}_6` 모두 취소 시도

### 루틴 화면 (RoutineScreen) 탭 구조
- **SegmentedButtons** 탭: `[오늘의 루틴 | 내 루틴 관리]`
- **오늘의 루틴 탭**: 오늘 요일에 해당하는 루틴만 표시, 체크 버튼으로 완료 처리, 미완료→완료 정렬
- **내 루틴 관리 탭**: 전체 루틴 표시(등록순), 체크 버튼 없음, 탭하면 수정 모달 열림
- **헤더 카드**: 탭 전환과 무관하게 항상 오늘 기준 진행률 표시
- **빈 상태**:
  - 오늘 탭 + 루틴 있는데 오늘 예정 없음 → "오늘 예정된 루틴이 없어요 / 내 루틴 관리 탭에서 확인하세요" (탭 불가)
  - 루틴 자체 없음 → "루틴을 추가해보세요" (탭하면 추가 모달)

### RoutineItem 카드 구성
```
[색상바] [제목                        ] [🗑] [○/●]
         [카테고리 · 빈도 · 🔥스트릭 · 🔔알람]
         [● ● ○ ○ ● ○ ●]  ← 주간 완료 도트 (월~일)
```
- 빈도 라벨: `'매일'` 또는 `'주 N회 · 월수금'` 형태
- 주간 도트: 예정 요일은 완료(채움)/미완료(테두리), 비예정 요일은 빈 공간(placeholder)
- `showCheckButton={false}` prop으로 체크 버튼 숨김 (내 루틴 관리 탭용)

### 일정/루틴 삭제 기능
- **카드 우측 삭제 버튼**: `trash-can-outline` 아이콘 → Alert 확인 후 삭제
- **수정 모달 하단**: 수정 모드일 때 `[삭제(outlined, error색, flex:1) | 수정완료(contained, flex:2)]`
- 추가 모드에서는 전체 너비 저장 버튼만 표시

### SafeArea 처리 원칙
- 모든 화면의 `SafeAreaView`에 `edges={['top', 'left', 'right']}` 적용
  → 하단은 탭 바가 이미 처리하므로 중복 패딩 방지
- 모달(Modal) 내부에서 `useSafeAreaInsets().bottom` 사용 금지
  → Android edge-to-edge에서 과도한 패딩 발생. `paddingBottom: spacing.xl (24dp)` 고정값 사용

### 일정 화면 (ScheduleScreen) 동작 방식
- **날짜 선택 시**: 해당 날짜 일정만 표시 (당일 보기 모드)
- **같은 날짜 재탭**: 선택 해제 → 월 전체 보기 모드로 전환
- **월 이동 (화살표/스와이프)**: 선택 해제 → 해당 월 전체 일정 표시
- **월 전체 보기**: 해당 월 모든 일정을 날짜·시간 오름차순으로 표시 (과거 포함), 화면 열릴 때 오늘 이후 첫 일정 위치로 자동 스크롤
- **달력 스와이프**: PanResponder 기반 좌우 스와이프로 월 이동 가능

### 달력 dot 표시
- `markedDates: Record<string, number>` — 날짜별 일정 개수 맵
- 일정 1개 → 점 1개, 2개 → 점 2개, 3개 이상 → 점 3개 (최대)
- `getMarkedDates()`: `SELECT date, COUNT(*) as count GROUP BY date`로 조회

### 일정 추가/수정 화면 (AddScheduleScreen) 레이아웃
```
[제목]
[날짜 (달력 아이콘)] [시작] ~ [종료]
  └ 달력 아이콘 탭 → 인라인 MonthCalendar 펼침/접힘
[카테고리]          ← Paper TextInput + pointerEvents="none" 래퍼 + 투명 오버레이 TouchableOpacity
  └ 탭 → 절대위치 인라인 드롭다운 (업무/개인/건강/기타, 색상 dot 포함)
[장소] [참석자]     ← flex:1 each
[메모 (선택)]       ← multiline, numberOfLines=3, minHeight=90
--- Divider ---
[알람 토글]
  └ ON → 등록된 알람 목록 + "+ 알람 추가" 패널
         프리셋(10분~1주) + 직접입력(숫자+단위)
--- 하단 버튼 ---
수정 모드: [삭제(flex:1)] [수정완료(flex:2)]
추가 모드: [일정 저장(full)]
```

### 루틴 추가/수정 화면 (AddRoutineScreen) 레이아웃
```
[제목]
[카테고리]          ← 드롭다운 (운동/공부/청소/관리/기타, 색상 dot)
[빈도]              ← SegmentedButtons [매일 | 요일 선택]
  └ 요일 선택 시 → [월][화][수][목][금][토][일] 토글 버튼
--- Divider ---
[알람 토글]
  └ ON → HH:mm 시간 입력
--- 하단 버튼 ---
수정 모드: [삭제(flex:1)] [수정완료(flex:2)]
추가 모드: [루틴 저장(full)]
```

### 일정 알람 시스템
- **복수 알람 지원**: 일정 하나에 여러 알람 시간 등록 가능
- **알람 ID 패턴**: `{scheduleId}_{index}` (예: `abc123_0`, `abc123_1`)
- **구형 호환**: 구형 단일 알람 ID(`{scheduleId}`)도 취소 시도
- **프리셋**: 10분, 30분, 1시간, 3시간, 1일, 2일, 1주
- **직접 입력**: 숫자 + 단위(분/시간/일) 조합으로 임의 시간 설정
- **알람 body 메시지**: `"N분 전 후 일정이 있습니다"` (formatAlarmTime 함수로 포맷)

### ScheduleItem 카드 표시 필드
제목, 시작~종료 시간, 장소(map-marker 아이콘), 참석자(account-multiple 아이콘), 메모(italic), 우측 삭제 버튼 — 각 조건부 표시

### 테마 토큰 (theme/index.ts)
```
spacing: xs=4, sm=8, md=12, base=16, lg=20, xl=24, xxl=32, xxxl=48
borderRadius: sm=8, md=12, lg=16, xl=24, full=9999
브랜드 컬러: primary=#6366F1 (인디고), secondary=#10B981 (에메랄드)
일정 카테고리 색상: 업무=#6366F1, 개인=#10B981, 건강=#F59E0B, 기타=#94A3B8
```

### scheduleStore 주요 상태/액션
```typescript
selectedDate: string | null        // null = 월 전체 보기
viewYear: number
viewMonth: number
schedules: Schedule[]
markedDates: Record<string, number> // 캘린더 dot 표시용 (날짜 → 개수)

setSelectedDate(date)         // 날짜 선택 → fetchByDate
clearSelectedDate()           // 선택 해제 → fetchByMonth
fetchByDate(date)
fetchByMonth(year, month)     // 월 전체 일정 (과거 포함)
fetchMarkedDates(year, month)
addSchedule / updateSchedule / deleteSchedule
```

### routineStore 주요 상태/액션
```typescript
routines: Routine[]
completedIds: string[]               // 오늘 완료된 루틴 ID 목록
weekCompletions: Record<string, string[]>  // 루틴ID → 이번 주 완료 날짜 배열

fetchRoutines()
fetchCompletions(date)
fetchWeekCompletions()               // 현재 주 월~일 기준 완료 현황
addRoutine / updateRoutine / deleteRoutine
toggleCompletion(routineId)          // 완료/취소 토글, 스트릭 재계산
```
