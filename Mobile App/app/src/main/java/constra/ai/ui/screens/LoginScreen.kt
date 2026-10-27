package constra.ai.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import constra.ai.ConstraApp
import constra.ai.R
import constra.ai.ui.components.BlueprintCard
import constra.ai.ui.components.OutlineButton
import constra.ai.ui.components.SignalButton
import constra.ai.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    val authRepo = ConstraApp.instance.authRepository
    val sessionManager = ConstraApp.instance.sessionManager

    var email by remember { mutableStateOf("supervisor@siteverify.com") }
    var password by remember { mutableStateOf("3157") }
    var backendUrl by remember { mutableStateOf(sessionManager.getBackendUrl()) }
    var showUrlConfig by remember { mutableStateOf(false) }

    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(CarbonBlack)
            .statusBarsPadding()
            .padding(top = 16.dp)
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(24.dp))

        // Branding Title Block
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(bottom = 16.dp)
        ) {
            Image(
                painter = painterResource(id = R.drawable.constra_logo),
                contentDescription = "CONSTRA",
                modifier = Modifier.size(44.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column {
                Text(
                    text = "CONSTRA",
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 24.sp,
                    color = SignalYellow,
                    letterSpacing = 1.sp
                )
                Text(
                    text = "FIELD EVIDENCE CAPTURE // SUPERVISOR",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    color = PaperGray
                )
            }
        }

        // Industrial Warning Card
        BlueprintCard(
            borderColor = SignalYellow,
            backgroundColor = SurfaceElevated
        ) {
            Text(
                text = "SUPERVISOR AUTHORIZATION REQUIRED",
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                fontSize = 12.sp,
                color = SignalYellow
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "This mobile terminal is restricted exclusively to authorized Site Supervisors. Store In-Charge and Auditor roles must access their respective web desks.",
                fontFamily = FontFamily.SansSerif,
                fontSize = 12.sp,
                color = PaperGray
            )
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Credentials Card
        BlueprintCard(
            borderColor = BorderStone,
            backgroundColor = SurfaceCard
        ) {
            Text(
                text = "CREDENTIAL AUTHENTICATION",
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                fontSize = 13.sp,
                color = PaperGray
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Email Input
            Text(
                text = "SUPERVISOR EMAIL",
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp,
                color = TextMuted
            )
            Spacer(modifier = Modifier.height(4.dp))
            OutlinedTextField(
                value = email,
                onValueChange = { email = it },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = SignalYellow,
                    unfocusedBorderColor = BorderStone,
                    focusedTextColor = PaperGray,
                    unfocusedTextColor = PaperGray,
                    cursorColor = SignalYellow
                ),
                shape = RoundedCornerShape(0.dp)
            )

            Spacer(modifier = Modifier.height(14.dp))

            // Password Input
            Text(
                text = "PASSWORD / PIN",
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp,
                color = TextMuted
            )
            Spacer(modifier = Modifier.height(4.dp))
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = SignalYellow,
                    unfocusedBorderColor = BorderStone,
                    focusedTextColor = PaperGray,
                    unfocusedTextColor = PaperGray,
                    cursorColor = SignalYellow
                ),
                shape = RoundedCornerShape(0.dp)
            )

            if (errorMessage != null) {
                Spacer(modifier = Modifier.height(12.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(StatusDefectBg)
                        .border(1.dp, StatusDefect)
                        .padding(8.dp)
                ) {
                    Text(
                        text = "AUTH ERROR: $errorMessage",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        color = StatusDefect
                    )
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            SignalButton(
                text = if (isLoading) "AUTHENTICATING..." else "SIGN IN AS SUPERVISOR",
                enabled = !isLoading && email.isNotBlank(),
                onClick = {
                    isLoading = true
                    errorMessage = null
                    coroutineScope.launch {
                        val result = authRepo.loginWithPassword(email, password)
                        isLoading = false
                        if (result.isSuccess) {
                            onLoginSuccess()
                        } else {
                            errorMessage = result.exceptionOrNull()?.message ?: "Login failed"
                        }
                    }
                }
            )

            Spacer(modifier = Modifier.height(10.dp))

            // Instant Quick Access Mode
            OutlineButton(
                text = "⚡ INSTANT SUPERVISOR LOGIN",
                enabled = !isLoading,
                onClick = {
                    isLoading = true
                    errorMessage = null
                    coroutineScope.launch {
                        val result = authRepo.loginWithDemo()
                        isLoading = false
                        if (result.isSuccess) {
                            onLoginSuccess()
                        } else {
                            errorMessage = result.exceptionOrNull()?.message ?: "Demo login failed"
                        }
                    }
                }
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Backend URL Settings Configuration Toggle
        TextButton(
            onClick = { showUrlConfig = !showUrlConfig }
        ) {
            Text(
                text = if (showUrlConfig) "▲ HIDE BACKEND HOST CONFIG" else "▼ CONFIGURE BACKEND API HOST",
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp,
                color = TextMuted
            )
        }

        if (showUrlConfig) {
            BlueprintCard(
                borderColor = BorderStone,
                backgroundColor = SurfaceDark
            ) {
                Text(
                    text = "TARGET FASTAPI ENDPOINT",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    color = SignalYellow
                )
                Spacer(modifier = Modifier.height(6.dp))
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
                Text(
                    text = "PRESET HOST SHORTCUTS:",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                    color = TextMuted
                )
                Spacer(modifier = Modifier.height(6.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = {
                            backendUrl = "http://127.0.0.1:8787"
                            sessionManager.setBackendUrl("http://127.0.0.1:8787")
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (backendUrl == "http://127.0.0.1:8787") SignalYellow else SurfaceElevated,
                            contentColor = if (backendUrl == "http://127.0.0.1:8787") CarbonBlack else PaperGray
                        ),
                        shape = RoundedCornerShape(2.dp),
                        contentPadding = PaddingValues(horizontal = 4.dp, vertical = 6.dp)
                    ) {
                        Text("USB 127.0.0.1", fontSize = 10.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                    }

                    Button(
                        onClick = {
                            backendUrl = "http://172.16.14.163:8787"
                            sessionManager.setBackendUrl("http://172.16.14.163:8787")
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (backendUrl == "http://172.16.14.163:8787") SignalYellow else SurfaceElevated,
                            contentColor = if (backendUrl == "http://172.16.14.163:8787") CarbonBlack else PaperGray
                        ),
                        shape = RoundedCornerShape(2.dp),
                        contentPadding = PaddingValues(horizontal = 4.dp, vertical = 6.dp)
                    ) {
                        Text("LAN Wi-Fi", fontSize = 10.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                    }

                    Button(
                        onClick = {
                            backendUrl = "http://10.0.2.2:8787"
                            sessionManager.setBackendUrl("http://10.0.2.2:8787")
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (backendUrl == "http://10.0.2.2:8787") SignalYellow else SurfaceElevated,
                            contentColor = if (backendUrl == "http://10.0.2.2:8787") CarbonBlack else PaperGray
                        ),
                        shape = RoundedCornerShape(2.dp),
                        contentPadding = PaddingValues(horizontal = 4.dp, vertical = 6.dp)
                    ) {
                        Text("EMULATOR", fontSize = 10.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
