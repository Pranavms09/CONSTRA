import 'package:flutter/material.dart';

import '../api.dart';
import '../capture.dart';
import '../ui.dart';
import '../uploads.dart';
import 'evidence_screen.dart';

/// Step 3: check the stamped photo, add notes, submit (queued offline if the network fails).
class ReviewScreen extends StatefulWidget {
  const ReviewScreen({super.key, required this.evidence, required this.project, this.distanceM});
  final CapturedEvidence evidence;
  final Project project;
  final double? distanceM;
  @override
  State<ReviewScreen> createState() => _ReviewScreenState();
}

class _ReviewScreenState extends State<ReviewScreen> {
  final _notes = TextEditingController();
  bool _busy = false, _queued = false;

  @override
  void dispose() {
    // Retake or back: the photo was never queued, so it is not kept.
    if (!_queued) widget.evidence.file.delete().ignore();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _busy = true);
    final nav = Navigator.of(context);
    try {
      _queued = true;
      final saved = await uploads.submit(widget.evidence, _notes.text);
      nav.popUntil((r) => r.isFirst);
      nav.push(
        MaterialPageRoute<void>(
          builder: (_) => EvidenceScreen(id: saved.id, initial: saved),
        ),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.retryable) {
        showInfo(context, 'Saved on this phone. It uploads automatically when you are back online.');
        nav.popUntil((r) => r.isFirst);
      } else {
        showError(context, '${e.message} The photo stays in the upload queue.');
        setState(() => _busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final ev = widget.evidence;
    final d = widget.distanceM;
    final outside = d != null && d > widget.project.radiusM + ev.fix.accuracyM.clamp(0, 50);
    return Scaffold(
      appBar: AppBar(title: const Text('Review evidence')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: Image.file(ev.file, fit: BoxFit.contain),
          ),
          const SizedBox(height: 16),
          if (outside) ...[
            Panel(
              color: const Color(0xFFFDECEA),
              borderColor: C.bad,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.wrong_location_outlined, color: C.bad),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'You are ${d.toStringAsFixed(0)} m from the site centre (geofence ${widget.project.radiusM.toStringAsFixed(0)} m). '
                      'Submitting raises a geofence alert for the auditor.',
                      style: const TextStyle(color: C.bad, height: 1.35),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],
          Panel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Eyebrow('GPS tag (burned into the photo)'),
                const SizedBox(height: 6),
                InfoRow('Site', ev.projectName),
                InfoRow('Stage', ev.stageName),
                InfoRow('Latitude', formatCoord(ev.fix.lat, 'N', 'S'), isMono: true),
                InfoRow('Longitude', formatCoord(ev.fix.lng, 'E', 'W'), isMono: true),
                InfoRow('Accuracy', '±${ev.fix.accuracyM.toStringAsFixed(1)} m'),
                if (d != null) InfoRow('To site', '${d.toStringAsFixed(1)} m'),
                InfoRow('Captured', stampTime(ev.fix.time), isMono: true),
                const Divider(height: 20),
                const Eyebrow('Fingerprint anchored on MST'),
                const SizedBox(height: 6),
                InfoRow('SHA-256', ev.sha256, isMono: true),
              ],
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _notes,
            enabled: !_busy,
            maxLines: 3,
            maxLength: 500,
            decoration: const InputDecoration(labelText: 'Notes for the auditor (optional)', alignLabelWithHint: true),
          ),
          const SizedBox(height: 8),
          FilledButton.icon(
            onPressed: _busy ? null : _submit,
            icon: _busy
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: C.paper))
                : const Icon(Icons.verified_outlined),
            label: Text(_busy ? 'UPLOADING…' : 'SUBMIT & ANCHOR ON MST'),
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: _busy ? null : () => Navigator.pop(context),
            icon: const Icon(Icons.replay),
            label: const Text('RETAKE'),
          ),
        ],
      ),
    );
  }
}
