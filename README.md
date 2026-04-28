# Doro

매일의 루틴을 반복하고 성과를 확인하는 Android 개인 플래너 앱입니다.  
일정, 루틴, 할일을 한 곳에서 관리하고 연속 달성 스트릭으로 동기부여를 유지하세요.

---

## 주요 기능

### 일정 (Schedule)
- 월 달력 + 날짜별 일정 목록 조회
- 날짜 탭 → 당일 보기 / 재탭 → 월 전체 보기 자동 전환
- 좌우 스와이프로 월 이동
- **반복 일정**: 매일 / 매주 / 매월 / 매년, 종료일 설정 가능
- **여러 날 일정**: 날짜 범위 bar 표시
- **이름표(nameTag)**: 참석자/작성자 태그 + 색상 dot
- 카테고리별 색상 구분 (업무 / 개인 / 건강 / 기타)
- 복수 알람 설정 (프리셋 10분~1주 + 직접 입력)
- 장소 검색 (카카오 지도 WebView 연동), 메모 필드
- Supabase 실시간 동기화 (다른 기기에서 변경 시 자동 반영)

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
- 복수 알람 설정 + **마감 후 자동 재알람** (+1일 / +1주 / +1달)
- 카테고리별 색상 구분

### 성과 (Achievement)
- **요약 카드**: 오늘 완료 / 주간 달성률 / 최고 스트릭 / 누적 완료 (항상 상단 고정)
- **주간 탭**: 이번 주(월~일) 기준 달성률 막대 차트, 0%인 날도 레이블 표시
- **월간 탭**: 캘린더 dot 마킹 (전체완료 초록 / 일부완료 노랑 / 미완료 빨강)
- **루틴별 탭**: 루틴별 달성률 프로그레스 바 + 스트릭 뱃지

### 계정 (Account)
- Supabase 이메일/패스워드 로그인
- 미로그인 시 LoginScreen 표시

---

## 기술 스택

| 분류 | 라이브러리 |
|------|-----------|
| Framework | React Native + Expo |
| Language | TypeScript |
| UI | React Native Paper v5 |
| 상태관리 | Zustand |
| DB (루틴/할일) | expo-sqlite |
| DB (일정) | Supabase PostgreSQL |
| 알람 | expo-notifications |
| 차트 | react-native-gifted-charts |
| 지도 | react-native-webview + 카카오 지도 JS API |
| 내비게이션 | React Navigation (Bottom Tabs) |
| 빌드 | EAS Build / 로컬 Gradle 빌드 |

---

## 프로젝트 구조

```
src/
├── db/
│   ├── database.ts          # DB 초기화 및 마이그레이션
│   ├── scheduleDb.ts        # 일정 CRUD
│   ├── routineDb.ts         # 루틴 CRUD, 스트릭, 주간 완료
│   ├── achievementDb.ts     # 달성률 조회
│   └── todoDb.ts            # 할일 CRUD
├── lib/
│   └── supabase.ts          # Supabase 클라이언트
├── store/
│   ├── authStore.ts         # 인증 상태 (Zustand)
│   ├── scheduleStore.ts     # 일정 상태 (Zustand)
│   ├── routineStore.ts      # 루틴 상태 (Zustand)
│   └── todoStore.ts         # 할일 상태 (Zustand)
├── utils/
│   ├── date.ts              # 날짜 유틸
│   ├── navigationRef.ts     # 알림 탭 이동 (killed 상태 대응)
│   ├── scheduleAlarms.ts    # 일정 알람 등록/취소
│   ├── repeatDate.ts        # 반복 일정 날짜 매칭
│   ├── achievementCalc.ts   # 달성률 계산 (순수 함수)
│   └── streakCalc.ts        # 스트릭 계산 (순수 함수)
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
│   └── AppNavigator.tsx         # 탭 순서: 일정 / 할일 / 루틴 / 성과 / 계정
└── theme/
    └── index.ts                 # 라이트/다크 테마, 디자인 토큰

__tests__/                       # Jest 단위 테스트 (53개)
├── achievementCalc.test.ts
├── streakCalc.test.ts
└── repeatDate.test.ts
```

---

## 시작하기

### 요구사항
- Node.js 18+
- Expo CLI
- Android 에뮬레이터 또는 실기기

### 설치 및 실행

```bash
npm install
npm start        # Metro 번들러 시작 (Expo Go로 테스트)
npm test         # Jest 단위 테스트 실행
```

### 빌드

EAS 클라우드 빌드와 로컬 Gradle 빌드 모두 지원합니다.  
→ 자세한 명령어: [`docs/build-commands.md`](docs/build-commands.md)

```bash
# EAS 클라우드 — APK (테스트용)
eas build --platform android --profile preview

# EAS 클라우드 — AAB (스토어 배포용)
eas build --platform android --profile production

# 로컬 빌드 (Windows, 월 한도 없음)
npx expo prebuild --platform android --clean
cd android && .\gradlew assembleRelease
```

---

## 디자인 시스템

```
브랜드 컬러
  Primary  : #6366F1 (인디고)
  Secondary: #10B981 (에메랄드)

루틴 카테고리
  운동 : #10B981  공부 : #6366F1
  청소 : #06B6D4  관리 : #F59E0B  기타 : #94A3B8

일정/할일 카테고리
  업무 : #6366F1  개인 : #10B981
  건강 : #F59E0B  기타 : #94A3B8
```

라이트 모드 / 다크 모드 모두 지원합니다.
