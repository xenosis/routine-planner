# 빌드 및 개발 명령어 모음

## 개발

```powershell
# Metro 번들러 시작 (Expo Go 앱으로 테스트)
npm start

# Metro 캐시 클리어 후 시작 (라이브러리 버전 변경 후 필수)
npx expo start --clear

# 단위 테스트 실행
npm test
```

### Expo Go 호환성 주의사항
- **Expo Go SDK 54 내장 버전**: `react-native-reanimated ~4.1.1` + `react-native-worklets 0.5.1`
- 프로젝트도 동일 버전 사용 (`reanimated 4.1.1`, `worklets 0.5.1` 정확 고정)
- 버전 불일치 시: `TurboModule method "installTurboModule" called with 1 arguments (expected 0)` 에러
- **Android 위젯(WidgetModule)은 Expo Go에서 동작 안 함** — 릴리즈 APK로만 테스트 가능
- 커스텀 native module이 필요한 기능 개발 시: `expo run:android` (USB/무선 ADB 연결 필요)

---

## 로컬 APK 빌드 (Windows)

> EAS 클라우드 빌드 대신 PC에서 직접 빌드. 월 한도 없음.
> 전제: Android Studio 설치, `android/local.properties` 에 SDK 경로 설정 완료.

### 최초 1회 세팅

**1. android/ 폴더 생성**
```powershell
npx expo prebuild --platform android --clean
```
> `--clean`은 기존 android/ 폴더를 지우고 새로 생성. 처음에만 필요, 이후엔 생략 가능.

**2. keystore 생성** (APK 서명용 — 최초 1회만)
```powershell
& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkey -v -keystore android/app/release.keystore -alias doro -keyalg RSA -keysize 2048 -validity 10000
```
> 비밀번호 직접 설정. 마지막 확인 질문에 영문 `y` 입력.
> **생성된 `release.keystore` 파일은 절대 분실 금지 + git에 올리지 말 것.**

**3. build.gradle 서명 설정** (`android/app/build.gradle`)
```groovy
android {
    ...
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

**4. android/ 설정 복구** (prebuild --clean 후 항상 실행)
```powershell
powershell -File scripts/setup-android.ps1
```
> `local.properties` + `build.gradle` 서명 설정을 자동으로 복구.
> `keystore.properties`(프로젝트 루트)에서 비밀번호/alias를 읽어 적용.

### APK 빌드 (매번)

> JS/TS 소스코드만 변경했을 때는 prebuild 없이 바로 이 명령만 실행.

```powershell
npm run build:apk
```

결과물: 프로젝트 루트의 **`doro-v{버전}.apk`** (버전은 `app.json`에서 자동 읽음)

> 내부적으로 `scripts/build-apk.ps1` 실행:
> 1. `app.json`에서 버전 읽기
> 2. 모든 `.kt` 파일 `LastWriteTime` 갱신 (Gradle 강제 재컴파일 — Windows에서 증분 빌드가 변경을 감지 못하는 버그 방지)
> 3. `android/gradlew assembleRelease`
> 4. 루트에 `doro-v{버전}.apk` 복사

### USB 기기에 APK 설치

> 빌드 후 USB로 연결된 실제 기기에 직접 설치.
> 전제: 기기에서 **USB 디버깅** 활성화, PC에서 기기를 신뢰함(허용) 처리 완료.

```powershell
# 기기 인식 확인
adb devices

# APK 설치 (-r: 기존 앱 데이터 유지하며 덮어쓰기)
adb install -r doro-v1.2.3.apk
```

**`device unauthorized` 오류** → 기기 화면의 "USB 디버깅 허용" 팝업에서 허용 후 재시도.
허용 팝업이 안 뜨면:
```powershell
adb kill-server
adb start-server
adb install -r doro-v{버전}.apk
```

---

### 문제 해결

**`prebuild --clean` 실행 중 파일 잠금 오류** (`EBUSY: resource busy or locked`)
→ Gradle 데몬이 빌드 후에도 백그라운드에서 살아있어 파일을 점유. Java 프로세스 종료 후 재시도:
```powershell
Get-Process -Name "java" -ErrorAction SilentlyContinue | Stop-Process -Force
npx expo prebuild --clean
```
> `prebuild --clean`은 네이티브 모듈 추가/변경 시에만 필요. 일반 빌드(`.\gradlew assembleRelease`)에서는 발생하지 않음.

**SDK 경로 오류** (`SDK location not found`)
→ `android/local.properties` 파일 확인:
```
sdk.dir=C\:\\Users\\Lenovo\\AppData\\Local\\Android\\Sdk
```

**keytool 인식 안 됨**
→ `keytool` 대신 전체 경로로 실행:
```powershell
& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" ...
```

---

## EAS 클라우드 빌드 (월 한도 있음)

```bash
# APK (테스트용)
eas build --platform android --profile preview

# AAB (Play Store 배포용)
eas build --platform android --profile production
```
