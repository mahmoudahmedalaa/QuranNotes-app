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
#   1. Cleans previous builds
#   2. Patches Expo/RN scripts for spaces in project path
#   3. Restores native iOS configurations
#   4. Builds production archive
#   5. Exports IPA ready for TestFlight upload
# ============================================================

set -eo pipefail

# ---- Auto-detect project settings ----
# These are auto-detected from your project files
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

# Read Team ID from xcodeproj
TEAM_ID=$(grep -m 1 "DEVELOPMENT_TEAM" "ios/${SCHEME}.xcodeproj/project.pbxproj" 2>/dev/null | head -n 1 | sed 's/.*= *//;s/;.*//' | tr -d ' "' || echo "")

if [ -z "$TEAM_ID" ]; then
  echo "⚠️  Could not auto-detect Team ID."
  echo "   Please set it: export TEAM_ID=YOUR_TEAM_ID"
  echo "   Find it at: https://developer.apple.com/account → Membership"
  exit 1
fi

echo ""
echo "🚀 iOS Build"
echo "========================"
echo "  Project: $SCHEME"
echo "  Team:    $TEAM_ID"
echo ""

# ---- Step 1: Clean ----
echo "🧹 Step 1/6: Cleaning previous builds..."
rm -rf build/
mkdir -p build/
rm -rf ~/Library/Developer/Xcode/DerivedData/${SCHEME}-*
echo "   ✅ Clean"

# ---- Step 2: Patch scripts for spaces in path ----
echo "🔧 Step 2/6: Patching build scripts for path compatibility..."

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
    # Fallback: find the first .xcodeproj
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

# ---- Step 3: Restore native configs ----
echo "📱 Step 3/6: Checking native configurations..."

# Restore app icon if assets/icon.png exists
ICON_SOURCE="assets/icon.png"
ICON_DEST="ios/${SCHEME}/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png"
if [ -f "$ICON_SOURCE" ] && [ -d "$(dirname "$ICON_DEST")" ]; then
  sips -s format png -z 1024 1024 "$ICON_SOURCE" --out "$ICON_DEST" > /dev/null 2>&1
  echo "   Updated app icon"
fi

echo "   ✅ Configs checked"

# ---- Step 4: Ensure ExportOptions.plist exists ----
echo "📄 Step 4/6: Checking ExportOptions.plist..."
if [ ! -f "$EXPORT_OPTIONS" ]; then
  cat > "$EXPORT_OPTIONS" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store</string>
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
  echo "   Created ExportOptions.plist"
fi
echo "   ✅ Ready"

# ---- Step 5: Build Archive ----
echo "🔨 Step 5/6: Building archive (5-10 minutes)..."
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
  -quiet

if [ ! -d "$ARCHIVE_PATH" ]; then
    echo "❌ Archive failed! Run without -quiet for details:"
    echo "   Remove '-quiet' from the xcodebuild command in this script"
    exit 1
fi
echo ""
echo "   ✅ Archive created"

# ---- Step 6: Export IPA ----
echo "📤 Step 6/6: Exporting IPA..."

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
echo "📱 IPA: $PROJECT_DIR/build/${SCHEME}.ipa"
echo ""
echo "📋 Next: Upload to TestFlight"
echo "   Open Xcode → Window → Organizer → Distribute"
echo ""
