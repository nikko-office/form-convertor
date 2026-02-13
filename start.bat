@echo off
title MasterPiece Mini
cd /d "%~dp0"
npx tsx src/cli/index.ts serve
pause
