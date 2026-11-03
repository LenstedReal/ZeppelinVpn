package expo.modules.zeppelinvpn

import android.content.Context
import android.content.SharedPreferences
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.VpnService
import android.os.SystemClock
import android.util.Log
import com.wireguard.android.backend.BackendException
import com.wireguard.android.backend.GoBackend
import com.wireguard.android.backend.Tunnel
import com.wireguard.config.BadConfigException
import com.wireguard.config.Config
import com.wireguard.crypto.Key
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.util.Locale
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

/** Error reported to JavaScript; [code] is translated by the app. */
class TunnelError(val code: String, message: String) : Exception(message)

/**
 * Owns the single WireGuard tunnel of the app.
 *
 * Every state change runs on one background thread ([executor]), so connect,
 * disconnect, health checks, retries, network events and Android's Always-on
 * callback can never race each other.
 *
 * Kill switch: while the tunnel is up, Android routes all traffic into it
 * (single peer with 0.0.0.0/0). When the server stops answering we keep the
 * tunnel up, so traffic is blocked instead of leaking, and WireGuard keeps
 * retrying. Only a manual disconnect (or the user's "kill switch off" setting)
 * takes the tunnel down and gives the normal internet back.
 */
object TunnelManager {
  private const val TAG = "ZeppelinVpn"
  private const val PREFS = "zeppelin_vpn"
  private const val KEY_SETTINGS = "settings_json"
  private const val KEY_WANT_UP = "want_up"
  private const val KEY_PROFILE_ID = "profile_id"
  private const val KEY_PROFILE_NAME = "profile_name"
  const val VAULT_ACTIVE = "active_config"

  private const val TICK_MS = 2_000L
  /** Time allowed for the very first handshake after the tunnel comes up. */
  private const val FIRST_HANDSHAKE_GRACE_MS = 15_000L
  /** WireGuard's REJECT_AFTER_TIME: a session older than this is no longer usable. */
  private const val SESSION_LIFETIME_MS = 180_000L
  /** Traffic sent on an expired session without a new handshake for this long = server unreachable. */
  private const val STALE_WITH_TRAFFIC_MS = 10_000L
  /** With the kill switch off we give the internet back after this much time without a working tunnel. */
  private const val GIVE_UP_WITHOUT_KILL_SWITCH_MS = 30_000L

  private val executor: ScheduledExecutorService = Executors.newSingleThreadScheduledExecutor { r ->
    Thread(r, "zeppelin-tunnel").apply { isDaemon = true }
  }

  @Volatile private var initialized = false
  @Volatile private var listener: ((Map<String, Any?>) -> Unit)? = null
  @Volatile private var lastSnapshot: Map<String, Any?> = emptyMap()
  @Volatile private var hasNetwork = true
  private lateinit var app: Context
  private val networks = HashSet<Network>()

  // ---- state below is only read and written on [executor] ----
  private var backend: GoBackend? = null
  private var tunnelUp = false
  private var profileId = ""
  private var profileName = ""
  private var endpoint = ""
  private var peerKeys: List<Key> = emptyList()
  private var state = "disconnected"
  private var errorCode: String? = null
  private var errorDetail: String? = null
  private var upSince = 0L
  private var unhealthySince = 0L
  private var staleTrafficSince = 0L
  private var everHandshake = false
  private var connectedSince = 0L
  private var lastTx = -1L
  private var rxBytes = 0L
  private var txBytes = 0L
  private var handshakeAgeSec = -1L
  private var attempt = 0
  private var monitor: ScheduledFuture<*>? = null
  private var retry: ScheduledFuture<*>? = null

  private val tunnel = object : Tunnel {
    override fun getName(): String = "zeppelin"

    override fun onStateChange(newState: Tunnel.State) {
      executor.execute { onBackendState(newState) }
    }
  }

  // ------------------------------------------------------------------ setup

