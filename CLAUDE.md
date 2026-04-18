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

## 현재 구현 상태 (2026-04-18 기준, 성과 탭 3탭 개선 + 앱 이름 Doro 확정)

### 파일 구조
```
src/
  db/
    database.ts        - DB 초기화 (SQLite 싱글톤, 테이블 생성, 마이그레이션)
    scheduleDb.ts      - 일정 CRUD (Schedule 타입 포함)
    routineDb.ts       - 루틴 CRUD (Routine 타입, 스트릭, 주간 완료 조회)
    achievementDb.ts   - 달성률 조회 (frequency/weekdays 반영, getEarliestRoutineCreatedAt 포함)
    todoDb.ts          - 할일 CRUD (Todo 타입 포함)
  store/
    scheduleStore.ts   - 일정 Zustand 스토어
    routineStore.ts    - 루틴 Zustand 스토어 (weekCompletions 포함)
    todoStore.ts       - 할일 Zustand 스토어 (알람 등록/취소 포함)
  screens/
    schedule/
      ScheduleScreen.tsx     - 일정 메인 화면 (달력 + 목록, 삭제 기능 포함)
      AddScheduleScreen.tsx  - 일정 추가/수정 모달 (하단 삭제/저장 분리 버튼)
    routine/
      RoutineScreen.tsx      - 루틴 화면 (탭 구조: 오늘의 루틴 / 내 루틴 관리)
      AddRoutineScreen.tsx   - 루틴 추가/수정 모달 (하단 삭제/저장 분리 버튼)
    todo/
      TodoScreen.tsx         - 할일 화면 (진행중/완료 탭, 날짜 구분자, FAB)
      AddTodoScreen.tsx      - 할일 추가/수정 모달 (하단 삭제/저장 분리 버튼)
    achievement/
      AchievementScreen.tsx  - 성과 화면 (3탭: 주간/월간/루틴별, 요약 카드 고정)
  components/
    calendar/
      MonthCalendar.tsx      - 자체 구현 월 달력 컴포넌트
    schedule/
      ScheduleItem.tsx       - 일정 카드 (우측 삭제 버튼 포함)
    routine/
      RoutineItem.tsx        - 루틴 카드 (주간 완료 도트, 삭제/체크 버튼, 빈도 라벨)
    todo/
      TodoItem.tsx           - 할일 카드 (D-day 뱃지, 체크박스, 삭제 버튼)
  navigation/
    AppNavigator.tsx         - 탭 순서: 일정 / 루틴 / 할일 / 성과
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
frequency TEXT NOT NULL DEFAULT 'daily' -- 'daily'|'weekly_days'|'weekly_count'
weekdays TEXT                           -- JSON 배열, JS getDay() 기준 (0=일,1=월...6=토)
                                        -- weekly_days: 루틴 예정 요일
                                        -- weekly_count: 알람 요일 (루틴 요일과 독립)
weekly_count INTEGER                    -- 주 N회 목표 횟수 (2~6, weekly_count일 때만 유효)
alarm INTEGER NOT NULL DEFAULT 0
alarmTime TEXT                          -- HH:mm
streak INTEGER NOT NULL DEFAULT 0
createdAt TEXT NOT NULL
```
- `frequency`, `weekdays`, `weekly_count`는 `ALTER TABLE` 마이그레이션으로 추가된 컬럼
- `targetMinutes`는 UI에서 제거됨 (DB 컬럼은 잔존, 무시)

#### routine_completions 테이블
```sql
id TEXT PRIMARY KEY
routineId TEXT NOT NULL
date TEXT NOT NULL          -- YYYY-MM-DD
UNIQUE(routineId, date)
```

#### todos 테이블
```sql
id TEXT PRIMARY KEY
title TEXT NOT NULL
deadlineDate TEXT NOT NULL  -- YYYY-MM-DD
deadlineTime TEXT NOT NULL  -- HH:mm (기본값 '09:00')
category TEXT NOT NULL DEFAULT '기타'   -- '업무'|'개인'|'건강'|'기타'
color TEXT NOT NULL DEFAULT '#6366F1'
memo TEXT
alarm INTEGER NOT NULL DEFAULT 0        -- 0|1 (boolean)
alarmTimes TEXT                         -- JSON 배열 문자열 (분 단위, 마감 기준 N분 전)
completed INTEGER NOT NULL DEFAULT 0    -- 0|1 (boolean)
completedAt TEXT                        -- 완료 처리 시각 (ISO 문자열)
createdAt TEXT NOT NULL
```
- 신규 테이블 (마이그레이션 불필요, CREATE IF NOT EXISTS)
- 인덱스: `idx_todos_deadline(deadlineDate, deadlineTime)`, `idx_todos_completed(completed)`

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
- **weekly_days**: 루틴 예정 요일마다 WEEKLY 트리거, 알람 ID = `{routineId}_{jsDay}`
- **weekly_count**: 사용자가 별도 선택한 알람 요일마다 WEEKLY 트리거, 알람 ID = `{routineId}_{jsDay}`
  - 알람 요일은 루틴 빈도(주 N회)와 독립적으로 설정 (weekdays 필드 재사용)
  - 알람 요일 미선택 시 알람 미등록
