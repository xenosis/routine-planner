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
- UI: React Native Paper v5 / 상태관리: Zustand
- 달력: 자체 구현 MonthCalendar (react-native-calendars는 성과 탭 월간뷰에만 사용)
- 빌드: EAS Build (preview: APK, production: AAB)

## 버전 관리 정책
버그 수정·기능 변경 시 반드시 버전을 올릴 것. 항상 세 파일 동시 수정:
`app.json` / `android/app/build.gradle` (versionCode +1, versionName) / `package.json`
- `patch` (1.0.x): 버그 수정 / `minor` (1.x.0): 새 기능 / `major` (x.0.0): 대규모 변경

## 라이브러리 정책
- 새 라이브러리 필요 시 사용자에게 먼저 물어볼 것
- Expo native 모듈은 반드시 `npx expo install` (npm install 금지)

## 디자인 원칙
→ 상세: `docs/design-system.md`
- 모던하고 세련된 UI, 다크모드 지원, 미니멀
- SafeArea: `edges={['top', 'left', 'right']}` (하단은 탭 바가 처리)
- 모달 footer: `paddingBottom: insets.bottom > 0 ? insets.bottom : spacing.sm`
- Modal: 반드시 `statusBarTranslucent` 설정 — `edgeToEdgeEnabled: true` 환경에서 누락 시 중첩 Modal 내부 WebView 높이 0 (프로덕션에서만 재현)
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
  - `AddScheduleScreen`은 RN `Modal` 기반 전체화면 (`statusBarTranslucent` 필수) — ScheduleScreen에서 `{modalVisible && <AddScheduleScreen visible={modalVisible} />}`

---

## 현재 구현 상태 (2026-05-11, v1.2.0)

### 탭 구조
일정 / 할일 / 루틴 / 성과 / 계정 (미로그인 시 LoginScreen 표시)

### 파일 구조
→ `docs/architecture.md`

### 핵심 구현 사항
→ 세부 계산 로직: `docs/api-patterns.md` / 알람 전략: `docs/architecture.md`

- **일정**: Supabase 연동, 반복 일정 (`matchesRepeatDate` → `src/utils/repeatDate.ts`), 여러날/이름표/장소
- **루틴**: daily / weekly_days / weekly_count, 스트릭 계산 (`src/utils/streakCalc.ts`)
- **할일**: 마감 후속 알람 자동 등록 (`{todoId}_late_0/1/2`)
- **카테고리**: `categoryDb.ts` + `categoryStore.ts` — 탭별 독립, 삭제·변경 시 '기타'로 마이그레이션
  - `database.ts` 시드: 일정 4 + 루틴 5 + 할일 4 = 13개 기본 카테고리
  - DB 초기화 race condition 방지: `initPromise` 캐시로 시드 중복 삽입 방지
  - **드래그앤드롭 순서 변경**: `react-native-draggable-flatlist` — `reorderCategories` 낙관적 업데이트 후 `setCategoryOrder` DB 일괄 저장
  - `App.tsx`에 `GestureHandlerRootView` 필수 (`index.ts`에 `react-native-gesture-handler` import 선행)
- **DB 초기화 중앙화**: AppNavigator에서 `initDatabase()` 한 번만 (`dbReady` 게이트)
  - DB 완료 후 카테고리 전체 로드 (`fetchAllCategories`) + 위젯 즉시 동기화 (`syncWidgetNow`)
- **성과탭**: `getThisWeekDays(today)` 기준 주간 달성률 / `weekly_count` 루틴은 오늘 목록·헤더·완료 카운트에서 항상 제외
- **Android 홈 화면 위젯**: Medium(4×3) / Large(4×5) 월간 달력, Kotlin AppWidgetProvider
  - 위젯 4종: 불투명(Medium/Large) + 투명(Medium/Large) — `CalendarWidgetProvider`의 `abstract getLayoutId()`로 분기
  - 투명 버전: `widget_calendar_transparent.xml` (배경 없음, 텍스트 드롭 섀도우 적용)
  - 요일 헤더: 날짜 숫자와 동일한 18sp, 날짜 셀 28dp × 28dp (컴팩트)
  - 이벤트 탭 PendingIntent template은 반드시 **`FLAG_MUTABLE`** (FLAG_IMMUTABLE 시 fillIn extras 병합 안 됨)
  - 위젯 탭 → 앱 복귀: `MainActivity.onNewIntent → setIntent(intent)` + JS `AppState` 리스너 → `getLaunchDate()`
  - **RemoteViews 제약**: `<View>` 사용 불가 — `<TextView>`, `<ImageView>` 등 허용 클래스만
  - **Expo Go / 디버그 빌드에서 동작 안 함** — 릴리즈 APK에서만 테스트 가능
- **크로스 유저 푸시 알림**: `addSchedule()` → Edge Function `notify-schedule` → Expo Push API
  - 로그인 시 `registerPushToken()` 자동 호출 → `user_push_tokens` 테이블 upsert
- **알림 탭 이동 (killed 상태)**: `App.tsx` → `setPendingNotifType` + rAF 재귀 → `consumePendingNotifType`
  - AppNavigator도 auth 완료 후 시도 — 먼저 소비하는 쪽이 이동, 나머지는 무시
- **Android 알람**: 반복 알람은 다음 발생 1건만 예약, 탭 시 재등록

### 테스트
- `npm test` — Jest 단위 테스트 (59개, `jest-expo` 프리셋)
- 계산 로직 변경 시 → `npm test` 먼저 실행 후 `docs/test-checklist.md` 수동 확인

### DB 컬럼명 주의
- routines 테이블의 주 N회 컬럼: **`weekly_count`** (snake_case) — JS 객체에서는 `weeklyCount`
- SQL 쿼리에서 반드시 `weekly_count` 사용, camelCase 혼용 시 SQLite 에러 발생

### 라이브러리 버전 고정 주의
- `react-native-reanimated`: **`4.1.1`** / `react-native-worklets`: **`0.5.1`** (Expo Go SDK 54 내장 버전)
- 버전 올리면 `installTurboModule` 인수 불일치로 Expo Go 즉시 크래시
- 업그레이드 시 `node_modules/expo/bundledNativeModules.json`에서 내장 버전 먼저 확인

---

## 참조 문서
- `docs/design-system.md` — UI/디자인 규칙, 화면 레이아웃, 카드 구성, 동작 방식
- `docs/architecture.md` — 파일 구조, 스토어 API, 인증, Android 알람, 앱 정보
- `docs/api-patterns.md` — Supabase 패턴, 카카오 장소 검색, 달성률 계산 세부 로직
- `docs/data-models.md` — DB 스키마, 알람 ID 패턴, 스트릭/달성률 계산, 카테고리 색상
- `docs/test-checklist.md` — 수동 회귀 테스트 시나리오 목록
- `docs/build-commands.md` — 개발 서버, 로컬 APK 빌드, EAS 빌드 명령어 모음
