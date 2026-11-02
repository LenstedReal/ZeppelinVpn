package expo.modules.zeppelinvpn

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.net.VpnService
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Locale

/** JavaScript bridge for the WireGuard tunnel. Business logic lives in [TunnelManager]. */
class ZeppelinVpnModule : Module() {
  private var pendingPrepare: Promise? = null
  private var pendingPick: Promise? = null
  private val mainHandler = Handler(Looper.getMainLooper())

  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is not available" }.applicationContext

  override fun definition() = ModuleDefinition {
    Name("ZeppelinVpn")

    Events("onStatus")

    OnCreate {
      TunnelManager.init(context)
      TunnelManager.setListener { status -> sendEvent("onStatus", status) }
    }

    OnDestroy {
      TunnelManager.setListener(null)
    }

    Function("isPrepared") {
      VpnService.prepare(context) == null
    }

    // Shows Android's "Allow VPN connection?" dialog when needed. Resolves true when allowed.
    AsyncFunction("prepare") { promise: Promise ->
      val intent = VpnService.prepare(context)
      if (intent == null) {
        promise.resolve(true)
        return@AsyncFunction
      }
      val activity = appContext.activityProvider?.currentActivity
      if (activity == null) {
        promise.reject("NO_ACTIVITY", "The app is not in the foreground", null)
        return@AsyncFunction
      }
      pendingPrepare?.resolve(false)
      pendingPrepare = promise
      mainHandler.post {
        try {
          activity.startActivityForResult(intent, REQUEST_VPN)
        } catch (e: Exception) {
          pendingPrepare?.reject("PREPARE_FAILED", e.message, e)
          pendingPrepare = null
        }
      }
    }

    AsyncFunction("connect") { conf: String, profileId: String, profileName: String, promise: Promise ->
      TunnelManager.connect(conf, profileId, profileName) { error ->
        if (error == null) promise.resolve(null) else promise.reject(error.code, error.message, null)
      }
    }

    AsyncFunction("disconnect") { promise: Promise ->
      TunnelManager.disconnect { promise.resolve(null) }
    }

    Function("getStatus") {
      TunnelManager.snapshot()
    }

    Function("saveSettings") { json: String ->
      TunnelManager.saveSettings(json)
    }

    Function("loadSettings") {
      TunnelManager.loadSettings()
    }

    AsyncFunction("vaultSave") { name: String, json: String ->
      SecureVault.write(context, name, json)
    }

    AsyncFunction("vaultLoad") { name: String ->
      SecureVault.read(context, name)
    }

    AsyncFunction("vaultClear") {
      SecureVault.clear(context)
    }

    // Lets the user pick a .conf file with the system file picker and returns its text.
    AsyncFunction("pickTextFile") { promise: Promise ->
      val activity = appContext.activityProvider?.currentActivity
      if (activity == null) {
        promise.reject("NO_ACTIVITY", "The app is not in the foreground", null)
        return@AsyncFunction
      }
      pendingPick?.resolve(null)
      pendingPick = promise
      val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
        addCategory(Intent.CATEGORY_OPENABLE)
        type = "*/*"
      }
      mainHandler.post {
        try {
          activity.startActivityForResult(intent, REQUEST_PICK)
        } catch (e: Exception) {
          pendingPick?.reject("PICK_FAILED", e.message, e)
          pendingPick = null
        }
      }
    }

    AsyncFunction("readClipboard") {
      val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
      val clip = clipboard.primaryClip
      if (clip == null || clip.itemCount == 0) null else clip.getItemAt(0).coerceToText(context)?.toString()
    }

    AsyncFunction("writeClipboard") { text: String ->
      val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
      clipboard.setPrimaryClip(ClipData.newPlainText("Zeppelin VPN", text))
    }

    // Android's VPN settings page, where "Always-on VPN" and "Block connections without VPN" live.
    Function("openVpnSettings") {
      try {
        context.startActivity(Intent(Settings.ACTION_VPN_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        true
      } catch (e: Exception) {
        false
      }
    }

    Function("deviceLanguage") {
      Locale.getDefault().language
    }

    Function("appVersion") {
      try {
        context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: ""
      } catch (e: Exception) {
        ""
      }
    }

    OnActivityResult { _, payload ->
      when (payload.requestCode) {
        REQUEST_VPN -> {
          val promise = pendingPrepare
          pendingPrepare = null
          promise?.resolve(payload.resultCode == Activity.RESULT_OK)
        }
        REQUEST_PICK -> {
          val promise = pendingPick
          pendingPick = null
          if (promise != null) {
            val uri = payload.data?.data
            if (payload.resultCode != Activity.RESULT_OK || uri == null) promise.resolve(null) else readText(uri, promise)
          }
        }
      }
    }
  }

  private fun readText(uri: Uri, promise: Promise) {
    Thread {
      try {
        val input = context.contentResolver.openInputStream(uri)
        if (input == null) {
          promise.reject("READ_FAILED", "No input stream", null)
          return@Thread
        }
        val buffer = ByteArray(MAX_FILE_BYTES + 1)
        var total = 0
        input.use {
          while (total < buffer.size) {
            val n = it.read(buffer, total, buffer.size - total)
            if (n < 0) break
            total += n
          }
        }
        if (total > MAX_FILE_BYTES) {
          promise.reject("FILE_TOO_LARGE", "Profile files are at most 64 KB", null)
        } else {
          promise.resolve(String(buffer, 0, total, Charsets.UTF_8))
        }
      } catch (e: Exception) {
        promise.reject("READ_FAILED", e.message, e)
      }
    }.start()
  }

  companion object {
    private const val REQUEST_VPN = 0x5A01
    private const val REQUEST_PICK = 0x5A02
    private const val MAX_FILE_BYTES = 64 * 1024
  }
}
