package constra.ai.data.repository

import android.content.Context
import com.google.gson.JsonParser
import constra.ai.data.api.NetworkClient
import constra.ai.data.api.SupervisorApiService
import constra.ai.domain.model.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.io.IOException

class SupervisorRepository(
    val offlineQueueManager: OfflineQueueManager,
    private val apiServiceProvider: () -> SupervisorApiService
) {
    constructor(
        context: Context,
        networkClient: NetworkClient,
        offlineQueueManager: OfflineQueueManager
    ) : this(offlineQueueManager, { networkClient.getApiService() })

    suspend fun getAssignedProjects(): Result<List<Project>> {
        return try {
            val response = apiServiceProvider().getAssignedProjects()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                val errorMsg = extractErrorMessage(response.code(), response.errorBody()?.string())
                Result.failure(EvidenceSubmissionException(response.code(), errorMsg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getProjectStages(projectId: Int): Result<List<Stage>> {
        return try {
            val response = apiServiceProvider().getProjectStages(projectId)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                val errorMsg = extractErrorMessage(response.code(), response.errorBody()?.string())
                Result.failure(EvidenceSubmissionException(response.code(), errorMsg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun submitEvidence(metadata: CaptureMetadata): Result<Evidence> {
        val file = File(metadata.originalFilePath)
        if (!file.exists()) {
            return Result.failure(IllegalStateException("Local original capture file not found on device."))
        }
        if (file.length() == 0L) {
            return Result.failure(IllegalStateException("Local capture file is empty (0 bytes)."))
        }

        return try {
            val mediaType = "image/jpeg".toMediaTypeOrNull()
            val requestFile = file.asRequestBody(mediaType)
            val filePart = MultipartBody.Part.createFormData("file", file.name, requestFile)

            val textMediaType = "text/plain".toMediaTypeOrNull()
            val deviceIdPart = metadata.deviceEvidenceId.toRequestBody(textMediaType)
            val projectIdPart = metadata.projectId.toString().toRequestBody(textMediaType)
            val stageIdPart = metadata.stageId.toString().toRequestBody(textMediaType)
            val capturedAtPart = metadata.capturedAtIso.toRequestBody(textMediaType)
            val latPart = metadata.latitude.toString().toRequestBody(textMediaType)
            val lngPart = metadata.longitude.toString().toRequestBody(textMediaType)
            val accPart = metadata.accuracyM.toString().toRequestBody(textMediaType)
            val shaPart = metadata.clientSha256.toRequestBody(textMediaType)
            val notesPart = metadata.notes?.takeIf { it.isNotBlank() }?.toRequestBody(textMediaType)

            val response = apiServiceProvider().submitEvidence(
                file = filePart,
                deviceEvidenceId = deviceIdPart,
                projectId = projectIdPart,
                stageId = stageIdPart,
                capturedAt = capturedAtPart,
                latitude = latPart,
                longitude = lngPart,
                accuracyM = accPart,
                clientSha256 = shaPart,
                notes = notesPart
            )

            if (response.isSuccessful && response.body() != null) {
                // Remove from pending queue on successful upload (HTTP 201 or idempotent HTTP 200)
                offlineQueueManager.remove(metadata.deviceEvidenceId)
                Result.success(response.body()!!)
            } else {
                val rawError = response.errorBody()?.string()
                val errorMsg = extractErrorMessage(response.code(), rawError)
                val detail = parseDetail(rawError)
                // Persist failed submission to offline queue to prevent evidence loss
                enqueuePending(metadata, errorMsg)
                Result.failure(EvidenceSubmissionException(response.code(), errorMsg, detail))
            }
        } catch (e: IOException) {
            // Network failure or timeout: securely enqueue for offline sync
            val isTimeout = e is java.net.SocketTimeoutException
            val errorMsg = if (isTimeout) {
                "Connection timed out. Evidence securely queued locally for offline retry."
            } else {
                "Network offline (${e.localizedMessage ?: "unreachable"}). Evidence securely saved locally and added to submission queue."
            }
            enqueuePending(metadata, errorMsg)
            Result.failure(IOException(errorMsg, e))
        } catch (e: Exception) {
            val errorMsg = "Unexpected error (${e.localizedMessage ?: "unknown"}). Evidence saved to queue."
            enqueuePending(metadata, errorMsg)
            Result.failure(e)
        }
    }

    private fun enqueuePending(metadata: CaptureMetadata, error: String) {
        val pending = PendingSubmission(
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
            notes = metadata.notes,
            lastError = error
        )
        offlineQueueManager.enqueue(pending)
    }

    suspend fun retryPendingSubmissions(): List<Pair<PendingSubmission, Result<Evidence>>> {
        val pendingList = offlineQueueManager.getPendingSubmissions()
        val results = mutableListOf<Pair<PendingSubmission, Result<Evidence>>>()

        for (item in pendingList) {
            // Step 1: Verify file integrity
            if (!offlineQueueManager.verifyFileIntegrity(item)) {
                val error = "File integrity check failed: local capture was modified or corrupted. Retake required."
                offlineQueueManager.updateError(item.deviceEvidenceId, error)
                results.add(item to Result.failure(SecurityException(error)))
                continue
            }

            // Step 2: Retry upload
            val metadata = CaptureMetadata(
                deviceEvidenceId = item.deviceEvidenceId,
                projectId = item.projectId,
                stageId = item.stageId,
                projectName = item.projectName,
                stageName = item.stageName,
                originalFilePath = item.originalFilePath,
                fileSizeBytes = File(item.originalFilePath).length(),
                clientSha256 = item.clientSha256,
                capturedAtIso = item.capturedAtIso,
                latitude = item.latitude,
                longitude = item.longitude,
                accuracyM = item.accuracyM,
                isWithinRadius = true,
                distanceToSiteM = null,
                siteRadiusM = 200.0,
                radiusWarning = false,
                notes = item.notes
            )

            val uploadResult = submitEvidence(metadata)
            if (uploadResult.isFailure) {
                val err = uploadResult.exceptionOrNull()?.message ?: "Upload retry failed"
                offlineQueueManager.updateError(item.deviceEvidenceId, err)
            }
            results.add(item to uploadResult)
        }

        return results
    }

    suspend fun listSubmittedEvidence(projectId: Int? = null, stageId: Int? = null): Result<List<Evidence>> {
        return try {
            val response = apiServiceProvider().listEvidence(projectId, stageId)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                val error = extractErrorMessage(response.code(), response.errorBody()?.string())
                Result.failure(EvidenceSubmissionException(response.code(), error))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getEvidenceDetail(id: Int): Result<Evidence> {
        return try {
            val response = apiServiceProvider().getEvidenceDetail(id)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                val error = extractErrorMessage(response.code(), response.errorBody()?.string())
                Result.failure(EvidenceSubmissionException(response.code(), error))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun retryAiAnalysis(id: Int): Result<Evidence> {
        return try {
            val response = apiServiceProvider().retryAiAnalysis(id)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                val error = extractErrorMessage(response.code(), response.errorBody()?.string())
                Result.failure(EvidenceSubmissionException(response.code(), error))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun retryAnchor(id: Int): Result<Evidence> {
        return try {
            val response = apiServiceProvider().retryAnchor(id)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                val error = extractErrorMessage(response.code(), response.errorBody()?.string())
                Result.failure(EvidenceSubmissionException(response.code(), error))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getDashboard(): Result<SupervisorDashboard> {
        return try {
            val response = apiServiceProvider().getDashboard()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                val error = extractErrorMessage(response.code(), response.errorBody()?.string())
                Result.failure(EvidenceSubmissionException(response.code(), error))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun extractErrorMessage(code: Int, errorBody: String?): String {
        val detail = parseDetail(errorBody)
        return when (code) {
            401 -> "HTTP 401 Unauthorized: Session token expired or invalid."
            403 -> "HTTP 403 Forbidden: Supervisor permission denied (${detail ?: "Role restricted"})."
            404 -> "HTTP 404 Not Found: Project or stage not found (${detail ?: ""})."
            400 -> "HTTP 400 Bad Request: Invalid evidence format (${detail ?: "Corrupted file"})."
            413 -> "HTTP 413 Payload Too Large: Evidence file exceeds server limit."
            422 -> "HTTP 422 Unprocessable Entity: Validation failed (${detail ?: ""})."
            else -> if (!detail.isNullOrBlank()) "[HTTP $code] $detail" else "Server error (HTTP $code)"
        }
    }

    private fun parseDetail(rawJson: String?): String? {
        if (rawJson.isNullOrBlank()) return null
        return try {
            val elem = JsonParser.parseString(rawJson)
            if (elem.isJsonObject) {
                val obj = elem.asJsonObject
                if (obj.has("detail")) {
                    val detailElem = obj.get("detail")
                    if (detailElem.isJsonPrimitive) {
                        detailElem.asString
                    } else {
                        detailElem.toString()
                    }
                } else null
            } else null
        } catch (_: Exception) {
            null
        }
    }
}
