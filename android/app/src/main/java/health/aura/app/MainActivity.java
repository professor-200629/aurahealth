package health.aura.app;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONException;
import org.json.JSONObject;

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
    private static final int PICK_FILE = 41;
    private android.webkit.ValueCallback<Uri[]> fileCallback;
    static final String LOCAL_HOST = "appassets.aura";
    static final String LOCAL = "https://" + LOCAL_HOST + "/";
    private static volatile MainActivity current;

    WebView web;
    TextToSpeech tts;
    private boolean ttsReady = false;
    private boolean triedPairing = false;
    private String loadedHub = "";
    private SpeechRecognizer recognizer;
    private boolean locationWanted = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        current = this;
        showOverLockScreenIfAlert(getIntent());
        rememberOpen(getIntent());
        getWindow().setStatusBarColor(Color.parseColor("#f6f4ef"));

        web = new WebView(this);
        setContentView(web);
        WebSettings s = web.getSettings();
        // Follow the phone's font size, up to a point where the screens still fit.
        s.setTextZoom(Math.round(Math.min(getResources().getConfiguration().fontScale, 1.3f) * 100));
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.addJavascriptInterface(new AuraBridge(this), "AuraNative");
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, android.webkit.ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), PICK_FILE);
                    return true;
                } catch (android.content.ActivityNotFoundException e) {
                    fileCallback = null;
                    return false;
                }
            }
        });
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
        Meds.run(this);  // sets the medicine alarm again, in case Android dropped it
    }

    /** Show the bundled copy at once, so the app never opens on a blank page. If the laptop answers, switch to its copy. */
    void loadBest() {
        loadLocal();
        String hub = Store.hubUrl(this);
        if (hub.isEmpty()) return;
        new Thread(() -> {
            boolean up = reachable(hub);
            runOnUiThread(() -> {
                if (up) {
                    loadedHub = hub;
                    triedPairing = true;
                    web.loadUrl(hub + "/pair?code=" + Uri.encode(Store.hubCode(this)));
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
                try {
                    startActivity(new Intent(Intent.ACTION_DIAL, url));
                } catch (android.content.ActivityNotFoundException e) {
                    android.widget.Toast.makeText(MainActivity.this, url.getSchemeSpecificPart(), android.widget.Toast.LENGTH_LONG).show();
                }
                return true;
            }
            String host = url.getHost() == null ? "" : url.getHost();
            boolean ours = host.equals(LOCAL_HOST) || (!loadedHub.isEmpty() && loadedHub.contains("//" + host));
            if (!ours) {
                openOutside(url);  // other sites and map links open in the normal browser or Maps
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

    private void openOutside(Uri url) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, url));
        } catch (ActivityNotFoundException e) {
            sendToWeb("{\"type\":\"toast\",\"key\":\"nearby.noApp\"}");
        }
    }

    // ---------- called by the bridge ----------

    void speak(String text) {
        if (ttsReady) tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "aura");
    }

    void stopSpeaking() {
        if (ttsReady) tts.stop();
    }

    // ---------- location, sharing and maps ----------

    /** Ask for a fresh location; the answer comes back to the page as a "location" event. */
    void sendLocation() {
        if (!Locator.allowed(this)) {
            locationWanted = true;
            requestPermissions(new String[] {Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, 8);
            return;
        }
        if (!Locator.enabled(this)) {
            sendToWeb("{\"type\":\"location\",\"ok\":false,\"reason\":\"off\"}");
            return;
        }
        Locator.current(this, 15_000, l -> {
            JSONObject o = new JSONObject();
            try {
                o.put("type", "location").put("ok", l != null);
                if (l == null) o.put("reason", "unknown");
                else o.put("lat", l.getLatitude()).put("lng", l.getLongitude()).put("accuracy", Math.round(l.getAccuracy()))
                        .put("at", l.getTime()).put("link", Locator.mapsLink(l));
            } catch (JSONException ignored) {
            }
            sendToWeb(o.toString());
        });
    }

    void askLocationPermission() {
        requestPermissions(new String[] {Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, 8);
    }

    void share(String text) {
        Intent send = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text);
        try {
            startActivity(Intent.createChooser(send, "Share"));
        } catch (ActivityNotFoundException ignored) {
        }
    }

    /** Opens the phone's map app searching near here, for example for "hospital" or "pharmacy". Needs internet. */
    void openMaps(String query) {
        android.location.Location l = Locator.last(this);
        String at = l == null ? "0,0" : String.format(Locale.US, "%.6f,%.6f", l.getLatitude(), l.getLongitude());
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("geo:" + at + "?q=" + Uri.encode(query))));
        } catch (ActivityNotFoundException e) {
            openOutside(Uri.parse("https://www.google.com/maps/search/?api=1&query=" + Uri.encode(query)));
        }
    }

    // ---------- voice input ----------

    boolean canListen() {
        return SpeechRecognizer.isRecognitionAvailable(this);
    }

    /** Push-to-talk: the phone's own speech recognizer turns speech into text; results go to the page. */
    void startVoice() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] {Manifest.permission.RECORD_AUDIO}, 9);
            voiceEvent("error", "", "permission");
            return;
        }
        if (!canListen()) {
            voiceEvent("error", "", "unavailable");
            return;
        }
        stopSpeaking();
        if (recognizer == null) {
            recognizer = SpeechRecognizer.createSpeechRecognizer(this);
            recognizer.setRecognitionListener(new VoiceListener());
        }
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-IN")
                .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        recognizer.startListening(i);
    }

    void stopVoice() {
        if (recognizer != null) recognizer.stopListening();
    }

    private static void voiceEvent(String stage, String text, String error) {
        JSONObject o = new JSONObject();
        try {
            o.put("type", "voice").put("stage", stage).put("text", text);
            if (error != null) o.put("error", error);
        } catch (JSONException ignored) {
        }
        sendToWeb(o.toString());
    }

    private static String firstResult(Bundle b) {
        ArrayList<String> r = b == null ? null : b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        return r == null || r.isEmpty() ? "" : r.get(0);
    }

    private static class VoiceListener implements RecognitionListener {
        @Override public void onReadyForSpeech(Bundle params) { voiceEvent("listening", "", null); }
        @Override public void onBeginningOfSpeech() {}
        @Override public void onRmsChanged(float rmsdB) {}
        @Override public void onBufferReceived(byte[] buffer) {}
        @Override public void onEndOfSpeech() { voiceEvent("processing", "", null); }
        @Override public void onPartialResults(Bundle partial) { voiceEvent("partial", firstResult(partial), null); }
        @Override public void onEvent(int eventType, Bundle params) {}
        @Override public void onResults(Bundle results) { voiceEvent("final", firstResult(results), null); }

        @Override
        public void onError(int error) {
            String name;
            switch (error) {
                case SpeechRecognizer.ERROR_NO_MATCH: name = "no_match"; break;
                case SpeechRecognizer.ERROR_SPEECH_TIMEOUT: name = "silence"; break;
                case SpeechRecognizer.ERROR_NETWORK:
                case SpeechRecognizer.ERROR_NETWORK_TIMEOUT: name = "network"; break;
                case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: name = "permission"; break;
                case SpeechRecognizer.ERROR_AUDIO: name = "audio"; break;
                case SpeechRecognizer.ERROR_RECOGNIZER_BUSY: name = "busy"; break;
                default: name = "other";
            }
            voiceEvent("error", "", name);
        }
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
        if (requestCode == 8) {
            if (locationWanted && Locator.allowed(this)) sendLocation();
            else if (locationWanted) sendToWeb("{\"type\":\"location\",\"ok\":false,\"reason\":\"permission\"}");
            locationWanted = false;
            return;
        }
        if (requestCode == 9) return;
        if (!canFullScreen()) askPermissions();
    }

    /** Push an event to the page (night guard state, alert countdown, knock meter). */
    static void sendToWeb(String json) {
        MainActivity a = current;
        if (a == null || a.web == null) return;
        a.runOnUiThread(() -> a.web.evaluateJavascript("window.auraNativeEvent&&window.auraNativeEvent(" + json + ")", null));
    }

    /** A notification asked for a screen (for example the medicines): the page opens it when it is ready. */
    private void rememberOpen(Intent intent) {
        String open = intent == null ? null : intent.getStringExtra("open");
        if (open == null || !open.matches("[a-z]{1,20}")) return;
        Store.setOpen(this, open);
        sendToWeb("{\"type\":\"open\",\"screen\":\"" + open + "\"}");
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
        rememberOpen(intent);
    }

    @Override
    protected void onResume() {
        super.onResume();
        current = this;
        sendToWeb("{\"type\":\"queue\"}");
        sendToWeb("{\"type\":\"guard\",\"on\":" + Store.guardOn(this) + "}");
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == PICK_FILE && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileCallback = null;
        }
    }

    @Override
    public void onBackPressed() {
        // An open menu or sheet closes first; then back one screen; then out of the app.
        web.evaluateJavascript("window.auraBack ? window.auraBack() : false", closed -> {
            if ("true".equals(closed)) return;
            if (web.canGoBack()) web.goBack();
            else super.onBackPressed();
        });
    }

    @Override
    protected void onDestroy() {
        if (current == this) current = null;
        if (tts != null) tts.shutdown();
        if (recognizer != null) recognizer.destroy();
        web.destroy();
        super.onDestroy();
    }
}
