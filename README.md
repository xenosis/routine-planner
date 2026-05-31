# Doro — 개인 플래너 앱

매일의 루틴을 반복하고 성과를 확인하는 Android 개인 플래너 앱입니다.  
일정, 루틴, 할일을 한 곳에서 관리하고 연속 달성 스트릭으로 동기부여를 유지하세요.

**현재 버전: v1.2.9**

---

## 주요 기능

### 일정 (Schedule)
- 월 달력 + 날짜별 일정 목록 조회
- 날짜 탭 → 당일 보기 / 재탭 → 월 전체 보기 자동 전환
- 좌우 스와이프로 월 이동
- **반복 일정**: 매일 / 매주 / 매월 / 매년, 종료일 설정 가능
- **여러 날 일정**: 날짜 범위 bar 표시
- **이름표(nameTag)**: 참석자/작성자 태그 + 색상 dot
- 카테고리별 색상 구분
- 복수 알람 설정 (프리셋 10분~1주 + 직접 입력)
- 장소 검색 (카카오 지도 WebView 연동), 메모 필드
- Supabase 실시간 동기화 (다른 기기에서 변경 시 자동 반영)
- **크로스 유저 푸시 알림**: 일정 추가 시 상대방에게 자동 푸시

### 루틴 (Routine)
- **오늘의 루틴 탭**: 오늘 요일에 해당하는 루틴만 표시, 체크로 완료 처리
- **내 루틴 관리 탭**: 전체 루틴 목록, 탭하면 수정
- 빈도 설정: 매일 / 요일 지정 / 주 N회 (2~6회)
- 연속 달성 스트릭 자동 계산 (daily: 연속 일수, weekly: 연속 주수)
- 이번 주 요일별 완료 현황 도트 표시
- 주 N회 quota 달성 시 카드 흐려짐 + 당일 목록에서 제외
- 알람 연동 (매일 / 요일별 개별 알람 / 주 N회 별도 알람 요일)

### 할일 (Todo)
- 마감일 기반 할일 관리 (진행중 / 완료 탭 분리)
- D-day 뱃지 (오늘 / 내일 / D-N / D+N), 3일 이내 긴급 색상
- 날짜 구분자 자동 삽입 (지남 / 오늘 / 내일 / 이번 주 / 그 이후)
- 복수 알람 설정 (알람 켤 때 마감시각 기본 추가) + **마감 후 자동 재알람** (+1일 / +1주 / +1달)
- 카테고리별 색상 구분

### 성과 (Achievement)
- **요약 카드**: 오늘 완료 / 주간 달성률 / 최고 스트릭 / 누적 완료 (항상 상단 고정)
- **주간 탭**: 이번 주(월~일) 기준 달성률 막대 차트, 0%인 날도 레이블 표시
- **월간 탭**: 캘린더 dot 마킹 (전체완료 초록 / 일부완료 노랑 / 미완료 빨강)
- **루틴별 탭**: 루틴별 달성률 프로그레스 바 + 스트릭 뱃지

### 계정 (Account)
- Supabase 이메일/패스워드 로그인
- 작성자 이름 + 색상 설정 (일정 이름표에 반영)
- **카테고리 관리**: 일정 / 루틴 / 할일 탭별 독립 카테고리 (추가/수정/삭제/순서 변경)
  - 탭 간 공통 카테고리 이름·색상·순서 자동 동기화
- **데이터 백업/복원**: 루틴·할일·카테고리를 Supabase에 백업, 앱 재설치 후 복원 가능
- 미로그인 시 LoginScreen 표시

### Android 홈 화면 위젯
- 4종 위젯: 불투명 Medium(4×3) / 불투명 Large(4×5) / 투명 Medium / 투명 Large
- 월간 달력 그리드 + 날짜별 일정 목록
- 날짜 셀 탭 → 해당 날짜 일정 하단 표시 + 앱 이동
- 이전/다음 달 이동 (달 변경 시 날짜 선택 자동 초기화)
- 여러 날 일정 bar 표시 (시작/중간/끝 모양 구분)
- 앱 시작 시 현재 월 기준 **±12개월** 일정(반복 일정 포함) 자동 캐싱

---

## 기술 스택

| 분류 | 라이브러리 |
|------|-----------|
| Framework | React Native + Expo (SDK 54) |
| Language | TypeScript |
| UI | React Native Paper v5 |
| 상태관리 | Zustand |
| DB (루틴/할일/카테고리) | expo-sqlite |
| DB (일정) | Supabase PostgreSQL |
| 알람 | expo-notifications |
| 차트 | react-native-gifted-charts |
| 지도 | react-native-webview + 카카오 지도 JS API |
| 내비게이션 | React Navigation (Bottom Tabs) |
| 드래그앤드롭 | react-native-draggable-flatlist |
| 빌드 | EAS Build / 로컬 Gradle 빌드 |

---

## 프로젝트 구조

