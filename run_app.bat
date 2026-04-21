@echo off
chcp 65001 >nul
echo  启动OpenAvatarChat LiteAvatar服务...

set "PYTHON=%CD%\.glut\python.exe"
set "CU_PATH=%CD%\.glut\Lib\site-packages\torch\lib"
set "SC_PATH=%CD%\.glut\Scripts"
set "GIT_PATH=%CD%\.glut\git\cmd"
set "FFMPEG_PATH=%CD%\.glut\ffmpeg\bin"
set "PATH=%CU_PATH%;%SC_PATH%;%GIT_PATH%;%FFMPEG_PATH%;%PATH%"
set "HF_ENDPOINT=https://hf-mirror.com"
set "HF_HOME=%CD%\models"
set "TORCH_HOME=%CD%\models"
set "MODELSCOPE_CACHE=%CD%"

%PYTHON% app.py

pause