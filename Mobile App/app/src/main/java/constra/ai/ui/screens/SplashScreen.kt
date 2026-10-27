package constra.ai.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import constra.ai.ConstraApp
import constra.ai.R
import constra.ai.ui.navigation.Screen
import constra.ai.ui.theme.*
import kotlinx.coroutines.delay

@Composable
fun SplashScreen(
    onNavigateToLogin: () -> Unit,
    onNavigateToDashboard: () -> Unit
) {
    LaunchedEffect(Unit) {
        delay(1200) // Brief initial branding presentation
        val authRepo = ConstraApp.instance.authRepository
        val result = authRepo.restoreSession()
        if (result.isSuccess) {
            onNavigateToDashboard()
        } else {
            onNavigateToLogin()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(CarbonBlack),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(24.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(96.dp)
                    .border(2.dp, SignalYellow)
                    .background(SurfaceCard),
                contentAlignment = Alignment.Center
            ) {
                Image(
                    painter = painterResource(id = R.drawable.constra_logo),
                    contentDescription = "CONSTRA",
                    modifier = Modifier.size(72.dp)
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            Text(
                text = "CONSTRA",
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                fontSize = 28.sp,
                color = SignalYellow,
                letterSpacing = 2.sp
            )

            Text(
                text = "FIELD EVIDENCE REGISTRY // MOBILE",
                fontFamily = FontFamily.Monospace,
                fontSize = 12.sp,
                color = PaperGray,
                letterSpacing = 1.sp
            )

            Spacer(modifier = Modifier.height(36.dp))

            Box(
                modifier = Modifier
                    .border(1.dp, BorderStone)
                    .background(SurfaceCard)
                    .padding(horizontal = 16.dp, vertical = 8.dp)
            ) {
                Text(
                    text = "INITIALIZING TELEMETRY & AUDIT KERNEL...",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    color = SignalYellow
                )
            }
        }

        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 24.dp)
        ) {
            Text(
                text = "ISO-9001:2015 SECTION 8.5.1 // SPEC REV 2.4",
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
                color = TextMuted
            )
        }
    }
}
