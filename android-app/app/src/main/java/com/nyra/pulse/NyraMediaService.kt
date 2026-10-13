package com.nyra.pulse

import android.app.PendingIntent
import android.content.Intent
import android.os.Bundle
import android.os.PowerManager
import androidx.media3.session.CommandButton
import androidx.media3.session.MediaLibraryService
import androidx.media3.session.MediaLibraryService.MediaLibrarySession
import androidx.media3.session.MediaSession
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionResult
import com.google.common.collect.ImmutableList
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

/**
 * Hosts the Media3 session. While the page is playing, Media3 promotes this service to a foreground
 * "media playback" service, which is what keeps the app (and the WebView's audio) alive in the
 * background and shows the notification / lock-screen controls.
 *
 * Playback with the screen off: the foreground service keeps the process alive, and a partial
 * wake lock (held only while playing) keeps the CPU awake so the page can stream and advance to
 * the next song of any playlist.
 */
class NyraMediaService : MediaLibraryService() {

    private var session: MediaLibrarySession? = null
    private var virtualPlayer: NyraVirtualPlayer? = null
    private var wakeLock: PowerManager.WakeLock? = null

    private val likeCommand = SessionCommand(ACTION_LIKE, Bundle.EMPTY)
    private var liked = false

    override fun onCreate() {
        super.onCreate()
        val player = NyraVirtualPlayer()
        virtualPlayer = player

        // Tapping the notification brings the app back to the front.
        val openApp = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )

        session = MediaLibrarySession.Builder(this, player, SessionCallback())
            .setSessionActivity(openApp)
            .setCustomLayout(ImmutableList.of(likeButton()))
            .build()

        setMediaNotificationProvider(NyraNotificationProvider(this))
        NyraMediaBridge.attachService(this)
    }

    fun updateTrack(title: String, artist: String, artwork: String, durationMs: Long) {
        virtualPlayer?.updateTrack(title, artist, artwork, durationMs)
    }

    fun updatePlaybackState(isPlaying: Boolean, positionMs: Long) {
        virtualPlayer?.updatePlaybackState(isPlaying, positionMs)
        setWakeLock(isPlaying)
    }

    /** Shows a filled or empty heart on the notification, matching the site's favourites. */
    fun updateLiked(isLiked: Boolean) {
        if (isLiked == liked) return
        liked = isLiked
        session?.setCustomLayout(ImmutableList.of(likeButton()))
    }

    private fun likeButton(): CommandButton =
        CommandButton.Builder(if (liked) CommandButton.ICON_HEART_FILLED else CommandButton.ICON_HEART_UNFILLED)
            .setDisplayName(if (liked) "Unlike" else "Like")
            .setSessionCommand(likeCommand)
            .build()

    private inner class SessionCallback : MediaLibrarySession.Callback {
        override fun onConnect(
            session: MediaSession,
            controller: MediaSession.ControllerInfo,
        ): MediaSession.ConnectionResult {
            val commands = MediaSession.ConnectionResult.DEFAULT_SESSION_AND_LIBRARY_COMMANDS
                .buildUpon()
                .add(likeCommand)
                .build()
            return MediaSession.ConnectionResult.AcceptedResultBuilder(session)
                .setAvailableSessionCommands(commands)
                .build()
        }

        override fun onCustomCommand(
            session: MediaSession,
            controller: MediaSession.ControllerInfo,
            customCommand: SessionCommand,
            args: Bundle,
        ): ListenableFuture<SessionResult> {
            if (customCommand.customAction == ACTION_LIKE) {
                NyraMediaBridge.commandWebPlayer("like")
                return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
            }
            return Futures.immediateFuture(SessionResult(SessionResult.RESULT_ERROR_NOT_SUPPORTED))
        }
    }

    private fun setWakeLock(playing: Boolean) {
        if (playing) {
            if (wakeLock?.isHeld == true) return
            val pm = getSystemService(PowerManager::class.java) ?: return
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "NYRA:playback").apply {
                setReferenceCounted(false)
                // Safety net: auto-release after 6 h; re-acquired on the next update while still playing.
                acquire(WAKE_LOCK_TIMEOUT_MS)
            }
        } else {
            wakeLock?.let { if (it.isHeld) it.release() }
        }
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaLibrarySession? = session

    override fun onDestroy() {
        setWakeLock(false)
        NyraMediaBridge.attachService(null)
        session?.release()
        session = null
        virtualPlayer?.release()
        virtualPlayer = null
        super.onDestroy()
    }

    private companion object {
        const val ACTION_LIKE = "com.nyra.pulse.LIKE"
        const val WAKE_LOCK_TIMEOUT_MS = 6L * 60 * 60 * 1000
    }
}
