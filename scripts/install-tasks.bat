@echo off
echo ========================================
echo  Instalando Tarefas Agendadas
echo  Copa 2026 - Video DOOH + Drive Upload
echo ========================================
echo.

set "BASE=C:\Users\jefer\OneDrive\Documentos\EXA\CLIENTES\PAGINA COPA DO MUNDO\scripts"

echo [1/2] Criando tarefa para 07:00...
schtasks /Create /TN "Copa2026_Video_07h" /XML "%BASE%\task-07h.xml" /F
echo.

echo [2/2] Criando tarefa para 17:00...
schtasks /Create /TN "Copa2026_Video_17h" /XML "%BASE%\task-17h.xml" /F
echo.

echo ========================================
echo  Verificando tarefas...
echo ========================================
schtasks /Query /TN "Copa2026_Video_07h"
schtasks /Query /TN "Copa2026_Video_17h"
echo.
echo PRONTO! Videos serao gerados diariamente
echo as 07:00 e 17:00, mesmo se o PC estiver
echo dormindo (WakeToRun habilitado).
echo.
pause
