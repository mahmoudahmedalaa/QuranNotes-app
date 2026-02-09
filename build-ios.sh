#!/bin/bash
# ============================================================
# iOS Build Script - Local Xcode (No EAS Required)
# ============================================================
# Usage: ./build-ios.sh
#
# This script builds a production IPA locally using Xcode.
# No EAS subscription needed. Unlimited builds. Free forever.
#
# Prerequisites:
#   - Mac with Xcode installed
#   - Apple Developer account ($99/year)
#   - Project has ios/ directory (run `npx expo prebuild` first)
#
# What it does:
#   1. Auto-increments build number in app.json
#   2. Cleans previous builds
#   3. Patches Expo/RN scripts for spaces in project path
#   4. Restores native iOS configurations (icon, signing)
#   5. Builds production archive
#   6. Exports IPA ready for TestFlight upload
# ============================================================

set -eo pipefail

# ---- Auto-detect project settings ----
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# Read scheme name from workspace
if [ -d "ios" ]; then
  WORKSPACE=$(find ios -name "*.xcworkspace" -maxdepth 1 | head -n 1)
  SCHEME=$(basename "$WORKSPACE" .xcworkspace)
else
  echo "❌ No ios/ directory found. Run: npx expo prebuild"
  exit 1
fi

ARCHIVE_PATH="./build/${SCHEME}.xcarchive"
EXPORT_PATH="./build"
EXPORT_OPTIONS="ios/ExportOptions.plist"

# Read Team ID: prefer env var > xcodeproj > eas.json
if [ -z "$TEAM_ID" ]; then
  TEAM_ID=$(grep -m 1 "DEVELOPMENT_TEAM" "ios/${SCHEME}.xcodeproj/project.pbxproj" 2>/dev/null | head -n 1 | sed 's/.*= *//;s/;.*//' | tr -d ' "' || echo "")
fi
if [ -z "$TEAM_ID" ] && [ -f "eas.json" ]; then
  TEAM_ID=$(grep -o '"appleTeamId": *"[^"]*"' eas.json | head -n 1 | sed 's/.*"appleTeamId": *"//;s/"//')
fi

if [ -z "$TEAM_ID" ]; then
  echo "⚠️  Could not auto-detect Team ID."
  echo "   Please set it: export TEAM_ID=YOUR_TEAM_ID"
  echo "   Find it at: https://developer.apple.com/account → Membership"
  exit 1
fi

# Read version info from app.json
APP_VERSION=$(python3 -c "import json; d=json.load(open('app.json')); print(d['expo']['version'])")
BUILD_NUMBER=$(python3 -c "import json; d=json.load(open('app.json')); print(d['expo']['ios']['buildNumber'])")

echo ""
echo "🚀 iOS Build"
echo "========================"
echo "  Project: $SCHEME"
echo "  Version: $APP_VERSION ($BUILD_NUMBER)"
echo "  Team:    $TEAM_ID"
echo ""

# ---- Step 1: Auto-increment build number ----
echo "🔢 Step 1/7: Incrementing build number..."
NEW_BUILD=$((BUILD_NUMBER + 1))
python3 << PYEOF
import json
with open('app.json', 'r') as f:
    data = json.load(f)
data['expo']['ios']['buildNumber'] = '$NEW_BUILD'
with open('app.json', 'w') as f:
    json.dump(data, f, indent=2)
PYEOF
echo "   Build number: $BUILD_NUMBER → $NEW_BUILD"
echo "   ✅ Incremented"

# ---- Step 2: Clean ----
echo "🧹 Step 2/7: Cleaning previous builds..."
rm -rf build/
mkdir -p build/
rm -rf ~/Library/Developer/Xcode/DerivedData/${SCHEME}-*
echo "   ✅ Clean"

# ---- Step 3: Patch scripts for spaces in path ----
echo "🔧 Step 3/7: Patching build scripts for path compatibility..."

# Patch EXConstants script (unquoted $PROJECT_DIR breaks on spaces)
EXCONST_SCRIPT="node_modules/expo-constants/scripts/get-app-config-ios.sh"
if [ -f "$EXCONST_SCRIPT" ]; then
  sed -i '' 's/PROJECT_DIR_BASENAME=$(basename $PROJECT_DIR)/PROJECT_DIR_BASENAME=$(basename "$PROJECT_DIR")/' "$EXCONST_SCRIPT" 2>/dev/null || true
fi

