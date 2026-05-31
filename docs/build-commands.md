# 빌드 및 개발 명령어 모음

---

## 1. 최초 1회 세팅

> 처음 개발 환경을 구축하거나, `android/` 폴더를 새로 만들어야 할 때 순서대로 실행.
> 전제: Android Studio 설치 완료.

### 1-1. android/ 폴더 생성

```powershell
npx expo prebuild --platform android --clean
```

> `--clean`은 기존 `android/` 폴더를 지우고 새로 생성. **이후에는 생략 가능.**
> 네이티브 모듈 추가/변경 시에만 다시 실행.

### 1-2. keystore 생성 (APK 서명용 — 딱 한 번만)

```powershell
& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkey -v -keystore android/app/release.keystore -alias doro -keyalg RSA -keysize 2048 -validity 10000
```

> 비밀번호 직접 설정. 마지막 확인 질문에 영문 `y` 입력.
> **`release.keystore` 파일은 절대 분실 금지 + git에 올리지 말 것.**

### 1-3. build.gradle 서명 설정 (`android/app/build.gradle`)

```groovy
android {
    signingConfigs {
        release {
            storeFile file("release.keystore")
            storePassword "설정한_비밀번호"
            keyAlias "doro"
            keyPassword "설정한_비밀번호"
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

### 1-4. 설정 자동 복구 (prebuild --clean 후 항상 실행)

```powershell
powershell -File scripts/setup-android.ps1
```

> `local.properties` + `build.gradle` 서명 설정을 자동으로 복구.
> `keystore.properties`(프로젝트 루트)에서 비밀번호/alias를 읽어 적용.

---

## 2. 개발 서버 시작

```powershell
# Metro 번들러 시작 (Expo Go 앱으로 테스트)
npm start

# 캐시 클리어 후 시작 (라이브러리 버전 변경 후 필수)
npx expo start --clear

# 단위 테스트
npm test
```

**Expo Go 주의사항**
- `react-native-reanimated 4.1.1` + `react-native-worklets 0.5.1` 정확 고정 (Expo Go SDK 54 내장 버전)
- 버전 불일치 시: `TurboModule method "installTurboModule" called with 1 arguments (expected 0)` 에러
- **Android 위젯(WidgetModule)은 Expo Go에서 동작 안 함** — 릴리즈 APK로만 테스트 가능

---

## 3. USB 디버그 빌드 & 실행

> 위젯 등 커스텀 네이티브 모듈이 포함된 기능을 개발 중 테스트할 때 사용.
> 전제: 기기에서 **USB 디버깅** 활성화, PC에서 기기 신뢰(허용) 완료.

```powershell
# 기기 연결 확인
adb devices

# 디버그 APK 빌드 후 연결된 기기에 자동 설치 & 실행
npx expo run:android
```

> Metro 번들러와 함께 실행되어 JS 변경 시 즉시 반영됨.
> 순수 디버그 APK만 빌드하려면:

```powershell
cd android
.\gradlew assembleDebug
adb install -r app\build\outputs\apk\debug\app-debug.apk
```

---

## 4. 릴리즈 APK 빌드 & USB 설치

> JS/TS 소스만 변경했을 때는 prebuild 없이 바로 실행.

### 빌드

```powershell
npm run build:apk
```

결과물: 프로젝트 루트의 **`doro-v{버전}.apk`** (버전은 `app.json`에서 자동 읽음)

> 내부 동작 (`scripts/build-apk.ps1`):
> 1. `app.json`에서 버전 읽기
> 2. 모든 `.kt` 파일 `LastWriteTime` 갱신 (Windows 증분 빌드 감지 버그 방지)
> 3. `gradlew assembleRelease`
> 4. 루트에 `doro-v{버전}.apk` 복사

### USB 설치

```powershell
# 기기 인식 확인
adb devices

# 설치 (-r: 기존 앱 데이터 유지하며 덮어쓰기)
adb install -r doro-v1.2.4.apk
```

**`device unauthorized` 오류** → 기기 화면의 "USB 디버깅 허용" 팝업에서 허용 후 재시도.
팝업이 안 뜨면:

```powershell
adb kill-server
adb start-server
adb install -r doro-v{버전}.apk
```

---

## 5. EAS 클라우드 빌드 (월 한도 있음)

```bash
# APK (테스트용)
eas build --platform android --profile preview

# AAB (Play Store 배포용)
eas build --platform android --profile production
```

---

## 문제 해결

**`prebuild --clean` 실행 중 파일 잠금 오류** (`EBUSY: resource busy or locked`)
→ Gradle 데몬이 파일을 점유 중. Java 프로세스 종료 후 재시도:

```powershell
Get-Process -Name "java" -ErrorAction SilentlyContinue | Stop-Process -Force
npx expo prebuild --clean
```

**SDK 경로 오류** (`SDK location not found`)
→ `android/local.properties` 확인:

```
sdk.dir=C\:\\Users\\Lenovo\\AppData\\Local\\Android\\Sdk
```

**keytool 인식 안 됨**
→ 전체 경로로 실행:

```powershell
& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" ...
```

**ADB 드라이버 없음 (기기 인식 불가)**
→ Android Studio → SDK Manager → SDK Tools → **Google USB Driver** 설치
