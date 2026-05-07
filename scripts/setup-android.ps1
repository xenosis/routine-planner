# prebuild --clean 후 android/ 설정 복구 스크립트

# 1. local.properties 생성
Set-Content -Path "android\local.properties" -Value "sdk.dir=C\:\\Users\\Lenovo\\AppData\\Local\\Android\\Sdk" -Encoding utf8
Write-Host "local.properties 생성 완료"

# 2. keystore.properties 읽기
$props = @{}
Get-Content "keystore.properties" | ForEach-Object {
    if ($_ -match "^(.+?)=(.+)$") {
        $props[$matches[1]] = $matches[2]
    }
}

# 3. build.gradle에 서명 설정 추가
$gradlePath = "android\app\build.gradle"
$gradle = Get-Content $gradlePath -Raw

$signingConfig = @"
        release {
            storeFile file("$($props['storeFile'])")
            storePassword '$($props['storePassword'])'
            keyAlias '$($props['keyAlias'])'
            keyPassword '$($props['keyPassword'])'
        }
"@

# signingConfigs 블록에 release 추가
$gradle = $gradle -replace "(signingConfigs \{[\s\S]*?)(    \}[\s\S]*?buildTypes)", "`$1$signingConfig`n    `$2"

# buildTypes.release의 signingConfig를 debug → release로 교체
$gradle = $gradle -replace "(buildTypes \{[\s\S]*?release \{[\s\S]*?signingConfig signingConfigs\.)debug", "`${1}release"

Set-Content -Path $gradlePath -Value $gradle -Encoding utf8 -NoNewline
Write-Host "build.gradle 서명 설정 완료"

# 4. AndroidManifest에 usesCleartextTraffic 추가 (Kakao 지도 타일 HTTP 허용)
$manifestPath = "android\app\src\main\AndroidManifest.xml"
$manifest = Get-Content $manifestPath -Raw
if ($manifest -notmatch 'usesCleartextTraffic') {
    $manifest = $manifest -replace '(android:enableOnBackInvokedCallback="false")', '$1 android:usesCleartextTraffic="true"'
    Set-Content -Path $manifestPath -Value $manifest -Encoding utf8 -NoNewline
    Write-Host "AndroidManifest usesCleartextTraffic 추가 완료"
} else {
    Write-Host "AndroidManifest usesCleartextTraffic 이미 설정됨"
}

Write-Host ""
Write-Host "설정 완료. 이제 빌드하세요:"
Write-Host "  npm run build:apk"
