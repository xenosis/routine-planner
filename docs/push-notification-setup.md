# 푸시 알림 설정 가이드

크로스 유저 푸시 알림(일정 추가/수정/삭제 시 상대방에게 알림) 설정 전체 과정.

---

## 구조 개요

```
앱 (scheduleStore.ts)
  → supabase.functions.invoke('notify-schedule')
    → Edge Function (supabase/functions/notify-schedule/index.ts)
      → user_push_tokens 테이블에서 수신자 토큰 조회
        → Expo Push API (https://exp.host/--/api/v2/push/send)
          → FCM (Firebase) → Android 기기
```

---

## 1. Firebase 서비스 계정 키 발급

1. [Firebase Console](https://console.firebase.google.com) 접속
2. 프로젝트 선택 (패키지명: `com.sewoong.routineplanner`)
3. 왼쪽 상단 톱니바퀴 → **프로젝트 설정**
4. **서비스 계정** 탭 클릭
5. **"새 비공개 키 생성"** 버튼 클릭 → JSON 파일 다운로드
6. 파일명 예시: `routineplanner-firebase-adminsdk-xxxxx.json`

> 이 파일은 민감 정보이므로 절대 git에 커밋하지 말 것.

---

## 2. Expo 대시보드에 FCM 키 등록

1. [expo.dev](https://expo.dev) 접속 → 프로젝트 선택
2. 좌측 메뉴 **Credentials** 클릭
3. **Android** 섹션 → **FCM V1 Service Account Key**
4. **"Upload"** 클릭 → 위에서 다운로드한 JSON 파일 업로드

> APK 재빌드 불필요. Expo 서버 측 설정이므로 기존 앱에 즉시 적용됨.

또는 터미널에서:
```bash
npx eas credentials --platform android
```

---

## 3. Supabase Edge Function 배포

### 최초 배포 또는 코드 수정 후 재배포

```bash
# Supabase CLI 로그인 (최초 1회)
npx supabase login

# 함수 배포
npx supabase functions deploy notify-schedule
```

### 배포 확인
[Supabase 대시보드](https://supabase.com/dashboard) → 프로젝트 선택 → **Edge Functions** 메뉴에서 `notify-schedule` 존재 여부 확인.

### 로그 확인
Edge Functions → `notify-schedule` → **Logs** 탭

정상 동작 시 로그 예시:
```
[notify-schedule] 요청: { sender_id: '...', action: 'add', title: '...' }
[notify-schedule] 조회된 토큰 수: 1
[notify-schedule] Expo Push 전송: [{ to: 'ExponentPushToken[...]', title: '...' }]
[notify-schedule] Expo Push 결과: {"data":[{"status":"ok","id":"..."}]}
```

---

## 4. Supabase 테이블: user_push_tokens

앱 로그인 시 자동으로 기기 토큰이 등록됨 (`src/utils/pushTokenManager.ts`).

| 컬럼 | 설명 |
|------|------|
| `user_id` | Supabase auth user ID (PK) |
| `push_token` | Expo Push Token (`ExponentPushToken[...]` 형식) |
| `updated_at` | 마지막 갱신 시각 |

**토큰이 등록 안 된 경우**: 앱 → 계정 탭 → **"알림 재등록"** 버튼 탭

> 프로덕션 APK에서만 유효한 토큰이 발급됨. Expo Go / 개발 빌드에서는 토큰 등록 불가.

---

## 5. 관련 코드 파일

| 파일 | 역할 |
|------|------|
| `src/utils/pushTokenManager.ts` | 기기 푸시 토큰 발급 및 Supabase 등록 |
| `src/store/authStore.ts` | 로그인/앱 시작 시 `registerPushToken` 호출 |
| `src/store/scheduleStore.ts` | 일정 추가/수정/삭제 시 `notify-schedule` Edge Function 호출 |
| `src/screens/account/AccountScreen.tsx` | 계정 탭 "알림 재등록" 버튼 |
| `supabase/functions/notify-schedule/index.ts` | Edge Function 본체 |

---

## 6. 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| Edge Functions에 `notify-schedule` 없음 | 배포 안 됨 | `npx supabase functions deploy notify-schedule` |
| `InvalidCredentials` 에러 (Expo Push 결과) | FCM 서버 키 미등록 | 2번 과정 수행 |
| `DeviceNotRegistered` 에러 | 토큰 만료 또는 앱 재설치 | 계정 탭 "알림 재등록" |
| `user_push_tokens`에 내 row 없음 | 토큰 등록 실패 | 계정 탭 "알림 재등록" (프로덕션 APK 필수) |
| Logs 탭에 로그 자체가 없음 | 앱이 Edge Function을 호출 안 함 | `scheduleStore.ts` 로그 확인, 세션 유효 여부 확인 |
