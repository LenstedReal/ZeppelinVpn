package expo.modules.zeppelinvpn

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.SystemClock
import android.util.Log
import java.util.Locale

/**
 * Live status notification: connection state, live speed and connected time,
 * with a "Disconnect" button. Shown only while the tunnel is up.
 *
 * Privacy: on a locked screen Android shows only "Zeppelin VPN", not the
 * server name or traffic numbers (VISIBILITY_PRIVATE with a public version).
 * Called on TunnelManager's single thread, so no locking is needed here.
 */
object StatusNotifier {
  private const val TAG = "ZeppelinVpn"
  private const val CHANNEL_ID = "zeppelin_status"
  private const val NOTIFICATION_ID = 0x5A10
  const val ACTION_DISCONNECT = "expo.modules.zeppelinvpn.action.DISCONNECT"
  const val ACTION_DISMISSED = "expo.modules.zeppelinvpn.action.DISMISSED"

  private var shownKey: String? = null
  private var channelLang: String? = null
  /** State the user swiped away (Android 14+ lets users dismiss ongoing notifications). */
  @Volatile var dismissedState: String? = null
  private var prevRx = -1L
  private var prevTx = -1L
  private var prevAt = 0L
  private var down = 0.0
  private var up = 0.0

  fun allowed(ctx: Context): Boolean {
    val nm = ctx.getSystemService(NotificationManager::class.java) ?: return false
    if (Build.VERSION.SDK_INT >= 33 &&
      ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
    ) return false
    return nm.areNotificationsEnabled()
  }

  fun update(ctx: Context, snap: Map<String, Any?>, enabled: Boolean, lang: String) {
    try {
      render(ctx, snap, enabled, lang)
    } catch (t: Throwable) {
      // A notification problem must never break the tunnel.
      Log.w(TAG, "notification", t)
    }
  }

  private fun render(ctx: Context, snap: Map<String, Any?>, enabled: Boolean, lang: String) {
    val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
    val tunnelUp = snap["tunnelUp"] == true
    val state = snap["state"] as? String ?: "disconnected"
    if (!tunnelUp || !enabled) {
      if (shownKey != null) nm.cancel(NOTIFICATION_ID)
      shownKey = null
      dismissedState = null
      prevRx = -1L
      down = 0.0
      up = 0.0
      return
    }
    if (dismissedState != null) {
      if (dismissedState == state) return
      dismissedState = null
    }
    if (!allowed(ctx)) return

    val tr = lang == "tr"
    ensureChannel(nm, tr)

    val rx = (snap["rxBytes"] as? Number)?.toLong() ?: 0L
    val tx = (snap["txBytes"] as? Number)?.toLong() ?: 0L
    val now = SystemClock.elapsedRealtime()
    if (prevRx < 0 || rx < prevRx || tx < prevTx) {
      prevRx = rx; prevTx = tx; prevAt = now
    } else if (now - prevAt >= 1_500L) {
      val seconds = (now - prevAt) / 1000.0
      down = (rx - prevRx) / seconds
      up = (tx - prevTx) / seconds
      prevRx = rx; prevTx = tx; prevAt = now
    }

    val name = (snap["profileName"] as? String).orEmpty()
    val connectedSince = (snap["connectedSince"] as? Number)?.toLong() ?: 0L
    val title: String
    val text: String
    when (state) {
      "connected" -> {
        title = if (tr) "Korunuyorsun" else "Protected"
        text = "↓ ${rate(down, tr)}   ↑ ${rate(up, tr)}"
      }
      "connecting" -> {
        title = if (tr) "Bağlanıyor…" else "Connecting…"
        text = if (tr) "Şifreli tünel kuruluyor" else "Setting up the encrypted tunnel"
      }
      "no_network" -> {
        title = if (tr) "İnternet yok" else "No internet"
        text = if (tr) "Bağlantı gelince otomatik devam eder" else "Resumes automatically when you are back online"
      }
      else -> {
        title = if (tr) "Yeniden bağlanıyor" else "Reconnecting"
        text = if (tr) "Veri sızmasın diye internet durduruldu" else "Internet is paused so nothing leaks"
      }
    }
    val fullTitle = if (name.isNotEmpty()) "$title · $name" else title
    val showTimer = state == "connected" && connectedSince > 0
    val key = "$fullTitle|$text|$showTimer|$connectedSince|$tr"
    if (key == shownKey) return

    val builder = Notification.Builder(ctx, CHANNEL_ID)
      .setSmallIcon(R.drawable.zeppelin_ic_notification)
      .setContentTitle(fullTitle)
      .setContentText(text)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setCategory(Notification.CATEGORY_SERVICE)
      .setVisibility(Notification.VISIBILITY_PRIVATE)
      .setPublicVersion(
        Notification.Builder(ctx, CHANNEL_ID)
          .setSmallIcon(R.drawable.zeppelin_ic_notification)
          .setContentTitle("Zeppelin VPN")
          .setContentText(if (tr) "VPN açık" else "VPN is on")
          .build(),
      )
      .setColor(0xFFE5262B.toInt())
      .setDeleteIntent(broadcast(ctx, ACTION_DISMISSED, state, 2))
      .addAction(
        Notification.Action.Builder(null, if (tr) "Bağlantıyı kes" else "Disconnect", broadcast(ctx, ACTION_DISCONNECT, null, 1)).build(),
      )
    if (showTimer) {
      builder.setShowWhen(true).setUsesChronometer(true).setWhen(connectedSince)
    } else {
      builder.setShowWhen(false)
    }
    ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)?.let { launch ->
      launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
      builder.setContentIntent(
        PendingIntent.getActivity(ctx, 0, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT),
      )
    }
    nm.notify(NOTIFICATION_ID, builder.build())
    shownKey = key
  }

  private fun broadcast(ctx: Context, action: String, state: String?, requestCode: Int): PendingIntent {
    val intent = Intent(ctx, NotificationActionReceiver::class.java).setAction(action)
    if (state != null) intent.putExtra("state", state)
    return PendingIntent.getBroadcast(ctx, requestCode, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }

  private fun ensureChannel(nm: NotificationManager, tr: Boolean) {
    val lang = if (tr) "tr" else "en"
    if (channelLang == lang) return
    // LOW: no sound or vibration; the notification only updates quietly.
    val channel = NotificationChannel(
      CHANNEL_ID,
      if (tr) "VPN durumu" else "VPN status",
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      description = if (tr) "Bağlantı durumu ve anlık hız" else "Connection state and live speed"
      setShowBadge(false)
    }
    nm.createNotificationChannel(channel)
    channelLang = lang
  }

  private fun rate(bytesPerSecond: Double, tr: Boolean): String {
    val locale = if (tr) Locale.forLanguageTag("tr-TR") else Locale.US
    val v = maxOf(0.0, bytesPerSecond)
    return when {
      v >= 1024 * 1024 -> String.format(locale, "%.1f MB/s", v / (1024 * 1024))
      v >= 1024 -> String.format(locale, "%.0f KB/s", v / 1024)
      else -> String.format(locale, "%.0f B/s", v)
    }
  }

  /** Called when the app's data is wiped, so nothing stale stays on screen. */
  fun cancel(ctx: Context) {
    ctx.getSystemService(NotificationManager::class.java)?.cancel(NOTIFICATION_ID)
    shownKey = null
  }
}
