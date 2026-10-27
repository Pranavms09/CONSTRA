package constra.ai.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
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
import constra.ai.ui.components.*
import constra.ai.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun EvidenceDetailScreen(
    evidenceId: Int,
    onBackClick: () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    val repo = ConstraApp.instance.supervisorRepository
    val clipboardManager = LocalClipboardManager.current
    val uriHandler = LocalUriHandler.current

    var evidence by remember { mutableStateOf<Evidence?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var isRetryingAi by remember { mutableStateOf(false) }
    var isRetryingAnchor by remember { mutableStateOf(false) }
    var actionNotice by remember { mutableStateOf<String?>(null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var copiedHash by remember { mutableStateOf(false) }

    fun refreshDetail() {
        coroutineScope.launch {
            val result = repo.getEvidenceDetail(evidenceId)
            isLoading = false
            if (result.isSuccess) {
                evidence = result.getOrNull()
            } else {
                errorMessage = result.exceptionOrNull()?.message ?: "Failed to load evidence record"
            }
        }
    }

    LaunchedEffect(evidenceId) {
        isLoading = true
        refreshDetail()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(CarbonBlack)
    ) {
        TechnicalHeader(
            title = "EVIDENCE SPEC",
            subtitle = "RECORD #$evidenceId",
            onBackClick = onBackClick
        )

        if (actionNotice != null) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(SurfaceElevated)
                    .padding(8.dp)
            ) {
                Text(
                    text = actionNotice!!,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    color = SignalYellow
                )
            }
        }

        if (isLoading) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = SignalYellow)
            }
        } else if (errorMessage != null || evidence == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(20.dp),
                contentAlignment = Alignment.Center
            ) {
                BlueprintCard(borderColor = StatusDefect) {
                    Text(
                        text = "RECORD NOT FOUND",
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        color = StatusDefect
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = errorMessage ?: "Evidence details could not be retrieved from the backend.",
                        color = PaperGray,
                        fontSize = 12.sp
                    )
                }
            }
        } else {
            val item = evidence!!
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // 1. STATUS & IMMUTABILITY NOTICE
                BlueprintCard(
                    borderColor = SignalYellow,
                    backgroundColor = SurfaceElevated
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "IMMUTABLE AUDIT RECORD",
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            color = SignalYellow
                        )
                        StatusBadge(status = item.status)
                    }

                    Spacer(modifier = Modifier.height(6.dp))

                    Text(
                        text = "Submitted evidence is append-only. Modification, replacement, or deletion is prohibited by system protocol to prevent claim fabrication.",
                        fontFamily = FontFamily.SansSerif,
                        fontSize = 12.sp,
                        color = PaperGray
                    )
                }

                // 2. CRYPTOGRAPHIC HASH AUDIT
                BlueprintCard(
                    borderColor = if (item.hashMatched) BorderStone else StatusDefect,
                    backgroundColor = SurfaceCard
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "CRYPTOGRAPHIC HASH INTEGRITY",
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            color = if (item.hashMatched) SignalYellow else StatusDefect
                        )
                        Text(
                            text = if (copiedHash) "[COPIED ✓]" else "[COPY HASH]",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = SignalYellow,
                            modifier = Modifier
                                .clickable {
                                    clipboardManager.setText(AnnotatedString(item.serverSha256))
                                    copiedHash = true
                                }
                                .padding(2.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = "CLIENT CALCULATED (ON-DEVICE):",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                        color = TextMuted
                    )
                    Text(
                        text = item.clientSha256,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = PaperGray
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = "SERVER RECALCULATED (INDEPENDENT):",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                        color = TextMuted
                    )
                    Text(
                        text = item.serverSha256,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (item.hashMatched) StatusPass else StatusDefect
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    TelemetryRow(
                        label = "HASH VALIDATION",
                        value = if (item.hashMatched) "MATCH CONFIRMED (100% BITWISE)" else "MISMATCH SUSPICIOUS"
                    )
                }

                // 3. GEMINI 2.5 FLASH CIVIL CONSTRUCTION VISION ANALYSIS
                val ai = item.aiAnalysis
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
                        Text(
                            text = "GEMINI 2.5 FLASH CIVIL ANALYSIS",
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            color = SignalYellow
                        )
                        StatusBadge(status = aiStatus)
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    TelemetryRow(label = "MODEL ENGINE", value = ai?.model ?: "gemini-2.5-flash")
                    if (!ai?.analyzedAt.isNullOrBlank()) {
                        TelemetryRow(label = "ANALYZED AT", value = ai!!.analyzedAt!!)
                    }

                    when (aiStatus.lowercase()) {
                        "completed" -> {
                            val structured = ai?.structuredResult
                            Spacer(modifier = Modifier.height(8.dp))

                            if (!structured?.workCategory.isNullOrBlank()) {
                                TelemetryRow(label = "CATEGORY", value = structured!!.workCategory)
                            }

                            if (!ai?.summary.isNullOrBlank()) {
                                Spacer(modifier = Modifier.height(6.dp))
                                Text(
                                    text = "VISUAL SUMMARY:",
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 10.sp,
                                    color = TextMuted
                                )
                                Text(
                                    text = ai!!.summary!!,
                                    fontFamily = FontFamily.SansSerif,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = PaperGray
                                )
                            }

                            if (structured != null) {
                                // Stage assessment
                                if (structured.stageAssessment != null) {
                                    val sa = structured.stageAssessment
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text(
                                        text = "STAGE ASSESSMENT:",
                                        fontFamily = FontFamily.Monospace,
                                        fontSize = 10.sp,
                                        color = TextMuted
                                    )
                                    TelemetryRow(label = "OBSERVED STAGE", value = sa.observedStage ?: "Indeterminate")
                                    TelemetryRow(label = "CONFIDENCE", value = sa.confidence.uppercase())
                                    if (!sa.reasoning.isNullOrBlank()) {
                                        Text(
                                            text = sa.reasoning,
                                            fontFamily = FontFamily.SansSerif,
                                            fontSize = 11.sp,
                                            color = TextMuted
                                        )
                                    }
                                }

                                // Activities
                                if (structured.observedActivities.isNotEmpty()) {
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text(
                                        text = "OBSERVED ACTIVITIES:",
                                        fontFamily = FontFamily.Monospace,
                                        fontSize = 10.sp,
                                        color = TextMuted
                                    )
                                    structured.observedActivities.forEach { act ->
                                        Text(
                                            text = "• $act",
                                            fontFamily = FontFamily.SansSerif,
                                            fontSize = 12.sp,
                                            color = PaperGray
                                        )
                                    }
                                }

                                // Materials
                                if (structured.materialsVisible.isNotEmpty()) {
                                    Spacer(modifier = Modifier.height(8.dp))
                                    TelemetryRow(
                                        label = "MATERIALS IDENTIFIED",
                                        value = structured.materialsVisible.joinToString(", ")
                                    )
                                }

                                // Equipment
                                if (structured.equipmentVisible.isNotEmpty()) {
                                    Spacer(modifier = Modifier.height(4.dp))
                                    TelemetryRow(
                                        label = "EQUIPMENT DETECTED",
                                        value = structured.equipmentVisible.joinToString(", ")
                                    )
                                }

                                // Limitations
                                if (structured.limitations.isNotEmpty()) {
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text(
                                        text = "CIVIL AUDIT LIMITATIONS:",
                                        fontFamily = FontFamily.Monospace,
                                        fontSize = 10.sp,
                                        color = TextMuted
                                    )
                                    structured.limitations.forEach { lim ->
                                        Text(
                                            text = "• $lim",
                                            fontFamily = FontFamily.SansSerif,
                                            fontSize = 11.sp,
                                            color = TextMuted
                                        )
                                    }
                                }
                            }

                            // Full progress report
                            if (!ai?.report.isNullOrBlank()) {
                                Spacer(modifier = Modifier.height(10.dp))
                                Text(
                                    text = "OFFICIAL PROGRESS REPORT:",
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 10.sp,
                                    color = SignalYellow
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = ai!!.report!!,
                                    fontFamily = FontFamily.SansSerif,
                                    fontSize = 12.sp,
                                    color = PaperGray
                                )
                            }
                        }
                        "failed" -> {
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "Analysis failed or quota unavailable (${ai?.errorCode ?: "AI_ERROR"}).",
                                fontFamily = FontFamily.SansSerif,
                                fontSize = 12.sp,
                                color = StatusDefect
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            OutlineButton(
                                text = if (isRetryingAi) "RETRYING..." else "↻ RETRY AI VISION ANALYSIS",
                                enabled = !isRetryingAi,
                                onClick = {
                                    if (!isRetryingAi) {
                                        isRetryingAi = true
                                        actionNotice = "Requesting re-analysis from Gemini 2.5 Flash..."
                                        coroutineScope.launch {
                                            val res = repo.retryAiAnalysis(item.id)
                                            isRetryingAi = false
                                            if (res.isSuccess) {
                                                evidence = res.getOrNull()
                                                actionNotice = "AI analysis re-queued successfully."
                                            } else {
                                                actionNotice = "Retry failed: ${res.exceptionOrNull()?.message}"
                                            }
                                        }
                                    }
                                }
                            )
                        }
                        else -> {
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "Analysis in progress. The civil engineering assessment will update automatically.",
                                fontFamily = FontFamily.SansSerif,
                                fontSize = 12.sp,
                                color = PaperGray
                            )
                        }
                    }
                }

                // 4. ETHEREUM SEPOLIA BLOCKCHAIN AUDIT
                val chain = item.blockchain
                val chainStatus = chain?.status ?: item.blockchainStatus
                BlueprintCard(
                    borderColor = if (chainStatus.lowercase() == "confirmed") StatusPass else BorderStone,
                    backgroundColor = SurfaceElevated
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "ETHEREUM SEPOLIA ANCHOR",
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            color = SignalYellow
                        )
                        StatusBadge(status = chainStatus)
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    TelemetryRow(label = "BLOCKCHAIN NETWORK", value = "Ethereum Sepolia (Chain ID 11155111)")
                    TelemetryRow(label = "EVIDENCE REGISTRY CONTRACT", value = "0x9B4E3d4b62e59B622d5E69cbea0393A6Ee8Fdd14".take(14) + "...")

                    val txHash = chain?.transactionHash ?: item.blockchainTx
                    if (!txHash.isNullOrBlank()) {
                        TelemetryRow(label = "TRANSACTION HASH", value = txHash.take(18) + "...")

                        val explorerUrl = chain?.explorerUrl ?: "https://sepolia.etherscan.io/tx/$txHash"
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.End
                        ) {
                            Text(
                                text = "↗ VIEW TRANSACTION ON ETHERSCAN",
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp,
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
                    }

                    if (chain?.blockNumber != null) {
                        TelemetryRow(label = "CONFIRMED BLOCK", value = "#${chain.blockNumber}")
                    }

                    if (chainStatus.lowercase() == "failed") {
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlineButton(
                            text = if (isRetryingAnchor) "RETRYING..." else "↻ RETRY BLOCKCHAIN ANCHOR",
                            enabled = !isRetryingAnchor,
                            onClick = {
                                if (!isRetryingAnchor) {
                                    isRetryingAnchor = true
                                    actionNotice = "Broadcasting anchor transaction to Ethereum Sepolia..."
                                    coroutineScope.launch {
                                        val res = repo.retryAnchor(item.id)
                                        isRetryingAnchor = false
                                        if (res.isSuccess) {
                                            evidence = res.getOrNull()
                                            actionNotice = "Anchoring re-queued successfully."
                                        } else {
                                            actionNotice = "Anchor retry failed: ${res.exceptionOrNull()?.message}"
                                        }
                                    }
                                }
                            }
                        )
                    }
                }

                // 5. GEOLOCATION & TIMESTAMPS
                BlueprintCard(borderColor = BorderStone) {
                    Text(
                        text = "TELEMETRY & TEMPORAL AUDIT",
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                        color = SignalYellow
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    TelemetryRow(label = "DEVICE EVIDENCE ID", value = item.deviceEvidenceId)
                    TelemetryRow(label = "PROJECT", value = item.projectName ?: "ID #${item.projectId}")
                    TelemetryRow(label = "STAGE", value = item.stageName ?: "ID #${item.stageId}")
                    TelemetryRow(label = "SUPERVISOR", value = item.supervisorName?.takeIf { it.isNotBlank() } ?: "Site Supervisor")
                    TelemetryRow(label = "DEVICE CAPTURED AT (UTC)", value = item.capturedAt)
                    TelemetryRow(label = "SERVER RECEIVED AT (UTC)", value = item.serverReceivedAt)
                    TelemetryRow(
                        label = "COORDINATES",
                        value = "%.6f, %.6f".format(item.latitude, item.longitude)
                    )
                    TelemetryRow(
                        label = "MEASUREMENT ACCURACY",
                        value = "±%.1fm".format(item.accuracyM)
                    )

                    if (item.distanceToSiteM != null) {
                        TelemetryRow(
                            label = "DISTANCE TO CENTROID",
                            value = "%.1fm".format(item.distanceToSiteM),
                            warning = item.radiusWarning
                        )
                    }
                    TelemetryRow(
                        label = "GEOFENCE STATUS",
                        value = if (item.isWithinRadius) "VERIFIED WITHIN SITE BOUNDS" else "OUTSIDE SITE RADIUS (FLAGGED)",
                        warning = item.radiusWarning
                    )
                }

                // 6. NOTES SECTION
                if (!item.notes.isNullOrBlank()) {
                    BlueprintCard(borderColor = BorderStone) {
                        Text(
                            text = "SUPERVISOR INSPECTION REMARKS",
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp,
                            color = TextMuted
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = item.notes,
                            fontFamily = FontFamily.SansSerif,
                            fontSize = 13.sp,
                            color = PaperGray
                        )
                    }
                }
            }
        }
    }
}
                    }
                }
            }
        }
    }
}
