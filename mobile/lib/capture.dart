import 'dart:io';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:image/image.dart' as img;

/// One GPS fix taken at the shutter press.
class GeoFix {
  const GeoFix(this.lat, this.lng, this.accuracyM, this.time);
  final double lat, lng, accuracyM;
  final DateTime time;
}

/// A stamped photo ready to submit; [sha256] covers the stamped bytes, so the GPS tag is what gets anchored on MST.
class CapturedEvidence {
  CapturedEvidence({
    required this.id,
    required this.file,
    required this.sha256,
    required this.fix,
    required this.projectId,
    required this.stageId,
    required this.projectName,
    required this.stageName,
  });
  final String id;
  final File file;
  final String sha256;
  final GeoFix fix;
  final int projectId, stageId;
  final String projectName, stageName;
}

/// Unique, client-side id; the server is idempotent on it, so retries never duplicate evidence.
String newEvidenceId() {
  final r = Random.secure();
  final hex = List.generate(12, (_) => r.nextInt(256).toRadixString(16).padLeft(2, '0')).join();
  return 'EV-${DateTime.now().toUtc().millisecondsSinceEpoch}-$hex';
}

/// Great-circle distance in metres (same formula as the backend geofence).
double haversineM(double lat1, double lng1, double lat2, double lng2) {
  const r = 6371000.0;
  double rad(double d) => d * pi / 180;
  final dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  final a = pow(sin(dLat / 2), 2) + cos(rad(lat1)) * cos(rad(lat2)) * pow(sin(dLng / 2), 2);
  return 2 * r * asin(sqrt(a));
}

String formatCoord(double v, String pos, String neg) => '${v.abs().toStringAsFixed(6)}° ${v >= 0 ? pos : neg}';

/// Local time with its UTC offset, e.g. 2026-10-28 17:55:03 UTC+05:30.
String stampTime(DateTime t) {
  final l = t.toLocal();
  String two(int n) => n.toString().padLeft(2, '0');
  final off = l.timeZoneOffset;
  final sign = off.isNegative ? '-' : '+';
  return '${l.year}-${two(l.month)}-${two(l.day)} ${two(l.hour)}:${two(l.minute)}:${two(l.second)} UTC$sign${two(off.inHours.abs())}:${two(off.inMinutes.abs() % 60)}';
}

/// Burns the GPS tag into the photo and returns the JPEG bytes (runs in an isolate via [compute]).
Uint8List stampJpeg(StampJob job) {
  final decoded = img.decodeJpg(job.bytes);
  if (decoded == null) throw const FormatException('Camera returned an unreadable image.');
  var photo = img.bakeOrientation(decoded);
  // Keep uploads well under the 20 MB server limit and stamping fast.
  if (photo.width > 2048) photo = img.copyResize(photo, width: 2048);

  final font = photo.width >= 1600 ? img.arial48 : img.arial24;
  final lineH = font.lineHeight + font.lineHeight ~/ 3;
  final pad = font.lineHeight;
  final top = photo.height - (job.lines.length * lineH + pad * 2);
  img.fillRect(photo, x1: 0, y1: top, x2: photo.width, y2: photo.height, color: img.ColorRgba8(16, 16, 16, 225));
  img.fillRect(photo, x1: 0, y1: top, x2: photo.width, y2: top + max(4, font.lineHeight ~/ 6), color: img.ColorRgb8(252, 188, 24));
  for (var i = 0; i < job.lines.length; i++) {
    img.drawString(
      photo,
      job.lines[i],
      font: font,
      x: pad,
      y: top + pad + i * lineH,
      color: i == 0 ? img.ColorRgb8(252, 188, 24) : img.ColorRgb8(242, 236, 230),
    );
  }
  return img.encodeJpg(photo, quality: 90);
}

class StampJob {
  StampJob(this.bytes, this.lines);
  final Uint8List bytes;
  final List<String> lines;
}

/// The bitmap font is ASCII only.
String _ascii(String s) => s.replaceAll(RegExp(r'[^\x20-\x7E]'), '?');

List<String> stampLines({
  required GeoFix fix,
  required String projectName,
  required String stageName,
  required String evidenceId,
  double? distanceM,
}) => [
  'CONSTRA  |  GPS-TAGGED SITE EVIDENCE',
  'LAT ${fix.lat.toStringAsFixed(6)}  LNG ${fix.lng.toStringAsFixed(6)}  ACC +/-${fix.accuracyM.toStringAsFixed(1)} m'
      '${distanceM == null ? '' : '  SITE ${distanceM.toStringAsFixed(0)} m'}',
  stampTime(fix.time),
  _ascii('$projectName  /  $stageName'),
  'ID $evidenceId',
];

Future<CapturedEvidence> stampAndHash({
  required Uint8List photo,
  required File out,
  required GeoFix fix,
  required String id,
  required int projectId,
  required int stageId,
  required String projectName,
  required String stageName,
  double? distanceM,
}) async {
  final lines = stampLines(fix: fix, projectName: projectName, stageName: stageName, evidenceId: id, distanceM: distanceM);
  final jpeg = await compute(stampJpeg, StampJob(photo, lines));
  await out.writeAsBytes(jpeg, flush: true);
  return CapturedEvidence(
    id: id,
    file: out,
    sha256: sha256.convert(jpeg).toString(),
    fix: fix,
    projectId: projectId,
    stageId: stageId,
    projectName: projectName,
    stageName: stageName,
  );
}