  fun init(context: Context) {
    if (initialized) return
    synchronized(this) {
      if (initialized) return
      app = context.applicationContext
      // Android starts GoBackend's VpnService by itself for "Always-on VPN" (also after a reboot).
      // The callback is static, so it is registered at process start, before any screen exists.
      GoBackend.setAlwaysOnCallback { executor.execute { onAlwaysOn() } }
      registerNetworkCallback()
      lastSnapshot = buildSnapshot()
      initialized = true
    }
  }

  fun setListener(l: ((Map<String, Any?>) -> Unit)?) {
    listener = l
    if (l != null && initialized) executor.execute { emit() }
  }

  fun snapshot(): Map<String, Any?> = lastSnapshot

  private fun backend(): GoBackend = backend ?: GoBackend(app).also { backend = it }

  private fun prefs(): SharedPreferences = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun saveSettings(json: String) {
    prefs().edit().putString(KEY_SETTINGS, json).apply()
    if (initialized) executor.execute { emit() }
  }

  fun loadSettings(): String? = prefs().getString(KEY_SETTINGS, null)

  private fun setting(name: String, default: Boolean): Boolean =
    try {
      JSONObject(loadSettings() ?: "{}").optBoolean(name, default)
    } catch (e: Exception) {
      default
    }

  private fun wantUp(): Boolean = prefs().getBoolean(KEY_WANT_UP, false)

  private fun setWantUp(value: Boolean) {
    prefs().edit().putBoolean(KEY_WANT_UP, value).apply()
  }

  // --------------------------------------------------------------- commands

  /** Validates, stores (encrypted) and brings up [conf]. [done] gets null on success. */
  fun connect(conf: String, id: String, name: String, done: (TunnelError?) -> Unit) {
    executor.execute {
      val result: TunnelError? = try {
        val config = parse(conf)
        if (VpnService.prepare(app) != null) throw TunnelError("NO_PERMISSION", "VPN permission not granted")
        SecureVault.write(app, VAULT_ACTIVE, conf)
        prefs().edit()
          .putBoolean(KEY_WANT_UP, true)
          .putString(KEY_PROFILE_ID, id)
          .putString(KEY_PROFILE_NAME, name)
          .apply()
        val previousId = profileId
        val previousName = profileName
        val wasUp = tunnelUp
        profileId = id
        profileName = name
        attempt = 0
        cancelRetry()
        val ok = bringUp(config)
        if (!ok && wasUp && tunnelUp) {
          // Switching profiles failed and GoBackend restored the previous tunnel.
          profileId = previousId
          profileName = previousName
          emit()
        }
        if (ok) null else TunnelError(errorCode ?: "UNKNOWN", errorDetail ?: "")
      } catch (e: TunnelError) {
        errorCode = e.code
        errorDetail = e.message
        setState(if (tunnelUp) state else "error")
        e
      } catch (e: Throwable) {
        Log.e(TAG, "connect failed", e)
        errorCode = "UNKNOWN"
        errorDetail = e.message ?: e.javaClass.simpleName
        setState(if (tunnelUp) state else "error")
        TunnelError("UNKNOWN", errorDetail ?: "")
      }
      done(result)
    }
  }

  /** Manual disconnect: the tunnel goes down and the normal internet comes back. */
  fun disconnect(done: () -> Unit) {
    executor.execute {
      setWantUp(false)
      cancelRetry()
      bringDown()
      attempt = 0
      errorCode = null
      errorDetail = null
      setState("disconnected")
      done()
    }
  }

  /** Called from [BootReceiver]. */
  fun onSystemEvent(isBoot: Boolean, done: () -> Unit) {
    executor.execute {
      try {
        val shouldStart = if (isBoot) setting("connectOnBoot", false) else wantUp()
        if (shouldStart && !tunnelUp && VpnService.prepare(app) == null) {
          setWantUp(true)
          attempt = 0
          startFromVault()
        }
      } catch (e: Exception) {
        Log.w(TAG, "system event", e)
      } finally {
        done()
      }
    }
  }

  fun refresh() {
    if (initialized) executor.execute { emit() }
  }

  // --------------------------------------------------------------- internals