- Expo WEEKLY trigger 요일 변환: `jsDay === 0 ? 1 : jsDay + 1` (Expo는 1=일 기준)
- 루틴 삭제 시 `{id}` + `{id}_0` ~ `{id}_6` 모두 취소 시도

### 루틴 화면 (RoutineScreen) 탭 구조
- **SegmentedButtons** 탭: `[오늘의 루틴 | 내 루틴 관리]`
- **오늘의 루틴 탭**: daily/weekly_count → 항상 표시, weekly_days → 오늘 요일만 표시
  - 체크 버튼으로 완료 처리, 미완료→완료 정렬
  - weekly_count: quota 달성 시 카드 흐려짐 + 체크 비활성 (오늘 체크한 것은 취소 가능)
- **내 루틴 관리 탭**: 전체 루틴 표시(등록순), 체크 버튼 없음, 탭하면 수정 모달 열림
- **헤더 카드**: 탭 전환과 무관하게 항상 오늘 기준 진행률 표시
  - weekly_count 진행률: quota 달성 여부로 계산
- **빈 상태**:
  - 오늘 탭 + 루틴 있는데 오늘 예정 없음 → "오늘 예정된 루틴이 없어요" (탭 불가)
  - 루틴 자체 없음 → "루틴을 추가해보세요" (탭하면 추가 모달)

### RoutineItem 카드 구성
```
[색상바] [제목                        ] [🗑] [○/●]
         [카테고리 · 빈도 · 🔥스트릭 · 🔔알람]
         [● ● ○ ○ ● ○ ●]  ← 주간 완료 도트
```
- 빈도 라벨: `'매일'` / `'주 N회 · 월수금'` / `'주 N회'` 형태
- 주간 도트 (frequency별 다름):
  - `daily` / `weekly_days`: 월~일 7개 dot, 예정 요일만 완료(채움)/미완료(테두리), 비예정은 placeholder
  - `weekly_count`: 목표 횟수만큼 dot 나열 (예: 주3회 → dot 3개), 완료 수만큼 채움 `●●○`
- Props:
  - `isQuotaMet`: weekly_count quota 달성 여부 → 카드 흐려짐, 체크 버튼 비활성
  - `showCheckButton={false}`: 체크 버튼 숨김 (내 루틴 관리 탭용)
  - 체크 버튼 `disabled` 조건: `isQuotaMet && !isCompleted` (취소는 허용)

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
[카테고리]          ← 드롭다운 (일정/할일과 동일 패턴, 색상 dot 포함)
[빈도]              ← SegmentedButtons [매일 | 요일 지정 | 주 N회]
  └ 요일 지정 시  → [월][화][수][목][금][토][일] 토글 버튼
  └ 주 N회 선택 시 → [2회][3회][4회][5회][6회] 횟수 버튼
--- Divider ---
[알람 토글]
  └ ON → HH:mm 시간 입력 (TimePicker)
         주 N회일 때만: [알람 요일] [월][화][수][목][금][토][일] 별도 선택
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
                                     // weekly_count: quota 초과 시 추가 체크 차단
                                     //   (단, 오늘 체크한 것은 취소 가능)
```

### 스트릭 계산 방식 (calculateStreak)
- **daily**: 오늘(또는 어제)부터 역산, 연속 완료 일수
- **weekly_days**: 예정된 요일만 역산, 연속 완료 회수
- **weekly_count**: 이번 주부터 역산, 연속으로 quota 달성한 주 수 (단위: 주)

---

### 할일 화면 (TodoScreen) 동작 방식
- 탭 순서: 일정 / 루틴 / **할일** / 성과
- **진행중/완료 탭** (SegmentedButtons): 기본값 진행중
- **진행중 탭**: 날짜 그룹 구분자 + TodoItem 목록 (마감일 오름차순)
  - 날짜 구분자: 지남 / 오늘 / 내일 / 이번 주(7일 이내) / 그 이후
- **완료 탭**: 구분자 없이 TodoItem 목록 (completedAt 내림차순)
- **FAB(+)**: 추가 모달 열기
- **TodoItem 탭**: 수정 모달 열기

### TodoItem 카드 구성
```
[색상바] [제목 (완료 시 취소선)         ] [체크박스] [🗑]
         [카테고리 · 마감일시 · 🔔알람    ]
         [메모 (1줄 truncate, 있을 때)   ]
         [D-day 뱃지                    ]
