#!/bin/bash

# All-in-One Dashboard - Setup & Run Script

echo "======================================"
echo "All-in-One Dashboard"
echo "Your centralized tracking hub"
echo "======================================"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo "✅ Dependencies installed!"
else
    echo "✅ Dependencies already installed"
fi

echo ""
echo "🚀 Starting development server..."
echo ""
echo "📍 Your app will be available at: http://localhost:3000"
echo ""
echo "Dashboard Features:"
echo "  📊 Dashboard        - http://localhost:3000"
echo "  💎 Gold & Silver    - http://localhost:3000/prices"
echo "  📈 PSX Stocks       - http://localhost:3000/stocks"
echo "  ⭐ Watchlist        - http://localhost:3000/watchlist"
echo "  ⚙️  Settings         - http://localhost:3000/settings"
echo ""
echo "Press Ctrl+C to stop the server"
echo "======================================"
echo ""

npm run dev
