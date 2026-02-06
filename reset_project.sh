#!/bin/bash
echo "🛑 Killing all Node/Expo processes..."
pkill -f node
pkill -f expo

echo "🧹 Clearing Metro Cache..."
rm -rf .expo
rm -rf web-build

echo "📦 Re-verifying dependencies..."
npm install

echo "✅ Ready. Starting Fresh Server..."
echo "📱 To test on mobile:"
echo "   1. Download 'Expo Go' from App Store"
echo "   2. Scan the QR code below"
npx expo start --clear
