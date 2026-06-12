@echo off
echo ========================================
echo  Configurar Google Drive para Upload
echo  de Videos DOOH Copa 2026
echo ========================================
echo.
echo Vai abrir o navegador para autenticar.
echo Selecione sua conta Google e autorize.
echo.

rclone config create gdrive drive scope "drive.file" root_folder_id "1eQqBxXS9Cfg7hMLgRopEkwtfeCM0JscA"

echo.
echo ========================================
echo  Testando conexao...
echo ========================================
rclone lsd gdrive:

echo.
echo Se apareceu a pasta "Videos DOOH Copa 2026", funcionou!
echo.
pause
