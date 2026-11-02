package expo.modules.zeppelinvpn

import android.app.Application
import expo.modules.core.interfaces.ApplicationLifecycleListener

/**
 * Runs in Application.onCreate, i.e. also when Android starts the app only to
 * bring up "Always-on VPN" or to deliver BOOT_COMPLETED, before any screen exists.
 */
class ZeppelinApplicationLifecycleListener : ApplicationLifecycleListener {
  override fun onCreate(application: Application) {
    TunnelManager.init(application)
  }
}
