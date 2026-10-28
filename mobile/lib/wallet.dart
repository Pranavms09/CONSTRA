import 'dart:async';
import 'dart:convert';

import 'package:reown_core/reown_core.dart';
import 'package:reown_sign/reown_sign.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'config.dart';

/// BridgeKey sign-in. The backend checks the signed challenge and reads the role from AccessRegistry on MST.
class WalletSignIn {
  static ReownSignClient? _client;

  static bool get walletConnectAvailable => Config.walletConnectProjectId.isNotEmpty;

  /// Wallet on this phone over WalletConnect v2: connect, `personal_sign` the challenge, log in.
  static Future<User> withWalletConnect({void Function(String step)? onStep}) async {
    if (!walletConnectAvailable) throw ApiException(400, 'WalletConnect is not configured in this build (WC_PROJECT_ID).');
    onStep?.call('Opening your wallet…');
    final cfg = (await api.get('/chain/config')) as Map<String, dynamic>;
    final chain = 'eip155:${cfg['chain_id']}';
    final client = _client ??= await ReownSignClient.createInstance(
      projectId: Config.walletConnectProjectId,
      metadata: const PairingMetadata(
        name: 'CONSTRA Site',
        description: 'GPS-tagged construction evidence anchored on MST Blockchain',
        url: Config.webAppUrl,
        redirect: Redirect(native: 'constra://wc'),
      ),
    );
    final connect = await client.connect(
      optionalNamespaces: {
        'eip155': RequiredNamespace(chains: [chain], methods: const ['personal_sign'], events: const []),
      },
    );
    if (!await launchUrl(connect.uri!, mode: LaunchMode.externalApplication)) {
      throw ApiException(400, 'No WalletConnect wallet found on this phone. Use "BridgeKey on a computer" instead.');
    }
    final session = await connect.session.future.timeout(
      const Duration(minutes: 3),
      onTimeout: () => throw ApiException(408, 'The wallet did not connect in time.'),
    );
    try {
      // CAIP-10 account: eip155:<chainId>:<address>
      final account = session.namespaces['eip155']!.accounts.first.split(':');
      final address = account[2];
      onStep?.call('Sign the CONSTRA message in your wallet…');
      final challenge = (await api.post('/auth/wallet/challenge', {'address': address})) as Map<String, dynamic>;
      final message = '0x${utf8.encode(challenge['message'] as String).map((b) => b.toRadixString(16).padLeft(2, '0')).join()}';
      final walletApp = session.peer.metadata.redirect?.native;
      if (walletApp != null) unawaited(launchUrl(Uri.parse(walletApp), mode: LaunchMode.externalApplication));
      final signature = await client.request(
        topic: session.topic,
        chainId: '${account[0]}:${account[1]}',
        request: SessionRequestParams(method: 'personal_sign', params: [message, address]),
      );
      onStep?.call('Checking your role on MST…');
      final res = await api.post('/auth/wallet/login', {
        'address': address,
        'nonce': challenge['nonce'],
        'signature': signature,
        'claimed_role': 'supervisor',
      });
      return await api.startSession(res as Map<String, dynamic>);
    } finally {
      unawaited(
        client
            .disconnect(
              topic: session.topic,
              reason: const ReownSignError(code: 6000, message: 'Signed in'),
            )
            .catchError((_) {}),
      );
    }
  }
}

/// QR sign-in: a computer with the BridgeKey extension approves this phone at `/wallet-pair`.
class WalletPairing {
  WalletPairing._(this.id, this._secret, this.expiresAt);
  final String id;
  final String _secret;
  final DateTime expiresAt;

  String get url => '${Config.webAppUrl}/wallet-pair?id=$id';

  /// Must match the code the web page shows (frontend `pairingCode`).
  String get code => id.replaceAll('-', '').substring(0, 8).toUpperCase();

  static Future<WalletPairing> start() async {
    final r = (await api.post('/auth/wallet/pair')) as Map<String, dynamic>;
    return WalletPairing._(r['pair_id'] as String, r['secret'] as String, DateTime.parse(r['expires_at'] as String));
  }

  /// Polls until the wallet approves; throws [ApiException] 410 when the pairing expires.
  Future<User> waitForApproval({required bool Function() cancelled}) async {
    while (!cancelled()) {
      try {
        final r = (await api.post('/auth/wallet/pair/$id/claim', {'secret': _secret})) as Map<String, dynamic>;
        if (r['token'] != null) return await api.startSession(r);
      } on ApiException catch (e) {
        if (e.status != 0) rethrow; // keep polling through brief network drops
      }
      await Future<void>.delayed(const Duration(seconds: 2));
    }
    throw ApiException(499, 'Cancelled');
  }
}
