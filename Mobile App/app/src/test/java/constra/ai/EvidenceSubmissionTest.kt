package constra.ai

import com.sun.net.httpserver.HttpExchange
import com.sun.net.httpserver.HttpHandler
import com.sun.net.httpserver.HttpServer
import constra.ai.data.api.SupervisorApiService
import constra.ai.data.repository.OfflineQueueManager
import constra.ai.data.repository.SupervisorRepository
import constra.ai.domain.model.CaptureMetadata
import constra.ai.domain.model.EvidenceSubmissionException
import constra.ai.domain.model.PendingSubmission
import constra.ai.domain.util.HashUtil
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.io.ByteArrayOutputStream
import java.io.File
import java.net.InetSocketAddress
import java.nio.charset.StandardCharsets
import java.util.concurrent.TimeUnit

class EvidenceSubmissionTest {

    private lateinit var tempDir: File
    private lateinit var queueManager: OfflineQueueManager
    private var testServer: HttpServer? = null
    private var serverPort: Int = 0

    @Before
    fun setUp() {
        tempDir = File(System.getProperty("java.io.tmpdir"), "constra_test_${System.currentTimeMillis()}").apply {
            mkdirs()
        }
        queueManager = OfflineQueueManager(tempDir)
    }

    @After
    fun tearDown() {
        testServer?.stop(0)
        tempDir.deleteRecursively()
    }

    private fun startMockServer(handler: HttpHandler): Int {
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.createContext("/", handler)
        server.start()
        testServer = server
        serverPort = server.address.port
        return serverPort
    }

    private fun createRepositoryForPort(port: Int): SupervisorRepository {
        val okHttpClient = OkHttpClient.Builder()
            .connectTimeout(5, TimeUnit.SECONDS)
            .readTimeout(5, TimeUnit.SECONDS)
            .writeTimeout(5, TimeUnit.SECONDS)
            .build()

        val retrofit = Retrofit.Builder()
            .baseUrl("http://127.0.0.1:$port/")
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()

        val apiService = retrofit.create(SupervisorApiService::class.java)
        return SupervisorRepository(queueManager) { apiService }
    }

    private fun createDummyTestJpeg(name: String, content: String = "JPEG_HEADER_TEST_BYTES_CONSTRA_2026"): Pair<File, String> {
        val file = File(tempDir, name)
        // Ensure dummy image has sufficient test bytes
        val bytes = (content.repeat(10)).toByteArray(StandardCharsets.UTF_8)
        file.writeBytes(bytes)
        val hash = HashUtil.sha256(file)
        return file to hash
    }

