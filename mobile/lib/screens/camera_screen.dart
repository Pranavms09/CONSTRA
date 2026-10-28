import 'dart:async';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../api.dart';
import '../capture.dart';
import '../ui.dart';
import '../uploads.dart';
import 'review_screen.dart';

/// Live viewfinder with a GPS HUD; the shutter only works with a fresh, real (non-mock) fix.
class CameraScreen extends StatefulWidget {
  const CameraScreen({super.key, required this.project, required this.stage});
  final Project project;
  final Stage stage;
  @override
  State<CameraScreen> createState() => _CameraScreenState();
}

class _CameraScreenState extends State<CameraScreen> with WidgetsBindingObserver {
  static const _maxFixAge = Duration(seconds: 20);
  CameraController? _camera;
  StreamSubscription<Position>? _gps;
  Position? _pos;
  String? _cameraError, _gpsError;
  bool _busy = false;
  Timer? _clock;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initCamera();
    _initGps();
    _clock = Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _clock?.cancel();
    _gps?.cancel();
    _camera?.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.inactive) {
      _camera?.dispose();
      _camera = null;
      _gps?.cancel();
    } else if (state == AppLifecycleState.resumed) {
      _initCamera();
      _initGps();
    }
  }

  Future<void> _initCamera() async {
    try {
      final cams = await availableCameras();
      if (cams.isEmpty) throw CameraException('none', 'No camera found on this device.');
      final cam = cams.firstWhere((c) => c.lensDirection == CameraLensDirection.back, orElse: () => cams.first);
      final ctrl = CameraController(cam, ResolutionPreset.veryHigh, enableAudio: false, imageFormatGroup: ImageFormatGroup.jpeg);
      await ctrl.initialize();
      if (!mounted) {
        await ctrl.dispose();
        return;
      }
      setState(() {
        _camera = ctrl;
        _cameraError = null;
      });
    } on CameraException catch (e) {
      setState(
        () => _cameraError = e.code == 'CameraAccessDenied'
            ? 'Camera permission denied. Allow it in system settings.'
            : e.description ?? e.code,
      );
    }
  }

  Future<void> _initGps() async {
    setState(() => _gpsError = null);
    if (!await Geolocator.isLocationServiceEnabled()) {
      setState(() => _gpsError = 'Turn on location (GPS) to capture evidence.');
      return;
    }
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
    if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
      setState(() => _gpsError = 'Location permission is required: evidence must carry a GPS tag.');
      return;
    }
    await _gps?.cancel();
    _gps = Geolocator.getPositionStream(locationSettings: const LocationSettings(accuracy: LocationAccuracy.best))
        .listen((p) => setState(() => _pos = p), onError: (Object e) => setState(() => _gpsError = 'GPS error: $e'));
  }

  bool get _fresh => _pos != null && DateTime.now().difference(_pos!.timestamp) < _maxFixAge;

  double? get _distance {
    final p = widget.project;
    return _pos == null || p.lat == null || p.lng == null ? null : haversineM(_pos!.latitude, _pos!.longitude, p.lat!, p.lng!);
  }

  Future<void> _shoot() async {
    final cam = _camera, pos = _pos;
    if (cam == null || pos == null || _busy) return;
    if (pos.isMocked) return showError(context, 'Mock location detected. Disable fake-GPS apps to capture evidence.');
    setState(() => _busy = true);
    try {
      final shot = await cam.takePicture();
      final fix = GeoFix(pos.latitude, pos.longitude, pos.accuracy, DateTime.now());
      final id = newEvidenceId();
      final ev = await stampAndHash(
        photo: await shot.readAsBytes(),
        out: uploads.photoFile(id),
        fix: fix,
        id: id,
        projectId: widget.project.id,
        stageId: widget.stage.id,
        projectName: widget.project.name,
        stageName: widget.stage.name,
        distanceM: _distance,
      );
      if (!mounted) return;
      await Navigator.push<void>(
        context,
        MaterialPageRoute(
          builder: (_) => ReviewScreen(evidence: ev, project: widget.project, distanceM: _distance),
        ),
      );
    } catch (e) {
      if (mounted) showError(context, 'Capture failed: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cam = _camera;
    final ready = cam != null && _fresh && !_busy;
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          if (cam != null)
            Center(
              child: AspectRatio(aspectRatio: 1 / cam.value.aspectRatio, child: CameraPreview(cam)),
            )
          else
            Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: _cameraError == null
                    ? const CircularProgressIndicator(color: C.signal)
                    : Text(
                        _cameraError!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Colors.white),
                      ),
              ),
            ),
          // Corner brackets: framing guide.
          const IgnorePointer(child: CustomPaint(painter: _FramePainter())),
          Positioned(top: 0, left: 0, right: 0, child: SafeArea(child: _topBar(context))),
          Positioned(left: 0, right: 0, bottom: 0, child: SafeArea(top: false, child: _bottom(ready))),
          if (_busy)
            Container(
              color: Colors.black54,
              child: const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircularProgressIndicator(color: C.signal),
                    SizedBox(height: 14),
                    Text(
                      'Stamping GPS tag and hashing…',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _topBar(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(8, 4, 16, 0),
    child: Row(
      children: [
        IconButton(
          onPressed: () => Navigator.pop(context),
          icon: const Icon(Icons.close, color: Colors.white),
          tooltip: 'Close',
        ),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                widget.stage.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800),
              ),
              Text(
                widget.project.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Colors.white70, fontSize: 12),
              ),
            ],
          ),
        ),
      ],
    ),
  );

  Widget _bottom(bool ready) {
    final p = _pos;
    final d = _distance;
    final inside = d == null || d <= widget.project.radiusM + (p?.accuracy ?? 0).clamp(0, 50);
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
      decoration: BoxDecoration(
        color: const Color(0xE6101010),
        borderRadius: BorderRadius.circular(10),
        border: const Border(top: BorderSide(color: C.signal, width: 3)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Icon(Icons.gps_fixed, size: 16, color: _fresh ? C.signal : Colors.white38),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  _gpsError ??
                      (p == null ? 'Acquiring GPS fix…' : '${formatCoord(p.latitude, 'N', 'S')}   ${formatCoord(p.longitude, 'E', 'W')}'),
                  style: mono.copyWith(color: _gpsError == null ? Colors.white : const Color(0xFFFF8A80), fontSize: 12.5),
                ),
              ),
              if (_gpsError != null)
                TextButton(
                  onPressed: _initGps,
                  child: const Text('RETRY', style: TextStyle(color: C.signal)),
                ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Text(p == null ? '±— m' : '±${p.accuracy.toStringAsFixed(1)} m', style: mono.copyWith(color: Colors.white70, fontSize: 12)),
              const SizedBox(width: 12),
              Expanded(
                child: Text(stampTime(DateTime.now()), style: mono.copyWith(color: Colors.white70, fontSize: 12)),
              ),
              if (d != null)
                _HudChip(inside ? '${d.toStringAsFixed(0)} m · ON SITE' : '${d.toStringAsFixed(0)} m · OFF SITE', inside ? C.ok : C.bad),
              if (p?.isMocked ?? false) const _HudChip('MOCK GPS', C.bad),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Semantics(
                button: true,
                label: 'Capture photo',
                child: GestureDetector(
                  onTap: ready ? _shoot : null,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    width: 74,
                    height: 74,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: ready ? C.signal : Colors.white24, width: 4),
                    ),
                    padding: const EdgeInsets.all(5),
                    child: DecoratedBox(
                      decoration: BoxDecoration(shape: BoxShape.circle, color: ready ? Colors.white : Colors.white24),
                    ),
                  ),
                ),
              ),
            ],
          ),
          if (!_fresh && _gpsError == null) ...[
            const SizedBox(height: 8),
            const Text('Waiting for a live GPS fix before capture', style: TextStyle(color: Colors.white60, fontSize: 12)),
          ],
        ],
      ),
    );
  }
}

class _HudChip extends StatelessWidget {
  const _HudChip(this.label, this.color);
  final String label;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(left: 6),
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
    decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3)),
    child: Text(
      label,
      style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 0.6),
    ),
  );
}

class _FramePainter extends CustomPainter {
  const _FramePainter();
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white70
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;
    const len = 26.0, inset = 28.0;
    final r = Rect.fromLTRB(inset, size.height * 0.16, size.width - inset, size.height * 0.62);
    for (final (c, dx, dy) in [(r.topLeft, 1.0, 1.0), (r.topRight, -1.0, 1.0), (r.bottomLeft, 1.0, -1.0), (r.bottomRight, -1.0, -1.0)]) {
      canvas.drawLine(c, c.translate(len * dx, 0), paint);
      canvas.drawLine(c, c.translate(0, len * dy), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
