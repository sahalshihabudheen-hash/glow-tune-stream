package com.nyra.pulse

import android.net.Uri
import android.os.Looper
import android.os.SystemClock
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.common.SimpleBasePlayer
import androidx.media3.common.SimpleBasePlayer.MediaItemData
import androidx.media3.common.SimpleBasePlayer.PositionSupplier
import androidx.media3.common.SimpleBasePlayer.State
import com.google.common.collect.ImmutableList
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

/**
 * A "virtual" player: it makes no sound itself. The real audio is played by the website inside the
 * WebView. This class mirrors what the page reports (track, play/pause, position) so Android can show
 * system media controls, and forwards button presses back to the page through [NyraMediaBridge].
 */
class NyraVirtualPlayer : SimpleBasePlayer(Looper.getMainLooper()) {

    private var currentState: State = State.Builder()
        .setAvailableCommands(
            Player.Commands.Builder()
                .addAll(
                    Player.COMMAND_PLAY_PAUSE,
                    Player.COMMAND_SEEK_TO_NEXT,
                    Player.COMMAND_SEEK_TO_PREVIOUS,
                    Player.COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM,
                    Player.COMMAND_GET_CURRENT_MEDIA_ITEM,
                    Player.COMMAND_GET_METADATA,
                    Player.COMMAND_GET_TIMELINE,
                )
                .build()
        )
        .setPlaybackState(Player.STATE_IDLE)
        .build()

    private var playing = false
    private var basePositionMs = 0L
    private var baseElapsedMs = SystemClock.elapsedRealtime()
    private var durationMs = 0L

    private var lastFullKey = ""
    private var lastSongKey = ""
    private var itemCounter = 0

    /** Position that keeps advancing between the page's once-a-second updates. */
    private val positionSupplier = PositionSupplier {
        val pos = if (playing) {
            basePositionMs + (SystemClock.elapsedRealtime() - baseElapsedMs)
        } else {
            basePositionMs
        }
        if (durationMs > 0) pos.coerceAtMost(durationMs) else pos
    }

    override fun getState(): State = currentState

    fun updateTrack(title: String, artist: String, artworkUrl: String?, durationMs: Long) {
        // The page re-sends the same track every second while playing; ignore repeats.
        val fullKey = "$title|$artist|$artworkUrl|$durationMs"
        if (fullKey == lastFullKey) return
        lastFullKey = fullKey

        val songKey = "$title|$artist"
        if (songKey != lastSongKey) {
            // New song: new playlist item id and restart the position clock.
            lastSongKey = songKey
            itemCounter++
            basePositionMs = 0L
            baseElapsedMs = SystemClock.elapsedRealtime()
        }
        this.durationMs = durationMs

        val metadata = MediaMetadata.Builder()
            .setTitle(title)
            .setArtist(artist)
            .setIsBrowsable(false)
            .setIsPlayable(true)
        if (!artworkUrl.isNullOrEmpty()) {
            metadata.setArtworkUri(Uri.parse(artworkUrl))
        }

        val uid = "nyra_$itemCounter"
        val item = MediaItem.Builder()
            .setMediaId(uid)
            .setMediaMetadata(metadata.build())
            .build()

        val itemData = MediaItemData.Builder(uid)
            .setMediaItem(item)
            .setDurationUs(if (durationMs > 0) durationMs * 1000L else C.TIME_UNSET)
            .setIsSeekable(true)
            .build()

        currentState = currentState.buildUpon()
            .setPlaylist(ImmutableList.of(itemData))
            .setCurrentMediaItemIndex(0)
            .setPlaybackState(Player.STATE_READY)
            .setContentPositionMs(positionSupplier)
            .build()
        invalidateState()
    }

    fun updatePlaybackState(isPlaying: Boolean, positionMs: Long) {
        playing = isPlaying
        basePositionMs = positionMs
        baseElapsedMs = SystemClock.elapsedRealtime()
        if (currentState.playlist.isEmpty()) return

        currentState = currentState.buildUpon()
            .setPlayWhenReady(isPlaying, Player.PLAY_WHEN_READY_CHANGE_REASON_REMOTE)
            .setContentPositionMs(positionSupplier)
            .build()
        invalidateState()
    }

    // ---- Commands coming from the notification / lock screen / headset / car --------------------

    override fun handleSetPlayWhenReady(playWhenReady: Boolean): ListenableFuture<*> {
        NyraMediaBridge.commandWebPlayer(if (playWhenReady) "play" else "pause")
        return Futures.immediateVoidFuture()
    }

    override fun handleSeek(mediaItemIndex: Int, positionMs: Long, seekCommand: Int): ListenableFuture<*> {
        when (seekCommand) {
            Player.COMMAND_SEEK_TO_NEXT,
            Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM -> NyraMediaBridge.commandWebPlayer("next")

            Player.COMMAND_SEEK_TO_PREVIOUS,
            Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM -> NyraMediaBridge.commandWebPlayer("previous")

            else -> NyraMediaBridge.commandWebPlayerSeek(positionMs)
        }
        return Futures.immediateVoidFuture()
    }

    override fun handlePrepare(): ListenableFuture<*> = Futures.immediateVoidFuture()
}
