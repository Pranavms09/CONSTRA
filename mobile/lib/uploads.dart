import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

import 'api.dart';
import 'capture.dart';

/// A stamped photo waiting for the server; persisted as `<id>.json` next to `<id>.jpg`.
class PendingUpload {
  PendingUpload(this.fields, this.label, {this.lastError});
  final Map<String, String> fields;
  final String label;
  String? lastError;
  String get id => fields['device_evidence_id']!;
  Map<String, dynamic> toJson() => {'fields': fields, 'label': label, 'last_error': lastError};
}

/// Offline-first submission: evidence is written to disk before upload and removed only once the server has it.
class Uploads extends ChangeNotifier {
  Uploads._();
  static final instance = Uploads._();
  late Directory dir;
  final List<PendingUpload> items = [];
  bool syncing = false;

  Future<void> load() async {
    dir = Directory('${(await getApplicationDocumentsDirectory()).path}/pending');
    await dir.create(recursive: true);
    items.clear();
    for (final f in dir.listSync().whereType<File>().where((f) => f.path.endsWith('.json'))) {
      try {
        final j = jsonDecode(await f.readAsString()) as Map<String, dynamic>;
        items.add(PendingUpload((j['fields'] as Map).cast<String, String>(), j['label'] as String, lastError: j['last_error'] as String?));
      } on FormatException {
        await f.delete();
      }
    }
    // Photos never submitted (app closed on the review screen) have no metadata.
    for (final f in dir.listSync().whereType<File>().where((f) => f.path.endsWith('.jpg'))) {
      if (!items.any((p) => f.path.endsWith('/${p.id}.jpg'))) await f.delete();
    }
    notifyListeners();
  }

  File photoFile(String id) => File('${dir.path}/$id.jpg');
  File _meta(String id) => File('${dir.path}/$id.json');

  Future<void> _save(PendingUpload p) => _meta(p.id).writeAsString(jsonEncode(p.toJson()), flush: true);

  /// Queues then uploads. Throws [ApiException]: retryable ones leave the photo queued for [syncAll].
  Future<Evidence> submit(CapturedEvidence ev, String? notes) async {
    final p = PendingUpload({
      'device_evidence_id': ev.id,
      'project_id': '${ev.projectId}',
      'stage_id': '${ev.stageId}',
      'captured_at': ev.fix.time.toUtc().toIso8601String(),
      'latitude': '${ev.fix.lat}',
      'longitude': '${ev.fix.lng}',
      'accuracy_m': '${ev.fix.accuracyM}',
      'client_sha256': ev.sha256,
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    }, '${ev.projectName} / ${ev.stageName}');
    await _save(p);
    items.add(p);
    notifyListeners();
    return _upload(p);
  }

  Future<Evidence> _upload(PendingUpload p) async {
    try {
      final res = Evidence((await api.upload('/supervisor/evidence', p.fields, photoFile(p.id))) as Map<String, dynamic>);
      await discard(p.id);
      return res;
    } on ApiException catch (e) {
      p.lastError = e.message;
      await _save(p);
      notifyListeners();
      rethrow;
    }
  }

  /// Retries every queued photo; returns how many reached the server.
  Future<int> syncAll() async {
    if (syncing) return 0;
    syncing = true;
    notifyListeners();
    var sent = 0;
    try {
      for (final p in List.of(items)) {
        try {
          await _upload(p);
          sent++;
        } on ApiException catch (e) {
          if (e.status == 0) break; // still offline
        }
      }
    } finally {
      syncing = false;
      notifyListeners();
    }
    return sent;
  }

  Future<void> discard(String id) async {
    items.removeWhere((p) => p.id == id);
    for (final f in [photoFile(id), _meta(id)]) {
      if (await f.exists()) await f.delete();
    }
    notifyListeners();
  }
}

final uploads = Uploads.instance;
