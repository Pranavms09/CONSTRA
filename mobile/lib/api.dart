import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import 'config.dart';

class ApiException implements Exception {
  ApiException(this.status, this.message);
  final int status;
  final String message;

  /// Worth retrying later (offline queue) rather than a rejection by the server.
  bool get retryable => status == 0 || status == 408 || status == 429 || status >= 500;

  @override
  String toString() => message;
}

class User {
  User(this.json);
  final Map<String, dynamic> json;
  int get id => json['id'] as int;
  String get fullName => json['full_name'] as String? ?? '';
  String get email => json['email'] as String? ?? '';
  String get role => json['role'] as String? ?? '';
  String? get wallet => json['wallet_address'] as String?;
}

class Project {
  Project(Map<String, dynamic> j)
    : id = j['id'] as int,
      name = j['name'] as String,
      address = j['site_address'] as String?,
      lat = (j['centroid_lat'] as num?)?.toDouble(),
      lng = (j['centroid_lng'] as num?)?.toDouble(),
      radiusM = (j['site_radius_m'] as num?)?.toDouble() ?? 200;
  final int id;
  final String name;
  final String? address;
  final double? lat, lng;
  final double radiusM;
}

class Stage {
  Stage(Map<String, dynamic> j)
    : id = j['id'] as int,
      name = j['name'] as String,
      status = j['status'] as String? ?? '',
      progress = (j['verified_progress'] as num?)?.toDouble() ?? 0;
  final int id;
  final String name, status;
  final double progress; // 0–1
}

/// Server evidence record (backend `evidenceResponse`); kept as JSON with typed getters.
class Evidence {
  Evidence(this.j);
  final Map<String, dynamic> j;
  int get id => j['id'] as int;
  String get projectName => j['project_name'] as String? ?? 'Project ${j['project_id']}';
  String get stageName => j['stage_name'] as String? ?? 'Stage ${j['stage_id']}';
  String get status => j['status'] as String? ?? '';
  bool get hashMatched => j['hash_matched'] == true;
  bool get withinRadius => j['is_within_radius'] != false;
  double? get distanceM => (j['distance_to_site_m'] as num?)?.toDouble();
  double get lat => (j['latitude'] as num).toDouble();
  double get lng => (j['longitude'] as num).toDouble();
  double get accuracyM => (j['accuracy_m'] as num).toDouble();
  DateTime get capturedAt => DateTime.parse(j['captured_at'] as String).toLocal();
  String get sha256 => j['server_sha256'] as String? ?? '';
  String? get notes => j['notes'] as String?;
  Map<String, dynamic> get ai => (j['ai_analysis'] as Map?)?.cast<String, dynamic>() ?? const {};
  Map<String, dynamic> get chain => (j['blockchain'] as Map?)?.cast<String, dynamic>() ?? const {};
  String get aiStatus => ai['status'] as String? ?? 'pending';
  String get chainStatus => chain['status'] as String? ?? j['blockchain_status'] as String? ?? 'queued';
  String get fileUrl => '${Api.instance.baseUrl}/supervisor/evidence/$id/file';

  /// Still changing on the server: AI running or the MST anchor not final yet.
  bool get settling => const {'pending', 'analyzing'}.contains(aiStatus) || const {'queued', 'submitted'}.contains(chainStatus);
}

/// HTTP client for the CONSTRA Worker; also owns the session (token + user) in secure storage.
class Api extends ChangeNotifier {
  Api._();
  static final instance = Api._();
  static const _store = FlutterSecureStorage();

  String baseUrl = Config.apiBaseUrl;
  String? _token;
  User? user;

  Future<void> load() async {
    baseUrl = await _store.read(key: 'base_url') ?? Config.apiBaseUrl;
    _token = await _store.read(key: 'token');
    final u = await _store.read(key: 'user');
    user = u == null || _token == null ? null : User(jsonDecode(u) as Map<String, dynamic>);
  }

  Future<void> setBaseUrl(String url) async {
    baseUrl = url.trim().replaceAll(RegExp(r'/+$'), '');
    await _store.write(key: 'base_url', value: baseUrl);
    notifyListeners();
  }

  /// Stores a login response (`{...user, token}`); this app is for site supervisors only.
  Future<User> startSession(Map<String, dynamic> body) async {
    final u = User(body);
    if (u.role != 'supervisor') {
      throw ApiException(403, "This account is a '${u.role}'. The mobile app is for site supervisors; use the CONSTRA web portal.");
    }
    _token = body['token'] as String?;
    if (_token == null) throw ApiException(500, 'Server did not return a session token.');
    user = u;
    await _store.write(key: 'token', value: _token);
    await _store.write(key: 'user', value: jsonEncode(body..remove('token')));
    notifyListeners();
    return u;
  }

  Future<void> logout() async {
    _token = null;
    user = null;
    await _store.delete(key: 'token');
    await _store.delete(key: 'user');
    notifyListeners();
  }

  Map<String, String> get authHeaders => {if (_token != null) 'Authorization': 'Bearer $_token'};

  Future<dynamic> get(String path) => _send(http.Request('GET', Uri.parse('$baseUrl$path')));

  Future<dynamic> post(String path, [Map<String, dynamic>? body]) {
    final req = http.Request('POST', Uri.parse('$baseUrl$path'))..headers['Content-Type'] = 'application/json';
    req.body = jsonEncode(body ?? {});
    return _send(req);
  }

  Future<dynamic> upload(String path, Map<String, String> fields, File file) async {
    final req = http.MultipartRequest('POST', Uri.parse('$baseUrl$path'))
      ..fields.addAll(fields)
      ..files.add(await http.MultipartFile.fromPath('file', file.path, filename: file.uri.pathSegments.last));
    return _send(req, timeout: const Duration(seconds: 90));
  }

  /// Returns decoded JSON; [ApiException] with status 0 means the server was unreachable.
  Future<dynamic> _send(http.BaseRequest req, {Duration timeout = const Duration(seconds: 30)}) async {
    req.headers.addAll(authHeaders);
    http.Response res;
    try {
      res = await http.Response.fromStream(await req.send().timeout(timeout));
    } on SocketException {
      throw ApiException(0, 'No connection to the CONSTRA server.');
    } on TimeoutException {
      throw ApiException(0, 'The CONSTRA server did not respond in time.');
    } on http.ClientException catch (e) {
      throw ApiException(0, 'Network error: ${e.message}');
    }
    final body = res.body.isEmpty ? null : _tryJson(res.body);
    if (res.statusCode >= 400) {
      if (res.statusCode == 401 && _token != null && !req.url.path.startsWith('/auth/')) await logout();
      final detail = body is Map ? body['detail'] : null;
      throw ApiException(res.statusCode, detail is String ? detail : 'Request failed (${res.statusCode}).');
    }
    return body;
  }

  static dynamic _tryJson(String s) {
    try {
      return jsonDecode(s);
    } on FormatException {
      return null;
    }
  }
}

final api = Api.instance;
