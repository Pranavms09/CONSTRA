package constra.ai.ui.navigation

sealed class Screen(val route: String) {
    object Splash : Screen("splash")
    object Login : Screen("login")
    object Dashboard : Screen("dashboard")
    object ProjectSelect : Screen("project_select")
    object StageSelect : Screen("stage_select/{projectId}") {
        fun createRoute(projectId: Int) = "stage_select/$projectId"
    }
    object CameraCapture : Screen("camera_capture/{projectId}/{stageId}") {
        fun createRoute(projectId: Int, stageId: Int) = "camera_capture/$projectId/$stageId"
    }
    object EvidenceReview : Screen("evidence_review")
    object SubmissionStatus : Screen("submission_status/{deviceEvidenceId}") {
        fun createRoute(deviceEvidenceId: String) = "submission_status/$deviceEvidenceId"
    }
    object EvidenceHistory : Screen("evidence_history")
    object EvidenceDetail : Screen("evidence_detail/{evidenceId}") {
        fun createRoute(evidenceId: Int) = "evidence_detail/$evidenceId"
    }
    object Profile : Screen("profile")
}
