@echo off
echo ========================================
echo  Central Copa 2026 - Gerando Video DOOH
echo ========================================
cd /d "C:\Users\jefer\OneDrive\Documentos\EXA\CLIENTES\PAGINA COPA DO MUNDO"
node scripts\generate-video.mjs
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha ao gerar video!
    pause
    exit /b 1
)
echo [OK] Video gerado com sucesso!
timeout /t 3
