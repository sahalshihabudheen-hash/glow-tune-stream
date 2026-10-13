package com.nyra.pulse

import android.Manifest
import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Message
import android.os.PowerManager
import android.provider.Settings
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.RenderProcessGoneDetail
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject

/**
 * The whole app: one full-screen WebView showing the NYRA website, plus the native bits a plain
 * browser tab can't do (background audio service + lock-screen controls, file saving, back button,
 * external links, offline page, fullscreen video).
 */
class MainActivity : AppCompatActivity() {

    private val siteUri: Uri = Uri.parse(BuildConfig.SITE_URL)

    private lateinit var root: FrameLayout
    private lateinit var webView: WebView
    private var webViewDestroyed = false

    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null

    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingMicRequest: PermissionRequest? = null

    /** Splash screen stays up until the site paints its first frame (or 4 s, whichever is first). */
    private var pageReady = false

    private var isForeground = false
    private var batteryTipChecked = false

    private val saver by lazy { DownloadSaver(this) }
    private val helperScript: String by lazy {
        assets.open("nyra-helpers.js").bufferedReader().use { it.readText() }
    }

    // ---- Activity result launchers --------------------------------------------------------------

    private val notificationPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { /* best effort */ }

    private val micPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            val request = pendingMicRequest
            pendingMicRequest = null
            if (granted) {
                request?.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
            } else {
                request?.deny()
            }
        }

    private val fileChooser =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val uris = WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
            fileCallback?.onReceiveValue(uris)
            fileCallback = null
        }

    // ---- Lifecycle ------------------------------------------------------------------------------

    override fun onCreate(savedInstanceState: Bundle?) {
        val splash = installSplashScreen()
        super.onCreate(savedInstanceState)
        splash.setKeepOnScreenCondition { !pageReady }

        val background = ContextCompat.getColor(this, R.color.nyra_bg)

        // Draw edge-to-edge; padding for status bar / nav bar / keyboard is applied below.
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }

        root = FrameLayout(this).apply { setBackgroundColor(background) }
        webView = WebView(this).apply {
            setBackgroundColor(background)
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
        }
        root.addView(webView)
        setContentView(root)

        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val types = WindowInsetsCompat.Type.systemBars() or
                WindowInsetsCompat.Type.displayCutout() or
                WindowInsetsCompat.Type.ime()
            val bars = insets.getInsets(types)
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }
        WindowCompat.getInsetsController(window, root).apply {
            isAppearanceLightStatusBars = false     // light icons on the dark site
            isAppearanceLightNavigationBars = false
        }

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        configureWebView()
        installWebBridge()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                when {
                    customView != null -> hideCustomView()
                    webView.canGoBack() -> webView.goBack()
                    // Keep the music going: send the app to the background instead of closing it.
                    else -> moveTaskToBack(true)
                }
            }
        })

        root.postDelayed({ pageReady = true }, 4000)

        requestNotificationPermission()
        startMediaService()

        val restored = savedInstanceState != null && webView.restoreState(savedInstanceState) != null
        if (!restored) webView.loadUrl(startUrl(intent))
    }

    override fun onResume() {
        super.onResume()
        isForeground = true
    }

    override fun onPause() {
        isForeground = false
        super.onPause()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val data = intent.data
        if (data != null && data.scheme == "https" && data.host == siteUri.host) {
            webView.loadUrl(data.toString())
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        if (!webViewDestroyed) {
            try {
                webView.saveState(outState)
            } catch (e: Exception) {
                // WebView already torn down
            }
        }
    }

    override fun onDestroy() {
        NyraMediaBridge.attachReplyProxy(null)
        destroyWebView()
        super.onDestroy()
    }

    private fun destroyWebView() {
        if (webViewDestroyed) return
        webViewDestroyed = true
        (webView.parent as? ViewGroup)?.removeView(webView)
        webView.destroy()
    }

    // ---- WebView setup --------------------------------------------------------------------------

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true) // needed for embedded YouTube players
        }

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false // auto-advance to the next track
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            allowFileAccess = false
            allowContentAccess = false
            setSupportMultipleWindows(true)
            javaScriptCanOpenWindowsAutomatically = true
            useWideViewPort = true
            loadWithOverviewMode = true
            userAgentString = "$userAgentString NyraApp/${BuildConfig.VERSION_NAME}"
        }

        webView.setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            handleDownload(url, userAgent, contentDisposition, mimeType)
        }

        webView.webViewClient = object : WebViewClient() {

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (!request.isForMainFrame) return false
                val uri = request.url
                if (isInternal(uri)) return false
                openExternal(uri)
                return true
            }

            override fun onPageCommitVisible(view: WebView, url: String?) {
                pageReady = true
            }

            override fun onPageFinished(view: WebView, url: String?) {
                pageReady = true
                val uri = url?.let { Uri.parse(it) }
                if (uri?.scheme == "https" && uri.host == siteUri.host) {
                    view.evaluateJavascript(helperScript, null)
                }
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (!request.isForMainFrame) return
                when (error.errorCode) {
                    WebViewClient.ERROR_HOST_LOOKUP,
                    WebViewClient.ERROR_CONNECT,
                    WebViewClient.ERROR_TIMEOUT,
                    WebViewClient.ERROR_IO -> {
                        pageReady = true
                        view.loadUrl(
                            "file:///android_asset/offline.html#retry=" + Uri.encode(request.url.toString())
                        )
                    }
                }
            }

            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                // The WebView's renderer crashed or was killed to free memory. Rebuild instead of crashing.
                destroyWebView()
                recreate()
                return true
            }
        }

        webView.webChromeClient = object : WebChromeClient() {

            override fun onShowFileChooser(
                view: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: WebChromeClient.FileChooserParams,
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                return try {
                    fileChooser.launch(params.createIntent())
                    true
                } catch (e: Exception) {
                    fileCallback = null
                    callback.onReceiveValue(null)
                    false
                }
            }

            // window.open() / target="_blank": same-site stays in the app, everything else opens in the browser.
            override fun onCreateWindow(
                view: WebView,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: Message,
            ): Boolean {
                val popup = WebView(this@MainActivity)
                var handled = false
                fun route(uri: Uri) {
                    if (handled) return
                    handled = true
                    if (isInternal(uri)) webView.loadUrl(uri.toString()) else openExternal(uri)
                    popup.post { popup.destroy() }
                }
                popup.webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(v: WebView, request: WebResourceRequest): Boolean {
                        route(request.url)
                        return true
                    }

                    override fun onPageStarted(v: WebView, url: String?, favicon: Bitmap?) {
                        if (!url.isNullOrEmpty() && url != "about:blank") route(Uri.parse(url))
                    }
                }
                (resultMsg.obj as WebView.WebViewTransport).webView = popup
                resultMsg.sendToTarget()
                return true
            }

            // Only the site itself may use the microphone (admin voice recorder), and only if the user allows it.
            override fun onPermissionRequest(request: PermissionRequest) {
                val fromSite = request.origin.scheme == "https" && request.origin.host == siteUri.host
                val micOnly = request.resources.isNotEmpty() &&
                    request.resources.all { it == PermissionRequest.RESOURCE_AUDIO_CAPTURE }
                if (!fromSite || !micOnly) {
                    request.deny()
                    return
                }
                if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.RECORD_AUDIO)
                    == PackageManager.PERMISSION_GRANTED
                ) {
                    request.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
                } else {
                    pendingMicRequest?.deny()
                    pendingMicRequest = request
                    micPermission.launch(Manifest.permission.RECORD_AUDIO)
                }
            }

            override fun onShowCustomView(view: View, callback: WebChromeClient.CustomViewCallback) {
                if (customView != null) {
                    callback.onCustomViewHidden()
                    return
                }
                customView = view
                customViewCallback = callback
                root.addView(
                    view,
                    FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT,
                    ),
                )
                webView.visibility = View.INVISIBLE
                applyImmersiveMode(true)
            }

            override fun onHideCustomView() = hideCustomView()

            // Avoids the default grey placeholder (and a null-poster crash on some devices).
            override fun getDefaultVideoPoster(): Bitmap =
                Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888)
        }
    }

    // ---- Web <-> native bridge ------------------------------------------------------------------

    /**
     * Exposes `window.NyraAndroid` to the page. Unlike addJavascriptInterface, a WebMessageListener
     * is limited to the listed origin, so ads or embedded third-party frames can't call into the app.
     */
    private fun installWebBridge() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return
        val origin = "https://${siteUri.host}"
        try {
            WebViewCompat.addWebMessageListener(webView, "NyraAndroid", setOf(origin)) {
                _, message, _, _, replyProxy ->
                val text = message.data
                if (text != null) handleWebMessage(text, replyProxy)
            }
        } catch (e: Exception) {
            // Bridge unavailable: the site still works as a normal web app, just without system media controls.
        }
    }

    private fun handleWebMessage(raw: String, proxy: JavaScriptReplyProxy) {
        NyraMediaBridge.attachReplyProxy(proxy)
        val json = try {
            JSONObject(raw)
        } catch (e: Exception) {
            return
        }
        when (json.optString("type")) {
            "track" -> NyraMediaBridge.updateTrack(
                json.optString("title", "NYRA"),
                json.optString("artist", ""),
                json.optString("artwork", ""),
                json.optLong("duration", 0L),
            )
            "playback" -> {
                val playing = json.optBoolean("isPlaying", false)
                NyraMediaBridge.updatePlaybackState(playing, json.optLong("position", 0L))
                if (playing) maybeShowBatteryTip()
            }
            "liked" -> NyraMediaBridge.updateLiked(json.optBoolean("value", false))
            "fileStart" -> saver.start(
                json.optString("id"),
                json.optString("name", "nyra-download"),
                json.optString("mime", "application/octet-stream"),
            )
            "fileChunk" -> saver.chunk(json.optString("id"), json.optString("data"))
            "fileEnd" -> saver.end(json.optString("id"))
            "fileError" -> Toast.makeText(this, "Download failed", Toast.LENGTH_SHORT).show()
            // "hello": nothing to do, attaching the reply proxy above is the whole point.
        }
    }

    // ---- Helpers --------------------------------------------------------------------------------

    private fun startUrl(intent: Intent?): String {
        val data = intent?.data
        return if (data != null && data.scheme == "https" && data.host == siteUri.host) {
            data.toString()
        } else {
            BuildConfig.SITE_URL
        }
    }

    private fun isInternal(uri: Uri): Boolean = when (uri.scheme) {
        "https" -> uri.host == siteUri.host
        "file" -> uri.toString().startsWith("file:///android_asset/")
        "about", "blob", "data" -> true
        else -> false
    }

    private fun openExternal(uri: Uri) {
        val scheme = uri.scheme?.lowercase()
        if (scheme != "http" && scheme != "https" && scheme != "mailto" && scheme != "tel") return
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE))
        } catch (e: ActivityNotFoundException) {
            Toast.makeText(this, "No app found to open this link", Toast.LENGTH_SHORT).show()
        }
    }

    private fun handleDownload(url: String, userAgent: String?, contentDisposition: String?, mimeType: String?) {
        val fileName = URLUtil.guessFileName(url, contentDisposition, mimeType)
        when {
            url.startsWith("blob:") -> {
                val safeUrl = url.replace("\\", "\\\\").replace("'", "\\'")
                val safeName = fileName.replace("\\", "\\\\").replace("'", "\\'")
                webView.evaluateJavascript(
                    "window.__nyraSaveBlob && window.__nyraSaveBlob('$safeUrl', '$safeName')",
                    null,
                )
            }
            url.startsWith("http") -> {
                try {
                    val request = DownloadManager.Request(Uri.parse(url)).apply {
                        setMimeType(mimeType)
                        if (userAgent != null) addRequestHeader("User-Agent", userAgent)
                        CookieManager.getInstance().getCookie(url)?.let { addRequestHeader("Cookie", it) }
                        setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                        setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
                    }
                    getSystemService(DownloadManager::class.java).enqueue(request)
                    Toast.makeText(this, "Downloading $fileName", Toast.LENGTH_SHORT).show()
                } catch (e: Exception) {
                    Toast.makeText(this, "Couldn't start download", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun hideCustomView() {
        val view = customView ?: return
        root.removeView(view)
        customView = null
        customViewCallback?.onCustomViewHidden()
        customViewCallback = null
        webView.visibility = View.VISIBLE
        applyImmersiveMode(false)
    }

    private fun applyImmersiveMode(on: Boolean) {
        val controller = WindowCompat.getInsetsController(window, root)
        if (on) {
            controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            controller.hide(WindowInsetsCompat.Type.systemBars())
        } else {
            controller.show(WindowInsetsCompat.Type.systemBars())
        }
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    /**
     * Some phones (especially Xiaomi, Oppo, Vivo, Samsung) stop background music to save battery.
     * The first time a song plays, point the user to the one setting that prevents it.
     */
    private fun maybeShowBatteryTip() {
        if (batteryTipChecked || !isForeground || isFinishing || isDestroyed) return
        batteryTipChecked = true

        val prefs = getSharedPreferences("nyra", MODE_PRIVATE)
        if (prefs.getBoolean("battery_tip_shown", false)) return
        val powerManager = getSystemService(PowerManager::class.java)
        if (powerManager?.isIgnoringBatteryOptimizations(packageName) == true) return
        prefs.edit().putBoolean("battery_tip_shown", true).apply()

        AlertDialog.Builder(this)
            .setTitle(R.string.battery_tip_title)
            .setMessage(R.string.battery_tip_message)
            .setPositiveButton(R.string.battery_tip_open) { _, _ ->
                try {
                    startActivity(
                        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName"))
                    )
                } catch (e: Exception) {
                    // No settings screen to open; nothing else to do.
                }
            }
            .setNegativeButton(R.string.battery_tip_later, null)
            .show()
    }

    private fun startMediaService() {
        try {
            startService(Intent(this, NyraMediaService::class.java))
        } catch (e: Exception) {
            // Not allowed to start right now; Media3 will bind it when playback starts.
        }
    }
}
