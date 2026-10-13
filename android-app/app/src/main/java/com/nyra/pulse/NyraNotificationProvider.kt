package com.nyra.pulse

import android.content.Context
import android.os.Bundle
import androidx.core.content.ContextCompat
import androidx.media3.session.CommandButton
import androidx.media3.session.DefaultMediaNotificationProvider
import androidx.media3.session.MediaNotification
import androidx.media3.session.MediaSession
import com.google.common.collect.ImmutableList

/**
 * NYRA's "now playing" notification. Media3's default notification already shows the artwork,
 * title, artist, a seek bar and previous / play-pause / next. On top of that we give it:
 *  - the NYRA treble-clef status-bar icon
 *  - the logo's coral accent (tints the icon and app name)
 *  - a "NYRA now playing" channel name in the system notification settings
 * plus the heart button supplied by NyraMediaService's custom layout.
 *
 * Media3 makes DefaultMediaNotificationProvider.createNotification final, so we wrap it instead of subclassing.
 */
class NyraNotificationProvider(context: Context) : MediaNotification.Provider {

    private val accent = ContextCompat.getColor(context, R.color.nyra_accent)

    private val delegate = DefaultMediaNotificationProvider.Builder(context)
        .setChannelName(R.string.notification_channel_name)
        .build()
        .also { it.setSmallIcon(R.drawable.ic_stat_nyra) }

    override fun createNotification(
        mediaSession: MediaSession,
        mediaButtonPreferences: ImmutableList<CommandButton>,
        actionFactory: MediaNotification.ActionFactory,
        onNotificationChangedCallback: MediaNotification.Provider.Callback,
    ): MediaNotification {
        val result = delegate.createNotification(
            mediaSession,
            mediaButtonPreferences,
            actionFactory,
            onNotificationChangedCallback,
        )
        result.notification.color = accent
        return result
    }

    override fun handleCustomCommand(session: MediaSession, action: String, extras: Bundle): Boolean =
        delegate.handleCustomCommand(session, action, extras)
}
