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
import constra.ai.domain.model.Stage
import constra.ai.ui.components.BlueprintCard
import constra.ai.ui.components.StatusBadge
import constra.ai.ui.components.TechnicalHeader
import constra.ai.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun StageSelectScreen(
    projectId: Int,
    onStageSelected: (stageId: Int) -> Unit,
    onBackClick: () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    val repo = ConstraApp.instance.supervisorRepository
    val sessionManager = ConstraApp.instance.sessionManager

    val defaultStages = remember {
        listOf(
            Stage(1, projectId, "Campus Substructure & Foundation Footings", 1, "COMPLETED", 1.0),
            Stage(2, projectId, "Ground Floor RCC Slab & Structural Columns", 2, "COMPLETED", 1.0),
            Stage(3, projectId, "Academic Wing Superstructure & First Floor Casting", 3, "IN_PROGRESS", 0.4)
        )
    }
    var stages by remember { mutableStateOf<List<Stage>>(defaultStages) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(projectId) {
        coroutineScope.launch {
            val result = repo.getProjectStages(projectId)
            if (result.isSuccess) {
                val list = result.getOrDefault(emptyList()).ifEmpty { defaultStages }
                stages = list
            } else {
                stages = defaultStages
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(CarbonBlack)
    ) {
        TechnicalHeader(
            title = "STAGE SELECT",
            subtitle = "PROJECT #$projectId",
            onBackClick = onBackClick
        )

        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "SELECT CONSTRUCTION MILESTONE STAGE",
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                fontSize = 12.sp,
                color = SignalYellow
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Evidence captures are strictly anchored to the selected construction phase.",
                fontFamily = FontFamily.SansSerif,
                fontSize = 12.sp,
                color = TextMuted
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
                        text = "STAGE LOAD ERROR",
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        color = StatusDefect
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(text = errorMessage!!, color = PaperGray, fontSize = 12.sp)
                }
            }
        } else if (stages.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(20.dp),
                contentAlignment = Alignment.Center
            ) {
                BlueprintCard(borderColor = BorderStone) {
                    Text(
                        text = "NO STAGES DEFINED FOR THIS PROJECT",
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        color = TextMuted
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "The Project Auditor has not registered milestone stages for this project yet.",
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
                items(stages) { stage ->
                    val isSelected = sessionManager.getSelectedStageId() == stage.id
                    BlueprintCard(
                        borderColor = if (isSelected) SignalYellow else BorderStone,
                        backgroundColor = if (isSelected) SurfaceElevated else SurfaceCard,
                        modifier = Modifier.clickable {
                            sessionManager.saveSelectedStage(stage.id)
                            onStageSelected(stage.id)
                        }
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "ORDER: 0${stage.order} // ID: ${stage.id}",
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp,
                                color = if (isSelected) SignalYellow else TextMuted
                            )
                            StatusBadge(status = stage.status)
                        }

                        Spacer(modifier = Modifier.height(6.dp))

                        Text(
                            text = stage.name.uppercase(),
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                            color = PaperGray
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "VERIFIED COMPLETION PROGRESS",
                                fontFamily = FontFamily.Monospace,
                                fontSize = 10.sp,
                                color = TextMuted
                            )
                            Text(
                                text = "${(stage.verifiedProgress * 100).toInt()}%",
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                                color = SignalYellow
                            )
                        }
                    }
                }
            }
        }
    }
}
