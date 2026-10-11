package constra.ai

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.navigation.compose.rememberNavController
import constra.ai.ui.navigation.NavGraph
import constra.ai.ui.theme.ConstraTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            ConstraTheme {
                val navController = rememberNavController()
                NavGraph(navController = navController)
            }
        }
    }
}
