import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../capture.dart';
import '../config.dart';
import '../ui.dart';

/// One submission: the stamped photo, its MST anchor, integrity checks and the AI site analysis.
class EvidenceScreen extends StatefulWidget {
  const EvidenceScreen({super.key, required this.id, this.initial});
  final int id;
  final Evidence? initial;
  @override
  State<EvidenceScreen> createState() => _EvidenceScreenState();
}

class _EvidenceScreenState extends State<EvidenceScreen> {
  Evidence? _e;
  String? _error;
  Timer? _poll;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _e = widget.initial;
    _load();
    // AI analysis and the MST anchor finish in the background on the server.
    _poll = Timer.periodic(const Duration(seconds: 5), (t) {
      if (t.tick > 60 || !(_e?.settling ?? true)) return t.cancel();
      _load();
    });
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final e = Evidence((await api.get('/supervisor/evidence/${widget.id}')) as Map<String, dynamic>);
      if (!mounted) return;
      setState(() {
        _e = e;
        _error = null;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _retry(String what) async {
    setState(() => _busy = true);
    try {
      final e = Evidence((await api.post('/supervisor/evidence/${widget.id}/$what')) as Map<String, dynamic>);
      setState(() => _e = e);
      _poll?.cancel();
      _poll = Timer.periodic(const Duration(seconds: 5), (t) => t.tick > 60 || !(_e?.settling ?? true) ? t.cancel() : _load());
    } on ApiException catch (err) {
      if (mounted) showError(context, err);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _open(String url) => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);

  @override
  Widget build(BuildContext context) {
    final e = _e;
    return Scaffold(
      appBar: AppBar(title: Text(e == null ? 'Evidence' : 'Evidence #${e.id}')),
      body: e == null
          ? Center(
              child: _error == null ? const CircularProgressIndicator() : Text(_error!, style: const TextStyle(color: C.bad)),
            )
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
                children: [
                  GestureDetector(
                    onTap: () => Navigator.push(context, MaterialPageRoute<void>(builder: (_) => _FullPhoto(e.fileUrl))),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.network(
                        e.fileUrl,
                        headers: api.authHeaders,
                        fit: BoxFit.contain,
                        loadingBuilder: (_, child, p) =>
                            p == null ? child : const SizedBox(height: 220, child: Center(child: CircularProgressIndicator())),
                        errorBuilder: (_, _, _) => Container(
                          height: 160,
                          color: C.line,
                          child: const Center(child: Text('Photo unavailable')),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text(e.stageName, style: Theme.of(context).textTheme.headlineSmall),
                  Text('${e.projectName} · ${shortDate(e.capturedAt)}', style: const TextStyle(color: C.muted)),
                  const SizedBox(height: 16),
                  _chain(e),
                  const SizedBox(height: 12),
                  _integrity(e),
                  const SizedBox(height: 12),
                  _ai(e),
                  if (e.notes != null) ...[
                    const SizedBox(height: 12),
                    Panel(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [const Eyebrow('Notes'), const SizedBox(height: 6), Text(e.notes!)],
                      ),
                    ),
                  ],
                ],
              ),
            ),
    );
  }

  Widget _chain(Evidence e) {
    final c = e.chain;
    final (label, tone) = chainLabel(e.chainStatus);
    final tx = c['transaction_hash'] as String?;
    final explorer = c['explorer_url'] as String?;
    return Panel(
      borderColor: tone == Tone.ok ? C.ok : C.line,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(child: Eyebrow('MST Blockchain')),
              StatusPill(label, tone, icon: tone == Tone.ok ? Icons.verified : Icons.link),
            ],
          ),
          const SizedBox(height: 8),
          InfoRow('Network', '${c['network'] ?? 'mst'} · chain ${c['chain_id'] ?? '—'}'),
          InfoRow('Anchored hash', e.sha256, isMono: true),
          if (tx != null) InfoRow('Transaction', tx, isMono: true),
          if (c['block_number'] != null) InfoRow('Block', '${c['block_number']}', isMono: true),
          if (c['contract_address'] != null) InfoRow('Registry', '${c['contract_address']}', isMono: true),
          if (e.chainStatus == 'queued' || e.chainStatus == 'submitted')
            const Padding(
              padding: EdgeInsets.only(top: 6),
              child: Text('The relayer anchors queued hashes within about a minute.', style: TextStyle(color: C.muted, fontSize: 12.5)),
            ),
          const SizedBox(height: 10),
          Row(
            children: [
              if (explorer != null)
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _open(explorer),
                    icon: const Icon(Icons.open_in_new, size: 18),
                    label: const Text('EXPLORER'),
                  ),
                ),
              if (explorer != null) const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _open('${Config.webAppUrl}/verify'),
                  icon: const Icon(Icons.travel_explore, size: 18),
                  label: const Text('VERIFY'),
                ),
              ),
            ],
          ),
          if (e.chainStatus == 'failed') ...[
            const SizedBox(height: 10),
            FilledButton(onPressed: _busy ? null : () => _retry('retry-anchor'), child: const Text('RETRY ANCHOR')),
          ],
        ],
      ),
    );
  }

  Widget _integrity(Evidence e) => Panel(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Expanded(child: Eyebrow('Integrity & location')),
            StatusPill(e.hashMatched ? 'Hash verified' : 'Hash mismatch', e.hashMatched ? Tone.ok : Tone.bad),
          ],
        ),
        const SizedBox(height: 8),
        InfoRow('Latitude', formatCoord(e.lat, 'N', 'S'), isMono: true),
        InfoRow('Longitude', formatCoord(e.lng, 'E', 'W'), isMono: true),
        InfoRow('Accuracy', '±${e.accuracyM.toStringAsFixed(1)} m'),
        if (e.distanceM != null)
          InfoRow('To site', '${e.distanceM!.toStringAsFixed(1)} m · ${e.withinRadius ? 'inside geofence' : 'OUTSIDE geofence'}'),
        InfoRow('Captured', stampTime(e.capturedAt), isMono: true),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: () => _open('https://www.google.com/maps/search/?api=1&query=${e.lat},${e.lng}'),
          icon: const Icon(Icons.map_outlined, size: 18),
          label: const Text('OPEN IN MAPS'),
        ),
      ],
    ),
  );

  Widget _ai(Evidence e) {
    final ai = e.ai;
    final r = (ai['structured_result'] as Map?)?.cast<String, dynamic>();
    final (label, tone) = aiLabel(e.aiStatus);
    List<String> list(String k) => ((r?[k] as List?) ?? const []).map((x) => '$x').toList();
    final stage = (r?['stage_assessment'] as Map?)?.cast<String, dynamic>();
    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(child: Eyebrow('AI vision analysis')),
              StatusPill(label, tone),
            ],
          ),
          const SizedBox(height: 8),
          if (e.aiStatus == 'completed') ...[
            Text((ai['summary'] as String?) ?? (r?['summary'] as String?) ?? '', style: const TextStyle(height: 1.4)),
            if (stage?['observed_stage'] != null) ...[
              const SizedBox(height: 10),
              InfoRow('Observed stage', '${stage!['observed_stage']} (${stage['confidence'] ?? '?'} confidence)'),
            ],
            for (final (k, t) in const [
              ('observed_activities', 'Activities'),
              ('materials_visible', 'Materials'),
              ('equipment_visible', 'Equipment'),
              ('potential_issues', 'Potential issues'),
            ])
              if (list(k).isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(t, style: const TextStyle(fontWeight: FontWeight.w800)),
                for (final x in list(k))
                  Padding(
                    padding: const EdgeInsets.only(top: 3),
                    child: Text('•  $x', style: const TextStyle(height: 1.3)),
                  ),
              ],
          ] else if (e.aiStatus == 'failed') ...[
            Text((ai['error'] as String?) ?? 'Analysis failed.', style: const TextStyle(color: C.bad)),
            const SizedBox(height: 10),
            FilledButton(onPressed: _busy ? null : () => _retry('retry-ai'), child: const Text('RETRY ANALYSIS')),
          ] else
            const Row(
              children: [
                SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
                SizedBox(width: 10),
                Text('AI vision is reviewing the photo…', style: TextStyle(color: C.muted)),
              ],
            ),
        ],
      ),
    );
  }
}

class _FullPhoto extends StatelessWidget {
  const _FullPhoto(this.url);
  final String url;
  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: Colors.black,
    appBar: AppBar(backgroundColor: Colors.black, foregroundColor: Colors.white),
    body: InteractiveViewer(
      maxScale: 6,
      child: Center(child: Image.network(url, headers: api.authHeaders)),
    ),
  );
}
