package constra.ai.data.auth

import android.content.Context
import android.content.SharedPreferences
import constra.ai.domain.model.User

class SessionManager(context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("constra_supervisor_session", Context.MODE_PRIVATE)

    companion object {
        private const val KEY_TOKEN = "auth_token"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_USER_EMAIL = "user_email"
        private const val KEY_USER_NAME = "user_name"
        private const val KEY_USER_ROLE = "user_role"
        private const val KEY_SELECTED_PROJECT_ID = "selected_project_id"
        private const val KEY_SELECTED_STAGE_ID = "selected_stage_id"
        private const val KEY_BACKEND_URL = "backend_url"
        
        fun getDefaultBackendUrl(): String {
            val isEmulator = (android.os.Build.FINGERPRINT.startsWith("generic") ||
                    android.os.Build.FINGERPRINT.startsWith("unknown") ||
                    android.os.Build.MODEL.contains("google_sdk") ||
                    android.os.Build.MODEL.contains("Emulator") ||
                    android.os.Build.MODEL.contains("Android SDK built for x86") ||
                    android.os.Build.MANUFACTURER.contains("Genymotion") ||
                    android.os.Build.HARDWARE.contains("goldfish") ||
                    android.os.Build.HARDWARE.contains("ranchu"))
            return if (isEmulator) "http://10.0.2.2:8000" else "http://127.0.0.1:8000"
        }
    }

    fun saveSession(user: User, token: String) {
        prefs.edit()
            .putString(KEY_TOKEN, token)
            .putInt(KEY_USER_ID, user.id)
            .putString(KEY_USER_EMAIL, user.email)
            .putString(KEY_USER_NAME, user.fullName)
            .putString(KEY_USER_ROLE, user.role)
            .apply()
    }

    fun updateToken(token: String) {
        prefs.edit().putString(KEY_TOKEN, token).apply()
    }

    fun getToken(): String? = prefs.getString(KEY_TOKEN, null)

    fun isLoggedIn(): Boolean = !getToken().isNullOrBlank()

    fun getCurrentUser(): User? {
        val id = prefs.getInt(KEY_USER_ID, -1)
        val email = prefs.getString(KEY_USER_EMAIL, null) ?: return null
        val name = prefs.getString(KEY_USER_NAME, "") ?: ""
        val role = prefs.getString(KEY_USER_ROLE, "supervisor") ?: "supervisor"
        return User(id = id, email = email, fullName = name, role = role, token = getToken())
    }

    fun clearSession() {
        prefs.edit()
            .remove(KEY_TOKEN)
            .remove(KEY_USER_ID)
            .remove(KEY_USER_EMAIL)
            .remove(KEY_USER_NAME)
            .remove(KEY_USER_ROLE)
            .apply()
    }

    fun getBackendUrl(): String {
        return prefs.getString(KEY_BACKEND_URL, null) ?: getDefaultBackendUrl()
    }

    fun setBackendUrl(url: String) {
        val cleanUrl = if (url.endsWith("/")) url.dropLast(1) else url
        prefs.edit().putString(KEY_BACKEND_URL, cleanUrl).apply()
    }

    fun saveSelectedProject(projectId: Int) {
        prefs.edit().putInt(KEY_SELECTED_PROJECT_ID, projectId).apply()
    }

    fun getSelectedProjectId(): Int = prefs.getInt(KEY_SELECTED_PROJECT_ID, -1)

    fun saveSelectedStage(stageId: Int) {
        prefs.edit().putInt(KEY_SELECTED_STAGE_ID, stageId).apply()
    }

    fun getSelectedStageId(): Int = prefs.getInt(KEY_SELECTED_STAGE_ID, -1)
}
