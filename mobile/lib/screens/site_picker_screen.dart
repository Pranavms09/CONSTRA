import 'package:flutter/material.dart';

import '../api.dart';
import '../ui.dart';
import 'camera_screen.dart';

/// Step 1 of a capture: choose the assigned site and the construction stage being evidenced.
class SitePickerScreen extends StatefulWidget {
  const SitePickerScreen({super.key});
  @override
  State<SitePickerScreen> createState() => _SitePickerScreenState();
}

class _SitePickerScreenState extends State<SitePickerScreen> {
  List<Project>? _projects;
  Project? _project;
  List<Stage>? _stages;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadProjects();
  }

  Future<void> _loadProjects() async {
    setState(() => _error = null);
    try {
      final list = ((await api.get('/supervisor/projects')) as List).map((p) => Project(p as Map<String, dynamic>)).toList();
      setState(() => _projects = list);
      if (list.length == 1) _select(list.first);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    }
  }

  Future<void> _select(Project p) async {
    setState(() {
      _project = p;
      _stages = null;
      _error = null;
    });
    try {
      final list = ((await api.get('/supervisor/projects/${p.id}/stages')) as List).map((s) => Stage(s as Map<String, dynamic>)).toList();
      if (_project == p) setState(() => _stages = list);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('New capture')),
    body: ListView(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
      children: [
        const Eyebrow('1 · Site'),
        const SizedBox(height: 10),
        if (_error != null) ...[
          Panel(
            borderColor: C.bad,
            child: Text(_error!, style: const TextStyle(color: C.bad)),
          ),
          const SizedBox(height: 10),
          OutlinedButton(onPressed: _loadProjects, child: const Text('RETRY')),
        ],
        if (_projects == null && _error == null)
          const Padding(
            padding: EdgeInsets.all(24),
            child: Center(child: CircularProgressIndicator()),
          ),
        if (_projects?.isEmpty ?? false)
          const Panel(child: Text('No sites are assigned to you yet. Ask your Project Auditor to add you to a project.')),
        for (final p in _projects ?? const <Project>[])
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Panel(
              onTap: () => _select(p),
              borderColor: _project == p ? C.ink : C.line,
              child: Row(
                children: [
                  Icon(_project == p ? Icons.radio_button_checked : Icons.radio_button_off),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(p.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                        if (p.address != null) Text(p.address!, style: const TextStyle(color: C.muted, fontSize: 12.5)),
                        const SizedBox(height: 4),
                        Text(
                          p.lat == null ? 'No geofence set' : 'Geofence ${p.radiusM.toStringAsFixed(0)} m',
                          style: mono.copyWith(fontSize: 11, color: C.muted),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        if (_project != null) ...[
          const SizedBox(height: 18),
          const Eyebrow('2 · Stage'),
          const SizedBox(height: 10),
          if (_stages == null && _error == null)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: CircularProgressIndicator()),
            ),
          if (_stages?.isEmpty ?? false) const Panel(child: Text('This project has no stages yet.')),
          for (final s in _stages ?? const <Stage>[])
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Panel(
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute<void>(
                    builder: (_) => CameraScreen(project: _project!, stage: s),
                  ),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(s.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                          const SizedBox(height: 6),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(2),
                            child: LinearProgressIndicator(
                              value: s.progress.clamp(0, 1).toDouble(),
                              minHeight: 4,
                              backgroundColor: C.line,
                              color: C.ok,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${(s.progress * 100).toStringAsFixed(0)}% verified · ${s.status.replaceAll('_', ' ')}',
                            style: const TextStyle(color: C.muted, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Icon(Icons.photo_camera_outlined),
                  ],
                ),
              ),
            ),
        ],
      ],
    ),
  );
}
