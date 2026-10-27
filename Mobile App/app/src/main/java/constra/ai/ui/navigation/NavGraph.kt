package constra.ai.ui.navigation

import androidx.compose.runtime.*
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import constra.ai.ConstraApp
import constra.ai.domain.model.CaptureMetadata
import constra.ai.ui.screens.*

@Composable
fun NavGraph(
    navController: NavHostController,
    startDestination: String = Screen.Splash.route
) {
    var activeCaptureMetadata by remember { mutableStateOf<CaptureMetadata?>(null) }
    val sessionManager = ConstraApp.instance.sessionManager

    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        composable(Screen.Splash.route) {
            SplashScreen(
                onNavigateToLogin = {
                    navController.navigate(Screen.Login.route) {
                        popUpTo(Screen.Splash.route) { inclusive = true }
                    }
                },
                onNavigateToDashboard = {
                    navController.navigate(Screen.Dashboard.route) {
                        popUpTo(Screen.Splash.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.Login.route) {
            LoginScreen(
                onLoginSuccess = {
                    navController.navigate(Screen.Dashboard.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.Dashboard.route) {
            DashboardScreen(
                onNavigateToProjectSelect = {
                    navController.navigate(Screen.ProjectSelect.route)
                },
                onNavigateToStageSelect = { projectId ->
                    navController.navigate(Screen.StageSelect.createRoute(projectId))
                },
                onNavigateToCamera = { projectId, stageId ->
                    navController.navigate(Screen.CameraCapture.createRoute(projectId, stageId))
                },
                onNavigateToHistory = {
                    navController.navigate(Screen.EvidenceHistory.route)
                },
                onNavigateToDetail = { evidenceId ->
                    navController.navigate(Screen.EvidenceDetail.createRoute(evidenceId))
                },
                onNavigateToProfile = {
                    navController.navigate(Screen.Profile.route)
                }
            )
        }

        composable(Screen.ProjectSelect.route) {
            ProjectSelectScreen(
                onProjectSelected = { projectId ->
                    navController.navigate(Screen.StageSelect.createRoute(projectId))
                },
                onBackClick = { navController.popBackStack() }
            )
        }

        composable(
            route = Screen.StageSelect.route,
            arguments = listOf(navArgument("projectId") { type = NavType.IntType })
        ) { backStackEntry ->
            val projectId = backStackEntry.arguments?.getInt("projectId") ?: -1
            StageSelectScreen(
                projectId = projectId,
                onStageSelected = { stageId ->
                    navController.navigate(Screen.CameraCapture.createRoute(projectId, stageId))
                },
                onBackClick = { navController.popBackStack() }
            )
        }

        composable(
            route = Screen.CameraCapture.route,
            arguments = listOf(
                navArgument("projectId") { type = NavType.IntType },
                navArgument("stageId") { type = NavType.IntType }
            )
        ) { backStackEntry ->
            val projectId = backStackEntry.arguments?.getInt("projectId") ?: -1
            val stageId = backStackEntry.arguments?.getInt("stageId") ?: -1
            CameraCaptureScreen(
                projectId = projectId,
                stageId = stageId,
                onEvidenceCaptured = { metadata ->
                    activeCaptureMetadata = metadata
                    navController.navigate(Screen.EvidenceReview.route)
                },
                onBackClick = { navController.popBackStack() }
            )
        }

        composable(Screen.EvidenceReview.route) {
            val metadata = activeCaptureMetadata
            if (metadata != null) {
                EvidenceReviewScreen(
                    metadata = metadata,
                    onRetake = {
                        activeCaptureMetadata = null
                        navController.popBackStack()
                    },
                    onSubmitSuccess = { deviceEvidenceId ->
                        navController.navigate(Screen.SubmissionStatus.createRoute(deviceEvidenceId)) {
                            popUpTo(Screen.Dashboard.route)
                        }
                    },
                    onBackClick = { navController.popBackStack() }
                )
            } else {
                navController.popBackStack()
            }
        }

        composable(
            route = Screen.SubmissionStatus.route,
            arguments = listOf(navArgument("deviceEvidenceId") { type = NavType.StringType })
        ) { backStackEntry ->
            val deviceEvidenceId = backStackEntry.arguments?.getString("deviceEvidenceId") ?: ""
            SubmissionStatusScreen(
                deviceEvidenceId = deviceEvidenceId,
                onNavigateToDashboard = {
                    navController.navigate(Screen.Dashboard.route) {
                        popUpTo(Screen.Dashboard.route) { inclusive = true }
                    }
                },
                onCaptureNext = {
                    val pid = sessionManager.getSelectedProjectId()
                    val sid = sessionManager.getSelectedStageId()
                    if (pid > 0 && sid > 0) {
                        navController.navigate(Screen.CameraCapture.createRoute(pid, sid)) {
                            popUpTo(Screen.Dashboard.route)
                        }
                    } else {
                        navController.navigate(Screen.ProjectSelect.route) {
                            popUpTo(Screen.Dashboard.route)
                        }
                    }
                }
            )
        }

        composable(Screen.EvidenceHistory.route) {
            EvidenceHistoryScreen(
                onEvidenceClick = { evidenceId ->
                    navController.navigate(Screen.EvidenceDetail.createRoute(evidenceId))
                },
                onBackClick = { navController.popBackStack() }
            )
        }

        composable(
            route = Screen.EvidenceDetail.route,
            arguments = listOf(navArgument("evidenceId") { type = NavType.IntType })
        ) { backStackEntry ->
            val evidenceId = backStackEntry.arguments?.getInt("evidenceId") ?: -1
            EvidenceDetailScreen(
                evidenceId = evidenceId,
                onBackClick = { navController.popBackStack() }
            )
        }

        composable(Screen.Profile.route) {
            ProfileScreen(
                onSignOut = {
                    navController.navigate(Screen.Login.route) {
                        popUpTo(0) { inclusive = true }
                    }
                },
                onBackClick = { navController.popBackStack() }
            )
        }
    }
}
