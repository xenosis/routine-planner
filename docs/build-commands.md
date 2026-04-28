# 빌드 및 개발 명령어 모음

## 개발

```powershell
# Metro 번들러 시작 (Expo Go 앱으로 테스트)
npm start

# 단위 테스트 실행
npm test
```

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

### APK 빌드 (매번)

```powershell
cd android
.\gradlew assembleRelease
```

결과물: `android/app/build/outputs/apk/release/app-release.apk`

### 문제 해결

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
