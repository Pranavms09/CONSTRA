package constra.ai

import android.app.Application
import constra.ai.data.api.NetworkClient
import constra.ai.data.auth.AuthRepository
import constra.ai.data.auth.SessionManager
import constra.ai.data.repository.OfflineQueueManager
import constra.ai.data.repository.SupervisorRepository

class ConstraApp : Application() {

    lateinit var sessionManager: SessionManager private set
    lateinit var networkClient: NetworkClient private set
    lateinit var authRepository: AuthRepository private set
    lateinit var offlineQueueManager: OfflineQueueManager private set
    lateinit var supervisorRepository: SupervisorRepository private set

    override fun onCreate() {
        super.onCreate()
        instance = this

        sessionManager = SessionManager(this)
        networkClient = NetworkClient(sessionManager)
        authRepository = AuthRepository(this, sessionManager, networkClient)
        offlineQueueManager = OfflineQueueManager(this)
        supervisorRepository = SupervisorRepository(this, networkClient, offlineQueueManager)
    }

    companion object {
        lateinit var instance: ConstraApp private set
    }
}
