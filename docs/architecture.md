# 아키텍처

## 파일 구조
```
src/
  db/
    database.ts        - DB 초기화 (SQLite 싱글톤, 루틴/할일 테이블 생성 및 마이그레이션)
    scheduleDb.ts      - 일정 CRUD — Supabase 연동 (Schedule 타입 포함)
    routineDb.ts       - 루틴 CRUD (Routine 타입, 스트릭, 주간 완료 조회)
    achievementDb.ts   - 달성률 조회 (frequency/weekdays 반영, getEarliestRoutineCreatedAt 포함)
    todoDb.ts          - 할일 CRUD (Todo 타입 포함)
  lib/
    supabase.ts        - Supabase 클라이언트 싱글톤
  store/
    authStore.ts       - 로그인 세션 상태 (signIn/signOut/updateDisplayName)
    scheduleStore.ts   - 일정 Zustand 스토어 (실시간 구독 포함)
    routineStore.ts    - 루틴 Zustand 스토어 (weekCompletions 포함)
    todoStore.ts       - 할일 Zustand 스토어 (알람 등록/취소 포함)
  utils/
    date.ts            - 로컬 타임존 날짜 유틸 (toLocalDateStr)
    nameTag.ts         - 이름표 색상 팔레트 + getNameColor (해시 fallback용)
  screens/
    auth/
      LoginScreen.tsx        - 이메일/비밀번호 로그인 화면
    account/
      AccountScreen.tsx      - 계정 탭 (이메일 표시, 작성자 이름+색상 설정, 로그아웃)
    schedule/
      ScheduleScreen.tsx     - 일정 메인 화면 (달력 + 목록, 실시간 구독, 월 전체 보기 버튼)
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
      MonthCalendar.tsx      - 자체 구현 월 달력 컴포넌트 (dot: 이름표 색상별)
    common/
      TimeInput.tsx          - 공통 시간 입력 컴포넌트 (자동 콜론, compact/일반 모드)
    schedule/
      ScheduleItem.tsx       - 일정 카드 (이름표 뱃지, 우측 삭제 버튼)
      LocationSearchModal.tsx - 카카오 Local API 장소 검색 모달
    routine/
      RoutineItem.tsx        - 루틴 카드 (주간 완료 도트, 삭제/체크 버튼, 빈도 라벨)
    todo/
      TodoItem.tsx           - 할일 카드 (D-day 뱃지, 체크박스, 삭제 버튼)
  navigation/
    AppNavigator.tsx         - 탭 순서: 일정 / 할일 / 루틴 / 성과 / 계정
                               인증 게이트 포함 (미로그인 시 LoginScreen 표시)
  theme/
    index.ts           - 라이트/다크 테마, spacing, borderRadius 토큰
```

---

## 네비게이션 (AppNavigator)
- 탭 순서: **일정 / 할일 / 루틴 / 성과 / 계정**
- 인증 게이트: `authStore.session` 없으면 → `LoginScreen` 표시, 있으면 → 탭 네비게이터

---

## 인증 시스템
- `authStore`: `session`, `loading`, `initialize()`, `signIn()`, `signOut()`, `updateDisplayName(name, color)`
- `user_metadata` 저장: `{ display_name: string, name_color: string }`
- AppNavigator에서 인증 게이트: 미로그인 → LoginScreen, 로그인 → 탭 네비게이터

### 계정 탭 (AccountScreen)
- 로그인 이메일 표시
- **작성자** 이름 입력 + 8가지 색상 팔레트 선택 → Supabase user_metadata에 저장
- 실시간 뱃지 미리보기 (선택 색상 반영)
- 로그아웃 버튼

---

## 스토어 상태/액션