    @Test
    fun testSuccessfulEvidenceSubmissionHttp201() = runBlocking {
        val (testFile, sha256) = createDummyTestJpeg("capture_201.jpg")
        val receivedHeaders = mutableMapOf<String, String>()
        val receivedBodyBytes = ByteArrayOutputStream()

        val port = startMockServer { exchange ->
            for ((key, values) in exchange.requestHeaders) {
                receivedHeaders[key.lowercase()] = values.joinToString(",")
            }
            exchange.requestBody.copyTo(receivedBodyBytes)

            val jsonResponse = """
                {
                    "id": 101,
                    "device_evidence_id": "CAP-TEST-101",
                    "project_id": 1,
                    "stage_id": 2,
                    "project_name": "Shree Construction, Nashik",
                    "stage_name": "Foundation Slab Pour",
                    "supervisor_id": 5,
                    "supervisor_name": "Alice Supervisor",
                    "original_filename": "capture_201.jpg",
                    "file_size": ${testFile.length()},
                    "mime_type": "image/jpeg",
                    "client_sha256": "$sha256",
                    "server_sha256": "$sha256",
                    "hash_matched": true,
                    "captured_at": "2026-10-10T03:30:00Z",
                    "server_received_at": "2026-10-10T03:30:02Z",
                    "latitude": 20.03639,
                    "longitude": 73.79959,
                    "accuracy_m": 4.5,
                    "distance_to_site_m": 12.3,
                    "is_within_radius": true,
                    "radius_warning": false,
                    "blockchain_tx": null,
                    "blockchain_status": "pending",
                    "status": "VERIFIED_SUBMITTED",
                    "notes": "Quality inspection verified"
                }
            """.trimIndent()

            val bytes = jsonResponse.toByteArray(StandardCharsets.UTF_8)
            exchange.responseHeaders.set("Content-Type", "application/json")
            exchange.sendResponseHeaders(201, bytes.size.toLong())
            exchange.responseBody.write(bytes)
            exchange.close()
        }

        val repo = createRepositoryForPort(port)
        val metadata = CaptureMetadata(
            deviceEvidenceId = "CAP-TEST-101",
            projectId = 1,
            stageId = 2,
            projectName = "Shree Construction, Nashik",
            stageName = "Foundation Slab Pour",
            originalFilePath = testFile.absolutePath,
            fileSizeBytes = testFile.length(),
            clientSha256 = sha256,
            capturedAtIso = "2026-10-10T03:30:00Z",
            latitude = 20.03639,
            longitude = 73.79959,
            accuracyM = 4.5f,
            isWithinRadius = true,
            distanceToSiteM = 12.3,
            siteRadiusM = 200.0,
            radiusWarning = false,
            notes = "Quality inspection verified"
        )

        // Enqueue beforehand to verify automatic queue eviction
        queueManager.enqueue(
            PendingSubmission(
                deviceEvidenceId = metadata.deviceEvidenceId,
                projectId = metadata.projectId,
                stageId = metadata.stageId,
                projectName = metadata.projectName,
                stageName = metadata.stageName,
                originalFilePath = metadata.originalFilePath,
                clientSha256 = metadata.clientSha256,
                capturedAtIso = metadata.capturedAtIso,
                latitude = metadata.latitude,
                longitude = metadata.longitude,
                accuracyM = metadata.accuracyM,
                notes = metadata.notes
            )
        )
        assertEquals(1, queueManager.getPendingSubmissions().size)

        val result = repo.submitEvidence(metadata)

        assertTrue("Expected successful upload", result.isSuccess)
        val evidence = result.getOrNull()!!
        assertEquals(101, evidence.id)
        assertEquals("CAP-TEST-101", evidence.deviceEvidenceId)
        assertEquals(sha256, evidence.serverSha256)
        assertTrue(evidence.hashMatched)
        assertEquals("VERIFIED_SUBMITTED", evidence.status)
        assertTrue(evidence.isWithinRadius)
        assertFalse(evidence.radiusWarning)

        // Queue item was removed
        assertEquals(0, queueManager.getPendingSubmissions().size)

        // Multipart verification
        val bodyString = receivedBodyBytes.toString(StandardCharsets.UTF_8.name())
        assertTrue("Body must contain device_evidence_id", bodyString.contains("CAP-TEST-101"))
        assertTrue("Body must contain client_sha256", bodyString.contains(sha256))
        assertTrue("Body must contain notes", bodyString.contains("Quality inspection verified"))
    }

