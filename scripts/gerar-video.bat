@echo off
echo ========================================
echo  Central Copa 2026 - Video DOOH + Drive
echo ========================================
cd /d "C:\Users\jefer\OneDrive\Documentos\EXA\CLIENTES\PAGINA COPA DO MUNDO"
node scripts\generate-video.mjs
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha ao gerar video!
    exit /b 1
)
echo [OK] Video gerado e enviado ao Google Drive!
timeout /t 3
