@echo off
echo ========================================================
echo   IdiomasTV - Compilador de APK para Android TV
echo ========================================================
echo.

cd idiomastv-app

echo [1/3] Sincronizando arquivos da interface Web...
call npx cordova prepare android

echo [2/3] Compilando o APK para Android TV...
call npx cordova build android

echo.
echo ========================================================
echo   Se a compilacao for concluida, o arquivo .apk estara em:
echo   c:\Users\willi\Downloads\app tv\idiomastv-app\platforms\android\app\build\outputs\apk\debug\app-debug.apk
echo ========================================================
pause
