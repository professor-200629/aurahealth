package health.aura.app;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.telephony.SmsManager;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Medicine reminders, run by Android itself so they work with the app closed and no laptop. At each dose time a
 * notification asks the person to tap "Taken". If it is still not taken 10 minutes later the reminder is shown
 * again; if it is still not taken after the waiting time (30 minutes by default), every guardian is sent a text.
 * The doses and amounts are whatever the family typed in from the prescription: AuraHealth never suggests them.
 *
 * One alarm is kept: the next moment anything is due. When it fires, everything that is due is handled and the
 * alarm is set again.
 */
final class Meds {
    static final String ACTION_TICK = "health.aura.app.MED_TICK";
    static final String ACTION_TAKEN = "health.aura.app.MED_TAKEN";
    private static final String CH_MEDS = "meds";
    private static final long MINUTE = 60_000L;
    private static final long NUDGE_MS = 10 * MINUTE;
    private static final long LATE_LIMIT_MS = 60 * MINUTE;  // phone was off: doses older than this are not announced
    private static final long KEEP_MS = 3 * 24 * 60 * MINUTE;
    private static final Object LOCK = new Object();

    private Meds() {}

    /** Handle everything that is due now, then set the alarm for the next thing. Safe to call any time. */
    static void run(Context c) {
        synchronized (LOCK) {
            long now = System.currentTimeMillis();
            JSONArray log = load(c);
            try {
                if (process(c, log, now)) Store.setDoseLog(c, log.toString());
            } catch (JSONException e) {
                Log.w("AuraMeds", "dose log not updated: " + e.getMessage());
            }
            schedule(c, log, now);
        }
        MainActivity.sendToWeb("{\"type\":\"meds\"}");
    }

    private static boolean process(Context c, JSONArray log, long now) throws JSONException {
        boolean changed = false;
        long horizon = now + 5_000;  // an alarm may fire a moment early
        JSONArray meds = Store.householdObject(c).optJSONArray("meds");
        for (int i = 0; meds != null && i < meds.length(); i++) {
            JSONObject m = meds.optJSONObject(i);
            if (m == null || !m.optBoolean("on", true) || m.optString("name").trim().isEmpty()) continue;
            JSONArray times = m.optJSONArray("times");
            for (int j = 0; times != null && j < times.length(); j++) {
                int minutes = parseTime(times.optString(j));
                if (minutes < 0) continue;
                long due = latestDue(minutes, horizon);
                if (due < m.optLong("since", 0) || horizon - due > LATE_LIMIT_MS) continue;
                String key = m.optString("id") + "@" + due;
                if (find(log, key) != null) continue;
                JSONObject e = new JSONObject().put("key", key).put("med", m.optString("id")).put("name", m.optString("name").trim())
                        .put("dose", m.optString("dose").trim()).put("person", m.optString("person")).put("due", due)
                        .put("wait", clampWait(m.optInt("wait", 30))).put("status", "due");
                log.put(e);
                notifyDue(c, e, false);
                changed = true;
            }
        }
        Set<String> active = new HashSet<>();
        for (int i = 0; meds != null && i < meds.length(); i++) {
            JSONObject m = meds.optJSONObject(i);
            if (m != null && m.optBoolean("on", true)) active.add(m.optString("id"));
        }
        for (int k = log.length() - 1; k >= 0; k--) {
            // A reminder that was removed or paused while a dose was waiting: no repeat and no guardian text for it.
            JSONObject e = log.optJSONObject(k);
            String status = e == null ? "" : e.optString("status");
            if (e != null && !e.optBoolean("test") && ("due".equals(status) || "scheduled".equals(status))
                    && !active.contains(e.optString("med"))) {
                c.getSystemService(NotificationManager.class).cancel(notificationId(e.optString("key")));
                log.remove(k);
                changed = true;
            }
        }
        for (int k = 0; k < log.length(); k++) {
            JSONObject e = log.optJSONObject(k);
            if (e == null) continue;
            long due = e.optLong("due");
            if ("scheduled".equals(e.optString("status")) && due <= horizon) {
                e.put("status", "due");
                notifyDue(c, e, false);
                changed = true;
            }
            if (!"due".equals(e.optString("status"))) continue;
            long waitMs = e.optInt("wait", 30) * MINUTE;
            if (!e.optBoolean("nudged") && waitMs > NUDGE_MS && horizon >= due + NUDGE_MS && horizon < due + waitMs) {
                notifyDue(c, e, true);
                e.put("nudged", true);
                changed = true;
            }
            if (horizon >= due + waitMs) {
                int sent = textGuardians(c, e, false);
                e.put("status", "missed").put("missedAt", now).put("guardians", sent);
                notifyMissed(c, e, sent);
                changed = true;
            }
        }
        for (int k = log.length() - 1; k >= 0; k--) {
            JSONObject e = log.optJSONObject(k);
            if (e == null || e.optLong("due") < now - KEEP_MS) {
                log.remove(k);
                changed = true;
            }
        }
        return changed;
    }

