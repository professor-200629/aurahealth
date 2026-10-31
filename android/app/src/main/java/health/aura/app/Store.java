package health.aura.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.UUID;

/** Small settings and the event queue, kept in Android's private app storage (not encrypted, on this phone only). */
final class Store {
    private static final String PREFS = "aura";
    private static final Object LOCK = new Object();

    private Store() {}

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static String contactsJson(Context c) {
        return prefs(c).getString("contacts", "{\"neighbour\":{\"name\":\"\",\"number\":\"\"},\"family\":{\"name\":\"\",\"number\":\"\"}}");
    }

    static void saveContacts(Context c, String json) {
        try {
            new JSONObject(json);  // only store valid JSON
            prefs(c).edit().putString("contacts", json).apply();
        } catch (JSONException ignored) {
        }
    }

    static String[] contact(Context c, String role) {
        try {
            JSONObject o = new JSONObject(contactsJson(c)).optJSONObject(role);
            if (o == null) return new String[] {"", ""};
            return new String[] {o.optString("name", ""), o.optString("number", "").replaceAll("[^0-9+]", "")};
        } catch (JSONException e) {
            return new String[] {"", ""};
        }
    }

    static boolean guardOn(Context c) {
        return prefs(c).getBoolean("guard_on", false);
    }

    static void setGuardOn(Context c, boolean on) {
        prefs(c).edit().putBoolean("guard_on", on).apply();
    }

    /** Morning check: if there is no "Good morning" by this time (minutes after midnight), the alert runs. */
    static boolean morningOn(Context c) {
        return prefs(c).getBoolean("morning_on", true);
    }

    static int morningMinutes(Context c) {
        return prefs(c).getInt("morning_minutes", 9 * 60);
    }

    static void setMorning(Context c, boolean on, int minutes) {
        prefs(c).edit().putBoolean("morning_on", on).putInt("morning_minutes", Math.max(0, Math.min(minutes, 24 * 60 - 1))).apply();
    }

    static long lastMorningAt(Context c) {
        return prefs(c).getLong("last_morning_at", 0);
    }

    static void setLastMorningAt(Context c, long when) {
        prefs(c).edit().putLong("last_morning_at", when).apply();
    }

    static String hubUrl(Context c) {
        return prefs(c).getString("hub_url", "");
    }

    static String hubCode(Context c) {
        return prefs(c).getString("hub_code", "");
    }

    static void setHub(Context c, String url, String code) {
        prefs(c).edit().putString("hub_url", url.trim().replaceAll("/+$", "")).putString("hub_code", code.trim()).apply();
    }

    /** The web page's own queue of first-aid steps (it owns this list). */
    static String queue(Context c) {
        return prefs(c).getString("queue", "[]");
    }

    static void setQueue(Context c, String json) {
        prefs(c).edit().putString("queue", json).apply();
    }

    /** Record an event raised by Android itself (night guard), for the page to collect with drainEvents(). */
    static void addEvent(Context c, String kind, String role) {
        synchronized (LOCK) {
            try {
                JSONArray list = new JSONArray(prefs(c).getString("native_events", "[]"));
                JSONObject e = new JSONObject();
                e.put("id", "n" + UUID.randomUUID().toString().replace("-", "").substring(0, 20));
                e.put("kind", kind);
                if (role != null) e.put("role", role);
                e.put("at", isoNow());
                list.put(e);
                prefs(c).edit().putString("native_events", list.toString()).apply();
            } catch (JSONException ignored) {
            }
        }
    }

    static String drainEvents(Context c) {
        synchronized (LOCK) {
            String all = prefs(c).getString("native_events", "[]");
            prefs(c).edit().putString("native_events", "[]").apply();
            return all;
        }
    }

    static String isoNow() {
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        f.setTimeZone(TimeZone.getTimeZone("UTC"));
        return f.format(new Date());
    }
}
