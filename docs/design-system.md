# 디자인 시스템

## 디자인 원칙
- 모던하고 세련된 UI
- 다크모드 지원
- 불필요한 요소 제거, 미니멀하게

---

## 테마 토큰 (`theme/index.ts`)
```
spacing:     xs=4, sm=8, md=12, base=16, lg=20, xl=24, xxl=32, xxxl=48
borderRadius: sm=8, md=12, lg=16, xl=24, full=9999
브랜드 컬러:  primary=#6366F1(인디고), secondary=#10B981(에메랄드)
일정 카테고리 색상: 업무=#6366F1, 개인=#10B981, 건강=#F59E0B, 기타=#94A3B8
루틴 카테고리 색상: 운동=#10B981, 공부=#6366F1, 청소=#06B6D4, 관리=#F59E0B, 기타=#94A3B8
```

---

## SafeArea 처리 원칙
- 모든 화면의 `SafeAreaView`에 `edges={['top', 'left', 'right']}` 적용
  → 하단은 탭 바가 이미 처리하므로 중복 패딩 방지
- 모달(Modal) 내부 footer paddingBottom 패턴:
  ```typescript
  paddingBottom: insets.bottom > 0 ? insets.bottom : spacing.sm
  ```
  → `insets.bottom > 0` 조건 필수 (Expo Go에서는 0이라 `spacing.sm` fallback 필요)
  → 기기 시스템 내비게이션 바 바로 위에 버튼이 위치하도록 insets만 사용 (추가 여백 없음)

---

## Paper TextInput label float 패턴

Paper v5 `mode="outlined"` label은 `value !== '' || focused` 일 때만 상단 border로 올라감.
값이 항상 있는 필드(시작일, 카테고리 등)는 자동으로 float. 비어있을 수 있는 선택 필드는 강제 float 필요.

**선택 필드 (장소·메모 등) 처리 패턴:**
```tsx
<TextInput
  label="장소"
  value={location}      // 빈 값이면 스페이스(truthy) → label 항상 float
  onChangeText={(v) => setLocation(v.trimStart())}  // 앞 공백 자동 제거
  placeholder="장소 검색"
  mode="outlined"
/>
```
- 저장 시 `.trim() || undefined` 로 공백 정리 → DB에 빈 값 저장 안 됨
- 스페이스는 화면에서 보이지 않아 사용자 경험에 영향 없음

---

## 카테고리 드롭다운 공통 패턴 (일정/루틴/할일 동일)
- Paper `TextInput` + `pointerEvents="none"` 래퍼로 포커스 차단
- 투명 `TouchableOpacity` 오버레이로 터치 가로채기
- 절대위치 드롭다운 (`zIndex: 10`, `elevation: 4`)
- 각 옵션에 색상 dot + 텍스트

---

## 공통 TimeInput 컴포넌트 (`components/common/TimeInput.tsx`)
- 숫자 4자리 자동 콜론 포맷 (예: `0900` → `09:00`)
- `compact=true`: Paper TextInput outlined (일정 화면 row용)
- `compact=false`: Surface 카드 + 오전/오후 표시 (할일·루틴 단독 입력용)
- blur 시 시/분 범위 클램프 (시 ≤23, 분 ≤59)

---

## 이름표(nameTag) 시스템 — UI 라벨명: "작성자"
- 계정 탭에서 이름 + 색상 팔레트 8가지 선택 → Supabase user_metadata 저장
- 일정 생성 시 자동 입력, 수동 변경 가능
- `ScheduleItem`: 제목 옆 이름 뱃지 (저장된 색상, 없으면 해시 fallback)
- 달력 dot: 날짜별 이름표 색상 배열 표시 (`markedDates: Record<string, string[]>`)
- 색상 팔레트: `#6366F1, #10B981, #F59E0B, #EF4444, #3B82F6, #EC4899, #8B5CF6, #06B6D4`
- `nameTag.ts` → `getNameColor(name)`: 해시 기반 색상 (fallback용)

---

## 일정/루틴/할일 삭제 버튼 패턴
- **카드 우측**: `trash-can-outline` 아이콘 → Alert 확인 후 삭제
- **수정 모달 하단**: `[삭제(outlined, error색, flex:1)] [수정완료(contained, flex:2)]`
- **추가 모달 하단**: 전체 너비 저장 버튼만

---

## 화면별 레이아웃

### 일정 추가/수정 화면 (AddScheduleScreen)
```
[제목 *]
[시작일 📅] ~ [종료일 📅]
  └ 달력 아이콘 → 인라인 MonthCalendar
  └ 종료일 ≠ 시작일 → 시각·알람 초기화 / 같아지면 시각 복구(09:00/10:00)
  └ 종료일 < 시작일 → 에러 표시
[시작] ~ [종료] [카테고리]  ← TimeInput compact + 드롭다운 한 줄
[장소 🔍] [작성자]          ← 2분할, 각각 Paper label= prop + value||' ' 패턴
[메모 (선택)]               ← multiline, scrollEnabled=false
--- Divider ---
[알람 토글]  ← 시작·종료 시각 없으면 비활성
  └ ON → 알람 목록 + "+ 알람 추가" 패널
         프리셋(마감시각/10분/30분/1시간/1일) + 직접입력(숫자+단위: 분/시간/일/주)
--- 하단 ---
수정: [삭제(flex:1)] [수정완료(flex:2)]  /  추가: [일정 저장(full)]
```
- 색상 결정: `color = nameTagColor || CATEGORY_COLORS[category]`
- 알람 body: `0분 → '지금 일정이 시작됩니다'` / 나머지 → `'N분 전 일정이 있습니다'`

