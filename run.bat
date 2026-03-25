@echo off
REM All-in-One Dashboard - Setup & Run Script for Windows

echo.
echo ======================================
echo All-in-One Dashboard
echo Your centralized tracking hub
echo ======================================
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    call npm install
    echo ✅ Dependencies installed!
) else (
    echo ✅ Dependencies already installed
)

echo.
echo 🚀 Starting development server...
echo.
echo 📍 Your app will be available at: http://localhost:3000
echo.
echo Dashboard Features:
echo   📊 Dashboard        - http://localhost:3000
echo   💎 Gold 
 Silver    - http://localhost:3000/prices
echo   📈 PSX Stocks       - http://localhost:3000/stocks
echo   ⭐ Watchlist        - http://localhost:3000/watchlist
echo   ⚙️ Settings         - http://localhost:3000/settings
echo.
echo Press Ctrl+C to stop the server
echo ======================================
echo.

call npm run dev
