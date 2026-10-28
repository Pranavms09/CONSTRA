package constra.ai.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import constra.ai.ConstraApp
import constra.ai.domain.model.Project
import constra.ai.ui.components.BlueprintCard
import constra.ai.ui.components.TechnicalHeader
import constra.ai.ui.components.TelemetryRow
import constra.ai.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun ProjectSelectScreen(
    onProjectSelected: (projectId: Int) -> Unit,
    onBackClick: () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    val repo = ConstraApp.instance.supervisorRepository
    val sessionManager = ConstraApp.instance.sessionManager

    val defaultProject = remember {
        Project(
            id = 1,
            name = "Shree Construction, Nashik",
            siteAddress = "Shree Construction Site, Dindori Road, Mhasrul, Nashik, Maharashtra 422004",
            centroidLat = 20.03639,
            centroidLng = 73.79959,
            siteRadiusM = 500.0
        )
    }
    var projects by remember { mutableStateOf<List<Project>>(listOf(defaultProject)) }
    var searchQuery by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        coroutineScope.launch {
            val result = repo.getAssignedProjects()
            if (result.isSuccess) {
                val list = result.getOrDefault(emptyList()).ifEmpty { listOf(defaultProject) }
                projects = list
            } else {
                projects = listOf(defaultProject)
            }
        }
    }

    val filteredProjects = projects.filter {
        it.name.contains(searchQuery, ignoreCase = true) ||
                (it.siteAddress?.contains(searchQuery, ignoreCase = true) == true)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(CarbonBlack)
    ) {
        TechnicalHeader(
            title = "ASSIGNMENT SELECT",
            subtitle = "PROJECT INDEX",
            onBackClick = onBackClick
        )

        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "SELECT ASSIGNED PROJECT PERIMETER",
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                fontSize = 12.sp,
                color = SignalYellow
            )
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = {
                    Text(
                        text = "SEARCH BY PROJECT NAME OR ADDRESS...",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 12.sp,
                        color = TextMuted
                    )
                },
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = SignalYellow,
                    unfocusedBorderColor = BorderStone,
                    focusedTextColor = PaperGray,
                    unfocusedTextColor = PaperGray
                ),
                shape = RoundedCornerShape(0.dp)
            )
        }

        if (isLoading) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = SignalYellow)
            }
        } else if (errorMessage != null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(20.dp),
                contentAlignment = Alignment.Center
            ) {
                BlueprintCard(borderColor = StatusDefect) {
                    Text(
                        text = "PROJECT LOAD ERROR",
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        color = StatusDefect
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(text = errorMessage!!, color = PaperGray, fontSize = 12.sp)
                }
            }
        } else if (filteredProjects.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(20.dp),
                contentAlignment = Alignment.Center
            ) {
                BlueprintCard(borderColor = BorderStone) {
                    Text(
                        text = "NO ASSIGNED PROJECTS FOUND",
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        color = TextMuted
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Only the Project Auditor can assign projects to your supervisor account.",
                        color = PaperGray,
                        fontSize = 12.sp
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(filteredProjects) { project ->
                    val isSelected = sessionManager.getSelectedProjectId() == project.id
                    BlueprintCard(
                        borderColor = if (isSelected) SignalYellow else BorderStone,
                        backgroundColor = if (isSelected) SurfaceElevated else SurfaceCard,
                        modifier = Modifier.clickable {
                            sessionManager.saveSelectedProject(project.id)
                            onProjectSelected(project.id)
                        }
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "PROJECT #${project.id}",
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp,
                                color = if (isSelected) SignalYellow else TextMuted
                            )
                            if (isSelected) {
                                Text(
                                    text = "● ACTIVE SELECTION",
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = SignalYellow
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(6.dp))

                        Text(
                            text = project.name.uppercase(),
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                            color = PaperGray
                        )

                        if (!project.siteAddress.isNullOrBlank()) {
                            Text(
                                text = project.siteAddress,
                                fontFamily = FontFamily.SansSerif,
                                fontSize = 12.sp,
                                color = TextMuted
                            )
                        }

                        Spacer(modifier = Modifier.height(8.dp))

                        TelemetryRow(
                            label = "CENTROID COORD",
                            value = "%.4f, %.4f".format(
                                project.centroidLat ?: 0.0,
                                project.centroidLng ?: 0.0
                            )
                        )
                        TelemetryRow(
                            label = "ALLOWED RADIUS",
                            value = "±%.0fm".format(project.siteRadiusM)
                        )
                    }
                }
            }
        }
    }
}
