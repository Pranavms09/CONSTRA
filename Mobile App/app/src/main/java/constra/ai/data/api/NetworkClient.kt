package constra.ai.data.api

import constra.ai.data.auth.SessionManager
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

class NetworkClient(private val sessionManager: SessionManager) {

    private var currentBaseUrl: String = sessionManager.getBackendUrl()
    private var cachedApiService: SupervisorApiService? = null

    private val okHttpClient: OkHttpClient by lazy {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }
        OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor(sessionManager))
            .addInterceptor(logging)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build()
    }

    @Synchronized
    fun getApiService(): SupervisorApiService {
        val configuredUrl = sessionManager.getBackendUrl().let {
            if (it.endsWith("/")) it else "$it/"
        }
        if (cachedApiService == null || currentBaseUrl != configuredUrl) {
            currentBaseUrl = configuredUrl
            val retrofit = Retrofit.Builder()
                .baseUrl(configuredUrl)
                .client(okHttpClient)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
            cachedApiService = retrofit.create(SupervisorApiService::class.java)
        }
        return cachedApiService!!
    }
}
