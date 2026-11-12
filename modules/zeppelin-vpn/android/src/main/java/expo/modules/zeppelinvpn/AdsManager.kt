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
        InMobiSdk.init(context.applicationContext, account, consent(personalized), object : SdkInitializationListener {
          override fun onInitializationComplete(error: Error?) {
            ready = error == null
            if (error != null) Log.w(TAG, "init failed: ${error.message}")
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
        if (!ready) return@post
        if (interstitial != null && interstitialPlacement == placementId) {
          if (!interstitialLoaded) interstitial?.load()
          return@post
        }
        interstitialPlacement = placementId
        interstitialLoaded = false
        interstitial = InMobiInterstitial(context, placementId, object : InterstitialAdEventListener() {
          override fun onAdLoadSucceeded(ad: InMobiInterstitial, info: AdMetaInfo) {
            interstitialLoaded = true
          }

          override fun onAdLoadFailed(ad: InMobiInterstitial, status: InMobiAdRequestStatus) {
            interstitialLoaded = false
            Log.w(TAG, "interstitial load failed: ${status.message}")
          }

          override fun onAdDismissed(ad: InMobiInterstitial) {
            interstitialLoaded = false
            main.postDelayed({ try { ad.load() } catch (_: Throwable) {} }, 2_000)
          }
        }).also { it.load() }
      } catch (e: Throwable) {
        Log.w(TAG, "interstitial create threw", e)
      }
    }
  }

  /** Shows the preloaded interstitial if it is ready. Returns false (and does nothing) otherwise. */
  fun showInterstitial(activity: Activity?): Boolean {
    val ad = interstitial ?: return false
    if (activity == null || !interstitialLoaded) return false
    return try {
      if (!ad.isReady()) return false
      interstitialLoaded = false
      main.post { try { ad.show() } catch (e: Throwable) { Log.w(TAG, "show threw", e) } }
      true
    } catch (e: Throwable) {
      false
    }
  }
}
