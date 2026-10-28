/// Build-time settings: `flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8788`.
class Config {
  static const apiBaseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: 'https://constra-api.pranavms09.workers.dev');

  /// CONSTRA web app; hosts /wallet-pair (QR sign-in) and /verify.
  static const webAppUrl = String.fromEnvironment('WEB_APP_URL', defaultValue: 'https://constra.pranavms09.workers.dev');

  /// Reown (WalletConnect) project id from cloud.reown.com; public, empty disables "wallet on this phone".
  static const walletConnectProjectId = String.fromEnvironment('WC_PROJECT_ID');
}
