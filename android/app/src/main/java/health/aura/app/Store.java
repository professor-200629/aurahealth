package health.aura.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
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

    /**
     * The household: people (name, age, health notes), contacts and medicine reminders. Kept on this phone only;
     * the page edits it as one JSON document. Before the first save it is built from the two old guard contacts.
     */
    static String household(Context c) {
        String saved = prefs(c).getString("household", null);
        if (saved != null) return saved;
        try {
            JSONObject h = new JSONObject().put("version", 1).put("country", "IN")
                    .put("people", new JSONArray()).put("meds", new JSONArray());
            JSONArray list = new JSONArray();
            JSONObject old = new JSONObject(contactsJson(c));
            addOld(list, old.optJSONObject("neighbour"), "c-neighbour", "Neighbour", true, false);
            addOld(list, old.optJSONObject("family"), "c-family", "Family", false, true);
            return h.put("contacts", list).toString();
        } catch (JSONException e) {
            return "{\"version\":1,\"country\":\"IN\",\"people\":[],\"contacts\":[],\"meds\":[]}";
        }
    }

    private static void addOld(JSONArray list, JSONObject o, String id, String relation, boolean call, boolean text) throws JSONException {
        if (o == null || (o.optString("name").isEmpty() && o.optString("number").isEmpty())) return;
        list.put(new JSONObject().put("id", id).put("name", o.optString("name")).put("number", o.optString("number"))
                .put("relation", relation).put("call", call).put("text", text).put("guardian", text));
    }

    static boolean saveHousehold(Context c, String json) {
        try {
            JSONObject h = new JSONObject(json);  // only store valid JSON
            if (h.optJSONArray("people") == null || h.optJSONArray("contacts") == null || h.optJSONArray("meds") == null) return false;
            prefs(c).edit().putString("household", h.toString()).commit();
            return true;
        } catch (JSONException e) {
            return false;
        }
    }

    static JSONObject householdObject(Context c) {
        try {
            return new JSONObject(household(c));
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    /** {name, number} of every contact with this flag set ("call", "text" or "guardian") that has a number. */
    static List<String[]> contactsWith(Context c, String flag) {
        List<String[]> out = new ArrayList<>();
        JSONArray list = householdObject(c).optJSONArray("contacts");
        if (list == null) return out;
        for (int i = 0; i < list.length(); i++) {
            JSONObject o = list.optJSONObject(i);
            if (o == null || !o.optBoolean(flag, false)) continue;
            String number = o.optString("number", "").replaceAll("[^0-9+]", "");
            if (!number.isEmpty()) out.add(new String[] {o.optString("name", ""), number});
        }
        return out;
    }

    /** The person marked as the main one (the person this phone looks after), or the first person. May be null. */
    static JSONObject mainPerson(Context c) {
        JSONArray people = householdObject(c).optJSONArray("people");
        if (people == null || people.length() == 0) return null;
        for (int i = 0; i < people.length(); i++) {
            JSONObject p = people.optJSONObject(i);
            if (p != null && p.optBoolean("main", false)) return p;
        }
        return people.optJSONObject(0);
    }

    static String personName(Context c, String id) {
        JSONArray people = householdObject(c).optJSONArray("people");
        if (people != null) {
            for (int i = 0; i < people.length(); i++) {
                JSONObject p = people.optJSONObject(i);
                if (p != null && p.optString("id").equals(id)) return p.optString("name", "");
            }
        }
        return "";
    }

    /** Medicine doses: what was due, and whether it was taken (written by Meds, read by the page). */
    static String doseLog(Context c) {
        return prefs(c).getString("dose_log", "[]");
    }

    static void setDoseLog(Context c, String json) {
        prefs(c).edit().putString("dose_log", json).commit();
    }

    static boolean locationInAlerts(Context c) {
        return prefs(c).getBoolean("location_in_alerts", true);
    }

    static void setLocationInAlerts(Context c, boolean on) {
        prefs(c).edit().putBoolean("location_in_alerts", on).apply();
    }

    /** A screen the page should open (for example, after tapping a medicine notification). Read once. */
    static String takeOpen(Context c) {
        String s = prefs(c).getString("open_screen", "");
        if (!s.isEmpty()) prefs(c).edit().remove("open_screen").apply();
        return s;
    }

    static void setOpen(Context c, String screen) {
        prefs(c).edit().putString("open_screen", screen).apply();
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