```
- D-day 뱃지: 오늘/내일/D-N/D+N
- 긴급 색상(error): 마감 3일 이내 또는 초과 시
- 완료 상태: 카드 opacity 0.5 + 제목 취소선

### 할일 추가/수정 화면 (AddTodoScreen) 레이아웃
```
[제목]
[마감 날짜 (달력 아이콘)]
  └ 달력 아이콘 탭 → 인라인 MonthCalendar 펼침/접힘
[마감 시각]         ← TimePicker (시/분 위아래 버튼, 오전/오후 표시, 루틴과 동일)
[카테고리]          ← 드롭다운 (업무/개인/건강/기타, 색상 dot)
--- Divider ---
[알람 토글]
  └ ON → 등록된 알람 목록 + "+ 알람 추가" 패널
         프리셋(10분~1주) + 직접입력(숫자+단위)
[메모 (선택)]
--- 하단 버튼 ---
수정 모드: [삭제(flex:1)] [수정완료(flex:2)]
추가 모드: [할일 저장(full)]
```

### 할일 알람 시스템
- **기본 알람**: `alarmTimes` 배열 각 항목 → 마감 시각 - N분 전 DATE 트리거
  - 알람 ID: `{todoId}_0`, `{todoId}_1`, ...
- **후속 알람 (자동)**: 알람 ON 시 마감 이후 자동 등록
  - 마감 +1일 → `{todoId}_late_0`
  - 마감 +1주 → `{todoId}_late_1`
  - 마감 +1달 → `{todoId}_late_2`
  - body: `"{제목} 마감이 지났어요. 할일을 완료했나요?"`
- 완료 처리 시: 기본 + 후속 알람 전부 취소
- 미완료로 되돌릴 시: 알람 재등록

### todoStore 주요 상태/액션
```typescript
todos: Todo[]
filter: 'active' | 'completed'

fetchTodos()                   // 현재 filter로 DB 조회
setFilter(filter)              // 필터 변경 + fetchTodos
addTodo(todo)                  // insert + 알람 등록 + fetchTodos
updateTodo(todo)               // 기존 알람 취소 + update + 새 알람 등록 + fetchTodos
deleteTodo(id)                 // 알람 취소 + delete + fetchTodos
toggleCompleted(id)            // 완료 토글 + 알람 처리 + fetchTodos
```

### 카테고리 드롭다운 공통 패턴 (일정/루틴/할일 동일)
- Paper `TextInput` + `pointerEvents="none"` 래퍼로 포커스 차단
- 투명 `TouchableOpacity` 오버레이로 터치 가로채기
- 절대위치 드롭다운 (`zIndex: 10`, `elevation: 4`)
- 각 옵션에 색상 dot + 텍스트

---

### 성과 화면 (AchievementScreen) 구조

- **요약 카드 (SummaryCards)**: 탭 전환과 무관하게 항상 상단 고정
  - 오늘 완료 / 주간 달성률 / 최고 스트릭 / 누적 완료 횟수
- **SegmentedButtons 탭**: `[주간 | 월간 | 루틴별]`
- **주간 탭 (WeeklyChart)**: 최근 7일 달성률 BarChart (maxValue=110, 100% 잘림 방지)
- **월간 탭 (MonthlyCalendar)**: react-native-calendars Calendar
  - `earliestRoutineDate` 기준 이전 날짜 dot 마킹 제외 (루틴 추가 전 빨간 dot 방지)
  - dot 색상: 전체완료 `#10B981` / 일부완료 `#F59E0B` / 미완료 `#EF4444`
- **루틴별 탭 (RoutineListSection)**: 루틴별 달성률 ProgressBar + 스트릭 뱃지

#### achievementDb 주요 함수
- `getEarliestRoutineCreatedAt(today)`: 가장 오래된 루틴의 createdAt 반환 (없으면 today)
- `getRoutineAchievements(today)`: frequency별 totalDays 계산 (daily=경과일, weekly_days=예정횟수)

---

### 앱 정보
- **앱 이름**: Doro
- **패키지**: com.sewoong.routineplanner
- **아이콘**: 인디고-퍼플 그라디언트 배경 + 순환 화살표 + 체크마크 (흰색)
- **스플래시 배경**: `#6366F1`