### 루틴 추가/수정 화면 (AddRoutineScreen)
```
[제목]
[카테고리]
[빈도] ← SegmentedButtons [매일 | 요일 지정 | 주 N회]
  └ 요일 지정 → [월][화][수][목][금][토][일]
  └ 주 N회 → [2회][3회][4회][5회][6회]
--- Divider ---
[알람 토글]
  └ ON → TimeInput 시간 입력
         주 N회일 때만: [알람 요일] 별도 선택
--- 하단 ---
수정: [삭제(flex:1)] [수정완료(flex:2)]  /  추가: [루틴 저장(full)]
```

### 할일 추가/수정 화면 (AddTodoScreen)
```
[제목 *]
[마감 날짜 📅] [마감 시각]  ← 한 줄 배치 (flex 1.6 : 1)
  └ 달력 아이콘 → 인라인 MonthCalendar
[카테고리]
--- Divider ---
[알람 토글]
  └ ON → 알람 목록 + "+ 알람 추가" 패널
[메모 (선택)]  ← Paper label= prop + value||' ' 패턴
--- 하단 ---
수정: [삭제(flex:1)] [수정완료(flex:2)]  /  추가: [할일 저장(full)]
```

---

## 카드 UI 구성

### ScheduleItem
```
[색상바] [제목              ] [이름태그 뱃지] [🗑]
         [시간 · 🔔알람]
         [📍장소]
         [메모 (italic)]
```
- 색상바: `nameTagColor || color`
- 시간: 단일 `"09:00 ~ 10:00"` / 여러 날 `"4/19 ~ 4/22 · 09:00 ~ 10:00"`
- 알람 아이콘: 시간 텍스트 **뒤**에 표시 (앞 아님), metaText에 flex:1 없음

### RoutineItem
```
[색상바] [제목                ] [🗑] [○/●]
         [카테고리 · 빈도 · 🔥스트릭 · 🔔알람]
         [● ● ○ ○ ● ○ ●]  ← 주간 완료 도트
```
- 빈도 라벨: `'매일'` / `'주 N회 · 월수금'` / `'주 N회'`
- 주간 도트:
  - `daily`/`weekly_days`: 월~일 7개, 예정 요일만 완료(채움)/미완료(테두리), 비예정 placeholder
  - `weekly_count`: 목표 횟수만큼 dot (예: 주3회 → `●●○`)
- Props: `isQuotaMet` → 카드 흐려짐 + 체크 비활성, `showCheckButton={false}` → 내 루틴 관리 탭용

### TodoItem
```
[색상바] [제목 (완료 시 취소선)] [D-day] [🗑] [체크박스]
         [카테고리 · 마감일시 · 🔔알람]
         [메모 (1줄 truncate)]
```
- D-day 색상: `<0일 → #EF4444`, `=0일 → #EF4444`, `≤2일 → #F97316`, `≤5일 → #F59E0B`, `≤7일 → #EAB308`
- 기한 초과 미완료: 배경 강조 (다크: `#3D1515`, 라이트: `#FEF2F2`)
- 완료: opacity 0.5 + 취소선

---

## 화면 동작 방식

### 일정 화면 (ScheduleScreen)
- **날짜 선택**: 해당 날짜 일정만 표시
- **같은 날짜 재탭**: 선택 해제 → 월 전체 보기
- **월 이동 (화살표/스와이프)**: 선택 해제 → 해당 월 전체 표시
- **월 전체 보기**: 날짜·시간 오름차순, 오늘 이후 첫 일정으로 자동 스크롤
- **달력 스와이프**: PanResponder 기반 좌우 스와이프

### 달력 dot + range bar
- `markedDates: Record<string, string[]>` — 날짜별 이름표 색상 배열
- `rangeEvents: { startDate, endDate, color }[]` — 여러 날 range bar
- MonthCalendar `rangeBarMap`: 날짜별 `{ color, roundLeft, roundRight }[]`
  - `roundLeft`: 이벤트 시작일 OR 해당 행 첫 열(일요일)
  - `roundRight`: 이벤트 종료일 OR 해당 행 마지막 열(토요일)
  - 바 색상: `color + '55'` (반투명), `alignSelf: 'stretch'`

### 루틴 화면 (RoutineScreen)
- **SegmentedButtons**: `[오늘의 루틴 | 내 루틴 관리]`
- **오늘의 루틴**: daily/weekly_count → 항상 표시, weekly_days → 오늘 요일만
  - weekly_count quota 달성 시 카드 흐려짐 + 체크 비활성 (오늘 체크한 것은 취소 가능)
- **내 루틴 관리**: 전체(등록순), 체크 없음, 탭 → 수정 모달
- **헤더 카드**: 탭 무관하게 오늘 기준 진행률 고정 표시

### 할일 화면 (TodoScreen)
- **진행중 탭**: 날짜 그룹 구분자 + 마감일 오름차순
  - 구분자: 지남 / 오늘 / 내일 / 이번 주(7일 이내) / 그 이후
- **완료 탭**: completedAt 내림차순

### 성과 화면 (AchievementScreen)
- **요약 카드**: 탭 무관하게 상단 고정 (오늘 완료 / 주간 달성률 / 최고 스트릭 / 누적 횟수)
- **탭**: `[주간 | 월간 | 루틴별]`
- **주간 탭**: 최근 7일 BarChart (`maxValue=110`, 100% 잘림 방지)
- **월간 탭**: react-native-calendars Calendar (dot: 전체완료 `#10B981` / 일부 `#F59E0B` / 미완료 `#EF4444`)
  - `earliestRoutineDate` 기준 이전 날짜 dot 제외
- **루틴별 탭**: 달성률 ProgressBar + 스트릭 뱃지
