# 프로젝트 루트 기준으로 android 폴더에서 assembleRelease 실행 후
# 결과물을 루트에 doro-v{version}.apk 로 복사한다.

$root = Split-Path $PSScriptRoot  # scripts/ 의 부모 = 프로젝트 루트

# app.json에서 버전 읽기
$appJson = Get-Content "$root\app.json" -Raw | ConvertFrom-Json
$version = $appJson.expo.version
$apkName = "doro-v$version.apk"

# Gradle 증분 빌드가 Windows에서 파일 변경을 못 잡는 경우를 방지:
# Kotlin 소스 파일 타임스탬프를 현재 시각으로 갱신
$ktFiles = Get-ChildItem "$root\android\app\src\main\java" -Recurse -Filter "*.kt"
$now = Get-Date
foreach ($f in $ktFiles) { $f.LastWriteTime = $now }

Push-Location "$root\android"
.\gradlew assembleRelease
$exitCode = $LASTEXITCODE
Pop-Location

if ($exitCode -eq 0) {
    $src = "$root\android\app\build\outputs\apk\release\app-release.apk"
    $dst = "$root\$apkName"
    Copy-Item $src $dst -Force
    (Get-Item $dst).LastWriteTime = Get-Date
    Write-Host ""
    Write-Host "APK 빌드 완료: $apkName" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "빌드 실패 (exit code: $exitCode)" -ForegroundColor Red
    exit $exitCode
}