  private fun parse(conf: String): Config =
    try {
      Config.parse(ByteArrayInputStream(conf.toByteArray(Charsets.UTF_8)))
    } catch (e: BadConfigException) {
      throw TunnelError("BAD_CONFIG", "${e.section.getName()} / ${e.location.getName()} / ${e.reason}")
    } catch (e: Exception) {
      throw TunnelError("BAD_CONFIG", e.message ?: e.javaClass.simpleName)
    }

  /** Returns true when the tunnel came up with [config]. */
  private fun bringUp(config: Config): Boolean {
    val newEndpoint = config.peers.firstOrNull()?.endpoint?.orElse(null)?.toString() ?: ""
    val newPeerKeys = config.peers.map { it.publicKey }
    errorCode = null
    errorDetail = null
    setState(if (attempt > 0) "reconnecting" else "connecting")
    try {
      backend().setState(tunnel, Tunnel.State.UP, config)
      // Only now: if a profile switch fails, GoBackend keeps the old tunnel and its peers stay monitored.
      endpoint = newEndpoint
      peerKeys = newPeerKeys
      tunnelUp = true
      upSince = SystemClock.elapsedRealtime()
      unhealthySince = 0L
      staleTrafficSince = 0L
      everHandshake = false
      connectedSince = 0L
      lastTx = -1L
      handshakeAgeSec = -1L
      rxBytes = 0L
      txBytes = 0L
      startMonitor()
      setState("connecting")
      return true
    } catch (e: BackendException) {
      val code = when (e.reason) {
        BackendException.Reason.VPN_NOT_AUTHORIZED -> "NO_PERMISSION"
        BackendException.Reason.DNS_RESOLUTION_FAILURE -> "DNS_FAILED"
        BackendException.Reason.UNABLE_TO_START_VPN -> "VPN_START_FAILED"
        BackendException.Reason.TUN_CREATION_ERROR -> "TUN_FAILED"
        BackendException.Reason.GO_ACTIVATION_ERROR_CODE -> "GO_FAILED"
        else -> "BACKEND_FAILED"
      }
      onStartFailed(code, e.reason.toString())
    } catch (t: Throwable) {
      // Throwable, not Exception: e.g. UnsatisfiedLinkError if libwg-go.so is missing for this CPU.
      Log.e(TAG, "bringUp failed", t)
      onStartFailed("UNKNOWN", t.message ?: t.javaClass.simpleName)
    }
    return false
  }

  private fun onStartFailed(code: String, detail: String) {
    // GoBackend restores the previous tunnel if a profile switch fails.
    tunnelUp = isBackendUp()
    if (!tunnelUp) stopMonitor()
    errorCode = code
    errorDetail = detail
    if (code == "NO_PERMISSION") setWantUp(false)
    val retryable = code != "NO_PERMISSION"
    if (!tunnelUp && retryable && wantUp() && setting("autoReconnect", true)) {
      setState("reconnecting")
      scheduleRetry()
    } else if (!tunnelUp) {
      if (!retryable || !setting("autoReconnect", true)) setWantUp(false)
      setState("error")
    } else {
      emit()
    }
  }

  private fun bringDown() {
    stopMonitor()
    val wasUp = tunnelUp || isBackendUp()
    tunnelUp = false // set first: the DOWN callback below must not look like a drop
    if (wasUp) {
      try {
        backend?.setState(tunnel, Tunnel.State.DOWN, null)
      } catch (e: Exception) {
        Log.w(TAG, "bringDown", e)
      }
    }
    everHandshake = false
    connectedSince = 0L
    handshakeAgeSec = -1L
    rxBytes = 0L
    txBytes = 0L
  }

  private fun isBackendUp(): Boolean =
    try {
      backend?.getState(tunnel) == Tunnel.State.UP
    } catch (e: Exception) {
      false
    }

  private fun startFromVault() {
    val conf = try {
      SecureVault.read(app, VAULT_ACTIVE)
    } catch (e: Exception) {
      Log.w(TAG, "vault read", e)
      null
    }
    if (conf == null) {
      setWantUp(false)
      errorCode = "NO_PROFILE"
      errorDetail = null
      setState("error")
      return
    }
    profileId = prefs().getString(KEY_PROFILE_ID, "") ?: ""
    profileName = prefs().getString(KEY_PROFILE_NAME, "") ?: ""
    val config = try {
      parse(conf)
    } catch (e: TunnelError) {
      setWantUp(false)
      errorCode = e.code
      errorDetail = e.message
      setState("error")
      return
    }
    bringUp(config)
  }

