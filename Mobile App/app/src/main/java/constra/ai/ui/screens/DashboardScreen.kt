package constra.ai.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import constra.ai.ConstraApp
import constra.ai.domain.model.Evidence
import constra.ai.domain.model.Project
import constra.ai.domain.model.Stage
import constra.ai.domain.model.SupervisorDashboard
import constra.ai.ui.components.*
import constra.ai.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun DashboardScreen(
    onNavigateToProjectSelect: () -> Unit,
    onNavigateToStageSelect: (projectId: Int) -> Unit,
    onNavigateToCamera: (projectId: Int, stageId: Int) -> Unit,
    onNavigateToHistory: () -> Unit,
    onNavigateToDetail: (evidenceId: Int) -> Unit,
    onNavigateToProfile: () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    val repo = ConstraApp.instance.supervisorRepository
    val sessionManager = ConstraApp.instance.sessionManager

    val defaultProject = remember {
        Project(
            id = 1,
            name = "Pune Vidyarthi Griha's College of Engineering, Nashik",
            siteAddress = "206, Dindori Road, Behind Reliance Petrol Pump, Mhasrul, Nashik, Maharashtra 422004",
            centroidLat = 20.03639,
            centroidLng = 73.79959,
            siteRadiusM = 500.0
        )
    }
    val defaultStages = remember {
        listOf(
            Stage(1, 1, "Campus Substructure & Foundation Footings", 1, "COMPLETED", 1.0),
            Stage(2, 1, "Ground Floor RCC Slab & Structural Columns", 2, "COMPLETED", 1.0),
            Stage(3, 1, "Academic Wing Superstructure & First Floor Casting", 3, "IN_PROGRESS", 0.4)
        )
    }

    var dashboardData by remember { mutableStateOf<SupervisorDashboard?>(null) }
    var assignedProjects by remember { mutableStateOf<List<Project>>(listOf(defaultProject)) }
    var selectedProject by remember { mutableStateOf<Project?>(defaultProject) }
    var stages by remember { mutableStateOf<List<Stage>>(defaultStages) }
    var selectedStage by remember { mutableStateOf<Stage?>(defaultStages[2]) }

    var pendingCount by remember { mutableStateOf(repo.offlineQueueManager.getPendingSubmissions().size) }
    var isLoading by remember { mutableStateOf(true) }
    var isSyncing by remember { mutableStateOf(false) }
    var syncMessage by remember { mutableStateOf<String?>(null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    fun refreshData() {
        isLoading = true
        errorMessage = null
        coroutineScope.launch {
            // 1. Fetch dashboard telemetry
            val dashRes = repo.getDashboard()
            if (dashRes.isSuccess) {
                dashboardData = dashRes.getOrNull()
            }

            // 2. Fetch projects
            val projRes = repo.getAssignedProjects()
            if (projRes.isSuccess) {
                val list = projRes.getOrDefault(emptyList()).ifEmpty { listOf(defaultProject) }
                assignedProjects = list
                val savedPid = sessionManager.getSelectedProjectId()
                val currentProj = list.find { it.id == savedPid } ?: list.firstOrNull() ?: defaultProject
                selectedProject = currentProj

                // 3. Fetch stages for selected project
                sessionManager.saveSelectedProject(currentProj.id)
                val stgRes = repo.getProjectStages(currentProj.id)
                if (stgRes.isSuccess) {
                    val stgList = stgRes.getOrDefault(emptyList()).ifEmpty { defaultStages }
                    stages = stgList
                    val savedSid = sessionManager.getSelectedStageId()
                    val currentStg = stgList.find { it.id == savedSid } ?: stgList.lastOrNull() ?: defaultStages.last()
                    selectedStage = currentStg
                    if (currentStg != null) {
                        sessionManager.saveSelectedStage(currentStg.id)
                    }
                } else {
                    stages = defaultStages
                    selectedStage = defaultStages.last()
                }
            } else {
                assignedProjects = listOf(defaultProject)
                selectedProject = defaultProject
                stages = defaultStages
                selectedStage = defaultStages.last()
            }

            pendingCount = repo.offlineQueueManager.getPendingSubmissions().size
            isLoading = false
        }
    }

    LaunchedEffect(Unit) {
        refreshData()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(CarbonBlack)
    ) {
        TechnicalHeader(
            title = "DASHBOARD",
            subtitle = selectedProject?.name ?: "INITIALIZING",
            onProfileClick = onNavigateToProfile
        )

        NetworkStatusBar(
            isOnline = errorMessage == null,
            pendingQueueCount = pendingCount,
            onRetryClick = { refreshData() },
            onSyncClick = {
                if (!isSyncing && pendingCount > 0) {
                    isSyncing = true
                    syncMessage = "Syncing queued captures..."
                    coroutineScope.launch {
                        val results = repo.retryPendingSubmissions()
                        val successCount = results.count { it.second.isSuccess }
                        syncMessage = "Synced $successCount / ${results.size} pending items."
                        pendingCount = repo.offlineQueueManager.getPendingSubmissions().size
                        isSyncing = false
                        refreshData()
                    }
                }
            }
        )

        if (syncMessage != null) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(SurfaceElevated)
                    .border(1.dp, SignalYellow)
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
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // ACTIVE ASSIGNMENT CARD
            item {
                BlueprintCard(
                    borderColor = SignalYellow,
                    backgroundColor = SurfaceCard
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "ASSIGNED PROJECT TARGET",
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            color = SignalYellow
                        )
                        Text(
                            text = "[CHANGE]",
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp,
                            color = PaperGray,
                            modifier = Modifier.clickable { onNavigateToProjectSelect() }
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    if (selectedProject != null) {
                        Text(
                            text = selectedProject!!.name.uppercase(),
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            color = PaperGray
                        )
                        if (!selectedProject!!.siteAddress.isNullOrBlank()) {
                            Text(
                                text = selectedProject!!.siteAddress!!,
                                fontFamily = FontFamily.SansSerif,
                                fontSize = 12.sp,
                                color = TextMuted
                            )
                        }

                        Spacer(modifier = Modifier.height(10.dp))
                        TelemetryRow(
                            label = "GEOFENCE CENTROID",
                            value = "%.4f, %.4f".format(
                                selectedProject!!.centroidLat ?: 0.0,
                                selectedProject!!.centroidLng ?: 0.0
                            )
                        )
                        TelemetryRow(
                            label = "SITE RADIUS LIMIT",
                            value = "±%.0fm".format(selectedProject!!.siteRadiusM)
                        )
                    } else {
                        Text(
                            text = if (isLoading) "LOADING ASSIGNED PROJECTS..." else "NO ASSIGNED PROJECTS FOUND",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 13.sp,
                            color = TextMuted
                        )
                    }
                }
            }

            // ACTIVE STAGE CARD & CAMERA LAUNCH
            item {
                BlueprintCard(
                    borderColor = BorderStone,
                    backgroundColor = SurfaceElevated
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "ACTIVE MILESTONE STAGE",
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            color = PaperGray
                        )
                        if (selectedProject != null) {
                            Text(
                                text = "[SELECT STAGE]",
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp,
                                color = SignalYellow,
                                modifier = Modifier.clickable { onNavigateToStageSelect(selectedProject!!.id) }
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    if (selectedStage != null) {
                        Text(
                            text = "${selectedStage!!.order}. ${selectedStage!!.name.uppercase()}",
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                            color = PaperGray
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            StatusBadge(status = selectedStage!!.status)
                            Text(
                                text = "VERIFIED: ${(selectedStage!!.verifiedProgress * 100).toInt()}%",
                                fontFamily = FontFamily.Monospace,
                                fontSize = 11.sp,
                                color = SignalYellow
                            )
                        }
                    } else {
                        Text(
                            text = "NO STAGE SELECTED",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 13.sp,
                            color = TextMuted
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // PRIMARY CTA: OPEN CAMERA (CAMERA-ONLY)
                    SignalButton(
                        text = "📷 CAPTURE LIVE SITE EVIDENCE",
                        enabled = selectedProject != null && selectedStage != null,
                        onClick = {
                            if (selectedProject != null && selectedStage != null) {
                                onNavigateToCamera(selectedProject!!.id, selectedStage!!.id)
                            }
                        }
                    )
                }
            }

            // TELEMETRY COUNTERS
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    // Today's Captures
                    BlueprintCard(
                        modifier = Modifier.weight(1f),
                        borderColor = BorderStone
                    ) {
                        Text(
                            text = "CAPTURED TODAY",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 10.sp,
                            color = TextMuted
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "${dashboardData?.evidenceTodayCount ?: 0}",
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 24.sp,
                            color = SignalYellow
                        )
                    }

                    // Pending Offline Queue
                    BlueprintCard(
                        modifier = Modifier.weight(1f),
                        borderColor = if (pendingCount > 0) SignalYellow else BorderStone
                    ) {
                        Text(
                            text = "PENDING SYNC",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 10.sp,
                            color = TextMuted
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "$pendingCount",
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 24.sp,
                            color = if (pendingCount > 0) SignalYellow else PaperGray
                        )
                    }

                    // Total Submitted
                    BlueprintCard(
                        modifier = Modifier.weight(1f),
                        borderColor = BorderStone
                    ) {
                        Text(
                            text = "TOTAL VERIFIED",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 10.sp,
                            color = TextMuted
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "${dashboardData?.totalSubmittedCount ?: 0}",
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 24.sp,
                            color = StatusPass
                        )
                    }
                }
            }

            // RECENT SUBMISSIONS SECTION
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "RECENT EVIDENCE TRANSMISSIONS",
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                        color = PaperGray
                    )
                    Text(
                        text = "VIEW ALL [${dashboardData?.recentSubmissions?.size ?: 0}]",
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.sp,
                        color = SignalYellow,
                        modifier = Modifier.clickable { onNavigateToHistory() }
                    )
                }
            }

            val recentList: List<Evidence> = dashboardData?.recentSubmissions ?: emptyList()
            if (recentList.isEmpty()) {
                item {
                    BlueprintCard(borderColor = BorderStone) {
                        Text(
                            text = "NO EVIDENCE SUBMISSIONS RECORDED TODAY",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 11.sp,
                            color = TextMuted
                        )
                        Text(
                            text = "Launch in-app camera to record the first verified site evidence.",
                            fontFamily = FontFamily.SansSerif,
                            fontSize = 12.sp,
                            color = PaperGray
                        )
                    }
                }
            } else {
                items(recentList) { item: Evidence ->
                    EvidenceItemCard(
                        evidence = item,
                        onClick = { onNavigateToDetail(item.id) }
                    )
                }
            }
        }
    }
}

