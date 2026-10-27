package constra.ai.ui.screens

import androidx.compose.foundation.Image
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.rememberAsyncImagePainter
import constra.ai.ConstraApp
import constra.ai.domain.model.CaptureMetadata
import constra.ai.domain.util.WatermarkUtil
import constra.ai.ui.components.*
import constra.ai.ui.theme.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

@Composable
fun EvidenceReviewScreen(
    metadata: CaptureMetadata,
    onRetake: () -> Unit,
    onSubmitSuccess: (deviceEvidenceId: String) -> Unit,
    onBackClick: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val repo = ConstraApp.instance.supervisorRepository

    var notes by remember { mutableStateOf("") }
    var isSubmitting by remember { mutableStateOf(false) }
    var submitError by remember { mutableStateOf<String?>(null) }

    var watermarkedPreviewFile by remember { mutableStateOf<File?>(null) }
    var isGeneratingWatermark by remember { mutableStateOf(true) }

    LaunchedEffect(metadata.deviceEvidenceId) {
        withContext(Dispatchers.IO) {
            try {
                val origFile = File(metadata.originalFilePath)
                val previewFile = File(
                    context.cacheDir,
                    "watermark_${metadata.deviceEvidenceId}.jpg"
                )
                val generated = WatermarkUtil.createWatermarkedPreview(
                    originalFile = origFile,
                    outputPreviewFile = previewFile,
                    projectName = metadata.projectName,
                    stageName = metadata.stageName,
                    capturedAt = metadata.capturedAtIso,
                    latitude = metadata.latitude,
                    longitude = metadata.longitude,
                    accuracyM = metadata.accuracyM,
                    evidenceId = metadata.deviceEvidenceId,
                    clientSha256 = metadata.clientSha256
                )
                watermarkedPreviewFile = generated
            } catch (_: Exception) {}
            isGeneratingWatermark = false
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(CarbonBlack)
    ) {
        TechnicalHeader(
            title = "EVIDENCE REVIEW",
            subtitle = "ID: ${metadata.deviceEvidenceId}",
            onBackClick = onBackClick
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // WATERMARKED PREVIEW CONTAINER
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(280.dp)
                    .background(SurfaceDark)
                    .border(1.dp, BorderStone),
                contentAlignment = Alignment.Center
            ) {
                if (isGeneratingWatermark) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(color = SignalYellow, modifier = Modifier.size(28.dp))
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "GENERATING CALIBRATED PREVIEW OVERLAY...",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 10.sp,
                            color = TextMuted
                        )
                    }
                } else if (watermarkedPreviewFile != null) {
                    Image(
                        painter = rememberAsyncImagePainter(watermarkedPreviewFile),
                        contentDescription = "Watermarked Evidence Preview",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize()
                    )
                } else {
                    // Fallback to original
                    Image(
                        painter = rememberAsyncImagePainter(File(metadata.originalFilePath)),
                        contentDescription = "Original Capture",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize()
                    )
                }
            }

            // GEOFENCE RADIUS WARNING (IF OUTSIDE PERMITTED SITE RADIUS)
            if (metadata.radiusWarning) {
                BlueprintCard(
                    borderColor = StatusDefect,
                    backgroundColor = StatusDefectBg
                ) {
                    Text(
                        text = "⚠ GEOFENCE PROXIMITY ALERT",
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                        color = StatusDefect
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    val dist = metadata.distanceToSiteM ?: 0.0
                    Text(
                        text = "GPS reading is %.1fm from project centroid, exceeding the site radius tolerance of ±%.0fm (±%.1fm measurement accuracy). Submitting will log an audit anomaly flag.".format(
                            dist, metadata.siteRadiusM, metadata.accuracyM
                        ),
                        fontFamily = FontFamily.SansSerif,
                        fontSize = 12.sp,
                        color = PaperGray
                    )
                }
            } else {
                BlueprintCard(
                    borderColor = StatusPass,
                    backgroundColor = StatusPassBg
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "● SITE GEOFENCE: VERIFIED IN BOUNDS",
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp,
                            color = StatusPass
                        )
                        val dist = metadata.distanceToSiteM ?: 0.0
                        Text(
                            text = "%.1fm to centroid".format(dist),
                            fontFamily = FontFamily.Monospace,
                            fontSize = 11.sp,
                            color = PaperGray
                        )
                    }
                }
            }

            // METADATA CONFIRMATION SPEC CARD
            BlueprintCard(
                borderColor = BorderStone,
                backgroundColor = SurfaceCard
            ) {
                Text(
                    text = "SPECIFICATION & CRYPTOGRAPHIC TELEMETRY",
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp,
                    color = SignalYellow
                )

                Spacer(modifier = Modifier.height(8.dp))

                TelemetryRow(label = "EVIDENCE ID", value = metadata.deviceEvidenceId)
                TelemetryRow(label = "PROJECT", value = metadata.projectName)
                TelemetryRow(label = "STAGE", value = metadata.stageName)
                TelemetryRow(label = "UTC TIMESTAMP", value = metadata.capturedAtIso)
                TelemetryRow(
                    label = "GPS LAT/LONG",
                    value = "%.6f, %.6f".format(metadata.latitude, metadata.longitude)
                )
                TelemetryRow(
                    label = "ACCURACY",
                    value = "±%.1fm".format(metadata.accuracyM)
                )
                TelemetryRow(
                    label = "FILE SIZE",
                    value = "%.1f KB".format(metadata.fileSizeBytes / 1024.0)
                )

                Spacer(modifier = Modifier.height(6.dp))

                // Primary SHA-256 Calculated Immediately from Original Bytes
                Text(
                    text = "ORIGINAL SHA-256 HASH (PRE-SUBMISSION):",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                    color = TextMuted
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = metadata.clientSha256,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = SignalYellow,
                    lineHeight = 15.sp
                )
            }

            // OPTIONAL SUPERVISOR NOTES
            BlueprintCard(borderColor = BorderStone) {
                Text(
                    text = "SUPERVISOR INSPECTION NOTES (OPTIONAL)",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    color = TextMuted
                )
                Spacer(modifier = Modifier.height(6.dp))
                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    placeholder = {
                        Text(
                            text = "e.g., Grid line C-4 column rebar alignment checked...",
                            color = TextMuted,
                            fontSize = 12.sp
                        )
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = SignalYellow,
                        unfocusedBorderColor = BorderStone,
                        focusedTextColor = PaperGray,
                        unfocusedTextColor = PaperGray
                    ),
                    shape = RoundedCornerShape(0.dp)
                )
            }

            if (submitError != null) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(StatusDefectBg)
                        .border(1.dp, StatusDefect)
                        .padding(10.dp)
                ) {
                    Text(
                        text = "SUBMISSION STATUS: $submitError",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        color = StatusDefect
                    )
                }
            }

            // ACTION BUTTONS: CONFIRM OR RETAKE
            SignalButton(
                text = if (isSubmitting) "TRANSMITTING TO AUDIT REGISTRY..." else "CONFIRM & TRANSMIT EVIDENCE",
                enabled = !isSubmitting,
                onClick = {
                    isSubmitting = true
                    submitError = null
                    val submissionMetadata = metadata.copy(notes = notes.takeIf { it.isNotBlank() })
                    coroutineScope.launch {
                        val result = repo.submitEvidence(submissionMetadata)
                        isSubmitting = false
                        if (result.isSuccess) {
                            onSubmitSuccess(metadata.deviceEvidenceId)
                        } else {
                            val err = result.exceptionOrNull()?.message ?: "Submission error"
                            // If it was queued offline, still treat as successfully captured locally!
                            if (err.contains("offline", ignoreCase = true) || err.contains("queue", ignoreCase = true)) {
                                onSubmitSuccess(metadata.deviceEvidenceId)
                            } else {
                                submitError = err
                            }
                        }
                    }
                }
            )

            OutlineButton(
                text = "✖ DISCARD & RETAKE PHOTO",
                enabled = !isSubmitting,
                onClick = onRetake
            )

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}
