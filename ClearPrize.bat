@echo off
title Diwali Prize - Clear All Winners

echo ==========================================
echo     DIWALI PRIZE - CLEAR ALL WINNERS
echo ==========================================
echo.
echo WARNING: dbo.PrizeWinner ka sara data delete hoga.
echo EmployeeMaster ka data safe rahega.
echo.

choice /C YN /M "Kya aap DELETE karna chahte hain"

if errorlevel 2 (
    echo.
    echo Cancelled.
    pause
    exit /b
)

echo.
echo FINAL CONFIRMATION
echo.

choice /C YN /M "FINAL DELETE confirm karein"

if errorlevel 2 (
    echo.
    echo Cancelled.
    pause
    exit /b
)

echo.
echo Deleting PrizeWinner records...
echo.

sqlcmd -S localhost -d DiwaliPrizeDB -E -Q "DELETE FROM dbo.PrizeWinner; SELECT @@ROWCOUNT AS DeletedRows;"

if errorlevel 1 (
    echo.
    echo ==========================================
    echo ERROR: Delete nahi hua.
    echo ==========================================
    echo.
    echo Check karein ki SQLCMD installed hai.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo SUCCESS: Saare prize records delete ho gaye.
echo EmployeeMaster safe hai.
echo ==========================================
echo.

pause