    private static void schedule(Context c, JSONArray log, long now) {
        long next = Long.MAX_VALUE;
        JSONArray meds = Store.householdObject(c).optJSONArray("meds");
        for (int i = 0; meds != null && i < meds.length(); i++) {
            JSONObject m = meds.optJSONObject(i);
            if (m == null || !m.optBoolean("on", true) || m.optString("name").trim().isEmpty()) continue;
            JSONArray times = m.optJSONArray("times");
            for (int j = 0; times != null && j < times.length(); j++) {
                int minutes = parseTime(times.optString(j));
                if (minutes >= 0) next = Math.min(next, nextDue(minutes, now));
            }
        }
        for (int k = 0; k < log.length(); k++) {
            JSONObject e = log.optJSONObject(k);
            if (e == null) continue;
            long due = e.optLong("due");
            String status = e.optString("status");
            if ("scheduled".equals(status)) next = Math.min(next, due);
            if (!"due".equals(status)) continue;
            long waitMs = e.optInt("wait", 30) * MINUTE;
            if (!e.optBoolean("nudged") && waitMs > NUDGE_MS) next = Math.min(next, due + NUDGE_MS);
            next = Math.min(next, due + waitMs);
        }
        AlarmManager am = c.getSystemService(AlarmManager.class);
        PendingIntent tick = PendingIntent.getBroadcast(c, 100, new Intent(c, MedReceiver.class).setAction(ACTION_TICK),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        if (next == Long.MAX_VALUE) {
            am.cancel(tick);
            return;
        }
        long at = Math.max(next, now + 1000);
        if (canExact(c)) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, tick);
        else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, tick);  // may be a few minutes late
    }

    static boolean canExact(Context c) {
        return Build.VERSION.SDK_INT < 31 || c.getSystemService(AlarmManager.class).canScheduleExactAlarms();
    }

    /** "Taken" from the notification or the app. If a guardian was already told, they get a short update too. */
    static boolean markTaken(Context c, String key) {
        boolean ok = false;
        synchronized (LOCK) {
            long now = System.currentTimeMillis();
            JSONArray log = load(c);
            JSONObject e = find(log, key == null ? "" : key);
            if (e != null && !"taken".equals(e.optString("status"))) {
                try {
                    boolean told = e.optInt("guardians", 0) > 0;
                    e.put("status", "taken").put("takenAt", now);
                    if (told) textGuardians(c, e, true);
                    Store.setDoseLog(c, log.toString());
                    ok = true;
                } catch (JSONException ignored) {
                }
                c.getSystemService(NotificationManager.class).cancel(notificationId(e.optString("key")));
            }
            schedule(c, log, now);
        }
        MainActivity.sendToWeb("{\"type\":\"meds\"}");
        return ok;
    }

    /** "Try it": a test reminder in one minute; if it is not marked taken a minute later, guardians get a TEST text. */
    static void test(Context c, String personId) {
        synchronized (LOCK) {
            long now = System.currentTimeMillis();
            long due = now + MINUTE;
            JSONArray log = load(c);
            try {
                log.put(new JSONObject().put("key", "test@" + due).put("med", "test").put("name", "Test reminder").put("dose", "")
                        .put("person", personId == null ? "" : personId).put("due", due).put("wait", 1)
                        .put("status", "scheduled").put("test", true));
                Store.setDoseLog(c, log.toString());
            } catch (JSONException ignored) {
            }
            schedule(c, log, now);
        }
        MainActivity.sendToWeb("{\"type\":\"meds\"}");
    }

    // ---------- texts and notifications ----------

    private static int textGuardians(Context c, JSONObject e, boolean takenUpdate) {
        List<String[]> guardians = Store.contactsWith(c, "guardian");
        if (guardians.isEmpty() || c.checkSelfPermission(Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) return 0;
        boolean test = e.optBoolean("test");
        String person = Store.personName(c, e.optString("person"));
        if (person.isEmpty()) person = "Your family member";
        String med = e.optString("name") + (e.optString("dose").isEmpty() ? "" : " (" + e.optString("dose") + ")");
        String msg = takenUpdate
                ? "AuraHealth update: " + person + " marked " + med + " as taken at " + clock(System.currentTimeMillis()) + "."
                : person + " has not marked " + med + " as taken. It was due at " + clock(e.optLong("due")) + ", "
                + e.optInt("wait", 30) + " min ago. Please check on them.";
        msg = (test ? "TEST from AuraHealth: " : takenUpdate ? "" : "AuraHealth: ") + msg + (test ? " (Only a test.)" : " (Prototype)");
        int sent = 0;
        try {
            SmsManager sms = Build.VERSION.SDK_INT >= 31 ? c.getSystemService(SmsManager.class) : SmsManager.getDefault();
            for (String[] g : guardians) {
                sms.sendMultipartTextMessage(g[1], null, sms.divideMessage(msg), null, null);
                sent++;
            }
        } catch (RuntimeException ex) {
            Log.w("AuraMeds", "text not sent: " + ex.getClass().getSimpleName());
        }
        return sent;
    }

    private static void notifyDue(Context c, JSONObject e, boolean again) {
        String person = Store.personName(c, e.optString("person"));
        StringBuilder text = new StringBuilder();
        if (!e.optString("dose").isEmpty()) text.append(e.optString("dose")).append(" · ");
        if (!person.isEmpty()) text.append("for ").append(person).append(" · ");
        text.append("due ").append(clock(e.optLong("due"))).append(". Tap \"Taken\" when it is done.");
        post(c, e, (again ? "Reminder: not taken yet: " : "Medicine time: ") + e.optString("name"), text.toString(), true);
    }

    private static void notifyMissed(Context c, JSONObject e, int sent) {
        String text = sent > 0 ? (sent == 1 ? "Your guardian was sent a text." : sent + " guardians were sent a text.")
                : "No guardian with a phone number is set, so nobody was told.";
        post(c, e, "Not marked taken: " + e.optString("name"), text + " Tap \"Taken\" if it was taken.", false);
    }

    private static void post(Context c, JSONObject e, String title, String text, boolean loud) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        NotificationChannel ch = new NotificationChannel(CH_MEDS, "Medicine reminders", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Medicine times and missed doses");
        ch.enableVibration(true);
        nm.createNotificationChannel(ch);
        String key = e.optString("key");
        Intent open = new Intent(c, MainActivity.class).putExtra("open", "meds")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent content = PendingIntent.getActivity(c, notificationId(key), open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Intent taken = new Intent(c, MedReceiver.class).setAction(ACTION_TAKEN).putExtra("key", key);
        PendingIntent takenPi = PendingIntent.getBroadcast(c, notificationId(key), taken, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n = new Notification.Builder(c, CH_MEDS)
                .setSmallIcon(R.drawable.ic_stat_aura)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setCategory(Notification.CATEGORY_REMINDER)
                .setContentIntent(content)
                .addAction(new Notification.Action.Builder(null, "Taken", takenPi).build())
                .setOnlyAlertOnce(!loud)
                .build();
        nm.notify(notificationId(key), n);
    }

    // ---------- small helpers ----------

    private static int notificationId(String key) {
        return 1000 + (key.hashCode() & 0x0fffffff);
    }

    private static JSONArray load(Context c) {
        try {
            return new JSONArray(Store.doseLog(c));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    private static JSONObject find(JSONArray log, String key) {
        for (int i = 0; i < log.length(); i++) {
            JSONObject e = log.optJSONObject(i);
            if (e != null && key.equals(e.optString("key"))) return e;
        }
        return null;
    }

    private static int clampWait(int minutes) {
        return Math.max(5, Math.min(minutes, 240));
    }

    /** "08:30" → 510 minutes after midnight, or -1. */
    static int parseTime(String hhmm) {
        try {
            String[] p = hhmm.split(":");
            int h = Integer.parseInt(p[0]);
            int m = Integer.parseInt(p[1]);
            return h >= 0 && h < 24 && m >= 0 && m < 60 ? h * 60 + m : -1;
        } catch (RuntimeException e) {
            return -1;
        }
    }

    private static long at(int minutes, long day) {
        Calendar cal = Calendar.getInstance();
        cal.setTimeInMillis(day);
        cal.set(Calendar.HOUR_OF_DAY, minutes / 60);
        cal.set(Calendar.MINUTE, minutes % 60);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        return cal.getTimeInMillis();
    }

    private static long latestDue(int minutes, long t) {
        long today = at(minutes, t);
        return today <= t ? today : at(minutes, t - 24 * 60 * MINUTE);
    }

    private static long nextDue(int minutes, long now) {
        long today = at(minutes, now);
        return today > now ? today : at(minutes, now + 24 * 60 * MINUTE);
    }

    private static String clock(long ms) {
        return new SimpleDateFormat("HH:mm", Locale.US).format(new Date(ms));
    }
}
