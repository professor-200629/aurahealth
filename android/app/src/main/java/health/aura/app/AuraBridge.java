package health.aura.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.webkit.JavascriptInterface;

import org.json.JSONException;
import org.json.JSONObject;

/** What the web page may ask Android to do. Exposed to the page as window.AuraNative. */
final class AuraBridge {
    private final MainActivity activity;

    AuraBridge(MainActivity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public boolean isNative() {
        return true;
    }

    @JavascriptInterface
    public void speak(String text) {
        activity.runOnUiThread(() -> activity.speak(text));
    }

    @JavascriptInterface
    public void stopSpeaking() {
        activity.runOnUiThread(activity::stopSpeaking);
    }

    @JavascriptInterface
    public String getContacts() {
        return Store.contactsJson(activity);
    }

    @JavascriptInterface
    public void saveContacts(String json) {
        Store.saveContacts(activity, json);
    }

    @JavascriptInterface
    public String startGuard() {
        if (activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            activity.runOnUiThread(activity::askPermissions);
            return "{\"ok\":false,\"reason\":\"microphone\"}";
        }
        activity.runOnUiThread(() -> GuardService.send(activity, GuardService.START));
        return "{\"ok\":true}";
    }

    @JavascriptInterface
    public void stopGuard() {
        activity.runOnUiThread(() -> GuardService.send(activity, GuardService.STOP));
    }

    @JavascriptInterface
    public String guardStatus() {
        try {
            JSONObject perms = new JSONObject();
            perms.put("mic", granted(Manifest.permission.RECORD_AUDIO));
            perms.put("call", granted(Manifest.permission.CALL_PHONE));
            perms.put("sms", granted(Manifest.permission.SEND_SMS));
            perms.put("notify", Build.VERSION.SDK_INT < 33 || granted(Manifest.permission.POST_NOTIFICATIONS));
            perms.put("fullscreen", activity.canFullScreen());
            JSONObject o = new JSONObject();
            o.put("on", Store.guardOn(activity) && GuardService.instance != null);
            o.put("alert", GuardService.isAlertActive());
            o.put("permissions", perms);
            o.put("batteryOptimised", activity.batteryOptimised());
            return o.toString();
        } catch (JSONException e) {
            return "{}";
        }
    }

    private boolean granted(String p) {
        return activity.checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED;
    }

    @JavascriptInterface
    public String getMorning() {
        int m = Store.morningMinutes(activity);
        try {
            return new JSONObject().put("on", Store.morningOn(activity))
                    .put("time", String.format(java.util.Locale.US, "%02d:%02d", m / 60, m % 60)).toString();
        } catch (JSONException e) {
            return "{}";
        }
    }

    @JavascriptInterface
    public void setMorning(boolean on, String hhmm) {
        try {
            String[] p = hhmm.split(":");
            Store.setMorning(activity, on, Integer.parseInt(p[0]) * 60 + Integer.parseInt(p[1]));
        } catch (RuntimeException ignored) {
            return;
        }
        GuardService s = GuardService.instance;
        if (s != null) activity.runOnUiThread(s::armMorning);
    }

    /** A check-in tapped on the page. "Good morning" stops the morning check for today. */
    @JavascriptInterface
    public void checkIn(String kind) {
        if ("checkin_morning".equals(kind)) Store.setLastMorningAt(activity, System.currentTimeMillis());
    }

    @JavascriptInterface
    public void cancelAlert() {
        activity.runOnUiThread(() -> GuardService.send(activity, GuardService.CANCEL));
    }

    @JavascriptInterface
    public void testAlert() {
        activity.runOnUiThread(() -> GuardService.send(activity, GuardService.TEST));
    }

    /** Runs the morning check about a minute from now, as a test: the real timing, the alarm, no call or text. */
    @JavascriptInterface
    public String testMorning() {
        if (GuardService.instance == null || !Store.guardOn(activity)) return "{\"ok\":false,\"reason\":\"guard_off\"}";
        activity.runOnUiThread(() -> GuardService.send(activity, GuardService.TEST_MORNING));
        return "{\"ok\":true}";
    }

    @JavascriptInterface
    public void requestPermissions() {
        activity.runOnUiThread(activity::askPermissions);
    }

    @JavascriptInterface
    public void openBatterySettings() {
        activity.runOnUiThread(activity::openBatterySettings);
    }

    @JavascriptInterface
    public String getQueue() {
        return Store.queue(activity);
    }

    @JavascriptInterface
    public void setQueue(String json) {
        Store.setQueue(activity, json);
    }

    @JavascriptInterface
    public String drainEvents() {
        return Store.drainEvents(activity);
    }

    @JavascriptInterface
    public String getHub() {
        try {
            return new JSONObject().put("url", Store.hubUrl(activity)).put("code", Store.hubCode(activity)).toString();
        } catch (JSONException e) {
            return "{}";
        }
    }

    @JavascriptInterface
    public void setHub(String url, String code) {
        Store.setHub(activity, url, code);
        activity.runOnUiThread(activity::loadBest);
    }
}
