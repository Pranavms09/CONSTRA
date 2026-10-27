package constra.ai.data.api

import constra.ai.domain.model.*
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.Response
import retrofit2.http.*

data class LoginRequest(val claimed_role: String? = "supervisor")
data class PasswordLoginRequest(val email: String, val password: String, val claimed_role: String = "supervisor")
data class DemoLoginRequest(val role: String = "supervisor")

data class AuthResponse(
    val id: Int,
    val email: String,
    val full_name: String,
    val role: String,
    val is_active: Boolean = true,
    val token: String? = null
)

data class PingResponse(
    val status: String,
    val message: String,
    val role: String,
    val user: String
)

interface SupervisorApiService {

    @POST("auth/login")
    suspend fun loginWithFirebase(
        @Body body: LoginRequest = LoginRequest("supervisor")
    ): Response<AuthResponse>

    @POST("auth/login-password")
    suspend fun loginWithPassword(
        @Body body: PasswordLoginRequest
    ): Response<AuthResponse>

    @POST("auth/demo-login")
    suspend fun demoLogin(
        @Body body: DemoLoginRequest = DemoLoginRequest("supervisor")
    ): Response<AuthResponse>

    @GET("auth/me")
    suspend fun getMe(): Response<AuthResponse>

    @GET("supervisor/ping")
    suspend fun pingSupervisor(): Response<PingResponse>

    @GET("supervisor/projects")
    suspend fun getAssignedProjects(): Response<List<Project>>

    @GET("supervisor/projects/{pid}/stages")
    suspend fun getProjectStages(@Path("pid") projectId: Int): Response<List<Stage>>

    @Multipart
    @POST("supervisor/evidence")
    suspend fun submitEvidence(
        @Part file: MultipartBody.Part,
        @Part("device_evidence_id") deviceEvidenceId: RequestBody,
        @Part("project_id") projectId: RequestBody,
        @Part("stage_id") stageId: RequestBody,
        @Part("captured_at") capturedAt: RequestBody,
        @Part("latitude") latitude: RequestBody,
        @Part("longitude") longitude: RequestBody,
        @Part("accuracy_m") accuracyM: RequestBody,
        @Part("client_sha256") clientSha256: RequestBody,
        @Part("notes") notes: RequestBody? = null
    ): Response<Evidence>

    @GET("supervisor/evidence")
    suspend fun listEvidence(
        @Query("project_id") projectId: Int? = null,
        @Query("stage_id") stageId: Int? = null,
        @Query("limit") limit: Int = 50
    ): Response<List<Evidence>>

    @GET("supervisor/evidence/{id}")
    suspend fun getEvidenceDetail(@Path("id") id: Int): Response<Evidence>

    @POST("supervisor/evidence/{id}/retry-ai")
    suspend fun retryAiAnalysis(@Path("id") id: Int): Response<Evidence>

    @POST("supervisor/evidence/{id}/retry-anchor")
    suspend fun retryAnchor(@Path("id") id: Int): Response<Evidence>

    @GET("supervisor/dashboard")
    suspend fun getDashboard(): Response<SupervisorDashboard>
}
