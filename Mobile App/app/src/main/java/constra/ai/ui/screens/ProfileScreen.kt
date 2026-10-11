package constra.ai.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import constra.ai.ConstraApp
import constra.ai.ui.components.*
import constra.ai.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun ProfileScreen(
    onSignOut: () -> Unit,
    onBackClick: () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    val authRepo = ConstraApp.instance.authRepository
    val sessionManager = ConstraApp.instance.sessionManager
    val networkClient = ConstraApp.instance.networkClient

    val currentUser = sessionManager.getCurrentUser()
    var backendUrl by remember { mutableStateOf(sessionManager.getBackendUrl()) }
    var pingStatus by remember { mutableStateOf<String?>(null) }
    var isPinging by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(CarbonBlack)
    ) {
        TechnicalHeader(
            title = "SYSTEM CONFIG",
            subtitle = "SUPERVISOR PROFILE",
            onBackClick = onBackClick
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // USER ACCOUNT CARD
            BlueprintCard(
                borderColor = SignalYellow,
                backgroundColor = SurfaceCard
            ) {
                Text(
                    text = "AUTHENTICATED IDENTITY SPECIFICATION",
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 11.sp,
                    color = SignalYellow
                )

                Spacer(modifier = Modifier.height(10.dp))

                TelemetryRow(label = "NAME", value = currentUser?.fullName?.takeIf { it.isNotBlank() } ?: "Site Supervisor")
                TelemetryRow(label = "EMAIL", value = currentUser?.email ?: "supervisor@siteverify.com")
                TelemetryRow(label = "AUTHORIZED ROLE", value = currentUser?.role?.uppercase() ?: "SUPERVISOR")
                TelemetryRow(label = "ACCOUNT CLEARANCE", value = "ACTIVE // VERIFIED")
            }

            // BACKEND HOST ENDPOINT CONFIGURATION
            BlueprintCard(borderColor = BorderStone) {
                Text(
                    text = "BACKEND HOST INTEGRATION",
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 11.sp,
                    color = PaperGray
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = "TARGET FASTAPI URL:",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                    color = TextMuted
                )
                Spacer(modifier = Modifier.height(4.dp))
                OutlinedTextField(
                    value = backendUrl,
                    onValueChange = {
                        backendUrl = it
                        sessionManager.setBackendUrl(it)
                    },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = SignalYellow,
                        unfocusedBorderColor = BorderStone,
                        focusedTextColor = PaperGray,
                        unfocusedTextColor = PaperGray
                    ),
                    shape = RoundedCornerShape(0.dp)
                )

                Spacer(modifier = Modifier.height(10.dp))

                // Ping Diagnostic Button
                OutlineButton(
                    text = if (isPinging) "CONNECTING..." else "TEST API CLEARANCE (/supervisor/ping)",
                    enabled = !isPinging,
                    onClick = {
                        isPinging = true
                        pingStatus = null
                        coroutineScope.launch {
                            try {
                                val api = networkClient.getApiService()
                                val response = api.pingSupervisor()
                                isPinging = false
                                pingStatus = if (response.isSuccessful) {
                                    "200 OK — ${response.body()?.message}"
                                } else {
                                    "ERROR (${response.code()}): ${response.errorBody()?.string()}"
                                }
                            } catch (e: Exception) {
                                isPinging = false
                                pingStatus = "CONNECTION FAILED: ${e.localizedMessage}"
                            }
                        }
                    }
                )

                if (pingStatus != null) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(SurfaceElevated)
                            .border(1.dp, if (pingStatus!!.startsWith("200")) StatusPass else StatusDefect)
                            .padding(8.dp)
                    ) {
                        Text(
                            text = pingStatus!!,
                            fontFamily = FontFamily.Monospace,
                            fontSize = 11.sp,
                            color = if (pingStatus!!.startsWith("200")) StatusPass else StatusDefect
                        )
                    }
                }
            }

            // TECHNICAL DRAFTING METRICS CARD
            BlueprintCard(borderColor = BorderStone) {
                Text(
                    text = "APPLICATION REVISION SPEC",
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 11.sp,
                    color = TextMuted
                )
                Spacer(modifier = Modifier.height(6.dp))
                TelemetryRow(label = "APP NAME", value = "CONSTRA Mobile")
                TelemetryRow(label = "VERSION", value = "1.0.0 (Build 1)")
                TelemetryRow(label = "FRAMEWORK", value = "Kotlin // Jetpack Compose // CameraX")
                TelemetryRow(label = "STANDARD", value = "ISO-9001:2015 SECTION 8.5.1")
            }

            Spacer(modifier = Modifier.height(8.dp))

            // SIGN OUT ACTION
            SignalButton(
                text = "SIGN OUT OF MOBILE TERMINAL",
                onClick = {
                    authRepo.signOut()
                    onSignOut()
                }
            )
        }
    }
}