  private fun scheduleRetry() {
    cancelRetry()
    attempt++
    val delaySeconds = when (attempt) {
      1 -> 3L
      2 -> 6L
      3 -> 12L
      4 -> 24L
      else -> 60L
    }
    retry = executor.schedule({ retryNow() }, delaySeconds, TimeUnit.SECONDS)
  }

  private fun cancelRetry() {
    retry?.cancel(false)
    retry = null
  }

  private fun retryNow() {
    retry = null
    if (tunnelUp || !wantUp()) return
    if (VpnService.prepare(app) != null) {
      setWantUp(false)
      errorCode = "NO_PERMISSION"
      setState("error")
      return
    }
    startFromVault()
  }

  private fun onAlwaysOn() {
    if (tunnelUp) return
    setWantUp(true)
    attempt = 0
    cancelRetry()
    startFromVault()
  }

  private fun onBackendState(newState: Tunnel.State) {
    if (newState != Tunnel.State.DOWN || !tunnelUp) return
    if (isBackendUp()) return // old event from a profile switch
    // Android stopped our VPN: another VPN app took over, the user revoked it, or the OS killed it.
    tunnelUp = false
    stopMonitor()
    val revoked = VpnService.prepare(app) != null
    if (revoked) {
      setWantUp(false)
      errorCode = "REVOKED"
      setState("error")
    } else if (wantUp() && setting("autoReconnect", true)) {
      errorCode = "STOPPED"
      setState("reconnecting")
      scheduleRetry()
    } else {
      errorCode = "STOPPED"
      setState("disconnected")
    }
  }

  // ------------------------------------------------------------- monitoring

  private fun startMonitor() {
    stopMonitor()
    monitor = executor.scheduleWithFixedDelay({ safeTick() }, TICK_MS, TICK_MS, TimeUnit.MILLISECONDS)
  }

  private fun stopMonitor() {
    monitor?.cancel(false)
    monitor = null
  }

  private fun safeTick() {
    // An exception would silently cancel the periodic task, so nothing may escape.
    try {
      tick()
    } catch (t: Throwable) {
      Log.w(TAG, "health check", t)
    }
  }

  private fun tick() {
    if (!tunnelUp) return
    val stats = try {
      backend?.getStatistics(tunnel)
    } catch (e: Exception) {
      null
    } ?: return
    val now = System.currentTimeMillis()
    val mono = SystemClock.elapsedRealtime()

    rxBytes = stats.totalRx()
    txBytes = stats.totalTx()
    val sentSomething = lastTx >= 0 && txBytes != lastTx
    lastTx = txBytes

    var latest = 0L
    for (key in peerKeys) {
      val peer = stats.peer(key) ?: continue
      latest = maxOf(latest, peer.latestHandshakeEpochMillis())
    }
    handshakeAgeSec = if (latest > 0) maxOf(0L, (now - latest) / 1000) else -1L
    val fresh = latest > 0 && now - latest < SESSION_LIFETIME_MS
    if (fresh && !everHandshake) {
      everHandshake = true
      connectedSince = latest
    }

    // An expired session is fine while the phone is idle; it is a problem only if
    // we keep sending and no new handshake arrives.
    if (fresh || latest == 0L) {
      staleTrafficSince = 0L
    } else if (sentSomething && staleTrafficSince == 0L) {
      staleTrafficSince = mono
    }

    val healthy = fresh ||
      (everHandshake && (staleTrafficSince == 0L || mono - staleTrafficSince < STALE_WITH_TRAFFIC_MS))
    val newState: String
    if (!hasNetwork) {
      // No Wi-Fi or mobile data: nothing can leak, the tunnel simply waits.
      unhealthySince = 0L
      errorCode = "NO_NETWORK"
      errorDetail = null
      newState = "no_network"
    } else if (healthy) {
      unhealthySince = 0L
      attempt = 0
      errorCode = null
      errorDetail = null
      newState = "connected"
    } else if (!everHandshake && mono - upSince < FIRST_HANDSHAKE_GRACE_MS) {
      newState = "connecting"
    } else {
      if (unhealthySince == 0L) unhealthySince = mono
      errorCode = if (!everHandshake) "NO_HANDSHAKE" else "HANDSHAKE_STALE"
      errorDetail = null
      newState = "reconnecting"
      if (!setting("killSwitch", true) && mono - unhealthySince >= GIVE_UP_WITHOUT_KILL_SWITCH_MS) {
        // The user prefers an open internet over a blocked one.
        val reason = errorCode
        setWantUp(false)
        bringDown()
        errorCode = "SERVER_UNREACHABLE"
        errorDetail = reason
        setState("error")
        return
      }
    }
    state = newState
    emit()
  }

