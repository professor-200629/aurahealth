package health.aura.app;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Shows the AuraHealth web app. If the home laptop ("hub") is reachable, its copy is loaded, with the Meta
 * Llama helpers. Otherwise the copy bundled in this APK is used: first aid, the night guard and the time log
 * still work with no laptop and no internet. The JavaScript bridge "AuraNative" gives the page voice, calls,
 * texts and the night guard.
 */
public class MainActivity extends Activity {
    static final String LOCAL_HOST = "appassets.aura";
    static final String LOCAL = "https://" + LOCAL_HOST + "/";
    private static volatile MainActivity current;

    WebView web;
    TextToSpeech tts;
    private boolean ttsReady = false;
    private boolean triedPairing = false;
    private String loadedHub = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        current = this;
        showOverLockScreenIfAlert(getIntent());
        getWindow().setStatusBarColor(Color.parseColor("#f6f4ef"));

        web = new WebView(this);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.addJavascriptInterface(new AuraBridge(this), "AuraNative");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new Client());

        tts = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                int r = tts.setLanguage(new Locale("en", "IN"));
                if (r < 0) tts.setLanguage(Locale.ENGLISH);
                tts.setSpeechRate(0.95f);
                ttsReady = true;
            }
        });
        loadBest();
    }

    /** Load the laptop's copy if it answers within 2.5 s, otherwise the bundled copy. */
    void loadBest() {
        String hub = Store.hubUrl(this);
        if (hub.isEmpty()) {
            loadLocal();
            return;
        }
        new Thread(() -> {
            boolean up = reachable(hub);
            runOnUiThread(() -> {
                if (up) {
                    loadedHub = hub;
                    triedPairing = true;
                    web.loadUrl(hub + "/pair?code=" + Uri.encode(Store.hubCode(this)));
                } else {
                    loadLocal();
                }
            });
        }).start();
    }

    private void loadLocal() {
        loadedHub = "";
        web.loadUrl(LOCAL + "index.html");
    }

    private static boolean reachable(String hub) {
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(hub + "/api/health").openConnection();
            c.setConnectTimeout(2500);
            c.setReadTimeout(2500);
            int code = c.getResponseCode();  // 401 means it is there but wants pairing: still reachable
            c.disconnect();
            return code == 200 || code == 401;
        } catch (IOException e) {
            return false;
        }
    }

    private class Client extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            if (!LOCAL_HOST.equals(url.getHost())) return null;
            String path = url.getPath() == null ? "/" : url.getPath();
            if (path.startsWith("/api/")) {
                // Bundled mode has no laptop: answer like an unreachable server so the page shows that clearly.
                return new WebResourceResponse("application/json", "utf-8", 503, "Service Unavailable", null,
                        new ByteArrayInputStream("{\"detail\":\"The laptop is not connected.\"}".getBytes(StandardCharsets.UTF_8)));
            }
            String asset = "web" + (path.equals("/") || !path.contains(".") ? "/index.html" : path);
            try {
                InputStream in = getAssets().open(asset);
                return new WebResourceResponse(mime(asset), "utf-8", in);
            } catch (IOException e) {
                return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, new ByteArrayInputStream(new byte[0]));
            }
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            String scheme = url.getScheme() == null ? "" : url.getScheme();
            if (scheme.equals("tel")) {
                // Opens the dialer with the number filled in. It never calls by itself.
                startActivity(new Intent(Intent.ACTION_DIAL, url));
                return true;
            }
            String host = url.getHost() == null ? "" : url.getHost();
            boolean ours = host.equals(LOCAL_HOST) || (!loadedHub.isEmpty() && loadedHub.contains("//" + host));
            if (!ours) {
                startActivity(new Intent(Intent.ACTION_VIEW, url));  // other sites open in the normal browser
                return true;
            }
            return false;
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
            // The laptop restarted with a new pairing code that we don't have: fall back to the bundled copy.
            if (request.isForMainFrame() && response.getStatusCode() == 401 && triedPairing) {
                triedPairing = false;
                loadLocal();
            }
        }
    }

    private static String mime(String name) {
        if (name.endsWith(".html")) return "text/html";
        if (name.endsWith(".js")) return "application/javascript";
        if (name.endsWith(".css")) return "text/css";
        if (name.endsWith(".svg")) return "image/svg+xml";
        if (name.endsWith(".png")) return "image/png";
        if (name.endsWith(".json")) return "application/json";
        return "application/octet-stream";
    }

    // ---------- called by the bridge ----------

    void speak(String text) {
        if (ttsReady) tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "aura");
    }

    void stopSpeaking() {
        if (ttsReady) tts.stop();
    }

    String[] missingPermissions() {
        List<String> need = new ArrayList<>();
        need.add(Manifest.permission.RECORD_AUDIO);
        need.add(Manifest.permission.CALL_PHONE);
        need.add(Manifest.permission.SEND_SMS);
        if (Build.VERSION.SDK_INT >= 33) need.add(Manifest.permission.POST_NOTIFICATIONS);
        List<String> missing = new ArrayList<>();
        for (String p : need) if (checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) missing.add(p);
        return missing.toArray(new String[0]);
    }

    boolean canFullScreen() {
        if (Build.VERSION.SDK_INT < 34) return true;
        return getSystemService(NotificationManager.class).canUseFullScreenIntent();
    }

    boolean batteryOptimised() {
        return !getSystemService(PowerManager.class).isIgnoringBatteryOptimizations(getPackageName());
    }

    void askPermissions() {
        String[] missing = missingPermissions();
        if (missing.length > 0) requestPermissions(missing, 7);
        else if (!canFullScreen() && Build.VERSION.SDK_INT >= 34) {
            startActivity(new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:" + getPackageName())));
        }
    }

    void openBatterySettings() {
        startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getPackageName())));
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        sendToWeb("{\"type\":\"permissions\"}");
        if (!canFullScreen()) askPermissions();
    }

    /** Push an event to the page (night guard state, alert countdown, knock meter). */
    static void sendToWeb(String json) {
        MainActivity a = current;
        if (a == null || a.web == null) return;
        a.runOnUiThread(() -> a.web.evaluateJavascript("window.auraNativeEvent&&window.auraNativeEvent(" + json + ")", null));
    }

    private void showOverLockScreenIfAlert(Intent intent) {
        if (intent != null && intent.getBooleanExtra("alert", false)) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        showOverLockScreenIfAlert(intent);
    }

    @Override
    protected void onResume() {
        super.onResume();
        current = this;
        sendToWeb("{\"type\":\"queue\"}");
        sendToWeb("{\"type\":\"guard\",\"on\":" + Store.guardOn(this) + "}");
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (current == this) current = null;
        if (tts != null) tts.shutdown();
        web.destroy();
        super.onDestroy();
    }
}
