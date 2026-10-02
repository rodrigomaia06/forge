package expo.modules.forgeresttimer

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Android counterpart to the iOS rest-timer Live Activity.
 *
 * There is no ActivityKit on Android, so the live countdown is an ongoing notification built
 * from a custom RemoteViews layout that mirrors the iOS Live Activity surface: a dark rounded
 * card, the Tabler stopwatch glyph + "Rest" label in Manrope, a large system-ticked countdown,
 * and a draining rail — with the same normal / warning / overdue tints.
 *
 * Two things the system renders for free keep this cheap: the Chronometer ticks the countdown
 * number every second without the app waking (setChronometerCountDown, API 24+), so even if the
 * process is killed the number stays correct. A notification ProgressBar cannot self-drain, so a
 * light main-thread ticker re-posts the rail fraction and the tint (normal→warning) while the app
 * process is alive; if it is killed the rail freezes but the authoritative number keeps counting.
 *
 * The JS contract (syncAsync/stopAsync) matches the iOS module so one RestTimer path drives both.
 */
class ForgeRestTimerLiveActivityModule : Module() {
  private val handler = Handler(Looper.getMainLooper())
  private var ticker: Runnable? = null
  private var startAtMs = 0L
  private var endAtMs = 0L

  override fun definition() = ModuleDefinition {
    Name("ForgeRestTimerLiveActivity")

    AsyncFunction("syncAsync") { startAt: Double, endAt: Double ->
      sync(startAt.toLong(), endAt.toLong())
    }

    AsyncFunction("stopAsync") {
      stop()
    }

    OnDestroy {
      stopTicker()
    }
  }

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun sync(startAt: Long, endAt: Long) {
    // A past/empty end means the rest is over; clear the live notification. The completion
    // alert is owned separately by the JS notification scheduler.
    if (endAt <= System.currentTimeMillis()) {
      stop()
      return
    }
    startAtMs = startAt
    endAtMs = endAt
    ensureChannel()
    post()
    startTicker()
  }

  private fun stop() {
    stopTicker()
    runCatching { NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID) }
  }

  /** Build and post the notification reflecting the countdown's current tint and rail fraction. */
  private fun post() {
    val now = System.currentTimeMillis()
    if (endAtMs <= now) {
      stop()
      return
    }
    val total = (endAtMs - startAtMs).coerceAtLeast(1L)
    val remaining = (endAtMs - now).coerceIn(0L, total)
    val tint = tintFor(remaining, total)
    // Anchor the chronometer to the elapsed-realtime clock so the system ticks it down to the
    // end instant without the app updating each second.
    val base = SystemClock.elapsedRealtime() + remaining
    val progress = ((remaining.toDouble() / total.toDouble()) * PROGRESS_MAX).toInt()

    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(smallIcon())
      .setContentTitle("Rest")
      .setContentText("Resting…")
      .setStyle(NotificationCompat.DecoratedCustomViewStyle())
      .setCustomContentView(buildRemoteViews(R.layout.forge_rest_timer_compact, tint, base, progress, false))
      .setCustomBigContentView(buildRemoteViews(R.layout.forge_rest_timer_expanded, tint, base, progress, true))
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setColor(tint)
      .setColorized(false)
      .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setPriority(NotificationCompat.PRIORITY_LOW)
    openAppIntent()?.let { builder.setContentIntent(it) }
    runCatching { NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, builder.build()) }
  }

  private fun buildRemoteViews(
    layout: Int,
    tint: Int,
    chronometerBase: Long,
    progress: Int,
    withBar: Boolean,
  ): RemoteViews {
    val views = RemoteViews(context.packageName, layout)
    views.setTextColor(R.id.forge_rest_label, tint)
    views.setTextColor(R.id.forge_rest_time, tint)
    views.setInt(R.id.forge_rest_icon, "setColorFilter", tint)
    views.setChronometerCountDown(R.id.forge_rest_time, true)
    views.setChronometer(R.id.forge_rest_time, chronometerBase, null, true)
    if (withBar) {
      views.setProgressBar(R.id.forge_rest_bar, PROGRESS_MAX, progress, false)
    }
    return views
  }

  /** Overdue once the rest is spent; amber for the final fifth; otherwise white — mirrors iOS. */
  private fun tintFor(remaining: Long, total: Long): Int = when {
    remaining <= 0L -> 0xFFC85C5C.toInt()
    remaining.toDouble() <= total.toDouble() * WARNING_FRACTION -> 0xFFC58A45.toInt()
    else -> 0xFFFFFFFF.toInt()
  }

  /**
   * Re-post roughly once a second so the rail drains and the tint crosses into the warning band.
   * The Chronometer number does not need this (the system ticks it); only the rail/tint do.
   */
  private fun startTicker() {
    stopTicker()
    val runnable = object : Runnable {
      override fun run() {
        if (endAtMs <= System.currentTimeMillis()) {
          stop()
          return
        }
        post()
        handler.postDelayed(this, TICK_MS)
      }
    }
    ticker = runnable
    handler.postDelayed(runnable, TICK_MS)
  }

  private fun stopTicker() {
    ticker?.let { handler.removeCallbacks(it) }
    ticker = null
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(CHANNEL_ID, "Rest countdown", NotificationManager.IMPORTANCE_LOW).apply {
      description = "A live countdown while you rest between sets."
      setSound(null, null)
      enableVibration(false)
      setShowBadge(false)
    }
    manager.createNotificationChannel(channel)
  }

  private fun openAppIntent(): PendingIntent? {
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return null
    launch.action = Intent.ACTION_VIEW
    launch.data = Uri.parse("forge://rest-timer/open")
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    return PendingIntent.getActivity(context, 0, launch, flags)
  }

  private fun smallIcon(): Int {
    // Reuse the monochrome notification icon the expo-notifications config emits;
    // fall back to a built-in alarm glyph so a notification always has an icon.
    val id = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
    return if (id != 0) id else android.R.drawable.ic_lock_idle_alarm
  }

  companion object {
    private const val CHANNEL_ID = "forge-rest-timer-live"
    private const val NOTIFICATION_ID = 7312
    private const val PROGRESS_MAX = 1000
    private const val WARNING_FRACTION = 0.2
    private const val TICK_MS = 1000L
  }
}
