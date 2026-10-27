package constra.ai.data.auth

import android.content.Context
import com.google.firebase.auth.FirebaseAuth
import constra.ai.data.api.NetworkClient
import constra.ai.data.api.PasswordLoginRequest
import constra.ai.data.api.DemoLoginRequest
import constra.ai.domain.model.User
import kotlinx.coroutines.tasks.await

class AuthRepository(
    private val context: Context,
    private val sessionManager: SessionManager,
    private val networkClient: NetworkClient
) {
    private val firebaseAuth: FirebaseAuth by lazy { FirebaseAuth.getInstance() }

    suspend fun loginWithFirebaseToken(idToken: String): Result<User> {
        return try {
            sessionManager.updateToken(idToken)
            val api = networkClient.getApiService()
            val response = api.loginWithFirebase()

            if (!response.isSuccessful) {
                sessionManager.clearSession()
                val errorBody = response.errorBody()?.string() ?: "Authentication failed (${response.code()})"
                return Result.failure(Exception(errorBody))
            }

            val authUser = response.body() ?: return Result.failure(Exception("Empty response from auth server"))
            if (authUser.role != "supervisor") {
                sessionManager.clearSession()
                firebaseAuth.signOut()
                return Result.failure(Exception("Access denied: Account role '${authUser.role}' is not authorized for the Site Supervisor mobile app."))
            }

            val user = User(
                id = authUser.id,
                email = authUser.email,
                fullName = authUser.full_name,
                role = authUser.role,
                isActive = authUser.is_active,
                token = idToken
            )
            sessionManager.saveSession(user, idToken)
            Result.success(user)
        } catch (e: Exception) {
            sessionManager.clearSession()
            Result.failure(e)
        }
    }

    suspend fun loginWithPassword(email: String, pass: String): Result<User> {
        return try {
            val api = networkClient.getApiService()
            val response = api.loginWithPassword(PasswordLoginRequest(email.trim(), pass, "supervisor"))

            if (!response.isSuccessful) {
                val errorMsg = response.errorBody()?.string() ?: "Login failed (${response.code()})"
                return Result.failure(Exception(errorMsg))
            }

            val authUser = response.body() ?: return Result.failure(Exception("Empty login response"))
            val token = authUser.token ?: return Result.failure(Exception("No session token received"))

            val user = User(
                id = authUser.id,
                email = authUser.email,
                fullName = authUser.full_name,
                role = authUser.role,
                isActive = authUser.is_active,
                token = token
            )
            sessionManager.saveSession(user, token)
            Result.success(user)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun loginWithDemo(): Result<User> {
        return try {
            val api = networkClient.getApiService()
            val response = api.demoLogin(DemoLoginRequest("supervisor"))

            if (!response.isSuccessful) {
                val errorMsg = response.errorBody()?.string() ?: "Demo login failed (${response.code()})"
                return Result.failure(Exception(errorMsg))
            }

            val authUser = response.body() ?: return Result.failure(Exception("Empty demo response"))
            val token = authUser.token ?: "demo-supervisor"

            val user = User(
                id = authUser.id,
                email = authUser.email,
                fullName = authUser.full_name,
                role = authUser.role,
                isActive = authUser.is_active,
                token = token
            )
            sessionManager.saveSession(user, token)
            Result.success(user)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun restoreSession(): Result<User> {
        val currentUser = sessionManager.getCurrentUser() ?: return Result.failure(Exception("No active session"))
        return try {
            val api = networkClient.getApiService()
            val response = api.getMe()
            if (response.isSuccessful && response.body() != null) {
                val me = response.body()!!
                if (me.role != "supervisor") {
                    signOut()
                    return Result.failure(Exception("Session invalid: User is not a Site Supervisor."))
                }
                val refreshedUser = currentUser.copy(
                    id = me.id,
                    email = me.email,
                    fullName = me.full_name,
                    role = me.role
                )
                Result.success(refreshedUser)
            } else {
                // If network failure, permit cached offline session
                Result.success(currentUser)
            }
        } catch (e: Exception) {
            // Permit cached offline session on network error
            Result.success(currentUser)
        }
    }

    fun signOut() {
        try {
            firebaseAuth.signOut()
        } catch (_: Exception) {}
        sessionManager.clearSession()
    }
}
