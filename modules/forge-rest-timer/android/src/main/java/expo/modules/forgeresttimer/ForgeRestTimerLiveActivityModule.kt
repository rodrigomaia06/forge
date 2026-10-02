package expo.modules.forgeresttimer

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Android counterpart to the iOS rest-timer Live Activity. There is no ActivityKit
 * on Android, so the live countdown is an ongoing notification that the system
 * itself ticks down: setWhen(end) + usesChronometer + chronometerCountDown render
 * a per-second countdown toward the end time without the app updating each second
 * and without a foreground service. The JS contract (syncAsync/stopAsync) matches
 * the iOS module so a single RestTimer code path drives both platforms.
 */
class ForgeRestTimerLiveActivityModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ForgeRestTimerLiveActivity")

    AsyncFunction("syncAsync") { startAt: Double, endAt: Double ->
      sync(startAt.toLong(), endAt.toLong())
    }

    AsyncFunction("stopAsync") {
      NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
    }
  }

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun sync(startAt: Long, endAt: Long) {
    // A past/empty end means the rest is over; clear the live notification. The
    // completion alert is owned separately by the JS notification scheduler.
    if (endAt <= System.currentTimeMillis()) {
      NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
      return
    }
    ensureChannel()
    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(smallIcon())
      .setContentTitle("Rest")
      .setContentText("Resting…")
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setShowWhen(true)
      .setWhen(endAt)
      .setUsesChronometer(true)
      .setChronometerCountDown(true)
      .setColor(FORGE_ACCENT)
      .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setPriority(NotificationCompat.PRIORITY_LOW)
    openAppIntent()?.let { builder.setContentIntent(it) }
    runCatching { NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, builder.build()) }
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
    private const val FORGE_ACCENT = 0xFF4D7B67.toInt()
  }
}
