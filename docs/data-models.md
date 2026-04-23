# 데이터 모델

## DB 스키마

### schedules 테이블 — Supabase (PostgreSQL)
```sql
id           TEXT PRIMARY KEY
title        TEXT NOT NULL
date         TEXT NOT NULL           -- YYYY-MM-DD (시작일)
"endDate"    TEXT                    -- YYYY-MM-DD (종료일), 단일 일정이면 NULL
"startTime"  TEXT NOT NULL           -- HH:mm
"endTime"    TEXT NOT NULL           -- HH:mm
category     TEXT NOT NULL DEFAULT '기타'
color        TEXT NOT NULL DEFAULT '#6366F1'
memo         TEXT
alarm        BOOLEAN NOT NULL DEFAULT FALSE
"alarmTimes" JSONB DEFAULT '[]'      -- 복수 알람 (분 단위 배열)
location     TEXT
participants TEXT                     -- 이름표 (nameTag) 저장 컬럼
"nameTagColor" TEXT                  -- 이름표 색상 (hex)
created_at   TIMESTAMPTZ DEFAULT NOW()
```
- `endDate` 컬럼 마이그레이션: `ALTER TABLE schedules ADD COLUMN IF NOT EXISTS "endDate" TEXT;`
- `participants` → 앱 내부에서 `nameTag`로 매핑

### routines 테이블 — SQLite
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

### routine_completions 테이블 — SQLite
```sql
id TEXT PRIMARY KEY
routineId TEXT NOT NULL
date TEXT NOT NULL          -- YYYY-MM-DD
UNIQUE(routineId, date)
```

### todos 테이블 — SQLite
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

---

## 알람 시스템

### 일정 알람
- **복수 알람**: 일정 하나에 여러 알람 시간 등록 가능
- **알람 ID 패턴**: `{scheduleId}_{index}` (예: `abc123_0`, `abc123_1`)
- **구형 호환**: 구형 단일 알람 ID(`{scheduleId}`)도 취소 시도
- **프리셋**: 마감시각(0분), 10분, 30분, 1시간, 1일
- **직접 입력**: 숫자 + 단위(분/시간/일/주)
- **body**: `0분 → '지금 일정이 시작됩니다'` / 나머지 → `'N분 전 일정이 있습니다'`

### 루틴 알람
- **daily**: 단일 DAILY 트리거, 알람 ID = `{routineId}`
- **weekly_days**: 루틴 예정 요일마다 WEEKLY 트리거, 알람 ID = `{routineId}_{jsDay}`
- **weekly_count**: 사용자가 별도 선택한 알람 요일마다 WEEKLY 트리거, 알람 ID = `{routineId}_{jsDay}`
  - 알람 요일은 루틴 빈도(주 N회)와 독립적으로 설정 (weekdays 필드 재사용)
  - 알람 요일 미선택 시 알람 미등록
- Expo WEEKLY trigger 요일 변환: `jsDay === 0 ? 1 : jsDay + 1` (Expo는 1=일 기준)
- 루틴 삭제 시 `{id}` + `{id}_0` ~ `{id}_6` 모두 취소 시도

### 할일 알람
- **프리셋**: 마감시각(0분), 10분, 30분, 1시간, 1일
- **직접 입력**: 숫자 + 단위(분/시간/일/주)
- **body**: `0분 → '지금 마감인 할일이 있습니다'` / 나머지 → `'N분 후 마감인 할일이 있습니다'`
- **기본 알람**: `alarmTimes` 배열 각 항목 → 마감 시각 - N분 전 DATE 트리거
  - 알람 ID: `{todoId}_0`, `{todoId}_1`, ...
- **후속 알람 (자동)**: 알람 ON 시 마감 이후 자동 등록
  - 마감 +1일 → `{todoId}_late_0`
  - 마감 +1주 → `{todoId}_late_1`
  - 마감 +1달 → `{todoId}_late_2`
  - body: `"{제목} 마감이 지났어요. 할일을 완료했나요?"`
- 완료 처리 시: 기본 + 후속 알람 전부 취소
- 미완료로 되돌릴 시: 알람 재등록

---

## 스트릭 계산 방식 (calculateStreak)
- **daily**: 오늘(또는 어제)부터 역산, 연속 완료 일수
- **weekly_days**: 예정된 요일만 역산, 연속 완료 회수
- **weekly_count**: 이번 주부터 역산, 연속으로 quota 달성한 주 수 (단위: 주)

---

## 카테고리 색상

### 일정/할일
```
업무=#6366F1 (인디고)
개인=#10B981 (에메랄드)
건강=#F59E0B (앰버)
기타=#94A3B8 (슬레이트)
```

### 루틴
```
운동=#10B981 (에메랄드)
공부=#6366F1 (인디고)
청소=#06B6D4 (시안)
관리=#F59E0B (앰버)
기타=#94A3B8 (슬레이트)
```

---

## 이름표 (nameTag) 시스템
- 각 사용자가 계정 탭에서 이름 + 색상 지정
- 일정 생성 시 자동으로 `nameTag`, `nameTagColor` 입력 (수동 변경 가능)
- `ScheduleItem`: 제목 옆 이름 뱃지 (저장된 색상 사용, 없으면 해시 fallback)
- 달력 dot: 날짜별 이름표 색상 배열로 구분 표시 (`markedDates: Record<string, string[]>`)
- `nameTag.ts` 유틸: `getNameColor(name)` — 해시 기반 색상 (fallback용)
- 색상 팔레트: `#6366F1, #10B981, #F59E0B, #EF4444, #3B82F6, #EC4899, #8B5CF6, #06B6D4`
- **색상 결정 (일정)**: `color = nameTagColor || CATEGORY_COLORS[category]` (계정 색상 우선)
