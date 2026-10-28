import 'package:flutter/material.dart';

import 'api.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'ui.dart';
import 'uploads.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Future.wait([api.load(), uploads.load()]);
  runApp(const ConstraApp());
}

class ConstraApp extends StatelessWidget {
  const ConstraApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'CONSTRA Site',
    debugShowCheckedModeBanner: false,
    theme: buildTheme(),
    // Signing in or out swaps the whole screen stack.
    home: ListenableBuilder(listenable: api, builder: (context, _) => api.user == null ? const LoginScreen() : const HomeScreen()),
  );
}
