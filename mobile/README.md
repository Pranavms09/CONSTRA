# CONSTRA Site (Flutter)

Site-supervisor app: capture construction photos with a live GPS tag burned into the image, hash them on the phone, upload to the `constra-api` Worker, and follow each photo's anchor on MST Blockchain.

## Run

```bash
flutter pub get
# Emulator against local `wrangler dev --port 8788`:
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8788 --dart-define=WEB_APP_URL=http://localhost:5173
# Release APK against production:
flutter build apk --release --dart-define=WC_PROJECT_ID=<reown project id>
flutter test
```

| `--dart-define` | Default | Purpose |
|---|---|---|
| `API_BASE_URL` | `https://constra-api.pranavms09.workers.dev` | Worker API (also editable on the login screen) |
| `WEB_APP_URL` | `https://constra.pranavms09.workers.dev` | Web app: `/wallet-pair` (QR sign-in), `/verify` |
| `WC_PROJECT_ID` | empty | Reown (WalletConnect) project id from cloud.reown.com; empty hides "Wallet on this phone" |

## Sign-in

- Email/password (`/auth/login-password`). Supervisors set this password on the web: Supervisor → "04 // Account & App Login".
- **BridgeKey on a computer**: the phone shows a QR code + confirmation code; open it where the BridgeKey extension is installed and approve.
- **Wallet on this phone**: WalletConnect v2 `personal_sign` (any WC wallet with the MST network).

Only `supervisor` accounts can use the app; the role comes from `AccessRegistry` on MST for wallet sign-in.

## Code

`lib/api.dart` HTTP + session, `lib/wallet.dart` BridgeKey flows, `lib/capture.dart` GPS stamp + SHA-256, `lib/uploads.dart` offline queue, `lib/ui.dart` theme/components, `lib/screens/`.
