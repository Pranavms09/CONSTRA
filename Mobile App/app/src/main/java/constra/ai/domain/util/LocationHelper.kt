package constra.ai.domain.util

import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlin.math.*

object LocationHelper {

    fun hasLocationPermission(context: Context): Boolean {
        val fineLocation = ContextCompat.checkSelfPermission(
            context,
            android.Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val coarseLocation = ContextCompat.checkSelfPermission(
            context,
            android.Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        return fineLocation || coarseLocation
    }

    fun calculateDistanceMeters(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val r = 6371000.0 // Earth radius in meters
        val phi1 = Math.toRadians(lat1)
        val phi2 = Math.toRadians(lat2)
        val deltaPhi = Math.toRadians(lat2 - lat1)
        val deltaLambda = Math.toRadians(lon2 - lon1)

        val a = sin(deltaPhi / 2.0).pow(2) +
                cos(phi1) * cos(phi2) * sin(deltaLambda / 2.0).pow(2)
        val c = 2.0 * atan2(sqrt(a), sqrt(1.0 - a))
        return r * c
    }

    data class GeofenceResult(
        val distanceM: Double?,
        val isWithinRadius: Boolean,
        val radiusWarning: Boolean
    )

    fun evaluateGeofence(
        currentLat: Double,
        currentLng: Double,
        accuracyM: Float,
        centroidLat: Double?,
        centroidLng: Double?,
        siteRadiusM: Double
    ): GeofenceResult {
        if (centroidLat == null || centroidLng == null) {
            return GeofenceResult(
                distanceM = null,
                isWithinRadius = true,
                radiusWarning = false
            )
        }

        val distance = calculateDistanceMeters(currentLat, currentLng, centroidLat, centroidLng)
        val effectiveRadius = siteRadiusM + accuracyM.coerceAtLeast(0f)
        val isWithin = distance <= effectiveRadius
        return GeofenceResult(
            distanceM = distance,
            isWithinRadius = isWithin,
            radiusWarning = !isWithin
        )
    }

    fun isLocationEnabled(context: Context): Boolean {
        val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? android.location.LocationManager
        return locationManager?.let {
            androidx.core.location.LocationManagerCompat.isLocationEnabled(it)
        } ?: false
    }

    @SuppressLint("MissingPermission")
    fun fetchCurrentLocation(
        context: Context,
        onSuccess: (latitude: Double, longitude: Double, accuracy: Float) -> Unit,
        onError: (String) -> Unit
    ) {
        if (!hasLocationPermission(context)) {
            onError("GPS Location permission not granted. Cannot verify site coordinates.")
            return
        }

        if (!isLocationEnabled(context)) {
            onError("Device GPS / Location is turned off. Please enable Location in Android Settings.")
            return
        }

        val fusedClient: FusedLocationProviderClient =
            LocationServices.getFusedLocationProviderClient(context)

        val cancellationTokenSource = CancellationTokenSource()

        // Schedule cancellation after 4 seconds to trigger fallback promptly if GPS signal is obstructed
        val handler = android.os.Handler(android.os.Looper.getMainLooper())
        val cancelRunnable = Runnable {
            cancellationTokenSource.cancel()
        }
        handler.postDelayed(cancelRunnable, 4000)

        fusedClient.getCurrentLocation(
            Priority.PRIORITY_HIGH_ACCURACY,
            cancellationTokenSource.token
        ).addOnSuccessListener { location: Location? ->
            handler.removeCallbacks(cancelRunnable)
            if (location != null) {
                onSuccess(location.latitude, location.longitude, location.accuracy)
            } else {
                // Fallback to last known location
                fusedClient.lastLocation.addOnSuccessListener { lastLoc: Location? ->
                    if (lastLoc != null) {
                        onSuccess(lastLoc.latitude, lastLoc.longitude, lastLoc.accuracy)
                    } else {
                        onError("Unable to acquire GPS fix. Ensure you are outdoors or near a window.")
                    }
                }.addOnFailureListener { exc ->
                    onError("Failed to acquire location: ${exc.localizedMessage}")
                }
            }
        }.addOnFailureListener { exc ->
            handler.removeCallbacks(cancelRunnable)
            // On cancellation or timeout, try lastLocation as fallback
            fusedClient.lastLocation.addOnSuccessListener { lastLoc: Location? ->
                if (lastLoc != null) {
                    onSuccess(lastLoc.latitude, lastLoc.longitude, lastLoc.accuracy)
                } else {
                    onError("GPS acquisition timed out: ${exc.localizedMessage}")
                }
            }.addOnFailureListener {
                onError("Failed to acquire location: ${exc.localizedMessage}")
            }
        }
    }
}
