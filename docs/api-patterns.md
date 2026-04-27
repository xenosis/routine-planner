# API 패턴

## Supabase

### 클라이언트 초기화
- `src/lib/supabase.ts` — 싱글톤 클라이언트
- `react-native-url-polyfill` 필수 (RN 환경에서 URL 처리)
- AsyncStorage 기반 세션 유지

### RLS (Row Level Security)
- `schedules` 테이블: `family_full_access` 정책 — 로그인한 사용자 전체 읽기/쓰기 허용
- 인증된 사용자 모두가 서로의 일정을 읽고 쓸 수 있는 공유 구조 (가족/팀 공유 앱)

### 실시간 구독 (Realtime)
- `scheduleStore.setupRealtimeSubscription()`: `postgres_changes` 이벤트로 INSERT/UPDATE/DELETE 감지
- `ScheduleScreen` 마운트 시 구독 시작, 언마운트 시 해제
- 변경 감지 시 현재 뷰(날짜 선택 or 월 전체)에 맞게 자동 재조회 + markedDates 갱신

### 인증 (Auth)
- 이메일/비밀번호 로그인 (`supabase.auth.signInWithPassword`)
- 세션 초기화: `authStore.initialize()` — `supabase.auth.getSession()` + onAuthStateChange 구독
- 이름표 저장: `supabase.auth.updateUser({ data: { display_name, name_color } })`
- `authStore.updateDisplayName(name, color)` → user_metadata 업데이트 + 로컬 상태 동기화

### scheduleDb 컬럼 매핑
- DB 컬럼 `participants` → 앱 내부 `nameTag` 필드로 매핑
- DB 컬럼 `nameTagColor` → 그대로 사용
- `scheduleDb.ts`에서 select/insert/update 시 명시적 매핑 처리

---

## 카카오 장소 검색 (LocationSearchModal)

- **파일**: `src/components/schedule/LocationSearchModal.tsx`
- **API**: `https://dapi.kakao.com/v2/local/search/keyword.json`
- **인증**: `Authorization: KakaoAK {REST_API_KEY}` 헤더 (파일 상단 `KAKAO_API_KEY` 상수)
- **키 발급**: developers.kakao.com → 내 애플리케이션 → REST API 키

### Props
```typescript
visible: boolean
initialQuery?: string   // 장소 필드에 입력된 텍스트 → 모달 열릴 때 검색창 초기값
onSelect: (placeName: string) => void
onClose: () => void
```

### 동작
1. 검색어 변경 시 300ms 디바운스 후 API 호출
2. FlatList로 결과 표시 (`place_name`, `address_name`)
3. 결과 탭 → `onSelect(place_name)` 호출 → 장소 필드에 입력
4. 오류 발생 시 실제 API 오류 메시지 그대로 표시 (디버깅 목적)

---

## achievementDb 주요 함수

- `getEarliestRoutineCreatedAt(today)`: 가장 오래된 루틴의 createdAt 반환 (없으면 today)
  - 성과 월간 탭에서 루틴 추가 전 날짜 dot 방지에 사용
- `getRoutineAchievements(today)`: frequency별 totalDays 계산
  - daily → 경과일
  - weekly_days → 예정 요일 기준 누적 예정 횟수
- `getRoutineScheduleInfo()`: 루틴별 frequency/weekdays/createdAt 반환
  - AchievementScreen에서 날짜별 예정 수 계산에 사용

### 성과 달성률 계산 (AchievementScreen)
- 순수 계산 함수: `src/utils/achievementCalc.ts` (테스트: `__tests__/achievementCalc.test.ts`)
- **오늘 완료 분모**: `getScheduledCountForDate(today, routineSchedules, quotaMetBeforeToday)`
  - daily/weekly_count → 항상 포함
  - weekly_days → 오늘 요일이 weekdays에 포함될 때만 포함
  - createdAt > today인 루틴 제외
  - `quotaMetBeforeToday`: 오늘 체크분 제외한 횟수로 quota 달성 여부 판단 → 오늘 체크로 처음 채운 경우 "오늘 완료"로 집계

#### 주간 달성률
- `getThisWeekDays(today)`: 이번 주 월~오늘 날짜 배열 (최근 7일 X)
- 루틴별 계산 후 평균:
  - `daily` / `weekly_days`: 이번 주 예정 일수 대비 완료 일수
  - `weekly_count`: `min(완료횟수, quota) / quota`
- **weekly_days 이번 주 예정일 없는 루틴**: `scheduledDays === 0` → `null` 반환 → 평균 계산 제외
  - 예) 오늘이 월요일이고 화~일 루틴이면 이번 주 아직 기회 없음 → 달성률 평균에 포함하면 왜곡

#### 주간 차트
- `quotaMetForWeek`: 이번 주 quota 달성한 weekly_count 루틴 ID 집합
  - 각 날짜 분모(`getScheduledCountForDate`)에서 제외 → 100% 초과 방지
- 막대 레이블: 완료율 0%인 날도 "0%" 표시 (값 없어도 레이블 렌더링)

#### 월간 달력
- `buildMarkedDates`: `getRoutineCompletionsInRange(startDate, endDate)` — (routineId, date) 쌍 전체 조회
- `quotaMetBeforeThisDay`: 해당 날 **이전에** 이미 quota 달성한 weekly_count 루틴 집합
  - 해당 날의 완료·예정 분모 모두에서 제외 → dot 색상(전체/일부/미완료) 정확도 개선
- `getWeekStart(dateStr)`: 로컬 타임존 기준 월요일 반환 (`achievementCalc.ts`)

#### 루틴별 달성률
- `weekly_count` totalDays: **경과 주수 × quota** (생성일~오늘 일수 X)
  - `totalWeeks = Math.ceil((diffDays + 1) / 7)`, `totalDays = totalWeeks * quota`

#### 루틴 탭 오늘의 루틴
- `weekly_count`: **quota 달성 AND 오늘 미체크** 시 오늘 목록·카운트 모수에서 제외
  - 오늘 체크된 것은 quota 달성 후에도 유지 (취소 가능)
  - `isQuotaMet && !isCheckedToday` → `todayRoutines` 필터에서 제외