    @Test
    fun testIdempotencyDuplicateDeviceEvidenceIdHttp200() = runBlocking {
        val (testFile, sha256) = createDummyTestJpeg("capture_200.jpg")

        val port = startMockServer { exchange ->
            val jsonResponse = """
                {
                    "id": 99,
                    "device_evidence_id": "CAP-IDEMPOTENT-99",
                    "project_id": 1,
                    "stage_id": 1,
                    "supervisor_id": 5,
                    "original_filename": "capture_200.jpg",
                    "file_size": ${testFile.length()},
                    "mime_type": "image/jpeg",
                    "client_sha256": "$sha256",
                    "server_sha256": "$sha256",
                    "hash_matched": true,
                    "captured_at": "2026-10-10T03:00:00Z",
                    "server_received_at": "2026-10-10T03:00:01Z",
                    "latitude": 20.03639,
                    "longitude": 73.79959,
                    "accuracy_m": 3.0,
                    "is_within_radius": true,
                    "radius_warning": false,
                    "blockchain_status": "pending",
                    "status": "VERIFIED_SUBMITTED"
                }
            """.trimIndent()

            val bytes = jsonResponse.toByteArray(StandardCharsets.UTF_8)
            exchange.responseHeaders.set("Content-Type", "application/json")
            exchange.sendResponseHeaders(200, bytes.size.toLong())
            exchange.responseBody.write(bytes)
            exchange.close()
        }

        val repo = createRepositoryForPort(port)
        val metadata = CaptureMetadata(
            deviceEvidenceId = "CAP-IDEMPOTENT-99",
            projectId = 1,
            stageId = 1,
            projectName = "Shree Construction, Nashik",
            stageName = "Stage 1",
            originalFilePath = testFile.absolutePath,
            fileSizeBytes = testFile.length(),
            clientSha256 = sha256,
            capturedAtIso = "2026-10-10T03:00:00Z",
            latitude = 20.03639,
            longitude = 73.79959,
            accuracyM = 3.0f,
            isWithinRadius = true,
            distanceToSiteM = 0.0,
            siteRadiusM = 200.0,
            radiusWarning = false
        )

        val result = repo.submitEvidence(metadata)
        assertTrue("Idempotent HTTP 200 response must succeed", result.isSuccess)
        val evidence = result.getOrNull()!!
        assertEquals(99, evidence.id)
        assertEquals("CAP-IDEMPOTENT-99", evidence.deviceEvidenceId)
    }

    @Test
    fun testHashMismatchDetectionSuspiciousStatus() = runBlocking {
        val (testFile, actualSha256) = createDummyTestJpeg("tampered_specimen.jpg")
        val fakeSha256 = "0".repeat(64)

        val port = startMockServer { exchange ->
            val jsonResponse = """
                {
                    "id": 105,
                    "device_evidence_id": "CAP-TAMPERED-105",
                    "project_id": 1,
                    "stage_id": 1,
                    "supervisor_id": 5,
                    "original_filename": "tampered_specimen.jpg",
                    "file_size": ${testFile.length()},
                    "mime_type": "image/jpeg",
                    "client_sha256": "$fakeSha256",
                    "server_sha256": "$actualSha256",
                    "hash_matched": false,
                    "captured_at": "2026-10-10T03:15:00Z",
                    "server_received_at": "2026-10-10T03:15:02Z",
                    "latitude": 20.03639,
                    "longitude": 73.79959,
                    "accuracy_m": 5.0,
                    "is_within_radius": true,
                    "radius_warning": false,
                    "blockchain_status": "pending",
                    "status": "HASH_MISMATCH_SUSPICIOUS"
                }
            """.trimIndent()

            val bytes = jsonResponse.toByteArray(StandardCharsets.UTF_8)
            exchange.responseHeaders.set("Content-Type", "application/json")
            exchange.sendResponseHeaders(201, bytes.size.toLong())
            exchange.responseBody.write(bytes)
            exchange.close()
        }

        val repo = createRepositoryForPort(port)
        val metadata = CaptureMetadata(
            deviceEvidenceId = "CAP-TAMPERED-105",
            projectId = 1,
            stageId = 1,
            projectName = "Shree Construction, Nashik",
            stageName = "Stage 1",
            originalFilePath = testFile.absolutePath,
            fileSizeBytes = testFile.length(),
            clientSha256 = fakeSha256,
            capturedAtIso = "2026-10-10T03:15:00Z",
            latitude = 20.03639,
            longitude = 73.79959,
            accuracyM = 5.0f,
            isWithinRadius = true,
            distanceToSiteM = 0.0,
            siteRadiusM = 200.0,
            radiusWarning = false
        )

        val result = repo.submitEvidence(metadata)
        assertTrue(result.isSuccess)
        val evidence = result.getOrNull()!!
        assertFalse("Hash match must be false", evidence.hashMatched)
        assertEquals("HASH_MISMATCH_SUSPICIOUS", evidence.status)
        assertEquals(actualSha256, evidence.serverSha256)
    }