  // ---------------------------------------------------------------- network

  private fun registerNetworkCallback() {
    val cm = app.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return
    // Until the callback reports networks, trust the system's current view.
    hasNetwork = try {
      cm.activeNetwork != null
    } catch (e: Exception) {
      true
    }
    val request = NetworkRequest.Builder()
      .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
      .addCapability(NetworkCapabilities.NET_CAPABILITY_NOT_VPN)
      .build()
    try {
      cm.registerNetworkCallback(request, object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
          synchronized(networks) {
            networks.add(network)
            hasNetwork = true
          }
          executor.execute { onNetworkAvailable() }
        }

        override fun onLost(network: Network) {
          synchronized(networks) {
            networks.remove(network)
            hasNetwork = networks.isNotEmpty()
          }
          executor.execute { emit() }
        }
      })
    } catch (e: Exception) {
      Log.w(TAG, "network callback", e)
    }
  }

  private fun onNetworkAvailable() {
    if (!tunnelUp && retry != null && wantUp()) {
      // A start failed earlier (for example no DNS while offline): try again right away.
      cancelRetry()
      retryNow()
      return
    }
    if (tunnelUp) {
      // WireGuard roams to the new network by itself; give it a fresh grace period.
      val mono = SystemClock.elapsedRealtime()
      if (unhealthySince != 0L) unhealthySince = mono
      if (!everHandshake) upSince = mono
      if (staleTrafficSince != 0L) staleTrafficSince = mono
    }
    emit()
  }

  // ----------------------------------------------------------------- output

  private fun setState(s: String) {
    state = s
    emit()
  }

  private fun buildSnapshot(): Map<String, Any?> = mapOf(
    "state" to state,
    "tunnelUp" to tunnelUp,
    "blocking" to (tunnelUp && state != "connected"),
    "profileId" to profileId,
    "profileName" to profileName,
    "endpoint" to endpoint,
    "handshakeAgeSec" to handshakeAgeSec.toDouble(),
    "rxBytes" to rxBytes.toDouble(),
    "txBytes" to txBytes.toDouble(),
    "connectedSince" to connectedSince.toDouble(),
    "error" to errorCode,
    "errorDetail" to errorDetail,
    "attempt" to attempt,
    "hasNetwork" to hasNetwork,
    "updatedAt" to System.currentTimeMillis().toDouble(),
  )

  private fun emit() {
    val snap = buildSnapshot()
    lastSnapshot = snap
    StatusNotifier.update(app, snap, setting("statusNotification", true), notificationLanguage())
    try {
      listener?.invoke(snap)
    } catch (e: Exception) {
      Log.w(TAG, "listener", e)
    }
  }

  private fun notificationLanguage(): String {
    val chosen = try {
      JSONObject(loadSettings() ?: "{}").optString("language", "auto")
    } catch (e: Exception) {
      "auto"
    }
    val code = if (chosen == "tr" || chosen == "en") chosen else Locale.getDefault().language
    return if (code.lowercase(Locale.ROOT).startsWith("tr")) "tr" else "en"
  }
}
