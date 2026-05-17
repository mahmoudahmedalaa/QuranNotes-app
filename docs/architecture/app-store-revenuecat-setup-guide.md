# App Store And RevenueCat Setup Guide

## Purpose

This guide is the manual dashboard checklist for the QuranNotes hard-paywall rollout.

Use it when you are ready to do the hands-on work in:

- App Store Connect
- RevenueCat

## What The Code Expects

QuranNotes is already wired to these payment assumptions:

- RevenueCat entitlement identifier: `pro_access`
- Paywalls fetch `offerings.current`
- The current offering should expose:
  - `monthly`
  - `annual`

Relevant code:

- [`RevenueCatService.ts`](/Users/mahmoudalaaeldin/Documents/Projects/VibeCoding/Projects/QuranApp-paywall-audit/src/features/payments/infrastructure/RevenueCatService.ts)
- [`PaywallScreen.tsx`](/Users/mahmoudalaaeldin/Documents/Projects/VibeCoding/Projects/QuranApp-paywall-audit/src/features/payments/presentation/PaywallScreen.tsx)
- [`RamadanPaywallScreen.tsx`](/Users/mahmoudalaaeldin/Documents/Projects/VibeCoding/Projects/QuranApp-paywall-audit/src/features/payments/presentation/RamadanPaywallScreen.tsx)
- [`premium.tsx`](/Users/mahmoudalaaeldin/Documents/Projects/VibeCoding/Projects/QuranApp-paywall-audit/app/onboarding/premium.tsx)

## App Store Connect

### 1. Confirm the subscription group

The monthly and annual subscriptions should live in the same auto-renewable subscription group.

Why:

- Apple handles upgrade/downgrade logic within a group
- introductory offer eligibility is enforced per subscription group

Reference:

- [Offer auto-renewable subscriptions](https://developer.apple.com/help/app-store-connect/manage-subscriptions/offer-auto-renewable-subscriptions/)
- [Set up introductory offers for auto-renewable subscriptions](https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-introductory-offers-for-auto-renewable-subscriptions)

### 2. Confirm the products

You should have at least:

- one monthly auto-renewable subscription
- one annual auto-renewable subscription

Use stable product identifiers and keep them aligned with whatever you import into RevenueCat.

### 3. Configure pricing

Set the standard monthly and annual prices in App Store Connect first.

Keep this aligned with the copy in the app. Right now the app UI assumes:

- monthly: `4.99`
- annual: `35.99`

If the store prices differ, update the app copy later so pricing presentation stays honest.

### 4. Configure the free trial / introductory offer

For the hard-paywall rollout, the intended store strategy is:

- new users see a hard paywall
- eligible users can receive a free trial

Important Apple rule:

- a customer can only redeem one introductory offer per subscription group

Apple also notes that introductory offers are configured in App Store Connect and can be free trial, pay up front, or pay as you go.

Reference:

- [Set up introductory offers for auto-renewable subscriptions](https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-introductory-offers-for-auto-renewable-subscriptions)
- [Implementing introductory offers in your app](https://developer.apple.com/documentation/storekit/implementing-introductory-offers-in-your-app)

### 5. Decide which product should carry the trial

This is a business decision, but most likely you will want the trial attached to the package you want to push hardest in the paywall, usually annual.

Do not assume both products should necessarily receive the same offer.

### 6. Wait for propagation

Apple notes that some metadata changes can take time to appear in sandbox.

Do not treat a just-saved offer as instantly testable.

## RevenueCat

### 1. Confirm or create the entitlement

The entitlement name must be exactly:

```text
pro_access
```

That identifier is hardcoded in the app’s access check.

Reference:

- [Entitlements](https://www.revenuecat.com/docs/getting-started/entitlements)

### 2. Import the App Store products

After the products exist in App Store Connect, import them into RevenueCat.

Reference:

- [Product Configuration](https://www.revenuecat.com/docs/offerings/products-overview)
- [iOS Product Setup](https://www.revenuecat.com/docs/getting-started/entitlements/ios-products)

### 3. Attach both products to `pro_access`

Both the monthly and annual subscriptions should unlock the same `pro_access` entitlement unless you intentionally introduce tiers later.

### 4. Confirm the offering structure

Create or update the offering that should be shown in the app and make sure it is the default/current offering.

The app reads:

```text
offerings.current
```

Reference:

- [Offerings overview](https://www.revenuecat.com/docs/offerings/overview)

### 5. Confirm package identifiers

Within the current offering, configure package slots so the app can resolve:

- `monthly`
- `annual`

If those package slots are missing, the current paywall UI will fail to find the expected product.

### 6. Trial behavior

RevenueCat will surface store-configured introductory offers through the package/product information. The actual free trial still originates from store configuration.

Reference:

- [Free Trials & Promo Offers](https://www.revenuecat.com/docs/subscription-guidance/subscription-offers)

### 7. Test restore behavior

The app exposes restore flows in:

- onboarding premium screen
- modal paywall
- Ramadan paywall
- settings

Make sure restores grant `pro_access` correctly before any hard-paywall activation.

## When To Do This

Do the App Store Connect and RevenueCat setup after:

1. the rollout code is in a released build
2. Firebase rollout config is still `enabled=false`
3. grandfather docs are already written for the existing user base

That order keeps configuration work separate from the moment access behavior actually changes.

## After Manual Setup

Once the store/dashboards are ready:

1. test sandbox purchases
2. test restore purchases
3. confirm `offerings.current.monthly` and `offerings.current.annual` resolve
4. confirm `pro_access` activates after purchase
5. confirm telemetry starts appearing in Firebase reports
6. only then consider enabling `config/paywallRollout.enabled=true`