@Composable
fun EvidenceItemCard(
    evidence: Evidence,
    onClick: () -> Unit
) {
    BlueprintCard(
        borderColor = if (evidence.radiusWarning || !evidence.hashMatched) StatusWarning else BorderStone,
        modifier = Modifier.clickable { onClick() }
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "ID: ${evidence.deviceEvidenceId}",
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                fontSize = 11.sp,
                color = SignalYellow
            )
            StatusBadge(status = evidence.status)
        }

        Spacer(modifier = Modifier.height(4.dp))

        Text(
            text = "${evidence.projectName ?: "PROJECT"} // ${evidence.stageName ?: "STAGE"}",
            fontFamily = FontFamily.Monospace,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = PaperGray
        )

        Spacer(modifier = Modifier.height(6.dp))

        TelemetryRow(
            label = "SHA-256",
            value = evidence.serverSha256.take(12) + "..."
        )
        TelemetryRow(
            label = "TELEMETRY",
            value = "%.4f, %.4f (±%.1fm)".format(
                evidence.latitude,
                evidence.longitude,
                evidence.accuracyM
            ),
            warning = evidence.radiusWarning
        )

        val chainState = (evidence.blockchain?.status ?: evidence.blockchainStatus).uppercase()
        TelemetryRow(
            label = "BLOCKCHAIN",
            value = if (evidence.blockchain?.blockNumber != null) "CONFIRMED (#${evidence.blockchain.blockNumber})" else chainState
        )

        val ai = evidence.aiAnalysis
        if (!ai?.summary.isNullOrBlank()) {
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "AI: \"${ai!!.summary}\"",
                fontFamily = FontFamily.SansSerif,
                fontSize = 11.sp,
                color = PaperGray
            )
        } else {
            TelemetryRow(
                label = "AI VISION",
                value = (ai?.status ?: "PENDING").uppercase()
            )
        }
    }
}
