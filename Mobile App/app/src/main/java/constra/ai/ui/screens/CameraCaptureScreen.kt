package constra.ai.ui.screens

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.SystemClock
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import constra.ai.ConstraApp
import constra.ai.domain.model.CaptureMetadata
import constra.ai.domain.model.Project
import constra.ai.domain.model.Stage
import constra.ai.domain.util.HashUtil
import constra.ai.domain.util.LocationHelper
import constra.ai.ui.components.BlueprintCard
import constra.ai.ui.components.SignalButton
import constra.ai.ui.theme.*
import kotlinx.coroutines.launch
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun CameraCaptureScreen(
    projectId: Int,
    stageId: Int,
    onEvidenceCaptured: (CaptureMetadata) -> Unit,
    onBackClick: () -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val coroutineScope = rememberCoroutineScope()
    val repo = ConstraApp.instance.supervisorRepository

    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.CAMERA
            ) == PackageManager.PERMISSION_GRANTED
        )
    }

    var hasLocationPermission by remember {
        mutableStateOf(LocationHelper.hasLocationPermission(context))
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        if (permissions.containsKey(Manifest.permission.CAMERA)) {
            hasCameraPermission = permissions[Manifest.permission.CAMERA] == true
        } else {
            hasCameraPermission = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.CAMERA
            ) == PackageManager.PERMISSION_GRANTED
        }

        if (permissions.containsKey(Manifest.permission.ACCESS_FINE_LOCATION) ||
            permissions.containsKey(Manifest.permission.ACCESS_COARSE_LOCATION)
        ) {
            hasLocationPermission = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                    permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        } else {
            hasLocationPermission = LocationHelper.hasLocationPermission(context)
        }
    }

    LaunchedEffect(Unit) {
        val permissionsToRequest = mutableListOf<String>()
        if (!hasCameraPermission) permissionsToRequest.add(Manifest.permission.CAMERA)
        if (!hasLocationPermission) {
            permissionsToRequest.add(Manifest.permission.ACCESS_FINE_LOCATION)
            permissionsToRequest.add(Manifest.permission.ACCESS_COARSE_LOCATION)
        }
        if (permissionsToRequest.isNotEmpty()) {
            permissionLauncher.launch(permissionsToRequest.toTypedArray())
        }
    }

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
    var project by remember { mutableStateOf<Project?>(defaultProject) }
    var stage by remember { mutableStateOf<Stage?>(null) }
    var imageCapture by remember { mutableStateOf<ImageCapture?>(null) }
    var isCapturing by remember { mutableStateOf(false) }
    var captureStatusText by remember { mutableStateOf<String?>(null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(projectId, stageId) {
        coroutineScope.launch {
            val projRes = repo.getAssignedProjects()
            project = projRes.getOrNull()?.find { it.id == projectId } ?: defaultProject
            val stgRes = repo.getProjectStages(projectId)
            stage = stgRes.getOrNull()?.find { it.id == stageId } ?: Stage(
                id = stageId,
                projectId = 1,
                name = "Academic Wing Superstructure & First Floor Casting",
                order = 3,
                status = "IN_PROGRESS",
                verifiedProgress = 0.4
            )
        }
    }

    // Live GPS telemetry state
    var currentLat by remember { mutableStateOf<Double?>(null) }
    var currentLng by remember { mutableStateOf<Double?>(null) }
    var currentAcc by remember { mutableStateOf<Float?>(null) }

    fun refreshLocation() {
        if (hasLocationPermission) {
            LocationHelper.fetchCurrentLocation(
                context = context,
                onSuccess = { lat, lng, acc ->
                    currentLat = lat
                    currentLng = lng
                    currentAcc = acc
                },
                onError = { err ->
                    errorMessage = err
                }
            )
        }
    }

    LaunchedEffect(hasLocationPermission) {
        if (hasLocationPermission) {
            refreshLocation()
        }
    }

    fun executeCapture(capture: ImageCapture, lat: Double, lng: Double, acc: Float) {
        val capturesDir = repo.offlineQueueManager.getCapturesDirectory()
        val timestamp = System.currentTimeMillis()
        val randomSuffix = UUID.randomUUID().toString().take(6).uppercase()
        val deviceEvidenceId = "CAP-$projectId-$stageId-$timestamp-$randomSuffix"

        val originalFile = File(capturesDir, "${deviceEvidenceId}_original.jpg")
        val outputOptions = ImageCapture.OutputFileOptions.Builder(originalFile).build()

        capture.takePicture(
            outputOptions,
            ContextCompat.getMainExecutor(context),
            object : ImageCapture.OnImageSavedCallback {
                override fun onImageSaved(outputFileResults: ImageCapture.OutputFileResults) {
                    captureStatusText = "COMPUTING SHA-256 INTEGRITY HASH..."
                    coroutineScope.launch {
                        try {
                            // Compute SHA-256 immediately from original raw bytes
                            val sha256 = HashUtil.sha256(originalFile)
                            val isoDateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
                                timeZone = TimeZone.getTimeZone("UTC")
                            }
                            val capturedAtIso = isoDateFormat.format(Date())

                            // Geofence check
                            val geofence = LocationHelper.evaluateGeofence(
                                currentLat = lat,
                                currentLng = lng,
                                accuracyM = acc,
                                centroidLat = project?.centroidLat,
                                centroidLng = project?.centroidLng,
                                siteRadiusM = project?.siteRadiusM ?: 200.0
                            )

                            val metadata = CaptureMetadata(
                                deviceEvidenceId = deviceEvidenceId,
                                projectId = projectId,
                                stageId = stageId,
                                projectName = project?.name ?: "PROJECT #$projectId",
                                stageName = stage?.name ?: "STAGE #$stageId",
                                originalFilePath = originalFile.absolutePath,
                                fileSizeBytes = originalFile.length(),
                                clientSha256 = sha256,
                                capturedAtIso = capturedAtIso,
                                latitude = lat,
                                longitude = lng,
                                accuracyM = acc,
                                isWithinRadius = geofence.isWithinRadius,
                                distanceToSiteM = geofence.distanceM,
                                siteRadiusM = project?.siteRadiusM ?: 200.0,
                                radiusWarning = geofence.radiusWarning
                            )

                            isCapturing = false
                            onEvidenceCaptured(metadata)
                        } catch (e: Exception) {
                            isCapturing = false
                            errorMessage = "Error processing capture: ${e.localizedMessage}"
                        }
                    }
                }

                override fun onError(exception: ImageCaptureException) {
                    isCapturing = false
                    errorMessage = "Camera capture failed: ${exception.localizedMessage}"
                }
            }
        )
    }

    fun takePhoto() {
        val capture = imageCapture ?: return
        if (isCapturing) return

        if (!hasLocationPermission) {
            errorMessage = "GPS Permission required to record certified site evidence."
            permissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
            return
        }

        if (!LocationHelper.isLocationEnabled(context)) {
            errorMessage = "Device GPS is turned off. Please enable Location in Android settings."
            return
        }

        isCapturing = true
        captureStatusText = "RECORDING TRUSTED FRAME & EXIF..."
        errorMessage = null

        // Ensure location is requested
        LocationHelper.fetchCurrentLocation(
            context = context,
            onSuccess = { lat, lng, acc ->
                currentLat = lat
                currentLng = lng
                currentAcc = acc
                executeCapture(capture, lat, lng, acc)
            },
            onError = { locErr ->
                // Fallback to coordinates if already acquired or trigger error
                if (currentLat != null && currentLng != null) {
                    executeCapture(capture, currentLat!!, currentLng!!, currentAcc ?: 25f)
                } else {
                    isCapturing = false
                    errorMessage = "Location acquisition failed: $locErr. Site evidence requires GPS validation."
                }
            }
        )
    }


    if (!hasCameraPermission) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(CarbonBlack)
                .padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            BlueprintCard(borderColor = SignalYellow) {
                Text(
                    text = "CAMERA PERMISSION REQUIRED",
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    color = SignalYellow,
                    fontSize = 14.sp
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "CONSTRA operates exclusively via direct in-app camera capture to produce trusted, live physical evidence. Gallery upload and document importing are strictly disabled by protocol.",
                    color = PaperGray,
                    fontSize = 13.sp
                )
                Spacer(modifier = Modifier.height(16.dp))
                SignalButton(
                    text = "GRANT CAMERA ACCESS",
                    onClick = { permissionLauncher.launch(arrayOf(Manifest.permission.CAMERA)) }
                )
            }
        }
        return
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        // CameraX Live Preview
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { ctx ->
                val previewView = PreviewView(ctx)
                val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)
                cameraProviderFuture.addListener({
                    val cameraProvider = cameraProviderFuture.get()
                    val preview = Preview.Builder().build().also {
                        it.setSurfaceProvider(previewView.surfaceProvider)
                    }
                    val capture = ImageCapture.Builder()
                        .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
                        .build()
                    imageCapture = capture

                    val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA
                    try {
                        cameraProvider.unbindAll()
                        cameraProvider.bindToLifecycle(
                            lifecycleOwner,
                            cameraSelector,
                            preview,
                            capture
                        )
                    } catch (exc: Exception) {
                        errorMessage = "Camera initialization failed: ${exc.localizedMessage}"
                    }
                }, ContextCompat.getMainExecutor(ctx))
                previewView
            }
        )

        // TECHNICAL VIEWFINDER HUD OVERLAY
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .padding(top = 12.dp, start = 16.dp, end = 16.dp, bottom = 16.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // Top HUD Banner
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xD9101010))
                    .border(1.dp, BorderStone)
                    .padding(12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "● LIVE CAMERA STREAM // RTK HUD",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = SignalYellow
                    )
                    Text(
                        text = "[ABORT]",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextMuted,
                        modifier = Modifier.clickable { onBackClick() }
                    )
                }

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = "${project?.name ?: "LOADING..."} // ${stage?.name ?: ""}".uppercase(),
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp,
                    color = PaperGray
                )

                Spacer(modifier = Modifier.height(4.dp))

                // Real-time GPS coordinates
                val isGpsEnabled = LocationHelper.isLocationEnabled(context)
                val gpsString = when {
                    !hasLocationPermission -> "GPS: PERMISSION REQUIRED (TAP TO AUTHORIZE)"
                    !isGpsEnabled -> "GPS: SENSORS DISABLED IN SETTINGS (TAP TO FIX)"
                    currentLat != null && currentLng != null -> "GPS: %.5f, %.5f (±%.1fm)".format(currentLat, currentLng, currentAcc ?: 0f)
                    else -> "GPS: ACQUIRING SATELLITE LOCK..."
                }
                val gpsColor = when {
                    !hasLocationPermission || !isGpsEnabled -> StatusDefect
                    currentLat != null -> StatusPass
                    else -> SignalYellow
                }
                Text(
                    text = gpsString,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                    color = gpsColor,
                    modifier = Modifier.clickable {
                        if (!hasLocationPermission) {
                            permissionLauncher.launch(
                                arrayOf(
                                    Manifest.permission.ACCESS_FINE_LOCATION,
                                    Manifest.permission.ACCESS_COARSE_LOCATION
                                )
                            )
                        } else if (!isGpsEnabled) {
                            try {
                                context.startActivity(android.content.Intent(android.provider.Settings.ACTION_LOCATION_SOURCE_SETTINGS))
                            } catch (_: Exception) {}
                        } else {
                            refreshLocation()
                        }
                    }
                )
            }

            // Center Viewfinder Reticle
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(280.dp),
                contentAlignment = Alignment.Center
            ) {
                // Crosshair corner ticks
                Box(
                    modifier = Modifier
                        .size(220.dp)
                        .border(1.dp, Color(0x66FCBC18))
                )
                Text(
                    text = "+",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 24.sp,
                    color = SignalYellow
                )
            }

            // Bottom Controls Bar
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xD9101010))
                    .border(1.dp, BorderStone)
                    .padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                if (errorMessage != null) {
                    Text(
                        text = "ALERT: $errorMessage",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        color = StatusDefect
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                }

                if (isCapturing) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        CircularProgressIndicator(
                            color = SignalYellow,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            text = captureStatusText ?: "RECORDING...",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = SignalYellow
                        )
                    }
                } else {
                    // Shutter Trigger Button (Strictly in-app capture; no gallery picker)
                    Box(
                        modifier = Modifier
                            .size(72.dp)
                            .border(3.dp, SignalYellow, CircleShape)
                            .background(Color(0x33FCBC18), CircleShape)
                            .clickable { takePhoto() },
                        contentAlignment = Alignment.Center
                    ) {
                        Box(
                            modifier = Modifier
                                .size(56.dp)
                                .background(SignalYellow, CircleShape)
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = "PRESS TO CAPTURE TRUSTED EVIDENCE",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                        color = TextMuted
                    )
                }
            }
        }
    }
}
