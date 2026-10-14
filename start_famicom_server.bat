@echo off
rem -------------------------------------------------
rem Famicom‑Wars‑Clone 開発サーバー起動スクリプト
rem -------------------------------------------------
cd /d "%~dp0"
echo カレントディレクトリ → %CD%
node server.js
pause
