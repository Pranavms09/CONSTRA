package constra.ai.domain.util

import android.graphics.*
import java.io.File
import java.io.FileOutputStream

object WatermarkUtil {

    /**
     * Generates a separate watermarked preview bitmap and saves it to a derivative cache file.
     * The original capture file is preserved intact and untouched.
     */
    fun createWatermarkedPreview(
        originalFile: File,
        outputPreviewFile: File,
        projectName: String,
        stageName: String,
        capturedAt: String,
        latitude: Double,
        longitude: Double,
        accuracyM: Float,
        evidenceId: String,
        clientSha256: String
    ): File {
        val rawBitmap = BitmapFactory.decodeFile(originalFile.absolutePath)
            ?: throw IllegalStateException("Failed to decode original capture image for watermarking")

        // Correct for physical sensor rotation via EXIF
        val orientation = try {
            val exif = android.media.ExifInterface(originalFile.absolutePath)
            exif.getAttributeInt(
                android.media.ExifInterface.TAG_ORIENTATION,
                android.media.ExifInterface.ORIENTATION_NORMAL
            )
        } catch (_: Exception) {
            android.media.ExifInterface.ORIENTATION_NORMAL
        }

        val matrix = Matrix()
        when (orientation) {
            android.media.ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
            android.media.ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
            android.media.ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
            android.media.ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.postScale(-1f, 1f)
            android.media.ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.postScale(1f, -1f)
        }

        val originalBitmap = if (!matrix.isIdentity) {
            Bitmap.createBitmap(rawBitmap, 0, 0, rawBitmap.width, rawBitmap.height, matrix, true).also {
                if (it != rawBitmap) {
                    rawBitmap.recycle()
                }
            }
        } else {
            rawBitmap
        }

        val resultBitmap = originalBitmap.copy(Bitmap.Config.ARGB_8888, true)
        val canvas = Canvas(resultBitmap)

        val width = resultBitmap.width.toFloat()
        val height = resultBitmap.height.toFloat()

        // Watermark Banner at bottom
        val bannerHeight = (height * 0.22f).coerceAtLeast(180f)
        val bannerTop = height - bannerHeight

        val bannerPaint = Paint().apply {
            color = Color.parseColor("#E6101010") // 90% opaque Carbon Black
            style = Paint.Style.FILL
        }
        canvas.drawRect(0f, bannerTop, width, height, bannerPaint)

        // Accent top border of the watermark strip: Signal Yellow (#FCBC18)
        val yellowBorderPaint = Paint().apply {
            color = Color.parseColor("#FCBC18")
            strokeWidth = 6f
            style = Paint.Style.STROKE
        }
        canvas.drawLine(0f, bannerTop, width, bannerTop, yellowBorderPaint)

        val padding = 28f
        var currentY = bannerTop + padding + 32f

        // Brand Title
        val titlePaint = Paint().apply {
            color = Color.parseColor("#FCBC18")
            textSize = (bannerHeight * 0.16f).coerceIn(24f, 48f)
            typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
            isAntiAlias = true
        }
        canvas.drawText("CONSTRA // SITE EVIDENCE VERIFIER", padding, currentY, titlePaint)

        // Meta Text Paint
        val metaPaint = Paint().apply {
            color = Color.WHITE
            textSize = (bannerHeight * 0.10f).coerceIn(16f, 28f)
            typeface = Typeface.create(Typeface.MONOSPACE, Typeface.NORMAL)
            isAntiAlias = true
        }

        currentY += metaPaint.textSize + 14f
        canvas.drawText("PROJECT: $projectName | STAGE: $stageName", padding, currentY, metaPaint)

        currentY += metaPaint.textSize + 10f
        val locText = "GPS: %.6f, %.6f (±%.1fm) | UTC: %s".format(latitude, longitude, accuracyM, capturedAt)
        canvas.drawText(locText, padding, currentY, metaPaint)

        currentY += metaPaint.textSize + 10f
        val shaShort = if (clientSha256.length > 20) clientSha256.substring(0, 20) + "..." else clientSha256
        val idText = "ID: $evidenceId | SHA-256: $shaShort"
        canvas.drawText(idText, padding, currentY, metaPaint)

        // Save watermarked derivative to preview file
        FileOutputStream(outputPreviewFile).use { fos ->
            resultBitmap.compress(Bitmap.CompressFormat.JPEG, 92, fos)
        }

        originalBitmap.recycle()
        resultBitmap.recycle()

        return outputPreviewFile
    }
}
