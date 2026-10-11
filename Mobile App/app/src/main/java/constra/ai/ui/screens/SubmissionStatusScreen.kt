package constra.ai.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import constra.ai.ConstraApp
import constra.ai.domain.model.Evidence
import constra.ai.domain.model.PendingSubmission
import constra.ai.ui.components.*
import constra.ai.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

@Composable
fun SubmissionStatusScreen(
    deviceEvidenceId: String,
    onNavigateToDashboard: () -> Unit,
    onCaptureNext: () -> Unit
) {
    val repo = ConstraApp.instance.supervisorRepository
    val clipboardManager = LocalClipboardManager.current
    val uriHandler = LocalUriHandler.current

    var isPendingInQueue by remember { mutableStateOf(false) }
    var pendingItem by remember { mutableStateOf<PendingSubmission?>(null) }
    var serverEvidence by remember { mutableStateOf<Evidence?>(null) }
    var copiedHash by remember { mutableStateOf(false) }

    // Dynamic background polling for AI analysis and blockchain confirmation
    LaunchedEffect(deviceEvidenceId) {
        val queued = repo.offlineQueueManager.getPendingSubmissions().find { it.deviceEvidenceId == deviceEvidenceId }
        if (queued != null) {
            isPendingInQueue = true
            pendingItem = queued
            return@LaunchedEffect
        }

        while (isActive) {
            val listRes = repo.listSubmittedEvidence()
            if (listRes.isSuccess) {
                val found = listRes.getOrNull()?.find { it.deviceEvidenceId == deviceEvidenceId }
                if (found != null) {
                    val detailRes = repo.getEvidenceDetail(found.id)
                    serverEvidence = detailRes.getOrNull() ?: found

                    val aiStatus = serverEvidence?.aiAnalysis?.status?.lowercase() ?: "pending"
                    val chainStatus = serverEvidence?.blockchain?.status?.lowercase()
                        ?: serverEvidence?.blockchainStatus?.lowercase()
                        ?: "queued"

                    val isAiTerminal = aiStatus in listOf("completed", "failed")
                    val isChainTerminal = chainStatus in listOf("confirmed", "failed", "simulated")
                    if (isAiTerminal && isChainTerminal) {
                        break
                    }
                }
            }
            delay(3500)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(CarbonBlack)
            .statusBarsPadding()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(modifier = Modifier.height(12.dp))

            if (isPendingInQueue) {
                // OFFLINE QUEUE STATUS
                Box(
                    modifier = Modifier
                        .size(68.dp)
                        .border(2.dp, SignalYellow)
                        .background(SurfaceElevated),
                    contentAlignment = Alignment.Center
                ) {
                    Text(text = "⏳", fontSize = 32.sp)
                }

                Spacer(modifier = Modifier.height(12.dp))

                Text(
                    text = "QUEUED IN SECURE LOCAL STORAGE",
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = SignalYellow,
                    letterSpacing = 0.5.sp
                )

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = "Site connectivity was offline. Evidence bytes and telemetry are securely encrypted on device and will transmit once internet is restored.",
                    fontFamily = FontFamily.SansSerif,
                    fontSize = 12.sp,
                    color = PaperGray
                )
            } else {
                // SERVER ACCEPTED STATUS
                Box(
                    modifier = Modifier
                        .size(68.dp)
                        .border(2.dp, StatusPass)
                        .background(StatusPassBg),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "✓",
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 36.sp,
                        color = StatusPass
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                Text(
                    text = "SUBMISSION ACCEPTED & PROCESSING",
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = StatusPass,
                    letterSpacing = 0.5.sp
                )

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = "Backend confirmed receipt, verified SHA-256 integrity, and launched AI visual progress analysis and Ethereum Sepolia anchoring.",
                    fontFamily = FontFamily.SansSerif,
                    fontSize = 12.sp,
                    color = PaperGray
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // 1. TRANSMISSION RECEIPT DETAILS CARD
            BlueprintCard(
                borderColor = BorderStone,
                backgroundColor = SurfaceCard
            ) {
                Text(
                    text = "EVIDENCE INTEGRITY DETAILS",
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 11.sp,
                    color = SignalYellow
                )

                Spacer(modifier = Modifier.height(8.dp))

                TelemetryRow(label = "EVIDENCE ID", value = deviceEvidenceId)

                val fullSha = serverEvidence?.serverSha256
                    ?: pendingItem?.clientSha256
                    ?: "CALCULATED ON CAPTURE"

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "SHA-256 HASH",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 11.sp,
                            color = TextMuted
                        )
                        Text(
                            text = fullSha.take(18) + "...",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = PaperGray
                        )
                    }
                    Text(
                        text = if (copiedHash) "[COPIED ✓]" else "[COPY HASH]",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = SignalYellow,
                        modifier = Modifier
                            .clickable {
                                clipboardManager.setText(AnnotatedString(fullSha))
                                copiedHash = true
                            }
                            .padding(4.dp)
                    )
                }

                val statusLabel = if (isPendingInQueue) "QUEUED_OFFLINE" else (serverEvidence?.status ?: "VERIFIED_SUBMITTED")
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "SUBMISSION STATUS",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        color = TextMuted
                    )
                    StatusBadge(status = statusLabel)
                }

                if (serverEvidence != null) {
                    TelemetryRow(
                        label = "GEOFENCE MATCH",
                        value = if (serverEvidence!!.isWithinRadius) "PASS (< SITE BOUNDS)" else "WARNING (OUTSIDE)"
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // 2. GEMINI 2.5 FLASH CIVIL VISION CARD
            val ai = serverEvidence?.aiAnalysis
            val aiStatus = ai?.status ?: "pending"
            BlueprintCard(
                borderColor = if (aiStatus == "completed") StatusPass else BorderStone,
                backgroundColor = SurfaceElevated
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    val cardTitle = if (!ai?.model.isNullOrBlank()) {
                        val mName = ai!!.model!!.removePrefix("models/").replace("gemini-", "GEMINI ").uppercase()
                        "$mName CIVIL ANALYSIS"
                    } else {
                        "GEMINI FLASH CIVIL ANALYSIS"
                    }
                    Text(
                        text = cardTitle,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.sp,
                        color = SignalYellow
                    )
                    StatusBadge(status = aiStatus)
                }

                Spacer(modifier = Modifier.height(6.dp))

                when (aiStatus.lowercase()) {
                    "completed" -> {
                        val structured = ai?.structuredResult
                        if (!structured?.workCategory.isNullOrBlank()) {
                            Text(
                                text = "WORK CATEGORY: ${structured?.workCategory?.uppercase()}",
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp,
                                color = SignalYellow
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                        }

                        Text(
                            text = ai?.summary ?: "Analysis complete.",
                            fontFamily = FontFamily.SansSerif,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = PaperGray
                        )

                        if (!ai?.report.isNullOrBlank() && ai?.report != ai?.summary) {
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = ai!!.report!!,
                                fontFamily = FontFamily.SansSerif,
                                fontSize = 11.sp,
                                color = TextMuted
                            )
                        }
                    }
                    "analyzing" -> {
                        Text(
                            text = "Analyzing photograph for structural elements, excavation, formwork, and progress markers...",
                            fontFamily = FontFamily.SansSerif,
                            fontSize = 12.sp,
                            color = SignalYellow
                        )
                    }
                    "failed" -> {
                        Text(
                            text = "AI vision analysis timed out or rate limited. Photo evidence remains securely submitted.",
                            fontFamily = FontFamily.SansSerif,
                            fontSize = 12.sp,
                            color = StatusDefect
                        )
                    }
                    else -> {
                        Text(
                            text = "AI progress analysis queued. Results will update automatically...",
                            fontFamily = FontFamily.SansSerif,
                            fontSize = 12.sp,
                            color = PaperGray
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // 3. REAL BLOCKCHAIN ANCHORING (ETHEREUM SEPOLIA) CARD
            val chain = serverEvidence?.blockchain
            val chainStatus = chain?.status ?: serverEvidence?.blockchainStatus ?: "queued"
            BlueprintCard(
                borderColor = if (chainStatus == "confirmed") StatusPass else BorderStone,
                backgroundColor = SurfaceElevated
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "BLOCKCHAIN ANCHOR (SEPOLIA)",
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.sp,
                        color = SignalYellow
                    )
                    StatusBadge(status = chainStatus)
                }

                Spacer(modifier = Modifier.height(8.dp))

                TelemetryRow(label = "NETWORK", value = "Ethereum Sepolia (11155111)")

                val txHash = chain?.transactionHash ?: serverEvidence?.blockchainTx
                if (!txHash.isNullOrBlank()) {
                    TelemetryRow(label = "TRANSACTION HASH", value = txHash.take(16) + "...")

                    val explorerUrl = chain?.explorerUrl ?: "https://sepolia.etherscan.io/tx/$txHash"
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp),
                        horizontalArrangement = Arrangement.End
                    ) {
                        Text(
                            text = "↗ VIEW ON SEPOLIA ETHERSCAN",
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 10.sp,
                            color = SignalYellow,
                            modifier = Modifier
                                .clickable {
                                    try {
                                        uriHandler.openUri(explorerUrl)
                                    } catch (_: Exception) {}
                                }
                                .padding(4.dp)
                        )
                    }
                } else {
                    TelemetryRow(label = "ANCHOR STATUS", value = chainStatus.uppercase())
                }

                if (chain?.blockNumber != null) {
                    TelemetryRow(label = "CONFIRMED IN BLOCK", value = "#${chain.blockNumber}")
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
        }

        // NAVIGATION ACTIONS
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            SignalButton(
                text = "📷 CAPTURE NEXT EVIDENCE",
                onClick = onCaptureNext
            )

            OutlineButton(
                text = "RETURN TO DASHBOARD",
                onClick = onNavigateToDashboard
            )
        }
    }
}
