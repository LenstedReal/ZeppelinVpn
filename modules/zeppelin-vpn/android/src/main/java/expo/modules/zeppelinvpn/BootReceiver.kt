package expo.modules.zeppelinvpn

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * After a reboot: connects only if the user enabled "Connect when the phone starts".
 * After an app update: reconnects if the VPN was on before the update.
 */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action ?: return
    val isBoot = action == Intent.ACTION_BOOT_COMPLETED
    if (!isBoot && action != Intent.ACTION_MY_PACKAGE_REPLACED) return
    TunnelManager.init(context)
    val pending = goAsync()
    TunnelManager.onSystemEvent(isBoot) { pending.finish() }
  }
}
