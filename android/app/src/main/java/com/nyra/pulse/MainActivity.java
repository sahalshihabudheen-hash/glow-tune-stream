package com.nyra.pulse;

import android.content.Intent;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(NyraMediaPlugin.class);
        super.onCreate(savedInstanceState);
        // Keep the Media3 session bound to the app process. Media3 promotes the
        // service while playback is active, preserving notification/lock-screen
        // controls and audio when the WebView is backgrounded.
        startService(new Intent(this, NyraMediaService.class));
    }
}