```
src/
├── db/
│   ├── database.ts          # SQLite 초기화 및 마이그레이션
│   ├── scheduleDb.ts        # 일정 CRUD (Supabase)
│   ├── routineDb.ts         # 루틴 CRUD, 스트릭, 주간 완료
│   ├── achievementDb.ts     # 달성률 조회
│   ├── todoDb.ts            # 할일 CRUD
│   ├── categoryDb.ts        # 카테고리 CRUD (탭별 독립)
│   └── backupDb.ts          # Supabase 백업/복원
├── lib/
│   └── supabase.ts          # Supabase 클라이언트
├── store/
│   ├── authStore.ts         # 인증 상태
│   ├── scheduleStore.ts     # 일정 상태 + 위젯 동기화
│   ├── routineStore.ts      # 루틴 상태
│   ├── todoStore.ts         # 할일 상태
│   └── categoryStore.ts     # 카테고리 상태 (탭별)
├── utils/
│   ├── date.ts              # 날짜 유틸
│   ├── repeatDate.ts        # 반복 일정 날짜 매칭
│   ├── scheduleAlarms.ts    # 일정 알람 등록/취소
│   ├── streakCalc.ts        # 스트릭 계산 (순수 함수)
│   ├── achievementCalc.ts   # 달성률 계산 (순수 함수)
│   ├── widgetSync.ts        # Android 위젯 데이터 동기화
│   ├── pushTokenManager.ts  # Expo 푸시 토큰 관리
│   ├── nameTag.ts           # 이름표 색상 팔레트
│   └── navigationRef.ts     # 알림 탭 이동 (killed 상태 대응)
├── screens/
│   ├── auth/                # 로그인 화면
│   ├── account/             # 계정 화면
│   ├── schedule/            # 일정 목록 + 추가/수정
│   ├── routine/             # 루틴 목록 + 추가/수정
│   ├── todo/                # 할일 목록 + 추가/수정
│   └── achievement/         # 성과 대시보드
├── components/
│   ├── calendar/
│   │   └── MonthCalendar.tsx    # 자체 구현 월 달력
│   ├── common/
│   │   └── TimeInput.tsx
│   ├── schedule/
│   ├── routine/
│   └── todo/
├── navigation/
│   └── AppNavigator.tsx     # 탭 순서: 일정 / 할일 / 루틴 / 성과 / 계정
└── theme/
    └── index.ts             # 라이트/다크 테마, 디자인 토큰

android/app/src/main/java/.../
├── CalendarWidgetProvider.kt  # 위젯 달력 렌더링 (4종)
├── CalendarWidgetFactory.kt   # 이벤트 목록 RemoteViewsFactory
├── CalendarWidgetService.kt   # RemoteViewsService
├── WidgetDataCache.kt         # 위젯 파일/SharedPreferences 캐시
├── WidgetModule.kt            # RN Native Module 브릿지
└── WidgetPackage.kt           # ReactPackage 등록

supabase/functions/
└── notify-schedule/           # 크로스 유저 푸시 알림 Edge Function

__tests__/                     # Jest 단위 테스트 (59개)
├── achievementCalc.test.ts
├── streakCalc.test.ts
└── repeatDate.test.ts
```

---

## 카테고리 시스템

일정 / 루틴 / 할일 세 탭이 공통 6개 카테고리를 공유하며, 탭 전용 카테고리 추가도 가능합니다.

| 카테고리 | 색상 |
|---------|------|
| 업무 | #6366F1 (인디고) |
| 개인 | #10B981 (에메랄드) |
| 건강 | #F59E0B (앰버) |
| 학습 | #3B82F6 (블루) |
| 가족 | #EC4899 (핑크) |
| 기타 | #94A3B8 (슬레이트, 기본값) |

---

## 시작하기

### 요구사항
- Node.js 18+
- Android Studio (로컬 빌드 시)
- Expo Go 앱 (개발 테스트용)

### 설치 및 실행

```powershell
npm install
npm start        # Metro 번들러 시작 (Expo Go로 테스트)
npm test         # Jest 단위 테스트 실행 (59개)
```

### 빌드

```powershell
# 로컬 APK 빌드 (Windows, 결과물: doro-v{버전}.apk)
npm run build:apk

# USB 연결 기기에 직접 설치
adb install -r doro-v1.2.9.apk
```

EAS 클라우드 빌드 및 상세 빌드 옵션 → [`docs/build-commands.md`](docs/build-commands.md)

---

## 디자인 시스템

- **라이트 모드 / 다크 모드** 모두 지원
- Primary: `#6366F1` (인디고) / Secondary: `#10B981` (에메랄드)
- 상세 규칙 → [`docs/design-system.md`](docs/design-system.md)

---

## 문서

| 문서 | 내용 |
|------|------|
| [`docs/architecture.md`](docs/architecture.md) | 파일 구조, 스토어 API, 인증, 알람, 위젯 아키텍처 |
| [`docs/design-system.md`](docs/design-system.md) | UI 규칙, 화면 레이아웃, 컴포넌트 구성 |
| [`docs/api-patterns.md`](docs/api-patterns.md) | Supabase 패턴, 달성률 계산 세부 로직 |
| [`docs/data-models.md`](docs/data-models.md) | DB 스키마, 알람 ID 패턴, 카테고리 색상 |
| [`docs/build-commands.md`](docs/build-commands.md) | 개발 서버, 로컬 APK 빌드, EAS 빌드, ADB 설치 |
| [`docs/test-checklist.md`](docs/test-checklist.md) | 수동 회귀 테스트 시나리오 |
