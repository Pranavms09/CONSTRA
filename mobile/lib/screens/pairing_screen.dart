import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../api.dart';
import '../ui.dart';
import '../wallet.dart';

/// QR sign-in: the computer's BridgeKey extension approves this phone.
class PairingScreen extends StatefulWidget {
  const PairingScreen({super.key});
  @override
  State<PairingScreen> createState() => _PairingScreenState();
}

class _PairingScreenState extends State<PairingScreen> {
  WalletPairing? _pairing;
  String? _error;
  bool _closed = false;
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    _start();
    _tick = Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));
  }

  @override
  void dispose() {
    _closed = true;
    _tick?.cancel();
    super.dispose();
  }

  Future<void> _start() async {
    setState(() {
      _pairing = null;
      _error = null;
    });
    try {
      final p = await WalletPairing.start();
      if (_closed) return;
      setState(() => _pairing = p);
      await p.waitForApproval(cancelled: () => _closed || _pairing != p);
      if (mounted) Navigator.pop(context);
    } on ApiException catch (e) {
      if (mounted && e.status != 499) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = _pairing;
    final left = p?.expiresAt.difference(DateTime.now());
    return Scaffold(
      appBar: AppBar(title: const Text('Approve on your computer')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          if (_error != null) ...[
            Panel(
              borderColor: C.bad,
              child: Text(
                _error!,
                style: const TextStyle(color: C.bad, fontWeight: FontWeight.w600),
              ),
            ),
            const SizedBox(height: 16),
            FilledButton(onPressed: _start, child: const Text('TRY AGAIN')),
          ] else if (p == null)
            const Padding(
              padding: EdgeInsets.all(48),
              child: Center(child: CircularProgressIndicator()),
            )
          else ...[
            Panel(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  QrImageView(
                    data: p.url,
                    size: 220,
                    backgroundColor: Colors.white,
                    eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.square, color: C.ink),
                  ),
                  const SizedBox(height: 16),
                  const Eyebrow('Confirmation code'),
                  const SizedBox(height: 6),
                  Text(p.code, style: mono.copyWith(fontSize: 30, fontWeight: FontWeight.w800, letterSpacing: 6)),
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)),
                      const SizedBox(width: 8),
                      Text(
                        left == null || left.isNegative
                            ? 'Expired'
                            : 'Waiting for approval · ${left.inMinutes}:${(left.inSeconds % 60).toString().padLeft(2, '0')}',
                        style: const TextStyle(color: C.muted),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            const _Step(1, 'On a computer with the BridgeKey extension, scan this code or open the link below.'),
            const _Step(2, 'Check the web page shows the same confirmation code.'),
            const _Step(3, 'Click “Approve with BridgeKey” and sign. This phone signs in automatically.'),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: () {
                Clipboard.setData(ClipboardData(text: p.url));
                showInfo(context, 'Link copied');
              },
              icon: const Icon(Icons.link),
              label: const Text('COPY LINK'),
            ),
            const SizedBox(height: 12),
            const Text(
              'Never approve a code you did not start yourself.',
              textAlign: TextAlign.center,
              style: TextStyle(color: C.muted, fontSize: 12),
            ),
          ],
        ],
      ),
    );
  }
}

class _Step extends StatelessWidget {
  const _Step(this.n, this.text);
  final int n;
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 24,
          height: 24,
          alignment: Alignment.center,
          decoration: const BoxDecoration(color: C.ink, shape: BoxShape.circle),
          child: Text(
            '$n',
            style: const TextStyle(color: C.signal, fontWeight: FontWeight.w800, fontSize: 12),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(child: Text(text, style: const TextStyle(height: 1.35))),
      ],
    ),
  );
}