### scheduleStore
```typescript
selectedDate: string | null          // null = 월 전체 보기
viewYear: number
viewMonth: number
schedules: Schedule[]
markedDates: Record<string, string[]> // 캘린더 dot 표시용 (날짜 → 색상 배열)
rangeEvents: { startDate: string; endDate: string; color: string }[] // range bar용

setSelectedDate(date)           // 날짜 선택 → fetchByDate
clearSelectedDate()             // 선택 해제 → fetchByMonth
fetchByDate(date)
fetchByMonth(year, month)       // 월 전체 일정 (과거 포함)
fetchMarkedDates(year, month)   // getMarkedDates + getMultiDayEventsForMonth 병렬 호출
addSchedule / updateSchedule / deleteSchedule
setupRealtimeSubscription()     // Supabase 실시간 구독 시작 (ScheduleScreen에서 호출)
```

### routineStore
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

### todoStore
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

---

## Android APK 알람 설정
- `app.json` 권한: `android.permission.SCHEDULE_EXACT_ALARM` + `android.permission.USE_EXACT_ALARM` 필수 (Android 12+)
- `App.tsx` `setupNotifications()`: Android 알림 채널 `setNotificationChannelAsync('default', ...)` 생성 필수 (Android 8+)
- SCHEDULE_EXACT_ALARM 권한 박탈 감지: 앱 시작 시 probe scheduleNotificationAsync → 실패 시 Alert + `Linking.sendIntent('android.settings.REQUEST_SCHEDULE_EXACT_ALARM')` 안내
- 모든 알람 트리거에 `channelId: 'default'` 명시 (DATE/DAILY/WEEKLY 공통)
- 앱 첫 실행 시 구형 알람 일괄 초기화: AsyncStorage `alarm_reset_v1` 플래그로 1회만 실행
  ```typescript
  const alreadyReset = await AsyncStorage.getItem('alarm_reset_v1');
  if (!alreadyReset) {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.setItem('alarm_reset_v1', 'true');
  }
  ```
- 알람 유틸: `src/utils/scheduleAlarms.ts`
  - `scheduleAlarmNotifications(schedule)`: 비반복 일정 복수 알람 등록 (`{id}_{i}`)
  - `scheduleNextRepeatAlarm(schedule)`: 반복 일정 다음 발생 1건만 등록 (`{id}_repeat_{i}`)
  - `cancelRepeatAlarms(scheduleId, count)`: 반복 알람 일괄 취소
  - `getNextRepeatOccurrence(schedule)`: 다음 반복 발생일 계산

### 반복 일정 알람 재등록 전략
- **1건만 등록**: 반복 알람은 다음 발생 1건만 예약 (OS 알람 슬롯 절약)
- **알람 탭 시**: `App.tsx` — `_repeat_` 포함 identifier 감지 → `scheduleNextRepeatAlarm()` 즉시 재등록
- **앱 시작 시**: `AppNavigator.tsx` — `reRegisterMissingRepeatAlarms()` — 예약 목록에 없는 반복 알람 보완 등록
- **저장 순서 주의**: `onSave()` 완료 후 알람 등록 필수 (scheduleStore가 onSave 중 기존 알람 취소하므로 순서 역전 시 덮어쓰기 버그)
- 반복 활성 시 기존 알람 UI 숨김, 독립 `repeatAlarmTime` + 반복 종료일 2열 레이아웃 (`repeatTimeRow`)

### 알림 탭 → 화면 이동
- `src/utils/navigationRef.ts`: `navigationRef`, `navigateToTab`, `setPendingNotifType`, `consumePendingNotifType`
- **앱 실행 중/백그라운드**: `addNotificationResponseReceivedListener` → `navigateToTab()` 즉시 호출
- **앱 완전 종료(killed)**: `getLastNotificationResponseAsync()` → `setPendingNotifType()` 저장 → AppNavigator auth 완료 후 `consumePendingNotifType()` 처리
  - 이유: killed 상태에서는 `navigationRef.isReady()` false이고 탭 네비게이터도 미마운트

---

## 앱 정보
- **앱 이름**: Doro
- **패키지**: com.sewoong.routineplanner
- **아이콘**: 인디고-퍼플 그라디언트 배경 + 순환 화살표 + 체크마크 (흰색)
- **스플래시 배경**: `#6366F1`
- **빌드**: EAS Build (eas.json — preview: APK, production: AAB)
