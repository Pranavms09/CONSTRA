package constra.ai.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import constra.ai.R
import constra.ai.ui.theme.*

@Composable
fun TechnicalHeader(
    title: String,
    subtitle: String? = null,
    onProfileClick: (() -> Unit)? = null,
    onBackClick: (() -> Unit)? = null
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(CarbonBlack)
            .statusBarsPadding()
            .padding(top = 10.dp)
            .border(width = 1.dp, color = BorderStone)
            .padding(horizontal = 16.dp, vertical = 12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (onBackClick != null) {
                    IconButton(onClick = onBackClick, modifier = Modifier.size(36.dp)) {
                        Text(
                            text = "<",
                            color = SignalYellow,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 20.sp
                        )
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                }

                androidx.compose.foundation.Image(
                    painter = painterResource(id = R.drawable.constra_logo),
                    contentDescription = "CONSTRA Logo",
                    modifier = Modifier.size(32.dp)
                )

                Spacer(modifier = Modifier.width(10.dp))

                Column {
                    Text(
                        text = "CONSTRA",
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        color = SignalYellow,
                        fontSize = 18.sp,
                        letterSpacing = 1.sp
                    )
                    Text(
                        text = "SITE SUPERVISOR // FIELD UNIT",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                        color = TextMuted,
                        letterSpacing = 0.5.sp
                    )
                }
            }

            if (onProfileClick != null) {
                Box(
                    modifier = Modifier
                        .border(1.dp, BorderStone, RoundedCornerShape(0.dp))
                        .background(SurfaceCard)
                        .clickable { onProfileClick() }
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "SYS",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = SignalYellow
                    )
                }
            }
        }

        if (subtitle != null) {
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(SurfaceCard)
                    .padding(horizontal = 8.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "SPEC: $title // $subtitle",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    color = PaperGray
                )
            }
        }
    }
}

@Composable
fun BlueprintCard(
    modifier: Modifier = Modifier,
    borderColor: Color = BorderStone,
    backgroundColor: Color = SurfaceCard,
    content: @Composable ColumnScope.() -> Unit
) {
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .border(1.dp, borderColor, RoundedCornerShape(0.dp)),
        color = backgroundColor,
        shape = RoundedCornerShape(0.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            content = content
        )
    }
}

@Composable
fun SignalButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier
            .fillMaxWidth()
            .height(50.dp),
        shape = RoundedCornerShape(0.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = SignalYellow,
            contentColor = CarbonBlack,
            disabledContainerColor = BorderStone,
            disabledContentColor = TextMuted
        ),
        border = BorderStroke(1.dp, CarbonBlack)
    ) {
        Text(
            text = text.uppercase(),
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold,
            fontSize = 14.sp,
            letterSpacing = 0.5.sp
        )
    }
}

@Composable
fun OutlineButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true
) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier
            .fillMaxWidth()
            .height(50.dp),
        shape = RoundedCornerShape(0.dp),
        colors = ButtonDefaults.outlinedButtonColors(
            contentColor = PaperGray,
            disabledContentColor = TextMuted
        ),
        border = BorderStroke(1.dp, BorderStoneLight)
    ) {
        Text(
            text = text.uppercase(),
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold,
            fontSize = 14.sp,
            letterSpacing = 0.5.sp
        )
    }
}

@Composable
fun StatusBadge(
    status: String,
    modifier: Modifier = Modifier
) {
    val (bg, fg, label) = when (status.uppercase()) {
        "CONFIRMED" ->
            Triple(StatusPassBg, StatusPass, "● CONFIRMED ON-CHAIN")
        "SUBMITTED" ->
            Triple(StatusWarningBg, StatusWarning, "▲ SUBMITTED (AWAITING BLOCK)")
        "QUEUED" ->
            Triple(SurfaceElevated, SignalYellow, "⏳ QUEUED")
        "SIMULATED" ->
            Triple(SurfaceElevated, TextMuted, "◆ SIMULATED (DEV)")
        "FAILED" ->
            Triple(StatusDefectBg, StatusDefect, "✖ FAILED")
        "ANALYZING" ->
            Triple(StatusWarningBg, SignalYellow, "▲ ANALYZING (GEMINI)")
        "COMPLETED" ->
            Triple(StatusPassBg, StatusPass, "● COMPLETED")
        "RETRY_AVAILABLE" ->
            Triple(StatusWarningBg, SignalYellow, "↻ RETRY AVAILABLE")
        "VERIFIED", "VERIFIED_SUBMITTED", "APPROVED" ->
            Triple(StatusPassBg, StatusPass, "● VERIFIED SUBMITTED")
        "PENDING", "IN_PROGRESS", "IN_REVIEW" ->
            Triple(StatusWarningBg, StatusWarning, "▲ IN PROGRESS")
        "QUEUED_OFFLINE", "PENDING_QUEUE" ->
            Triple(SurfaceElevated, SignalYellow, "⏳ QUEUED OFFLINE")
        "OUT_OF_BOUNDS", "RADIUS_WARNING" ->
            Triple(StatusWarningBg, StatusWarning, "⚠ OUT OF RADIUS")
        "HASH_MISMATCH", "FLAGGED", "SUSPICIOUS" ->
            Triple(StatusDefectBg, StatusDefect, "✖ HASH MISMATCH")
        else ->
            Triple(SurfaceCard, TextMuted, status.uppercase())
    }

    Box(
        modifier = modifier
            .background(bg, RoundedCornerShape(0.dp))
            .border(1.dp, fg, RoundedCornerShape(0.dp))
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Text(
            text = label,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold,
            fontSize = 10.sp,
            color = fg
        )
    }
}

@Composable
fun TelemetryRow(
    label: String,
    value: String,
    highlight: Boolean = false,
    warning: Boolean = false
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label.uppercase(),
            fontFamily = FontFamily.Monospace,
            fontSize = 11.sp,
            color = TextMuted
        )
        Text(
            text = value,
            fontFamily = FontFamily.Monospace,
            fontSize = 12.sp,
            fontWeight = if (highlight) FontWeight.Bold else FontWeight.Normal,
            color = when {
                warning -> StatusWarning
                highlight -> SignalYellow
                else -> PaperGray
            }
        )
    }
}

@Composable
fun NetworkStatusBar(
    isOnline: Boolean,
    pendingQueueCount: Int,
    onSyncClick: (() -> Unit)? = null,
    onRetryClick: (() -> Unit)? = null
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(if (isOnline) Color(0xFF161F18) else Color(0xFF261900))
            .border(1.dp, if (isOnline) StatusPass else SignalYellow)
            .padding(horizontal = 12.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.clickable { onRetryClick?.invoke() }
        ) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .background(if (isOnline) StatusPass else SignalYellow)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = if (isOnline) "NETWORK: OPERATIONAL (API CONNECTED)" else "NETWORK: OFFLINE (LOCAL CACHE)",
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = if (isOnline) StatusPass else SignalYellow
            )
        }

        if (pendingQueueCount > 0) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.clickable { onSyncClick?.invoke() }
            ) {
                Text(
                    text = "PENDING: $pendingQueueCount [SYNC]",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = SignalYellow
                )
            }
        } else if (!isOnline) {
            Text(
                text = "[RETRY]",
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = SignalYellow,
                modifier = Modifier.clickable { onRetryClick?.invoke() }
            )
        }
    }
}
