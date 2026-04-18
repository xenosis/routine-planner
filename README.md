# Doro

매일의 루틴을 반복하고 성과를 확인하는 Android 개인 플래너 앱입니다.  
일정, 루틴, 할일을 한 곳에서 관리하고 연속 달성 스트릭으로 동기부여를 유지하세요.

---

## 주요 기능

### 일정 (Schedule)
- 월 달력 + 날짜별 일정 목록 조회
- 날짜 탭 → 당일 보기 / 재탭 → 월 전체 보기 자동 전환
- 좌우 스와이프로 월 이동
- 카테고리별 색상 구분 (업무 / 개인 / 건강 / 기타)
- 복수 알람 설정 (프리셋 10분~1주 + 직접 입력)
- 장소, 참석자, 메모 필드 지원

### 루틴 (Routine)
- **오늘의 루틴 탭**: 오늘 요일에 해당하는 루틴만 표시, 체크로 완료 처리
- **내 루틴 관리 탭**: 전체 루틴 목록, 탭하면 수정
- 빈도 설정: 매일 / 요일 지정 / 주 N회 (2~6회)
- 연속 달성 스트릭 자동 계산 (일/주 단위)
- 이번 주 요일별 완료 현황 도트 표시
- 알람 연동 (매일 / 요일별 개별 알람 / 주 N회 별도 알람 요일)

### 할일 (Todo)
- 마감일 기반 할일 관리 (진행중 / 완료 탭 분리)
- D-day 뱃지 (오늘 / 내일 / D-N / D+N), 3일 이내 긴급 색상
- 날짜 구분자 자동 삽입 (지남 / 오늘 / 내일 / 이번 주 / 그 이후)
- 복수 알람 설정 + **마감 후 자동 재알람** (+1일 / +1주 / +1달)
- 카테고리별 색상 구분

### 성과 (Achievement)
- **요약 카드**: 오늘 완료 / 주간 달성률 / 최고 스트릭 / 누적 완료 (항상 상단 고정)
- **주간 탭**: 최근 7일 달성률 막대 차트
- **월간 탭**: 캘린더 dot 마킹 (전체완료 초록 / 일부완료 노랑 / 미완료 빨강)
- **루틴별 탭**: 루틴별 달성률 프로그레스 바 + 스트릭 뱃지

---

## 기술 스택

| 분류 | 라이브러리 |
|------|-----------|
| Framework | React Native + Expo |
| Language | TypeScript |
| UI | React Native Paper |
| 상태관리 | Zustand |
| DB | expo-sqlite |
| 알람 | expo-notifications |
| 차트 | react-native-gifted-charts |
| 내비게이션 | React Navigation (Bottom Tabs) |
| 빌드 | EAS Build |

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
├── store/
│   ├── scheduleStore.ts     # 일정 상태 (Zustand)
│   ├── routineStore.ts      # 루틴 상태 (Zustand)
│   └── todoStore.ts         # 할일 상태 (Zustand, 알람 포함)
├── screens/
│   ├── schedule/
│   │   ├── ScheduleScreen.tsx
│   │   └── AddScheduleScreen.tsx
│   ├── routine/
│   │   ├── RoutineScreen.tsx
│   │   └── AddRoutineScreen.tsx
│   ├── todo/
│   │   ├── TodoScreen.tsx
│   │   └── AddTodoScreen.tsx
│   └── achievement/
│       └── AchievementScreen.tsx
├── components/
│   ├── calendar/
│   │   └── MonthCalendar.tsx    # 자체 구현 월 달력
│   ├── schedule/
│   │   └── ScheduleItem.tsx
│   ├── routine/
│   │   └── RoutineItem.tsx
│   └── todo/
│       └── TodoItem.tsx
├── navigation/
│   └── AppNavigator.tsx         # 탭 순서: 일정 / 루틴 / 할일 / 성과
└── theme/
    └── index.ts                 # 라이트/다크 테마, 디자인 토큰
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
npx expo start --android
```

### 빌드 (EAS Build)

```bash
# APK 빌드 (테스트용)
eas build --platform android --profile preview

# AAB 빌드 (스토어 배포용)
eas build --platform android --profile production
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
