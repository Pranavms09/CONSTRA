package constra.ai.domain.model

import com.google.gson.annotations.SerializedName

data class User(
    @SerializedName("id") val id: Int,
    @SerializedName("email") val email: String,
    @SerializedName("full_name") val fullName: String,
    @SerializedName("role") val role: String,
    @SerializedName("is_active") val isActive: Boolean = true,
    @SerializedName("token") val token: String? = null
)

data class Project(
    @SerializedName("id") val id: Int,
    @SerializedName("name") val name: String,
    @SerializedName("site_address") val siteAddress: String? = null,
    @SerializedName("centroid_lat") val centroidLat: Double? = null,
    @SerializedName("centroid_lng") val centroidLng: Double? = null,
    @SerializedName("site_radius_m") val siteRadiusM: Double = 200.0
)

data class Stage(
    @SerializedName("id") val id: Int,
    @SerializedName("project_id") val projectId: Int,
    @SerializedName("name") val name: String,
    @SerializedName("order") val order: Int,
    @SerializedName("status") val status: String,
    @SerializedName("verified_progress") val verifiedProgress: Double = 0.0
)

data class CaptureMetadata(
    val deviceEvidenceId: String,
    val projectId: Int,
    val stageId: Int,
    val projectName: String,
    val stageName: String,
    val originalFilePath: String,
    val fileSizeBytes: Long,
    val clientSha256: String,
    val capturedAtIso: String,
    val latitude: Double,
    val longitude: Double,
    val accuracyM: Float,
    val isWithinRadius: Boolean,
    val distanceToSiteM: Double?,
    val siteRadiusM: Double,
    val radiusWarning: Boolean,
    val notes: String? = null
)

data class StageAssessment(
    @SerializedName("observed_stage") val observedStage: String? = null,
    @SerializedName("confidence") val confidence: String = "medium",
    @SerializedName("reasoning") val reasoning: String? = null
)

data class StructuredResult(
    @SerializedName("summary") val summary: String = "",
    @SerializedName("work_category") val workCategory: String = "",
    @SerializedName("observed_activities") val observedActivities: List<String> = emptyList(),
    @SerializedName("materials_visible") val materialsVisible: List<String> = emptyList(),
    @SerializedName("equipment_visible") val equipmentVisible: List<String> = emptyList(),
    @SerializedName("stage_assessment") val stageAssessment: StageAssessment? = null,
    @SerializedName("progress_indicators") val progressIndicators: List<String> = emptyList(),
    @SerializedName("quality_observations") val qualityObservations: List<String> = emptyList(),
    @SerializedName("potential_issues") val potentialIssues: List<String> = emptyList(),
    @SerializedName("limitations") val limitations: List<String> = emptyList(),
    @SerializedName("report") val report: String = ""
)

data class AiAnalysis(
    @SerializedName("status") val status: String = "pending",
    @SerializedName("summary") val summary: String? = null,
    @SerializedName("report") val report: String? = null,
    @SerializedName("model") val model: String? = null,
    @SerializedName("version") val version: String? = null,
    @SerializedName("analyzed_at") val analyzedAt: String? = null,
    @SerializedName("error_code") val errorCode: String? = null,
    @SerializedName("structured_result") val structuredResult: StructuredResult? = null
)

data class BlockchainAnchor(
    @SerializedName("status") val status: String = "queued",
    @SerializedName("network") val network: String = "sepolia",
    @SerializedName("chain_id") val chainId: Int = 11155111,
    @SerializedName("transaction_hash") val transactionHash: String? = null,
    @SerializedName("block_number") val blockNumber: Long? = null,
    @SerializedName("explorer_url") val explorerUrl: String? = null
)

data class Evidence(
    @SerializedName("id") val id: Int,
    @SerializedName("device_evidence_id") val deviceEvidenceId: String,
    @SerializedName("project_id") val projectId: Int,
    @SerializedName("stage_id") val stageId: Int,
    @SerializedName("project_name") val projectName: String? = null,
    @SerializedName("stage_name") val stageName: String? = null,
    @SerializedName("supervisor_id") val supervisorId: Int,
    @SerializedName("supervisor_name") val supervisorName: String? = null,
    @SerializedName("original_filename") val originalFilename: String,
    @SerializedName("file_size") val fileSize: Long,
    @SerializedName("mime_type") val mimeType: String,
    @SerializedName("client_sha256") val clientSha256: String,
    @SerializedName("server_sha256") val serverSha256: String,
    @SerializedName("hash_matched") val hashMatched: Boolean,
    @SerializedName("captured_at") val capturedAt: String,
    @SerializedName("server_received_at") val serverReceivedAt: String,
    @SerializedName("latitude") val latitude: Double,
    @SerializedName("longitude") val longitude: Double,
    @SerializedName("accuracy_m") val accuracyM: Float,
    @SerializedName("distance_to_site_m") val distanceToSiteM: Double? = null,
    @SerializedName("is_within_radius") val isWithinRadius: Boolean = true,
    @SerializedName("radius_warning") val radiusWarning: Boolean = false,
    @SerializedName("blockchain_tx") val blockchainTx: String? = null,
    @SerializedName("blockchain_status") val blockchainStatus: String = "pending",
    @SerializedName("status") val status: String,
    @SerializedName("notes") val notes: String? = null,
    @SerializedName("ai_analysis") val aiAnalysis: AiAnalysis? = null,
    @SerializedName("blockchain") val blockchain: BlockchainAnchor? = null
)

data class PendingSubmission(
    @SerializedName("device_evidence_id") val deviceEvidenceId: String,
    @SerializedName("project_id") val projectId: Int,
    @SerializedName("stage_id") val stageId: Int,
    @SerializedName("project_name") val projectName: String,
    @SerializedName("stage_name") val stageName: String,
    @SerializedName("original_file_path") val originalFilePath: String,
    @SerializedName("client_sha256") val clientSha256: String,
    @SerializedName("captured_at_iso") val capturedAtIso: String,
    @SerializedName("latitude") val latitude: Double,
    @SerializedName("longitude") val longitude: Double,
    @SerializedName("accuracy_m") val accuracyM: Float,
    @SerializedName("notes") val notes: String? = null,
    @SerializedName("created_at_epoch") val createdAtEpoch: Long = System.currentTimeMillis(),
    @SerializedName("retry_count") val retryCount: Int = 0,
    @SerializedName("last_error") val lastError: String? = null
)

data class SupervisorDashboard(
    @SerializedName("assigned_projects_count") val assignedProjectsCount: Int,
    @SerializedName("evidence_today_count") val evidenceTodayCount: Int,
    @SerializedName("total_submitted_count") val totalSubmittedCount: Int,
    @SerializedName("recent_submissions") val recentSubmissions: List<Evidence> = emptyList()
)

class EvidenceSubmissionException(
    val statusCode: Int,
    message: String,
    val serverDetail: String? = null
) : Exception(message)
