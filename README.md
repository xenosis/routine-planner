# Routine Planner

개인 일정과 루틴을 한 곳에서 관리하는 Android 앱입니다.  
매일 반복할 루틴을 설정하고 스트릭을 쌓고, 일정을 달력으로 한눈에 확인할 수 있습니다.

---

## 주요 기능

### 일정 관리
- 월 달력 + 날짜별 일정 목록 조회
- 날짜 탭 → 당일 보기 / 재탭 → 월 전체 보기 자동 전환
- 좌우 스와이프로 월 이동
- 복수 알람 설정 (프리셋 + 직접 입력)
- 장소, 참석자, 메모 필드 지원
- 카드에서 바로 삭제 + 수정 모달 하단 삭제 버튼

### 루틴 관리
- **오늘의 루틴 탭**: 오늘 요일에 해당하는 루틴만 표시, 체크로 완료 처리
- **내 루틴 관리 탭**: 전체 루틴 목록, 탭하면 수정 가능
- 빈도 설정: 매일 / 요일 선택 (주 N회, 월~일 조합)
- 연속 달성 스트릭 자동 계산
- 이번 주 요일별 완료 현황 도트 표시
- 알람 연동 (매일 / 요일별 개별 알람)

### 성과 확인
- 루틴별 달성률 바 차트
- 주간 / 월간 통계

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

---

## 프로젝트 구조

```
src/
├── db/
│   ├── database.ts          # DB 초기화 및 마이그레이션
│   ├── scheduleDb.ts        # 일정 CRUD
│   ├── routineDb.ts         # 루틴 CRUD, 스트릭, 주간 완료
│   └── achievementDb.ts     # 달성률 조회
├── store/
│   ├── scheduleStore.ts     # 일정 상태 (Zustand)
│   └── routineStore.ts      # 루틴 상태 (Zustand)
├── screens/
│   ├── schedule/
│   │   ├── ScheduleScreen.tsx
│   │   └── AddScheduleScreen.tsx
│   ├── routine/
│   │   ├── RoutineScreen.tsx
│   │   └── AddRoutineScreen.tsx
│   └── achievement/
│       └── AchievementScreen.tsx
├── components/
│   ├── calendar/
│   │   └── MonthCalendar.tsx  # 자체 구현 월 달력
│   ├── schedule/
│   │   └── ScheduleItem.tsx
│   └── routine/
│       └── RoutineItem.tsx
├── navigation/
│   └── AppNavigator.tsx
└── theme/
    └── index.ts             # 라이트/다크 테마, 디자인 토큰
```

---

## 시작하기

### 요구사항
- Node.js 18+
- Expo CLI
- Android 에뮬레이터 또는 실기기 (Expo Go)

### 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npx expo start

# Android 실행
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

일정 카테고리
  업무 : #6366F1  개인 : #10B981
  건강 : #F59E0B  기타 : #94A3B8
```

라이트 모드 / 다크 모드 모두 지원합니다.