    @Test
    fun testHttp401UnauthorizedReturnsFailureAndEnqueuesOffline() = runBlocking {
        val (testFile, sha256) = createDummyTestJpeg("test_401.jpg")

        val port = startMockServer { exchange ->
            val jsonResponse = """{"detail": "Invalid or expired login"}"""
            val bytes = jsonResponse.toByteArray(StandardCharsets.UTF_8)
            exchange.responseHeaders.set("Content-Type", "application/json")
            exchange.sendResponseHeaders(401, bytes.size.toLong())
            exchange.responseBody.write(bytes)
            exchange.close()
        }

        val repo = createRepositoryForPort(port)
        val metadata = CaptureMetadata(
            deviceEvidenceId = "CAP-401-TEST",
            projectId = 1,
            stageId = 1,
            projectName = "Alpha",
            stageName = "Foundation",
            originalFilePath = testFile.absolutePath,
            fileSizeBytes = testFile.length(),
            clientSha256 = sha256,
            capturedAtIso = "2026-10-10T03:00:00Z",
            latitude = 20.03639,
            longitude = 77.364,
            accuracyM = 5f,
            isWithinRadius = true,
            distanceToSiteM = 0.0,
            siteRadiusM = 200.0,
            radiusWarning = false
        )

        val result = repo.submitEvidence(metadata)
        assertTrue("HTTP 401 must result in failure", result.isFailure)
        val exc = result.exceptionOrNull()
        assertTrue("Exception must be EvidenceSubmissionException", exc is EvidenceSubmissionException)
        assertEquals(401, (exc as EvidenceSubmissionException).statusCode)
        assertTrue(exc.message!!.contains("401"))

        // Verification: Failed submission is safely preserved in offline queue
        val pending = queueManager.getPendingSubmissions()
        assertEquals(1, pending.size)
        assertEquals("CAP-401-TEST", pending[0].deviceEvidenceId)
        assertTrue(pending[0].lastError!!.contains("401"))
    }

    @Test
    fun testHttp403ForbiddenAccessDenied() = runBlocking {
        val (testFile, sha256) = createDummyTestJpeg("test_403.jpg")

        val port = startMockServer { exchange ->
            val jsonResponse = """{"detail": "Supervisor role required"}"""
            val bytes = jsonResponse.toByteArray(StandardCharsets.UTF_8)
            exchange.responseHeaders.set("Content-Type", "application/json")
            exchange.sendResponseHeaders(403, bytes.size.toLong())
            exchange.responseBody.write(bytes)
            exchange.close()
        }

        val repo = createRepositoryForPort(port)
        val metadata = CaptureMetadata(
            deviceEvidenceId = "CAP-403-TEST",
            projectId = 1,
            stageId = 1,
            projectName = "Alpha",
            stageName = "Foundation",
            originalFilePath = testFile.absolutePath,
            fileSizeBytes = testFile.length(),
            clientSha256 = sha256,
            capturedAtIso = "2026-10-10T03:00:00Z",
            latitude = 20.03639,
            longitude = 77.364,
            accuracyM = 5f,
            isWithinRadius = true,
            distanceToSiteM = 0.0,
            siteRadiusM = 200.0,
            radiusWarning = false
        )

        val result = repo.submitEvidence(metadata)
        assertTrue(result.isFailure)
        val exc = result.exceptionOrNull() as EvidenceSubmissionException
        assertEquals(403, exc.statusCode)
        assertTrue(exc.message!!.contains("403"))
    }

