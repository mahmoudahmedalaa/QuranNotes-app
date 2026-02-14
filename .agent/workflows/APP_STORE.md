# App Store Submission Checklist — QuranNotes

> Complete step-by-step guide for App Store submission. Every item exists because something went wrong without it.

## Pre-Submission: Asset Creation

### App Icon
| Spec | Requirement |
|:-----|:------------|
| **Size** | 1024×1024px |
| **Format** | PNG (no alpha/transparency) |
| **Corners** | Square — Apple rounds them automatically |
| **Content** | No text, recognizable at 29px, no photos |

### Screenshots (iOS)

| Device | Resolution | Required |
|:-------|:-----------|:---------|
| iPhone 6.7" (15 Pro Max) | 1290 × 2796px | ✅ Yes |
| iPhone 6.5" (11 Pro Max) | 1242 × 2688px | ✅ Yes |
| iPhone 5.5" (8 Plus) | 1242 × 2208px | Optional |
| iPad Pro 12.9" (6th gen) | 2048 × 2732px | If universal |

**Rules**:
- Minimum 3, maximum 10 per device size
- Show real app content (no placeholders)
- Can add marketing text overlays
- First screenshot = most important (shown in search)

---

## Submission Process (Step by Step)

### Step 1: Build
```bash
# Local Xcode build (recommended for QuranNotes)
./build-ios.sh

# OR prebuild + Xcode manual
npx expo prebuild --clean
# Open ios/QuranNotes.xcworkspace → Product → Archive
```

### Step 2: App Store Connect Setup
1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Click **My Apps** → **+** → **New App**
3. Fill in:
   - Platform: iOS
   - Name: QuranNotes
   - Bundle ID: must match `com.qurannotes.app`
   - SKU: `qurannotes-ios-v1`

### Step 3: App Information
- [ ] **Category**: Education (primary) + Lifestyle (secondary)
- [ ] **Content Rights**: Yes — Quran text (public domain)
- [ ] **Age Rating**: Complete the questionnaire

### Step 4: Pricing & Agreements
- [ ] Set price tier: Free (with IAP)
- [ ] **CRITICAL**: Sign the **Paid Applications Agreement** — requires bank info, tax forms, 1-3 days to process

---

## ⚠️ In-App Purchase / Subscription Setup

> Apple will **reject** if IAPs are referenced in-app but not created in App Store Connect.

### Step 5A: Create Subscription Group
1. App Store Connect → Your App → **MONETIZATION → Subscriptions** (NOT "In-App Purchases")
2. Click **"+"** → Create **Subscription Group** → Name: `Pro Access`

### Step 5B: Create Individual Subscriptions

| Field | Monthly | Annual |
|:------|:--------|:-------|
| **Reference Name** | Pro Monthly | Pro Annual |
| **Product ID** | `qurannotes_monthly` | `qurannotes_annual` |
| **Duration** | 1 Month | 1 Year |
| **Price** | $4.99 | $35.99 |

For each subscription:
1. **Subscription Prices**: Click "+" → select base country → set price
2. **Localization**: Add English — Display Name + Description
3. **Review Information**: Screenshot of paywall + review notes

### Step 5C: ⚠️ Subscription GROUP Localization (EASY TO MISS!)
1. Go back to the **Subscription Group** page
2. Scroll to **"Localization"** at bottom → Click **"Create"**
3. Fill: Language, Group Display Name, App Name
4. Both subscriptions should show: **"Ready to Submit"** ✅

### Step 5D: Verify Product IDs
```
RevenueCat Dashboard → Products → Product Identifier
  ↕ Must match ↕
App Store Connect → Subscriptions → Product ID
```

---

## ⚠️ Legal Metadata

### Step 6A: In-App Requirements
Your paywall MUST display:
- [ ] Subscription title, length, and price
- [ ] Auto-renewal disclosure
- [ ] Management instructions ("Settings → Apple ID → Subscriptions")
- [ ] Functional **Privacy Policy** link
- [ ] Functional **Terms of Use** link
- [ ] **Restore Purchases** button

### Step 6B: App Store Connect Metadata
1. **Privacy Policy URL** in App Information
2. **Custom EULA**: App Information → License Agreement → Edit → Custom
3. **Description** must include at bottom:
   ```
   SUBSCRIPTION INFORMATION:
   • QuranNotes Pro is available as a monthly ($4.99/month) or annual ($35.99/year) subscription
   • Payment will be charged to your Apple ID account
   • Subscription automatically renews unless cancelled at least 24 hours before the end of the current period
   • Manage subscriptions in Settings → Apple ID → Subscriptions

   Privacy Policy: [URL]
   Terms of Use: [URL]
   ```

### Step 6C: Legal pages must be:
- [ ] Publicly accessible (no auth required)
- [ ] HTTPS
- [ ] Not returning 404

---

### Step 7: Prepare App Version
- [ ] **Description**: 4000 char max, include subscription info
- [ ] **Keywords**: 100 char max, comma-separated
- [ ] **What's New**: Brief changelog
- [ ] **Support URL**: Live and accessible
- [ ] **Privacy Policy URL**: Live and accessible
- [ ] Upload screenshots + app icon

### Step 8: App Privacy
Declare QuranNotes data collection:
- Email (app functionality, linked to identity)
- Name (app functionality, linked to identity)
- Audio recordings (app functionality, not linked to identity)
- Usage data (analytics, not linked to identity)

### Step 9: Upload Build
```bash
# Via Xcode Organizer
Xcode → Window → Organizer → Select archive → Distribute App → App Store Connect → Upload
```

### Step 10: ⚠️ Attach IAP Products to Submission
1. App Store Connect → Your App → App Store → Your Version
2. Scroll to **"In-App Purchases and Subscriptions"**
3. Click **"+"** → select ALL products
4. Each must show: **"Ready to Submit"**

### Step 11: Review Notes
- [ ] Provide demo credentials if login required
- [ ] Note audio features require physical device
- [ ] Note auto-renewable subscriptions
- [ ] Contact phone + email

### Step 12: Submit for Review
Click **Submit for Review**. Typical: 24-48 hours.

---

## Common Rejection Reasons

| Reason | Fix |
|:-------|:----|
| IAP not submitted | Create + attach IAP products (Step 5 + 10) |
| Missing Terms of Use | Add EULA in App Information (Step 6B) |
| Missing subscription info | Add renewal terms to paywall + description |
| Missing Delete Account | Build in Settings |
| Placeholder content | Search for TODO/Lorem/test data |
| Broken privacy policy | Host on public HTTPS URL |
| Crash on launch | Test clean install from production build |
| Bundle ID mismatch | Verify `app.json` matches App Store Connect |
| Build number reused | Increment `CFBundleVersion` |

---

## Pre-Submit Final Checklist

### Code & Build
- [ ] `tsc --noEmit` passes
- [ ] No `console.log` without `__DEV__` guards
- [ ] Debug tools stripped
- [ ] Production environment variables set
- [ ] Build number incremented
- [ ] Tested on real device from archive build

### App Store Connect
- [ ] Privacy Policy URL set and accessible
- [ ] EULA/Terms of Use set
- [ ] Category + age rating done
- [ ] App Privacy section completed
- [ ] All IAP products created + "Ready to Submit"
- [ ] Product IDs match RevenueCat
- [ ] Products attached to version
- [ ] Paid Applications Agreement signed
- [ ] Screenshots uploaded for all sizes
- [ ] Build uploaded and selected
- [ ] Review notes provided
