package com.nyra.pulse

import androidx.webkit.JavaScriptReplyProxy
import org.json.JSONObject

/**
 * Single hand-off point between the website's player (inside the WebView) and the
 * native Media3 session that powers the notification / lock-screen / Bluetooth controls.
 *
 *   web  -> native : updateTrack() / updatePlaybackState()   (called from MainActivity)
 *   native -> web  : commandWebPlayer() / commandWebPlayerSeek() (called from NyraVirtualPlayer)
 *
 * All calls happen on the main thread.
 */
object NyraMediaBridge {

    private var service: NyraMediaService? = null
    private var replyProxy: JavaScriptReplyProxy? = null

    // Latest state, replayed into the service if it starts after the web page already reported something.
    private var hasTrack = false
    private var title = "NYRA"
    private var artist = ""
    private var artwork = ""
    private var durationMs = 0L
    private var isPlaying = false
    private var positionMs = 0L
    private var isLiked = false

    fun attachService(svc: NyraMediaService?) {
        service = svc
        if (svc != null && hasTrack) {
            svc.updateTrack(title, artist, artwork, durationMs)
            svc.updatePlaybackState(isPlaying, positionMs)
            svc.updateLiked(isLiked)
        }
    }

    /** Channel used to send transport commands back to the page. */
    fun attachReplyProxy(proxy: JavaScriptReplyProxy?) {
        replyProxy = proxy
    }

    fun updateTrack(title: String, artist: String, artwork: String, durationMs: Long) {
        hasTrack = true
        this.title = title
        this.artist = artist
        this.artwork = artwork
        this.durationMs = durationMs
        service?.updateTrack(title, artist, artwork, durationMs)
    }

    fun updatePlaybackState(isPlaying: Boolean, positionMs: Long) {
        this.isPlaying = isPlaying
        this.positionMs = positionMs
        service?.updatePlaybackState(isPlaying, positionMs)
    }

    fun updateLiked(isLiked: Boolean) {
        this.isLiked = isLiked
        service?.updateLiked(isLiked)
    }

    fun commandWebPlayer(command: String) = send(command, 0L)

    fun commandWebPlayerSeek(positionMs: Long) = send("seek", positionMs)

    private fun send(command: String, position: Long) {
        val proxy = replyProxy ?: return
        val payload = JSONObject().put("command", command).put("position", position).toString()
        try {
            proxy.postMessage(payload)
        } catch (e: Exception) {
            // Page is gone / navigating; the next message from the page re-attaches a fresh proxy.
        }
    }
}