# Patch react-native-xcode.sh invocation (unquoted backtick breaks on spaces)
PBXPROJ="ios/${SCHEME}.xcodeproj/project.pbxproj"
if [ -f "$PBXPROJ" ]; then
  python3 << 'PYEOF'
import sys, os
scheme = os.environ.get("SCHEME", "")
pbxproj = f"ios/{scheme}.xcodeproj/project.pbxproj" if scheme else None
if not pbxproj:
    import glob
    matches = glob.glob("ios/*.xcodeproj/project.pbxproj")
    pbxproj = matches[0] if matches else None
if pbxproj and os.path.exists(pbxproj):
    with open(pbxproj, "r") as f:
        content = f.read()
    old = '`\\"$NODE_BINARY\\" --print \\"require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'\\"`'
    new = '. \\"$(\\"$NODE_BINARY\\" --print \\"require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'\\")\\"'
    if old in content:
        content = content.replace(old, new)
        with open(pbxproj, "w") as f:
            f.write(content)
PYEOF
fi

# Patch Pods project (EXConstants script path quoting)
PODS_PBXPROJ="ios/Pods/Pods.xcodeproj/project.pbxproj"
if [ -f "$PODS_PBXPROJ" ]; then
  sed -i '' 's|bash -l -c \\"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\"|bash -l -c \\"\\\\\\"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\\\\\"\\"|' "$PODS_PBXPROJ" 2>/dev/null || true
fi

echo "   ✅ Patched"

# ---- Step 4: Restore native configs ----
echo "📱 Step 4/7: Checking native configurations..."

# Restore app icon if assets/icon.png exists
ICON_SOURCE="assets/icon.png"
ICON_DEST="ios/${SCHEME}/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png"
if [ -f "$ICON_SOURCE" ] && [ -d "$(dirname "$ICON_DEST")" ]; then
  sips -s format png -z 1024 1024 "$ICON_SOURCE" --out "$ICON_DEST" > /dev/null 2>&1
  echo "   Updated app icon"
fi

# Ensure correct signing in pbxproj
sed -i '' "s/DEVELOPMENT_TEAM = [A-Z0-9]*/DEVELOPMENT_TEAM = $TEAM_ID/g" "$PBXPROJ" 2>/dev/null || true
echo "   Signing team: $TEAM_ID"

echo "   ✅ Configs checked"

# ---- Step 5: Force-write ExportOptions.plist ----
echo "📄 Step 5/7: Writing ExportOptions.plist..."
cat > "$EXPORT_OPTIONS" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store-connect</string>
    <key>teamID</key>
    <string>${TEAM_ID}</string>
    <key>uploadSymbols</key>
    <true/>
    <key>uploadBitcode</key>
    <false/>
    <key>signingStyle</key>
    <string>automatic</string>
</dict>
</plist>
PLIST
echo "   ✅ Ready (team: $TEAM_ID)"

# ---- Step 6: Build Archive ----
echo "🔨 Step 6/7: Building archive (5-10 minutes)..."
echo ""

xcodebuild archive \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -archivePath "$ARCHIVE_PATH" \
  -destination 'generic/platform=iOS' \
  -allowProvisioningUpdates \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  MARKETING_VERSION="$APP_VERSION" \
  CURRENT_PROJECT_VERSION="$NEW_BUILD" \
  -quiet

if [ ! -d "$ARCHIVE_PATH" ]; then
    echo "❌ Archive failed! Run without -quiet for details:"
    echo "   Remove '-quiet' from the xcodebuild command in this script"
    exit 1
fi
echo ""
echo "   ✅ Archive created"

# ---- Step 7: Export IPA ----
echo "📤 Step 7/7: Exporting IPA..."

xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS" \
  -allowProvisioningUpdates \
  -quiet

IPA_FILE="$EXPORT_PATH/${SCHEME}.ipa"
if [ ! -f "$IPA_FILE" ]; then
    echo "❌ Export failed!"
    exit 1
fi

echo "   ✅ IPA exported"
echo ""
echo "========================================"
echo "🎉 BUILD COMPLETE!"
echo "========================================"
echo ""
echo "📱 Version: $APP_VERSION ($NEW_BUILD)"
echo "📦 IPA:     $PROJECT_DIR/build/${SCHEME}.ipa"
echo ""
echo "📋 Next: Upload to TestFlight"
echo "   Drag build/${SCHEME}.ipa into Transporter app"
echo "   Or: Open Xcode → Window → Organizer → Distribute"
echo ""
