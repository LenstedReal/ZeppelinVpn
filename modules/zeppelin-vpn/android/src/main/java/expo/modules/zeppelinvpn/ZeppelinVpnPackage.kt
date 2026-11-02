package expo.modules.zeppelinvpn

import android.content.Context
import expo.modules.core.interfaces.ApplicationLifecycleListener
import expo.modules.core.interfaces.Package

/** Found by Expo Autolinking (file name ends with "Package"); no manual registration needed. */
class ZeppelinVpnPackage : Package {
  override fun createApplicationLifecycleListeners(context: Context): List<ApplicationLifecycleListener> =
    listOf(ZeppelinApplicationLifecycleListener())
}
