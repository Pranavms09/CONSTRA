import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../config.dart';
import '../ui.dart';
import '../uploads.dart';
import 'evidence_screen.dart';
import 'site_picker_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _tab = 0;
  final _todayKey = GlobalKey<_TodayTabState>();
  final _evidenceKey = GlobalKey<_EvidenceTabState>();

  @override
  void initState() {
    super.initState();
    uploads.syncAll();
  }

  Future<void> _capture() async {
    await Navigator.push<void>(context, MaterialPageRoute(builder: (_) => const SitePickerScreen()));
    _todayKey.currentState?.refresh();
    _evidenceKey.currentState?.refresh();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: IndexedStack(
      index: _tab,
      children: [
        _TodayTab(key: _todayKey),
        _EvidenceTab(key: _evidenceKey),
        const _AccountTab(),
      ],
    ),
    floatingActionButton: _tab == 2
        ? null
        : FloatingActionButton.extended(
            onPressed: _capture,
            backgroundColor: C.signal,
            foregroundColor: C.ink,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            icon: const Icon(Icons.photo_camera),
            label: const Text('CAPTURE', style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1.2)),
          ),
    bottomNavigationBar: NavigationBar(
      selectedIndex: _tab,
      onDestinationSelected: (i) => setState(() => _tab = i),
      destinations: const [
        NavigationDestination(icon: Icon(Icons.today_outlined), selectedIcon: Icon(Icons.today), label: 'Today'),
        NavigationDestination(icon: Icon(Icons.photo_library_outlined), selectedIcon: Icon(Icons.photo_library), label: 'Evidence'),
        NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Account'),
      ],
    ),
  );
}

class _TodayTab extends StatefulWidget {
  const _TodayTab({super.key});
  @override
  State<_TodayTab> createState() => _TodayTabState();
}

class _TodayTabState extends State<_TodayTab> {
  Map<String, dynamic>? _data;
  String? _error;

  @override
  void initState() {
    super.initState();
    refresh();
  }

