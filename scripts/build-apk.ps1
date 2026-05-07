# 프로젝트 루트 기준으로 android 폴더에서 assembleRelease 실행 후
# 결과물을 루트에 doro.apk 로 복사한다.

$root = Split-Path $PSScriptRoot  # scripts/ 의 부모 = 프로젝트 루트

Push-Location "$root\android"
.\gradlew assembleRelease
$exitCode = $LASTEXITCODE
Pop-Location

if ($exitCode -eq 0) {
    $src = "$root\android\app\build\outputs\apk\release\app-release.apk"
    $dst = "$root\doro.apk"
    Copy-Item $src $dst -Force
    Write-Host ""
    Write-Host "APK 빌드 완료: doro.apk" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "빌드 실패 (exit code: $exitCode)" -ForegroundColor Red
    exit $exitCode
}
