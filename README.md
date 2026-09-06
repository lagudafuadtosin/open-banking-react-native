# Open banking mobile app, React Native and TrueLayer

The code from my MSc dissertation at the University of Stirling: *Design and Development of a Fintech Mobile Application Using React Native and TrueLayer Open Banking APIs*, MSc Financial Technology, September 2025. The dissertation itself is in `docs/dissertation.pdf`.

The question the project set out to answer was simple. Open Banking, through PSD2 and platforms like TrueLayer, promises that a developer can integrate one API and reach every bank. Is that what building an app on it is actually like? The answer, in short: the integration works and the numbers are good, but the gap between the regulatory promise and the development reality is real, and the literature does not cover it.

## What the app does

A React Native 0.72 app that connects to several banks through TrueLayer's sandbox and shows them in one place.

- Sign in with Firebase Authentication, with biometric verification on the device.
- Connect bank accounts through TrueLayer's OAuth flow, with deep linking back into the app.
- One dashboard for all accounts, balances and transaction history.
- Spending categories with charts, and an AI powered categorisation of transactions that uses a hybrid approach: a keyword pass first, then Google Gemini for what the keywords cannot place, with caching so the same description is never sent twice and rate limiting so the API is not hammered.
- Payments through TrueLayer, which pivoted to a WebView flow after the native SDK could not be made to build against this React Native version. That pivot is one of the findings.
- Encrypted local storage for anything sensitive, secure key storage on the device, and an offline cache with a sync service so the app works between connections.

All sixteen objectives set at the start were achieved. The table is in section 4.3 of the dissertation.

## What the evaluation found

- 99% API connection success rate against the TrueLayer sandbox.
- Authentication in under two seconds.
- Hands-on usability testing following Nielsen's method. The consolidated view was the thing users valued, and the findings shaped the dashboard.
- The costs the theory hides: SDK compatibility, build configuration on Android, deep linking, and the time an Open Banking integration really takes before a line of product code is written. Section 5.4 sets these out for anyone about to start a similar build.

## Where things are

```
src/
  screens/       fifteen screens: splash, login, register, connect bank, bank auth, dashboard,
                 transactions, categories, analytics, payments, profile
  services/      trueLayerService, syncService, cacheService, aiService (categorisation),
                 encryptionService, secureStorage, biometricService, firebaseService
  components/    charts, category picker, recategorise modal
  context/       auth
  hooks/         session timeout
  navigation/
docs/            the dissertation
```

## Running it

You need the React Native 0.72 toolchain, a TrueLayer sandbox client, and a Firebase project.

```bash
npm install
cp .env.example .env     # fill in your own TrueLayer, Firebase and Gemini values
npm start
npm run android          # or npm run ios
```

No keys ship with this repository. `.env` is ignored and `android/app/google-services.json` has to come from your own Firebase project.

## Licence

MIT. Copyright 2025 Fuad Oluwatosin Laguda.
