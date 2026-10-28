import 'package:flutter/material.dart';

import '../api.dart';
import '../config.dart';
import '../ui.dart';
import '../wallet.dart';
import 'pairing_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  String? _busy; // progress text while signing in
  bool _hidePassword = true;

  Future<void> _run(String label, Future<void> Function() job) async {
    setState(() => _busy = label);
    try {
      await job();
    } on ApiException catch (e) {
      if (mounted && e.status != 499) showError(context, e);
    } catch (e) {
      if (mounted) showError(context, 'Sign-in failed: $e');
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _emailLogin() => _run('Signing in…', () async {
    final res = await api.post('/auth/login-password', {
      'email': _email.text.trim(),
      'password': _password.text,
      'claimed_role': 'supervisor',
    });
    await api.startSession(res as Map<String, dynamic>);
  });

  void _walletOptions() => showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (ctx) => SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Sign in with BridgeKey', style: Theme.of(ctx).textTheme.titleLarge),
            const SizedBox(height: 4),
            const Text('Your role is read from the AccessRegistry contract on MST Blockchain.', style: TextStyle(color: C.muted)),
            const SizedBox(height: 16),
            _WalletOption(
              icon: Icons.phone_android,
              title: 'Wallet on this phone',
              subtitle: WalletSignIn.walletConnectAvailable
                  ? 'Opens your WalletConnect wallet to sign'
                  : 'Unavailable: build has no WC_PROJECT_ID',
              enabled: WalletSignIn.walletConnectAvailable,
              onTap: () {
                Navigator.pop(ctx);
                _run('Opening wallet…', () async {
                  await WalletSignIn.withWalletConnect(onStep: (s) => mounted ? setState(() => _busy = s) : null);
                });
              },
            ),
            const SizedBox(height: 10),
            _WalletOption(
              icon: Icons.qr_code_2,
              title: 'BridgeKey on a computer',
              subtitle: 'Scan a QR code and approve with the browser extension',
              onTap: () {
                Navigator.pop(ctx);
                Navigator.push(context, MaterialPageRoute<void>(builder: (_) => const PairingScreen()));
              },
            ),
          ],
        ),
      ),
    ),
  );

  Future<void> _serverSettings() async {
    final ctrl = TextEditingController(text: api.baseUrl);
    final url = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('CONSTRA server'),
        content: TextField(
          controller: ctrl,
          keyboardType: TextInputType.url,
          decoration: const InputDecoration(labelText: 'API base URL'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, Config.apiBaseUrl), child: const Text('Reset')),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size(88, 44)),
            onPressed: () => Navigator.pop(ctx, ctrl.text),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    if (url != null && Uri.tryParse(url.trim())?.hasScheme == true) {
      await api.setBaseUrl(url);
      setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final busy = _busy != null;
    return Scaffold(
      backgroundColor: C.paper,
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _Hero(onSettings: busy ? null : _serverSettings),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
              child: AutofillGroup(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    FilledButton.icon(
                      style: FilledButton.styleFrom(backgroundColor: C.signal, foregroundColor: C.ink),
                      onPressed: busy ? null : _walletOptions,
                      icon: const Icon(Icons.account_balance_wallet_outlined),
                      label: const Text('SIGN IN WITH BRIDGEKEY'),
                    ),
                    const SizedBox(height: 24),
                    const Row(
                      children: [
                        Expanded(child: Divider()),
                        Padding(padding: EdgeInsets.symmetric(horizontal: 12), child: Eyebrow('or with email')),
                        Expanded(child: Divider()),
                      ],
                    ),
                    const SizedBox(height: 20),
                    TextField(
                      controller: _email,
                      enabled: !busy,
                      keyboardType: TextInputType.emailAddress,
                      autofillHints: const [AutofillHints.email],
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(labelText: 'Work email', prefixIcon: Icon(Icons.alternate_email)),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _password,
                      enabled: !busy,
                      obscureText: _hidePassword,
                      autofillHints: const [AutofillHints.password],
                      onSubmitted: (_) => _emailLogin(),
                      decoration: InputDecoration(
                        labelText: 'Password',
                        prefixIcon: const Icon(Icons.lock_outline),
                        suffixIcon: IconButton(
                          tooltip: _hidePassword ? 'Show password' : 'Hide password',
                          icon: Icon(_hidePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                          onPressed: () => setState(() => _hidePassword = !_hidePassword),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    FilledButton(onPressed: busy ? null : _emailLogin, child: const Text('SIGN IN')),
                    const SizedBox(height: 20),
                    AnimatedSwitcher(
                      duration: const Duration(milliseconds: 200),
                      child: busy
                          ? Row(
                              key: ValueKey(_busy),
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
                                const SizedBox(width: 10),
                                Flexible(
                                  child: Text(_busy!, style: const TextStyle(fontWeight: FontWeight.w600)),
                                ),
                              ],
                            )
                          : const Text(
                              'Accounts are created by your Project Auditor.',
                              textAlign: TextAlign.center,
                              style: TextStyle(color: C.muted, fontSize: 13),
                            ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero({this.onSettings});
  final VoidCallback? onSettings;

  @override
  Widget build(BuildContext context) => Container(
    color: C.ink,
    padding: EdgeInsets.fromLTRB(20, MediaQuery.paddingOf(context).top + 8, 8, 28),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            ClipRRect(borderRadius: BorderRadius.circular(6), child: Image.asset('assets/constra_logo.png', width: 36, height: 36)),
            const SizedBox(width: 10),
            const Text(
              'CONSTRA',
              style: TextStyle(color: C.paper, fontWeight: FontWeight.w900, letterSpacing: 3, fontSize: 16),
            ),
            const Spacer(),
            IconButton(
              tooltip: 'Server settings',
              onPressed: onSettings,
              icon: const Icon(Icons.dns_outlined, color: C.paper),
            ),
          ],
        ),
        const SizedBox(height: 40),
        Container(width: 40, height: 4, color: C.signal),
        const SizedBox(height: 14),
        const Text(
          'Site evidence\nthat can’t be faked.',
          style: TextStyle(color: C.paper, fontSize: 32, height: 1.1, fontWeight: FontWeight.w900, letterSpacing: -0.8),
        ),
        const SizedBox(height: 12),
        const Text(
          'Every photo is stamped with live GPS, hashed on this phone and sealed on MST Blockchain.',
          style: TextStyle(color: Color(0xFFBDB5AC), fontSize: 15, height: 1.4),
        ),
        const SizedBox(height: 18),
        Text(
          'Site supervisor app · ${api.baseUrl.replaceFirst(RegExp(r'^https?://'), '')}',
          style: mono.copyWith(color: const Color(0xFF8C847B), fontSize: 11),
        ),
      ],
    ),
  );
}

class _WalletOption extends StatelessWidget {
  const _WalletOption({required this.icon, required this.title, required this.subtitle, required this.onTap, this.enabled = true});
  final IconData icon;
  final String title, subtitle;
  final VoidCallback onTap;
  final bool enabled;

  @override
  Widget build(BuildContext context) => Opacity(
    opacity: enabled ? 1 : 0.5,
    child: Panel(
      onTap: enabled ? onTap : null,
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(color: C.signal, borderRadius: BorderRadius.circular(6)),
            child: Icon(icon, color: C.ink),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                const SizedBox(height: 2),
                Text(subtitle, style: const TextStyle(color: C.muted, fontSize: 13)),
              ],
            ),
          ),
          const Icon(Icons.chevron_right),
        ],
      ),
    ),
  );
}
