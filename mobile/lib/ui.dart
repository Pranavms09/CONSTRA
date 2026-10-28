import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// CONSTRA field palette: carbon ink on site-paper, signal yellow for action.
class C {
  static const ink = Color(0xFF101010);
  static const paper = Color(0xFFF2ECE6);
  static const surface = Color(0xFFFFFFFF);
  static const signal = Color(0xFFFCBC18);
  static const line = Color(0xFFDCD3C8);
  static const muted = Color(0xFF6E665D);
  static const ok = Color(0xFF296A49);
  static const bad = Color(0xFFBA1A1A);
  static const info = Color(0xFF2F5D8A);
}

const mono = TextStyle(fontFamily: 'monospace', fontFamilyFallback: ['Courier'], letterSpacing: 0);

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(seedColor: C.signal, brightness: Brightness.light).copyWith(
    primary: C.ink,
    onPrimary: C.paper,
    secondary: C.signal,
    onSecondary: C.ink,
    surface: C.paper,
    onSurface: C.ink,
    error: C.bad,
    outline: C.line,
  );
  final base = ThemeData(useMaterial3: true, colorScheme: scheme, scaffoldBackgroundColor: C.paper);
  final text = base.textTheme.apply(bodyColor: C.ink, displayColor: C.ink);
  return base.copyWith(
    textTheme: text.copyWith(
      headlineMedium: text.headlineMedium?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -0.5),
      headlineSmall: text.headlineSmall?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -0.3),
      titleLarge: text.titleLarge?.copyWith(fontWeight: FontWeight.w800),
      titleMedium: text.titleMedium?.copyWith(fontWeight: FontWeight.w700),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: C.paper,
      foregroundColor: C.ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(color: C.ink, fontSize: 18, fontWeight: FontWeight.w800, letterSpacing: 0.2),
      systemOverlayStyle: SystemUiOverlayStyle.dark,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: C.ink,
        foregroundColor: C.paper,
        minimumSize: const Size.fromHeight(54),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
        textStyle: const TextStyle(fontWeight: FontWeight.w800, letterSpacing: 1.1, fontSize: 14),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: C.ink,
        minimumSize: const Size.fromHeight(50),
        side: const BorderSide(color: C.ink, width: 1.4),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, letterSpacing: 0.8),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: C.ink,
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: C.surface,
      isDense: false,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(6),
        borderSide: const BorderSide(color: C.line),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(6),
        borderSide: const BorderSide(color: C.line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(6),
        borderSide: const BorderSide(color: C.ink, width: 1.6),
      ),
      labelStyle: const TextStyle(color: C.muted),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: C.surface,
      indicatorColor: C.signal,
      height: 68,
      labelTextStyle: WidgetStateProperty.all(const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
    ),
    snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating, backgroundColor: C.ink),
    dividerTheme: const DividerThemeData(color: C.line, space: 1),
    bottomSheetTheme: const BottomSheetThemeData(backgroundColor: C.paper, showDragHandle: true),
  );
}

/// White card with a hairline border; the base surface of every screen.
class Panel extends StatelessWidget {
  const Panel({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
    this.color = C.surface,
    this.borderColor = C.line,
  });
  final Widget child;
  final EdgeInsets padding;
  final VoidCallback? onTap;
  final Color color, borderColor;

  @override
  Widget build(BuildContext context) => Material(
    color: color,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(8),
      side: BorderSide(color: borderColor),
    ),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: Padding(padding: padding, child: child),
    ),
  );
}

/// Small uppercase section label.
class Eyebrow extends StatelessWidget {
  const Eyebrow(this.text, {super.key, this.color = C.muted});
  final String text;
  final Color color;
  @override
  Widget build(BuildContext context) => Text(
    text.toUpperCase(),
    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1.4, color: color),
  );
}

enum Tone { ok, warn, bad, info, neutral }

Color toneColor(Tone t) => switch (t) {
  Tone.ok => C.ok,
  Tone.warn => const Color(0xFF8A5A00),
  Tone.bad => C.bad,
  Tone.info => C.info,
  Tone.neutral => C.muted,
};

class StatusPill extends StatelessWidget {
  const StatusPill(this.label, this.tone, {super.key, this.icon});
  final String label;
  final Tone tone;
  final IconData? icon;
  @override
  Widget build(BuildContext context) {
    final c = toneColor(tone);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: c.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[Icon(icon, size: 13, color: c), const SizedBox(width: 4)],
          Text(
            label.toUpperCase(),
            style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, letterSpacing: 0.8, color: c),
          ),
        ],
      ),
    );
  }
}

/// Label/value line; mono values can be copied with a long press.
class InfoRow extends StatelessWidget {
  const InfoRow(this.label, this.value, {super.key, this.isMono = false});
  final String label, value;
  final bool isMono;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 6),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 104,
          child: Text(label, style: const TextStyle(color: C.muted, fontSize: 13)),
        ),
        Expanded(
          child: GestureDetector(
            onLongPress: isMono
                ? () {
                    Clipboard.setData(ClipboardData(text: value));
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$label copied')));
                  }
                : null,
            child: Text(value, style: isMono ? mono.copyWith(fontSize: 12.5) : const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
          ),
        ),
      ],
    ),
  );
}

(String, Tone) aiLabel(String s) => switch (s) {
  'completed' => ('AI analysed', Tone.ok),
  'failed' => ('AI failed', Tone.bad),
  'analyzing' => ('AI analysing', Tone.info),
  _ => ('AI pending', Tone.neutral),
};

(String, Tone) chainLabel(String s) => switch (s) {
  'confirmed' => ('Anchored on MST', Tone.ok),
  'failed' => ('Anchor failed', Tone.bad),
  'simulated' => ('Simulated', Tone.warn),
  'submitted' => ('Confirming on MST', Tone.info),
  _ => ('Queued for MST', Tone.neutral),
};

void showError(BuildContext context, Object e) =>
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: C.bad));

void showInfo(BuildContext context, String msg) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));

String shortDate(DateTime t) {
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  String two(int n) => n.toString().padLeft(2, '0');
  return '${t.day} ${m[t.month - 1]}, ${two(t.hour)}:${two(t.minute)}';
}

String shortHash(String h) => h.length > 16 ? '${h.substring(0, 10)}…${h.substring(h.length - 6)}' : h;
