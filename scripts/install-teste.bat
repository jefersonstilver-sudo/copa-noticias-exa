@echo off
echo ========================================
echo  TESTE UNICO - Video as 10:54
echo ========================================
echo.

set "BASE=C:\Users\jefer\OneDrive\Documentos\EXA\CLIENTES\PAGINA COPA DO MUNDO\scripts"

schtasks /Create /TN "Copa2026_TESTE_1054" /XML "%BASE%\task-teste.xml" /F

echo.
schtasks /Query /TN "Copa2026_TESTE_1054" /V /FO LIST | findstr /i "proxima Status"
echo.
echo Tarefa unica criada para 10:54. Sera removida apos execucao.
pause