    @Test
    fun testHttp400InvalidOrCorruptedImage() = runBlocking {
        val (testFile, sha256) = createDummyTestJpeg("test_400.jpg")

        val port = startMockServer { exchange ->
            val jsonResponse = """{"detail": "Invalid or corrupted image format: cannot identify image file"}"""
            val bytes = jsonResponse.toByteArray(StandardCharsets.UTF_8)
            exchange.responseHeaders.set("Content-Type", "application/json")
            exchange.sendResponseHeaders(400, bytes.size.toLong())
            exchange.responseBody.write(bytes)
            exchange.close()
        }

        val repo = createRepositoryForPort(port)
        val metadata = CaptureMetadata(
            deviceEvidenceId = "CAP-400-TEST",
            projectId = 1,
            stageId = 1,
            projectName = "Alpha",
            stageName = "Foundation",
            originalFilePath = testFile.absolutePath,
            fileSizeBytes = testFile.length(),
            clientSha256 = sha256,
            capturedAtIso = "2026-10-10T03:00:00Z",
            latitude = 20.03639,
            longitude = 77.364,
            accuracyM = 5f,
            isWithinRadius = true,
            distanceToSiteM = 0.0,
            siteRadiusM = 200.0,
            radiusWarning = false
        )

        val result = repo.submitEvidence(metadata)
        assertTrue(result.isFailure)
        val exc = result.exceptionOrNull() as EvidenceSubmissionException
        assertEquals(400, exc.statusCode)
    }

    @Test
    fun testNetworkOfflineEnqueuesToQueueWithOfflineMessage() = runBlocking {
        val (testFile, sha256) = createDummyTestJpeg("offline_test.jpg")

        // Unused closed port
        val unusedPort = 59876
        val repo = createRepositoryForPort(unusedPort)

        val metadata = CaptureMetadata(
            deviceEvidenceId = "CAP-OFFLINE-001",
            projectId = 1,
            stageId = 1,
            projectName = "Shree Construction, Nashik",
            stageName = "Stage 1",
            originalFilePath = testFile.absolutePath,
            fileSizeBytes = testFile.length(),
            clientSha256 = sha256,
            capturedAtIso = "2026-10-10T03:00:00Z",
            latitude = 20.03639,
            longitude = 73.79959,
            accuracyM = 4.0f,
            isWithinRadius = true,
            distanceToSiteM = 0.0,
            siteRadiusM = 200.0,
            radiusWarning = false
        )

        val result = repo.submitEvidence(metadata)
        assertTrue("Network error must produce failure", result.isFailure)
        val errMessage = result.exceptionOrNull()?.message ?: ""

        // Must contain "offline" or "queue" to allow EvidenceReviewScreen to acknowledge offline capture
        assertTrue(
            "Error must mention offline or queue. Was: $errMessage",
            errMessage.contains("offline", ignoreCase = true) || errMessage.contains("queue", ignoreCase = true)
        )

        // Stored in offline queue
        val queued = queueManager.getPendingSubmissions()
        assertEquals(1, queued.size)
        assertEquals("CAP-OFFLINE-001", queued[0].deviceEvidenceId)
    }

    @Test
    fun testOfflineQueueIntegrityVerificationAndTamperDetection() = runBlocking {
        val (testFile, originalHash) = createDummyTestJpeg("secure_evidence.jpg", "GENUINE_CAMERA_BYTES")

        val submission = PendingSubmission(
            deviceEvidenceId = "CAP-INTEGRITY-001",
            projectId = 1,
            stageId = 1,
            projectName = "Site Alpha",
            stageName = "Excavation",
            originalFilePath = testFile.absolutePath,
            clientSha256 = originalHash,
            capturedAtIso = "2026-10-10T02:00:00Z",
            latitude = 20.03639,
            longitude = 77.364,
            accuracyM = 3.0f
        )
        queueManager.enqueue(submission)

        // Intact verification
        assertTrue("Intact file must pass integrity check", queueManager.verifyFileIntegrity(submission))

        // Simulate local tampering on device while offline
        testFile.writeBytes("TAMPERED_INJECTED_BYTES".toByteArray(StandardCharsets.UTF_8))
        assertFalse("Tampered file must fail integrity check", queueManager.verifyFileIntegrity(submission))

        // Retry pending submissions should block tampered upload
        val dummyPort = startMockServer { exchange ->
            exchange.sendResponseHeaders(500, 0)
            exchange.close()
        }
        val repo = createRepositoryForPort(dummyPort)

        val retryResults = repo.retryPendingSubmissions()
        assertEquals(1, retryResults.size)
        val (_, uploadRes) = retryResults[0]
        assertTrue("Tampered upload retry must fail", uploadRes.isFailure)
        assertTrue(
            "Exception must be SecurityException",
            uploadRes.exceptionOrNull() is SecurityException
        )
    }

