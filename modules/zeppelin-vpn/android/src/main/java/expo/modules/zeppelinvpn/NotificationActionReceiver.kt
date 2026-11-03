package expo.modules.zeppelinvpn

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Handles the status notification's "Disconnect" button and swipe-away. Not exported. */
class NotificationActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      StatusNotifier.ACTION_DISCONNECT -> {
        val pending = goAsync()
        TunnelManager.init(context)
        TunnelManager.disconnect { pending.finish() }
      }
      StatusNotifier.ACTION_DISMISSED -> {
        StatusNotifier.dismissedState = intent.getStringExtra("state")
      }
    }
  }
}
