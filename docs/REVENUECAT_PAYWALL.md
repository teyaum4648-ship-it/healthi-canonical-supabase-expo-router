# Daywoven membership screen

The app routes `/paywall` and `/(app)/subscription` share the native `MembershipPaywall` component. It uses the app’s charcoal header, bone controls, Jost/Inter typography, foundation colours, and light canvas. Intended store pricing is $39.99/year or $6.99/month; configure these prices in RevenueCat and the linked store products. The app displays the store-returned prices.

`MembershipScreen` loads the current RevenueCat offering, keeps its package order, and passes the selected package to the existing `buySubscription` function. Prices and billing periods come from store product data. Yearly savings appear only when a cheaper annual plan and a same-currency monthly plan are both present. No price or free trial is assumed.

Purchases and restores still require the existing server membership check before access is granted. Restore remains available if the SDK connects but fetching the offering fails. Failed loads can be retried, and an immediate action lock prevents repeated purchase/restore taps.

Use the existing iOS configuration described in `docs/SUBSCRIPTION_ACTIVATION.md`: the public RevenueCat iOS SDK key, entitlement identifier, subscription launch toggle, current offering, and server verification setup. This change adds no native dependency and does not enable billing or change backend configuration.

Validate checkout on a signed iOS development/TestFlight build using the sandbox store, with the actual offering and entitlement. Check a successful purchase, cancellation, restore, and delayed server verification. Browser previews validate layout and UI interactions only; their sample prices are not production pricing.

Validation commands:

```sh
npm run typecheck
npm run test -- tests/features/subscriptions tests/styles/daywoven1c.contrast.test.ts --maxWorkers=2
```

References: [RevenueCat offerings](https://www.revenuecat.com/docs/getting-started/displaying-products), [restoring purchases](https://www.revenuecat.com/docs/getting-started/restoring-purchases), and the app’s existing subscription activation guide.
