package constra.ai

import constra.ai.domain.util.HashUtil
import constra.ai.domain.util.LocationHelper
import org.junit.Assert.*
import org.junit.Test
import java.io.File

class DomainAndUtilTest {

    @Test
    fun testSha256CalculationKnownVector() {
        // "CONSTRA_SITE_VERIFIER" known SHA-256
        val testInput = "CONSTRA_SITE_VERIFIER".toByteArray(Charsets.UTF_8)
        val computedHash = HashUtil.sha256(testInput)

        // Verifies exactly 64 hex characters and deterministic hashing
        assertEquals(64, computedHash.length)
        assertTrue(computedHash.matches(Regex("^[0-9a-f]{64}$")))

        // Test with empty byte array
        val emptyHash = HashUtil.sha256(ByteArray(0))
        assertEquals("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", emptyHash)
    }

    @Test
    fun testFileSha256MatchesBytesSha256() {
        val tempFile = File.createTempFile("constra_test", ".dat")
        val sampleBytes = "TRUSTED_SITE_CAPTURE_SPECIMEN_2026".toByteArray(Charsets.UTF_8)
        tempFile.writeBytes(sampleBytes)

        val bytesHash = HashUtil.sha256(sampleBytes)
        val fileHash = HashUtil.sha256(tempFile)

        assertEquals(bytesHash, fileHash)
        tempFile.delete()
    }

    @Test
    fun testHaversineDistanceAccuracy() {
        // PVGCOE Nashik Site Centroid: 20.03639, 73.79959
        // A point ~111 meters North (0.001 deg lat difference is ~111.13 meters)
        val lat1 = 20.03639
        val lon1 = 73.79959
        val lat2 = 20.03739
        val lon2 = 73.79959

        val distance = LocationHelper.calculateDistanceMeters(lat1, lon1, lat2, lon2)
        // Expected distance around 111.2 meters
        assertTrue("Distance should be ~111m, was $distance", distance in 110.0..112.5)
    }

    @Test
    fun testGeofenceEvaluationInsideRadius() {
        val centroidLat = 20.03639
        val centroidLng = 73.79959
        val siteRadiusM = 500.0

        // Point 50 meters away
        val currentLat = 20.03684
        val currentLng = 73.79959
        val accuracyM = 5.0f

        val result = LocationHelper.evaluateGeofence(
            currentLat = currentLat,
            currentLng = currentLng,
            accuracyM = accuracyM,
            centroidLat = centroidLat,
            centroidLng = centroidLng,
            siteRadiusM = siteRadiusM
        )

        assertTrue("Should be inside site radius", result.isWithinRadius)
        assertFalse("Should not have radius warning", result.radiusWarning)
        assertNotNull(result.distanceM)
        assertTrue(result.distanceM!! < siteRadiusM)
    }

    @Test
    fun testGeofenceEvaluationOutsideRadius() {
        val centroidLat = 20.03639
        val centroidLng = 73.79959
        val siteRadiusM = 500.0

        // Point 5 kilometers away
        val currentLat = 20.0800
        val currentLng = 73.79959
        val accuracyM = 10.0f

        val result = LocationHelper.evaluateGeofence(
            currentLat = currentLat,
            currentLng = currentLng,
            accuracyM = accuracyM,
            centroidLat = centroidLat,
            centroidLng = centroidLng,
            siteRadiusM = siteRadiusM
        )

        assertFalse("Should be outside site radius", result.isWithinRadius)
        assertTrue("Should trigger radius warning", result.radiusWarning)
        assertTrue(result.distanceM!! > 4000.0)
    }
}
