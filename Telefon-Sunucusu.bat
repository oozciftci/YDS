@echo off
rem Telefonun kaynak paketini indirebilmesi için bilgisayardaki sunucuyu başlatır (npm run telefon).
rem Çift tıkla; pencere açık kaldığı sürece telefon bağlanabilir. Kapatınca sunucu durur.
chcp 65001 >nul
cd /d "%~dp0"
title YDS - Telefon sunucusu
echo.
echo  YDS telefon sunucusu baslatiliyor...
echo  Asagida "Telefondan" satirindaki adresi telefonun Safari'sinde ac.
echo  Bu pencereyi isin bitene kadar KAPATMA.
echo.
call npm run telefon
echo.
echo  Sunucu durdu.
pause
