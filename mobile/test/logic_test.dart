import 'dart:io';

import 'package:constra/capture.dart';
import 'package:constra/screens/login_screen.dart';
import 'package:constra/ui.dart';
import 'package:crypto/crypto.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;

void main() {
  test('haversine matches a known distance (about 111 m per 0.001 deg latitude)', () {
    expect(haversineM(19.0, 73.0, 19.001, 73.0), closeTo(111.2, 0.5));
    expect(haversineM(19.0, 73.0, 19.0, 73.0), 0);
  });

  test('evidence ids are unique and URL-safe', () {
    final ids = List.generate(200, (_) => newEvidenceId()).toSet();
    expect(ids.length, 200);
    expect(ids.every((id) => RegExp(r'^EV-\d+-[0-9a-f]{24}$').hasMatch(id)), isTrue);
  });

  test('stamp lines carry GPS, time, site and stay ASCII for the bitmap font', () {
    final lines = stampLines(
      fix: GeoFix(19.997120, 73.789210, 4.25, DateTime.utc(2026, 10, 28, 12)),
      projectName: 'Shree Construction, Nashik — Phase 1',
      stageName: 'Slab',
      evidenceId: 'EV-1',
      distanceM: 42,
    );
    expect(lines[1], contains('LAT 19.997120  LNG 73.789210  ACC +/-4.3 m  SITE 42 m'));
    expect(lines.join(), matches(RegExp(r'^[\x20-\x7E]*$')));
  });

  test('stamping burns the tag into the photo and the hash covers the stamped bytes', () async {
    final photo = img.encodeJpg(img.Image(width: 1280, height: 720)..clear(img.ColorRgb8(200, 200, 200)));
    final out = File('${Directory.systemTemp.createTempSync().path}/ev.jpg');
    final ev = await stampAndHash(
      photo: photo,
      out: out,
      fix: GeoFix(19.99, 73.78, 5, DateTime.now()),
      id: 'EV-1',
      projectId: 1,
      stageId: 2,
      projectName: 'P',
      stageName: 'S',
    );
    final bytes = await out.readAsBytes();
    expect(ev.sha256, sha256.convert(bytes).toString());
    final stamped = img.decodeJpg(bytes)!;
    expect(stamped.width, 1280);
    // Bottom-left is inside the dark banner; the top is the untouched grey photo.
    expect(stamped.getPixel(2, 715).r, lessThan(60));
    expect(stamped.getPixel(2, 5).r, greaterThan(180));
  });

  testWidgets('login screen offers BridgeKey and email sign-in', (tester) async {
    tester.view.physicalSize = const Size(1080, 2340);
    tester.view.devicePixelRatio = 2.75;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(MaterialApp(theme: buildTheme(), home: const LoginScreen()));
    expect(find.text('SIGN IN WITH BRIDGEKEY'), findsOneWidget);
    expect(find.text('SIGN IN'), findsOneWidget);
    await tester.tap(find.text('SIGN IN WITH BRIDGEKEY'));
    await tester.pumpAndSettle();
    expect(find.text('BridgeKey on a computer'), findsOneWidget);
  });
}
