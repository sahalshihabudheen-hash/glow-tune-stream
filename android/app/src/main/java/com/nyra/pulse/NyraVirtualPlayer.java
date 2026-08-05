package com.nyra.pulse;

import android.net.Uri;
import android.os.Looper;
import androidx.annotation.Nullable;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.Player;
import androidx.media3.common.SimpleBasePlayer;
import com.google.common.collect.ImmutableList;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;

public class NyraVirtualPlayer extends SimpleBasePlayer {

    private State currentState;

    public NyraVirtualPlayer() {
        super(Looper.getMainLooper());
        currentState = new State.Builder()
                .setAvailableCommands(new Player.Commands.Builder()
                        .addAll(
                            Player.COMMAND_PLAY_PAUSE,
                            Player.COMMAND_SEEK_TO_NEXT,
                            Player.COMMAND_SEEK_TO_PREVIOUS,
                            Player.COMMAND_GET_CURRENT_MEDIA_ITEM,
                            Player.COMMAND_GET_TIMELINE
                        ).build())
                .setPlaybackState(Player.STATE_IDLE)
                .build();
    }

    @Override
    protected State getState() { return currentState; }

    public void updateTrack(String title, String artist, @Nullable String artworkUrl, long durationMs) {
        MediaMetadata.Builder meta = new MediaMetadata.Builder()
                .setTitle(title)
                .setArtist(artist)
                .setIsBrowsable(false)
                .setIsPlayable(true);
        if (artworkUrl != null && !artworkUrl.isEmpty()) {
            meta.setArtworkUri(Uri.parse(artworkUrl));
        }
        MediaItem item = new MediaItem.Builder()
                .setMediaId("nyra_now")
                .setMediaMetadata(meta.build())
                .build();
        currentState = currentState.buildUpon()
                .setPlaylist(ImmutableList.of(
                        new MediaItemData.Builder("nyra_now")
                                .setMediaItem(item)
                                .setDurationUs(durationMs > 0 ? durationMs * 1000L : C.TIME_UNSET)
                                .setIsSeekable(true)
                                .build()))
                .setCurrentMediaItemIndex(0)
                .setPlaybackState(Player.STATE_READY)
                .build();
        invalidateState();
    }

    public void updatePlaybackState(boolean isPlaying, long positionMs) {
        if (currentState.playlist.isEmpty()) return;
        currentState = currentState.buildUpon()
                .setPlayWhenReady(isPlaying, Player.PLAY_WHEN_READY_CHANGE_REASON_REMOTE)
                .setContentPositionMs(PositionSupplier.getConstant(positionMs))
                .build();
        invalidateState();
    }

    @Override
    protected ListenableFuture<?> handleSetPlayWhenReady(boolean playWhenReady) {
        NyraMediaBridge.getInstance().commandWebPlayer(playWhenReady ? "play" : "pause");
        return Futures.immediateVoidFuture();
    }

    @Override
    protected ListenableFuture<?> handleSeek(int mediaItemIndex, long positionMs, int seekCommand) {
        if (seekCommand == Player.COMMAND_SEEK_TO_NEXT
                || seekCommand == Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM) {
            NyraMediaBridge.getInstance().commandWebPlayer("next");
        } else if (seekCommand == Player.COMMAND_SEEK_TO_PREVIOUS
                || seekCommand == Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM) {
            NyraMediaBridge.getInstance().commandWebPlayer("previous");
        } else {
            NyraMediaBridge.getInstance().commandWebPlayerSeek(positionMs);
        }
        return Futures.immediateVoidFuture();
    }

    @Override
    protected ListenableFuture<?> handlePrepare() {
        return Futures.immediateVoidFuture();
    }
}
