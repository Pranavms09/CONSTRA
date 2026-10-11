package constra.ai.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import constra.ai.ConstraApp
import constra.ai.domain.model.Evidence
import constra.ai.domain.model.PendingSubmission
import constra.ai.ui.components.*
import constra.ai.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun EvidenceHistoryScreen(
    onEvidenceClick: (evidenceId: Int) -> Unit,
    onBackClick: () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    val repo = ConstraApp.instance.supervisorRepository

    var evidenceList by remember { mutableStateOf<List<Evidence>>(emptyList()) }
    var pendingList by remember { mutableStateOf<List<PendingSubmission>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var isRetrying by remember { mutableStateOf(false) }
    var syncMessage by remember { mutableStateOf<String?>(null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    fun loadData() {
        isLoading = true
        coroutineScope.launch {
            pendingList = repo.offlineQueueManager.getPendingSubmissions()
            val result = repo.listSubmittedEvidence()
            isLoading = false
            if (result.isSuccess) {
                evidenceList = result.getOrDefault(emptyList())
            } else {
                errorMessage = result.exceptionOrNull()?.message ?: "Failed to load evidence log"
            }
        }
    }

    LaunchedEffect(Unit) {
        loadData()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(CarbonBlack)
    ) {
        TechnicalHeader(
            title = "EVIDENCE AUDIT LOG",
            subtitle = "TOTAL RECORDS: ${evidenceList.size + pendingList.size}",
            onBackClick = onBackClick
        )

        if (syncMessage != null) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(SurfaceElevated)
                    .padding(8.dp)
            ) {
                Text(
                    text = syncMessage!!,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    color = SignalYellow
                )
            }
        }

        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // PENDING SUBMISSIONS SECTION (IF ANY)
            if (pendingList.isNotEmpty()) {
                item {
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
                                text = "⏳ LOCAL PENDING QUEUE (${pendingList.size})",
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp,
                                color = SignalYellow
                            )
                            Text(
                                text = if (isRetrying) "SYNCING..." else "[RETRY SYNC NOW]",
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp,
                                color = SignalYellow,
                                modifier = Modifier.clickable {
                                    if (!isRetrying) {
                                        isRetrying = true
                                        syncMessage = "Attempting to transmit pending evidence to backend..."
                                        coroutineScope.launch {
                                            val results = repo.retryPendingSubmissions()
                                            val succeeded = results.count { it.second.isSuccess }
                                            syncMessage = "Transmitted $succeeded / ${results.size} pending items."
                                            isRetrying = false
                                            loadData()
                                        }
                                    }
                                }
                            )
                        }

                        Spacer(modifier = Modifier.height(6.dp))

                        Text(
                            text = "Awaiting network connectivity to synchronize with backend audit desk.",
                            fontFamily = FontFamily.SansSerif,
                            fontSize = 12.sp,
                            color = PaperGray
                        )
                    }
                }

                items(pendingList) { pending ->
                    BlueprintCard(borderColor = SignalYellow) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "ID: ${pending.deviceEvidenceId}",
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp,
                                color = SignalYellow
                            )
                            StatusBadge(status = "QUEUED_OFFLINE")
                        }

                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "${pending.projectName} // ${pending.stageName}",
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            color = PaperGray
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        TelemetryRow(label = "SHA-256", value = pending.clientSha256.take(16) + "...")
                        if (pending.lastError != null) {
                            Text(
                                text = "LAST ERROR: ${pending.lastError}",
                                fontFamily = FontFamily.Monospace,
                                fontSize = 10.sp,
                                color = StatusWarning
                            )
                        }
                    }
                }

                item {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "VERIFIED SERVER SUBMISSIONS",
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                        color = PaperGray
                    )
                }
            }

            if (isLoading) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(180.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = SignalYellow)
                    }
                }
            } else if (evidenceList.isEmpty() && pendingList.isEmpty()) {
                item {
                    BlueprintCard(borderColor = BorderStone) {
                        Text(
                            text = "NO EVIDENCE CAPTURES IN REGISTRY",
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            color = TextMuted
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "All site photos captured through the in-app camera will be indexed here with their SHA-256 fingerprints.",
                            fontFamily = FontFamily.SansSerif,
                            fontSize = 12.sp,
                            color = PaperGray
                        )
                    }
                }
            } else {
                items(evidenceList) { evidence ->
                    EvidenceItemCard(
                        evidence = evidence,
                        onClick = { onEvidenceClick(evidence.id) }
                    )
                }
            }
        }
    }
}
