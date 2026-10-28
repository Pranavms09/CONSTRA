package constra.ai

import constra.ai.data.api.SupervisorApiService
import constra.ai.data.repository.OfflineQueueManager
import constra.ai.data.repository.SupervisorRepository
import constra.ai.domain.model.CaptureMetadata
import constra.ai.domain.util.HashUtil
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Response
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.awt.Color
import java.awt.image.BufferedImage
import java.io.File
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.TimeUnit
import javax.imageio.ImageIO

class RealFastApiE2EIntegrationTest {

    private lateinit var tempDir: File
    private lateinit var queueManager: OfflineQueueManager
    private lateinit var repo: SupervisorRepository
    private val testBackendUrl = "http://127.0.0.1:8000/"

    @Before
    fun setUp() {
        tempDir = File(System.getProperty("java.io.tmpdir"), "constra_e2e_${System.currentTimeMillis()}").apply {
            mkdirs()
        }
        queueManager = OfflineQueueManager(tempDir)

        // OkHttp client injecting Demo Supervisor Bearer token
        val authInterceptor = object : Interceptor {
            override fun intercept(chain: Interceptor.Chain): Response {
                val req = chain.request().newBuilder()
                    .header("Authorization", "Bearer demo-supervisor")
                    .header("Accept", "application/json")
                    .build()
                return chain.proceed(req)
            }
        }

        val okHttpClient = OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()

        val retrofit = Retrofit.Builder()
            .baseUrl(testBackendUrl)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()

        val apiService = retrofit.create(SupervisorApiService::class.java)
        repo = SupervisorRepository(queueManager) { apiService }
    }

    @After
    fun tearDown() {
        tempDir.deleteRecursively()
    }

    private fun createGenuineJpegFile(filename: String): Pair<File, String> {
        val file = File(tempDir, filename)
        val image = BufferedImage(400, 300, BufferedImage.TYPE_INT_RGB)
        val g2d = image.createGraphics()
        g2d.color = Color(252, 188, 24) // Signal Yellow
        g2d.fillRect(0, 0, 400, 300)
        g2d.color = Color.BLACK
        g2d.drawString("CONSTRA SITE VERIFY E2E TEST", 50, 150)
        g2d.dispose()

        ImageIO.write(image, "JPEG", file)
        val sha256 = HashUtil.sha256(file)
        return file to sha256
    }

    private fun isServerReachable(): Boolean {
        return try {
            java.net.Socket("127.0.0.1", 8000).use { true }
        } catch (_: Exception) {
            false
        }
    }

    @Test
    fun testRealEndToEndEvidenceSubmissionAndRetrieval() = runBlocking {
        org.junit.Assume.assumeTrue(
            "FastAPI backend is not running on port 8000; skipping live integration test",
            isServerReachable()
        )

        // Step 1: Create genuine JPEG file and calculate SHA-256
        val deviceEvidenceId = "CAP-E2E-${System.currentTimeMillis()}"
        val (jpegFile, clientSha256) = createGenuineJpegFile("${deviceEvidenceId}.jpg")
        assertTrue("JPEG file must exist", jpegFile.exists())
        assertTrue("JPEG file must have positive size", jpegFile.length() > 0)

        val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        val capturedAtIso = isoFormat.format(Date())

        val metadata = CaptureMetadata(
            deviceEvidenceId = deviceEvidenceId,
            projectId = 1,
            stageId = 1,
            projectName = "Shree Construction, Nashik",
            stageName = "Campus Substructure & Foundation Footings",
            originalFilePath = jpegFile.absolutePath,
            fileSizeBytes = jpegFile.length(),
            clientSha256 = clientSha256,
            capturedAtIso = capturedAtIso,
            latitude = 20.03639, // At PVGCOE campus centroid
            longitude = 73.79959,
            accuracyM = 4.0f,
            isWithinRadius = true,
            distanceToSiteM = 1.0,
            siteRadiusM = 500.0,
            radiusWarning = false,
            notes = "E2E Verified Physical Camera Frame"
        )

        // Step 2: Transmit live multipart evidence to FastAPI
        val submitResult = repo.submitEvidence(metadata)
        assertTrue(
            "Evidence submission to real FastAPI must succeed. Error: ${submitResult.exceptionOrNull()?.message}",
            submitResult.isSuccess
        )

        val evidence = submitResult.getOrNull()!!
        assertNotNull(evidence)
        assertEquals(deviceEvidenceId, evidence.deviceEvidenceId)
        assertEquals(1, evidence.projectId)
        assertEquals(1, evidence.stageId)

        // Step 3: Verify server-side hash match and integrity status
        assertEquals("Server-side SHA-256 must match client SHA-256 exactly", clientSha256, evidence.serverSha256)
        assertTrue("hash_matched must be true", evidence.hashMatched)
        assertEquals("status must be VERIFIED_SUBMITTED", "VERIFIED_SUBMITTED", evidence.status)
        assertTrue("is_within_radius must be true", evidence.isWithinRadius)
        assertFalse("radius_warning must be false", evidence.radiusWarning)

        // Step 4: Verify Idempotency - retrying exact same device_evidence_id returns existing record without duplicate
        val retryResult = repo.submitEvidence(metadata)
        assertTrue("Idempotent retry must succeed", retryResult.isSuccess)
        val retryEvidence = retryResult.getOrNull()!!
        assertEquals("Idempotent submission must return identical evidence ID", evidence.id, retryEvidence.id)

        // Step 5: Verify Evidence History Retrieval from FastAPI
        val listResult = repo.listSubmittedEvidence(projectId = 1)
        assertTrue("History retrieval must succeed", listResult.isSuccess)
        val historyList = listResult.getOrNull()!!
        assertTrue("History list must contain at least 1 record", historyList.isNotEmpty())
        val foundRecord = historyList.find { it.deviceEvidenceId == deviceEvidenceId }
        assertNotNull("Submitted evidence must exist in history list", foundRecord)
        assertEquals(evidence.id, foundRecord!!.id)
        assertEquals(clientSha256, foundRecord.serverSha256)

        // Step 6: Verify Evidence Detail Retrieval
        val detailResult = repo.getEvidenceDetail(evidence.id)
        assertTrue("Detail retrieval must succeed", detailResult.isSuccess)
        val detail = detailResult.getOrNull()!!
        assertEquals(evidence.id, detail.id)
        assertEquals(deviceEvidenceId, detail.deviceEvidenceId)
        assertEquals("E2E Verified Physical Camera Frame", detail.notes)
    }
}