    @Test
    fun testOfflineQueueRetryCountPreservedOnReEnqueue() {
        val (testFile, hash) = createDummyTestJpeg("retry_count_test.jpg")
        val initialTime = System.currentTimeMillis() - 10000

        val item = PendingSubmission(
            deviceEvidenceId = "CAP-RETRY-01",
            projectId = 1,
            stageId = 1,
            projectName = "Alpha",
            stageName = "Stage 1",
            originalFilePath = testFile.absolutePath,
            clientSha256 = hash,
            capturedAtIso = "2026-10-10T01:00:00Z",
            latitude = 28.6,
            longitude = 77.3,
            accuracyM = 5f,
            createdAtEpoch = initialTime,
            retryCount = 0
        )

        queueManager.enqueue(item)
        val first = queueManager.getPendingSubmissions().first()
        assertEquals(initialTime, first.createdAtEpoch)
        assertEquals(0, first.retryCount)

        // Re-enqueue simulate retry failure
        queueManager.enqueue(item.copy(lastError = "Connection refused"))
        val second = queueManager.getPendingSubmissions().first()
        assertEquals(initialTime, second.createdAtEpoch)
        assertEquals("Retry count must increment", 1, second.retryCount)
        assertEquals("Connection refused", second.lastError)

        // Update error directly
        queueManager.updateError("CAP-RETRY-01", "Timeout")
        val third = queueManager.getPendingSubmissions().first()
        assertEquals(2, third.retryCount)
        assertEquals("Timeout", third.lastError)
    }

    @Test
    fun testEvidenceWithAiAnalysisAndBlockchainBlocksParsed() = runBlocking {
        val port = startMockServer { exchange ->
            val jsonResponse = """
                {
                    "id": 202,
                    "device_evidence_id": "CAP-AI-BLOCK-202",
                    "project_id": 1,
                    "stage_id": 3,
                    "project_name": "Metro Extension",
                    "stage_name": "Pier Reinforcement",
                    "supervisor_id": 5,
                    "supervisor_name": "Site Engineer",
                    "original_filename": "pier_rebar.jpg",
                    "file_size": 204800,
                    "mime_type": "image/jpeg",
                    "client_sha256": "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
                    "server_sha256": "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
                    "hash_matched": true,
                    "captured_at": "2026-10-10T04:00:00Z",
                    "server_received_at": "2026-10-10T04:00:02Z",
                    "latitude": 19.0760,
                    "longitude": 72.8777,
                    "accuracy_m": 3.5,
                    "distance_to_site_m": 8.0,
                    "is_within_radius": true,
                    "radius_warning": false,
                    "blockchain_tx": "0x4a9b6c8d1234567890abcdef1234567890abcdef1234567890abcdef12345678",
                    "blockchain_status": "confirmed",
                    "status": "VERIFIED_SUBMITTED",
                    "ai_analysis": {
                        "status": "completed",
                        "summary": "Reinforced concrete pier cage assembly",
                        "report": "Vertical rebar cage positioned with helical ties prior to shuttering.",
                        "model": "gemini-2.5-flash",
                        "version": "1.0.0",
                        "analyzed_at": "2026-10-10T04:00:05Z",
                        "structured_result": {
                            "summary": "Pier reinforcement visible",
                            "work_category": "Reinforced Concrete",
                            "observed_activities": ["Tying vertical rebars", "Placing spiral stirrups"],
                            "materials_visible": ["Thermo-Mechanically Treated (TMT) steel bars", "Binding wire"],
                            "equipment_visible": ["Bar bending tool"],
                            "stage_assessment": {
                                "observed_stage": "Substructure Pier Reinforcement",
                                "confidence": "high",
                                "reasoning": "Exposed steel cage resting on footing starter"
                            },
                            "progress_indicators": ["Cage reached full elevation"],
                            "quality_observations": ["Uniform rebar spacing visible"],
                            "potential_issues": [],
                            "limitations": ["Concrete cover cannot be measured before shuttering"],
                            "report": "Pier steel rebar cage inspection complete."
                        }
                    },
                    "blockchain": {
                        "status": "confirmed",
                        "network": "sepolia",
                        "chain_id": 11155111,
                        "transaction_hash": "0x4a9b6c8d1234567890abcdef1234567890abcdef1234567890abcdef12345678",
                        "block_number": 6891234,
                        "explorer_url": "https://sepolia.etherscan.io/tx/0x4a9b6c8d1234567890abcdef1234567890abcdef1234567890abcdef12345678"
                    }
                }
            """.trimIndent()

            val bytes = jsonResponse.toByteArray(StandardCharsets.UTF_8)
            exchange.responseHeaders.set("Content-Type", "application/json")
            exchange.sendResponseHeaders(200, bytes.size.toLong())
            exchange.responseBody.write(bytes)
            exchange.close()
        }

        val repo = createRepositoryForPort(port)
        val result = repo.getEvidenceDetail(202)

        assertTrue(result.isSuccess)
        val ev = result.getOrNull()!!
        assertEquals(202, ev.id)
        assertNotNull(ev.aiAnalysis)
        assertEquals("completed", ev.aiAnalysis!!.status)
        assertEquals("Reinforced concrete pier cage assembly", ev.aiAnalysis!!.summary)
        assertEquals("gemini-2.5-flash", ev.aiAnalysis!!.model)

        val structured = ev.aiAnalysis!!.structuredResult
        assertNotNull(structured)
        assertEquals("Reinforced Concrete", structured!!.workCategory)
        assertEquals(2, structured.observedActivities.size)
        assertEquals(2, structured.materialsVisible.size)
        assertEquals("Substructure Pier Reinforcement", structured.stageAssessment?.observedStage)
        assertEquals("high", structured.stageAssessment?.confidence)

        assertNotNull(ev.blockchain)
        assertEquals("confirmed", ev.blockchain!!.status)
        assertEquals("sepolia", ev.blockchain!!.network)
        assertEquals(11155111, ev.blockchain!!.chainId)
        assertEquals(6891234L, ev.blockchain!!.blockNumber)
        assertTrue(ev.blockchain!!.explorerUrl!!.contains("sepolia.etherscan.io"))
    }

