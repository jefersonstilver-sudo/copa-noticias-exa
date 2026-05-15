@echo off
echo ========================================
echo  Configurando Tarefas Agendadas
echo  Copa 2026 - Video DOOH Automatico
echo ========================================
echo.

set SCRIPT_PATH="C:\Users\jefer\OneDrive\Documentos\EXA\CLIENTES\PAGINA COPA DO MUNDO\scripts\gerar-video.bat"

echo [1/2] Criando tarefa para 07:00...
schtasks /Create /TN "Copa2026_Video_07h" /TR %SCRIPT_PATH% /SC DAILY /ST 07:00 /F
echo.

echo [2/2] Criando tarefa para 17:00...
schtasks /Create /TN "Copa2026_Video_17h" /TR %SCRIPT_PATH% /SC DAILY /ST 17:00 /F
echo.

echo ========================================
echo  Tarefas criadas com sucesso!
echo  - Copa2026_Video_07h (todos os dias as 07:00)
echo  - Copa2026_Video_17h (todos os dias as 17:00)
echo ========================================
echo.
echo Para verificar: schtasks /Query /TN "Copa2026_Video_07h"
echo Para remover:   schtasks /Delete /TN "Copa2026_Video_07h" /F
echo.
pause
