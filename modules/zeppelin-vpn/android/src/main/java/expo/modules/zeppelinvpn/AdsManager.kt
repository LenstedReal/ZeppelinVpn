package expo.modules.zeppelinvpn

import android.app.Activity
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.inmobi.ads.AdMetaInfo
import com.inmobi.ads.InMobiAdRequestStatus
import com.inmobi.ads.InMobiInterstitial
import com.inmobi.ads.listeners.InterstitialAdEventListener
import com.inmobi.sdk.InMobiSdk
import com.inmobi.sdk.SdkInitializationListener
import org.json.JSONObject

/**
 * InMobi ads (2.4.0). Nothing here touches the VPN tunnel: ads are only requested from the app UI,
 * and every call is wrapped so an ad error can never crash the app or block connecting.
 *
 * Consent: the app never sends personal data of its own. "gdpr" = "1" is always set, so InMobi treats
 * every user as protected; "gdpr_consent_available" follows the user's "Personalized ads" switch
 * (default off). The SDK does not remember consent, so it is passed on every init.
 */
object AdsManager {
  private const val TAG = "ZeppelinAds"
  private val main = Handler(Looper.getMainLooper())

  @Volatile var ready = false
    private set
  private var accountId = ""
  private var interstitial: InMobiInterstitial? = null
  private var interstitialPlacement = 0L
  private var interstitialLoaded = false
  /** Called once when the shown interstitial closes (or fails to show); then the VPN connects. */
  private var onClosed: (() -> Unit)? = null

  // 2.4.1: what happened last, shown in Settings so ad problems can be seen without a computer.
  @Volatile private var sdkState = "off"
  @Volatile private var interstitialState = "-"
  @Volatile var bannerState = "-"
  private var initTries = 0
  private var loadRetries = 0
  /** Interstitial asked for before the SDK finished starting; loaded as soon as it is up. */
  private var pendingContext: Context? = null
  private var pendingPlacement = 0L

  fun statusText(): String = "SDK: $sdkState · Tam ekran: $interstitialState · Banner: $bannerState"

  private fun finishShow() {
    val cb = onClosed
    onClosed = null
    if (cb != null) main.post { try { cb() } catch (_: Throwable) {} }
  }

  private fun consent(personalized: Boolean) = JSONObject().apply {
    put("gdpr_consent_available", personalized)
    put("gdpr", "1")
  }

  /** Must run on the UI thread (InMobi requirement); callers may use any thread. */
  fun init(context: Context, account: String, personalized: Boolean) {
    if (account.isBlank()) return
    main.post {
      try {
        if (ready && account == accountId) {
          InMobiSdk.updateGDPRConsent(consent(personalized))
          return@post
        }
        accountId = account
        sdkState = "starting"
        InMobiSdk.init(context.applicationContext, account, consent(personalized), object : SdkInitializationListener {
          override fun onInitializationComplete(error: Error?) {
            ready = error == null
            if (error != null) {
              sdkState = "error: ${error.message}"
              Log.w(TAG, "init failed: ${error.message}")
              // Network may not be up yet: try again a few times.
              if (initTries++ < 3) main.postDelayed({ init(context, account, personalized) }, 30_000)
            } else {
              sdkState = "ready"
              val ctx = pendingContext
              val id = pendingPlacement
              pendingContext = null
              if (ctx != null && id > 0L) preloadInterstitial(ctx, id)
            }
          }
        })
      } catch (e: Throwable) {
        Log.w(TAG, "init threw", e)
      }
    }
  }

  /** Loads an interstitial in the background so it is ready when [showInterstitial] is called. */
  fun preloadInterstitial(context: Context, placementId: Long) {
    if (placementId <= 0L) return
    main.post {
      try {
        if (!ready) {
          // SDK still starting: remember it and load right after init (2.4.1).
          pendingContext = context
          pendingPlacement = placementId
          interstitialState = "waiting for SDK"
          return@post
        }
        if (interstitial != null && interstitialPlacement == placementId) {
          if (!interstitialLoaded) {
            interstitialState = "loading"
            interstitial?.load()
          }
          return@post
        }
        interstitialPlacement = placementId
        interstitialLoaded = false
        interstitial = InMobiInterstitial(context, placementId, object : InterstitialAdEventListener() {
          override fun onAdLoadSucceeded(ad: InMobiInterstitial, info: AdMetaInfo) {
            interstitialLoaded = true
            loadRetries = 0
            interstitialState = "ready"
          }

          override fun onAdLoadFailed(ad: InMobiInterstitial, status: InMobiAdRequestStatus) {
            interstitialLoaded = false
            interstitialState = "error: ${status.statusCode} ${status.message ?: ""}".trim()
            Log.w(TAG, "interstitial load failed: ${status.message}")
            // No fill is common: try again later, a limited number of times (2.4.1).
            if (loadRetries++ < 10) main.postDelayed({ try { if (!interstitialLoaded) ad.load() } catch (_: Throwable) {} }, 60_000)
          }

          override fun onAdDismissed(ad: InMobiInterstitial) {
            interstitialLoaded = false
            interstitialState = "shown, reloading"
            finishShow()
            main.postDelayed({ try { ad.load() } catch (_: Throwable) {} }, 2_000)
          }

          override fun onAdDisplayFailed(ad: InMobiInterstitial) {
            interstitialLoaded = false
            finishShow()
            main.postDelayed({ try { ad.load() } catch (_: Throwable) {} }, 2_000)
          }
        }).also {
          interstitialState = "loading"
          it.load()
        }
      } catch (e: Throwable) {
        Log.w(TAG, "interstitial create threw", e)
      }
    }
  }

  /**
   * Shows the preloaded interstitial if it is ready and calls [closed] when the user closes it.
   * Returns false (and never calls [closed]) when no ad is ready: the caller connects at once then.
   */
  fun showInterstitial(activity: Activity?, closed: () -> Unit): Boolean {
    val ad = interstitial ?: return false
    if (activity == null || !interstitialLoaded) return false
    return try {
      if (!ad.isReady()) return false
      interstitialLoaded = false
      onClosed = closed
      main.post {
        try {
          ad.show()
        } catch (e: Throwable) {
          Log.w(TAG, "show threw", e)
          finishShow()
        }
      }
      true
    } catch (e: Throwable) {
      onClosed = null
      false
    }
  }
}