    @Test
    fun testRetryAiAnalysisAndRetryAnchor() = runBlocking {
        val port = startMockServer { exchange ->
            val jsonResponse = """
                {
                    "id": 303,
                    "device_evidence_id": "CAP-RETRY-303",
                    "project_id": 1,
                    "stage_id": 1,
                    "supervisor_id": 5,
                    "original_filename": "retry.jpg",
                    "file_size": 1024,
                    "mime_type": "image/jpeg",
                    "client_sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                    "server_sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                    "hash_matched": true,
                    "captured_at": "2026-10-10T04:30:00Z",
                    "server_received_at": "2026-10-10T04:30:01Z",
                    "latitude": 19.0,
                    "longitude": 72.0,
                    "accuracy_m": 5.0,
                    "is_within_radius": true,
                    "status": "VERIFIED_SUBMITTED",
                    "ai_analysis": {
                        "status": "pending"
                    },
                    "blockchain": {
                        "status": "queued",
                        "network": "sepolia",
                        "chain_id": 11155111
                    }
                }
            """.trimIndent()

            val bytes = jsonResponse.toByteArray(StandardCharsets.UTF_8)
            exchange.responseHeaders.set("Content-Type", "application/json")
            exchange.sendResponseHeaders(200, bytes.size.toLong())
            exchange.responseBody.write(bytes)
            exchange.close()
        }

        val repo = createRepositoryForPort(port)

        val aiResult = repo.retryAiAnalysis(303)
        assertTrue(aiResult.isSuccess)
        assertEquals("pending", aiResult.getOrNull()?.aiAnalysis?.status)

        val anchorResult = repo.retryAnchor(303)
        assertTrue(anchorResult.isSuccess)
        assertEquals("queued", anchorResult.getOrNull()?.blockchain?.status)
    }
}