  Future<void> refresh() async {
    try {
      final d = (await api.get('/supervisor/dashboard')) as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _data = d;
        _error = null;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  String get _greeting {
    final h = DateTime.now().hour;
    return h < 12
        ? 'Good morning'
        : h < 17
        ? 'Good afternoon'
        : 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    final recent = ((_data?['recent_submissions'] as List?) ?? const []).map((e) => Evidence(e as Map<String, dynamic>)).toList();
    return SafeArea(
      child: RefreshIndicator(
        onRefresh: () async {
          await uploads.syncAll();
          await refresh();
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 100),
          children: [
            Eyebrow(shortDate(DateTime.now()).split(',').first),
            const SizedBox(height: 4),
            Text('$_greeting,\n${api.user?.fullName.split(' ').first ?? ''}', style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 20),
            const _PendingBanner(),
            if (_error != null) ...[
              Panel(
                borderColor: C.bad,
                child: Row(
                  children: [
                    const Icon(Icons.cloud_off, color: C.bad),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(_error!, style: const TextStyle(color: C.bad)),
                    ),
                    TextButton(onPressed: refresh, child: const Text('Retry')),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],
            Row(
              children: [
                _Stat('Sites', _data?['assigned_projects_count']),
                const SizedBox(width: 10),
                _Stat('Today', _data?['evidence_today_count'], highlight: true),
                const SizedBox(width: 10),
                _Stat('Total', _data?['total_submitted_count']),
              ],
            ),
            const SizedBox(height: 28),
            const Eyebrow('Recent captures'),
            const SizedBox(height: 10),
            if (_data == null && _error == null)
              const Padding(
                padding: EdgeInsets.all(32),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (recent.isEmpty)
              const _EmptyState(
                'No captures yet',
                'Tap CAPTURE to photograph site progress. Each photo is GPS-stamped and anchored on MST.',
              )
            else
              for (final e in recent) EvidenceTile(e),
          ],
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.label, this.value, {this.highlight = false});
  final String label;
  final Object? value;
  final bool highlight;
  @override
  Widget build(BuildContext context) => Expanded(
    child: Panel(
      color: highlight ? C.ink : C.surface,
      borderColor: highlight ? C.ink : C.line,
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${value ?? '–'}',
            style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: highlight ? C.signal : C.ink),
          ),
          Eyebrow(label, color: highlight ? const Color(0xFFBDB5AC) : C.muted),
        ],
      ),
    ),
  );
}

/// Photos captured offline or rejected by a flaky network, waiting in the local queue.
class _PendingBanner extends StatelessWidget {
  const _PendingBanner();

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: uploads,
    builder: (context, _) {
      if (uploads.items.isEmpty) return const SizedBox.shrink();
      final n = uploads.items.length;
      return Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: Panel(
          color: const Color(0xFFFFF4D6),
          borderColor: C.signal,
          onTap: () => _showQueue(context),
          child: Row(
            children: [
              const Icon(Icons.cloud_upload_outlined),
              const SizedBox(width: 12),
              Expanded(
                child: Text('$n photo${n == 1 ? '' : 's'} waiting to upload', style: const TextStyle(fontWeight: FontWeight.w700)),
              ),
              uploads.syncing
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : TextButton(
                      onPressed: () async {
                        final sent = await uploads.syncAll();
                        if (!context.mounted) return;
                        showInfo(
                          context,
                          sent == 0 ? 'Still offline or rejected. Tap the banner for details.' : 'Uploaded $sent photo(s).',
                        );
                      },
                      child: const Text('SYNC'),
                    ),
            ],
          ),
        ),
      );
    },
  );

  void _showQueue(BuildContext context) => showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (ctx) => ListenableBuilder(
      listenable: uploads,
      builder: (ctx, _) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          children: [
            Text('Upload queue', style: Theme.of(ctx).textTheme.titleLarge),
            const SizedBox(height: 12),
            for (final p in uploads.items)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Panel(
                  child: Row(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: Image.file(uploads.photoFile(p.id), width: 52, height: 52, fit: BoxFit.cover),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(p.label, style: const TextStyle(fontWeight: FontWeight.w700)),
                            Text(
                              p.lastError ?? 'Waiting for connection',
                              style: TextStyle(fontSize: 12, color: p.lastError == null ? C.muted : C.bad),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        tooltip: 'Discard',
                        icon: const Icon(Icons.delete_outline),
                        onPressed: () async {
                          final ok = await showDialog<bool>(
                            context: ctx,
                            builder: (d) => AlertDialog(
                              title: const Text('Discard this photo?'),
                              content: const Text('It has not reached the server and will be deleted from this phone.'),
                              actions: [
                                TextButton(onPressed: () => Navigator.pop(d, false), child: const Text('Keep')),
                                TextButton(
                                  onPressed: () => Navigator.pop(d, true),
                                  child: const Text('Discard', style: TextStyle(color: C.bad)),
                                ),
                              ],
                            ),
                          );
                          if (ok == true) await uploads.discard(p.id);
                        },
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    ),
  );
}

class _EvidenceTab extends StatefulWidget {
  const _EvidenceTab({super.key});
  @override
  State<_EvidenceTab> createState() => _EvidenceTabState();
}

class _EvidenceTabState extends State<_EvidenceTab> {
  List<Evidence>? _items;
  String? _error;

  @override
  void initState() {
    super.initState();
    refresh();
  }

  Future<void> refresh() async {
    try {
      final list = (await api.get('/supervisor/evidence?limit=100')) as List;
      if (!mounted) return;
      setState(() {
        _items = list.map((e) => Evidence(e as Map<String, dynamic>)).toList();
        _error = null;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) => SafeArea(
    child: RefreshIndicator(
      onRefresh: refresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 100),
        children: [
          Text('Evidence', style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 4),
          const Text('Everything you submitted, with its MST anchor.', style: TextStyle(color: C.muted)),
          const SizedBox(height: 20),
          if (_error != null) Text(_error!, style: const TextStyle(color: C.bad)),
          if (_items == null && _error == null)
            const Padding(
              padding: EdgeInsets.all(32),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_items?.isEmpty ?? false)
            const _EmptyState('Nothing here yet', 'Captured photos appear here once uploaded.')
          else
            for (final e in _items ?? const <Evidence>[]) EvidenceTile(e),
        ],
      ),
    ),
  );
}

class _AccountTab extends StatelessWidget {
  const _AccountTab();

  @override
  Widget build(BuildContext context) {
    final u = api.user!;
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        children: [
          Text('Account', style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 20),
          Panel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    CircleAvatar(
                      radius: 26,
                      backgroundColor: C.ink,
                      child: Text(
                        u.fullName.isEmpty ? '?' : u.fullName[0].toUpperCase(),
                        style: const TextStyle(color: C.signal, fontWeight: FontWeight.w900, fontSize: 20),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(u.fullName, style: Theme.of(context).textTheme.titleMedium),
                          Text(u.email, style: const TextStyle(color: C.muted)),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                const StatusPill('Site supervisor', Tone.info, icon: Icons.verified_user_outlined),
                const SizedBox(height: 8),
                const Divider(),
                InfoRow('Wallet', u.wallet ?? 'Not linked', isMono: u.wallet != null),
                InfoRow('Server', api.baseUrl, isMono: true),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Panel(
            onTap: () => launchUrl(Uri.parse('${Config.webAppUrl}/verify'), mode: LaunchMode.externalApplication),
            child: const Row(
              children: [
                Icon(Icons.travel_explore),
                SizedBox(width: 14),
                Expanded(
                  child: Text('Verify a photo on MST Blockchain', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
                Icon(Icons.open_in_new, size: 18),
              ],
            ),
          ),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: C.bad,
              side: const BorderSide(color: C.bad),
            ),
            onPressed: () async {
              if (uploads.items.isNotEmpty) {
                final ok = await showDialog<bool>(
                  context: context,
                  builder: (d) => AlertDialog(
                    title: const Text('Sign out?'),
                    content: Text(
                      '${uploads.items.length} photo(s) are still waiting to upload. They stay on this phone and upload after you sign in again.',
                    ),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(d, false), child: const Text('Cancel')),
                      TextButton(onPressed: () => Navigator.pop(d, true), child: const Text('Sign out')),
                    ],
                  ),
                );
                if (ok != true) return;
              }
              await api.logout();
            },
            icon: const Icon(Icons.logout),
            label: const Text('SIGN OUT'),
          ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState(this.title, this.body);
  final String title, body;
  @override
  Widget build(BuildContext context) => Panel(
    padding: const EdgeInsets.all(24),
    child: Column(
      children: [
        const Icon(Icons.photo_camera_outlined, size: 36, color: C.muted),
        const SizedBox(height: 10),
        Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
        const SizedBox(height: 4),
        Text(
          body,
          textAlign: TextAlign.center,
          style: const TextStyle(color: C.muted),
        ),
      ],
    ),
  );
}

class EvidenceTile extends StatelessWidget {
  const EvidenceTile(this.e, {super.key});
  final Evidence e;

  @override
  Widget build(BuildContext context) {
    final (chain, chainTone) = chainLabel(e.chainStatus);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Panel(
        padding: const EdgeInsets.all(10),
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute<void>(
            builder: (_) => EvidenceScreen(id: e.id, initial: e),
          ),
        ),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: Image.network(
                e.fileUrl,
                headers: api.authHeaders,
                width: 68,
                height: 68,
                fit: BoxFit.cover,
                cacheWidth: 200,
                errorBuilder: (_, _, _) => Container(
                  width: 68,
                  height: 68,
                  color: C.line,
                  child: const Icon(Icons.image_not_supported_outlined, color: C.muted),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    e.stageName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                  ),
                  Text(
                    '${e.projectName} · ${shortDate(e.capturedAt)}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: C.muted, fontSize: 12.5),
                  ),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    children: [
                      StatusPill(chain, chainTone, icon: Icons.link),
                      if (!e.withinRadius) const StatusPill('Off site', Tone.bad, icon: Icons.wrong_location_outlined),
                      if (!e.hashMatched) const StatusPill('Hash mismatch', Tone.bad),
                    ],
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: C.muted),
          ],
        ),
      ),
    );
  }
}
