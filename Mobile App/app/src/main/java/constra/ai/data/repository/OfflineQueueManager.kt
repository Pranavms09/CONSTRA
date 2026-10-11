package constra.ai.data.repository

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import constra.ai.domain.model.PendingSubmission
import constra.ai.domain.util.HashUtil
import java.io.File
import java.io.FileReader
import java.io.FileWriter

class OfflineQueueManager(
    val baseDir: File
) {
    constructor(context: Context) : this(context.filesDir)

    private val gson = Gson()
    private val queueFile = File(baseDir, "constra_offline_queue.json")
    private val capturesDir = File(baseDir, "evidence_captures").apply { mkdirs() }

    fun getCapturesDirectory(): File = capturesDir

    @Synchronized
    fun getPendingSubmissions(): List<PendingSubmission> {
        if (!queueFile.exists()) return emptyList()
        return try {
            FileReader(queueFile).use { reader ->
                val type = object : TypeToken<List<PendingSubmission>>() {}.type
                gson.fromJson<List<PendingSubmission>>(reader, type) ?: emptyList()
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    @Synchronized
    fun enqueue(submission: PendingSubmission) {
        val current = getPendingSubmissions().toMutableList()
        val existingIndex = current.indexOfFirst { it.deviceEvidenceId == submission.deviceEvidenceId }
        if (existingIndex >= 0) {
            val existing = current[existingIndex]
            current[existingIndex] = submission.copy(
                createdAtEpoch = existing.createdAtEpoch,
                retryCount = if (submission.retryCount > 0) submission.retryCount else (existing.retryCount + 1),
                lastError = submission.lastError ?: existing.lastError
            )
        } else {
            current.add(submission)
        }
        saveQueue(current)
    }

    @Synchronized
    fun remove(deviceEvidenceId: String) {
        val current = getPendingSubmissions().toMutableList()
        val removed = current.removeAll { it.deviceEvidenceId == deviceEvidenceId }
        if (removed) {
            saveQueue(current)
        }
    }

    @Synchronized
    fun updateError(deviceEvidenceId: String, error: String) {
        val current = getPendingSubmissions().toMutableList()
        val index = current.indexOfFirst { it.deviceEvidenceId == deviceEvidenceId }
        if (index >= 0) {
            val item = current[index]
            current[index] = item.copy(
                retryCount = item.retryCount + 1,
                lastError = error
            )
            saveQueue(current)
        }
    }

    @Synchronized
    fun clearQueue() {
        if (queueFile.exists()) {
            queueFile.delete()
        }
    }

    @Synchronized
    private fun saveQueue(list: List<PendingSubmission>) {
        try {
            val tempFile = File(baseDir, "constra_offline_queue.tmp")
            FileWriter(tempFile).use { writer ->
                gson.toJson(list, writer)
            }
            if (tempFile.exists()) {
                if (queueFile.exists()) {
                    queueFile.delete()
                }
                tempFile.renameTo(queueFile)
            }
        } catch (_: Exception) {}
    }

    /**
     * Checks if the locally stored capture file exists, is non-empty, and verifies that its
     * current SHA-256 matches the recorded clientSha256 taken at capture time.
     */
    fun verifyFileIntegrity(submission: PendingSubmission): Boolean {
        val file = File(submission.originalFilePath)
        if (!file.exists() || !file.isFile || file.length() == 0L) return false
        val currentHash = HashUtil.sha256(file)
        return currentHash.equals(submission.clientSha256, ignoreCase = true)
    }
}
