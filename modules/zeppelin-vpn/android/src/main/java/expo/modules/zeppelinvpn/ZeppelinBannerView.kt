package expo.modules.zeppelinvpn

import android.content.Context
import android.util.Log
import android.view.ViewGroup
import com.inmobi.ads.AdMetaInfo
import com.inmobi.ads.InMobiAdRequestStatus
import com.inmobi.ads.InMobiBanner
import com.inmobi.ads.listeners.BannerAdEventListener
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

/** 320x50 InMobi banner (2.4.0). Hides itself (onAdState "failed") when no ad comes. */
class ZeppelinBannerView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout = true

  private val onAdState by EventDispatcher()
  private var banner: InMobiBanner? = null
  private var placementId = 0L

  fun setPlacement(id: String) {
    val parsed = id.trim().toLongOrNull() ?: 0L
    if (parsed == placementId) return
    placementId = parsed
    load()
  }

  private fun load() {
    try {
      banner?.let { removeView(it); it.destroy() }
      banner = null
      if (placementId <= 0L || !AdsManager.ready) {
        onAdState(mapOf("state" to "failed"))
        return
      }
      val owner = appContext.currentActivity ?: context
      val b = InMobiBanner(owner, placementId)
      b.setBannerSize(320, 50)
      b.setEnableAutoRefresh(true)
      b.setRefreshInterval(60)
      b.setListener(object : BannerAdEventListener() {
        override fun onAdLoadSucceeded(ad: InMobiBanner, info: AdMetaInfo) {
          onAdState(mapOf("state" to "loaded"))
        }

        override fun onAdLoadFailed(ad: InMobiBanner, status: InMobiAdRequestStatus) {
          Log.w("ZeppelinAds", "banner load failed: ${status.message}")
          onAdState(mapOf("state" to "failed"))
        }
      })
      addView(b, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
      banner = b
      b.load()
    } catch (e: Throwable) {
      Log.w("ZeppelinAds", "banner threw", e)
      onAdState(mapOf("state" to "failed"))
    }
  }

  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    try { banner?.destroy() } catch (_: Throwable) {}
    banner = null
    placementId = 0L
  }
}
