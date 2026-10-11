package constra.ai.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val DarkColorScheme = darkColorScheme(
    primary = SignalYellow,
    onPrimary = CarbonBlack,
    primaryContainer = SurfaceCard,
    onPrimaryContainer = SignalYellow,
    secondary = PaperGray,
    onSecondary = CarbonBlack,
    background = SurfaceDark,
    onBackground = PaperGray,
    surface = SurfaceDark,
    onSurface = PaperGray,
    surfaceVariant = SurfaceCard,
    onSurfaceVariant = TextMuted,
    outline = BorderStone,
    error = StatusDefect,
    onError = WarmIvory
)

@Composable
fun ConstraTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        typography = Typography,
        content = content
    )
}
