package health.aura.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Medicine reminders, run by Android itself so they work with the app closed and no laptop. At each dose time a
 * notification asks the person to tap "Taken". If it is still not taken 10 minutes later the reminder is shown
 * again; if it is still not taken after the waiting time (30 minutes by default), every guardian is sent a text.
 * The doses and amounts are whatever the family typed in from the prescription: AuraHealth never suggests them.
 * A care plan adds food, exercise and other daily items here too. They get a reminder but no guardian text. Any item can
 * have an end date, for a course of 5 days or a plan of 6 months.
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
    private static final long KEEP_MS = 120L * 24 * 60 * MINUTE;  // the daily record shows how each day went
    private static final String CH_TODAY = "today";
    private static final int TODAY_ID = 77;
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
            showToday(c, log, now);
        }
        MainActivity.sendToWeb("{\"type\":\"meds\"}");
    }

    private static boolean process(Context c, JSONArray log, long now) throws JSONException {
        boolean changed = false;
        long horizon = now + 5_000;  // an alarm may fire a moment early
        JSONObject household = Store.householdObject(c);
        JSONArray meds = household.optJSONArray("meds");
        for (int i = 0; meds != null && i < meds.length(); i++) {
            JSONObject m = meds.optJSONObject(i);
            if (m == null || !m.optBoolean("on", true) || m.optBoolean("demo") || m.optString("name").trim().isEmpty()) continue;
            JSONArray times = m.optJSONArray("times");
            for (int j = 0; times != null && j < times.length(); j++) {
                int minutes = parseTime(times.optString(j));
                if (minutes < 0) continue;
                long due = latestDue(minutes, horizon);
                if (due < m.optLong("since", 0) || horizon - due > LATE_LIMIT_MS || ended(m, due) || !onThisDay(m, due)) continue;
                String key = m.optString("id") + "@" + due;
                if (find(log, key) != null) continue;
                JSONObject e = new JSONObject().put("key", key).put("med", m.optString("id")).put("name", m.optString("name").trim())
                        .put("dose", m.optString("dose").trim()).put("person", m.optString("person")).put("due", due)
                        .put("wait", clampWait(m.optInt("wait", 30))).put("kind", kindOf(m)).put("status", "due");
                log.put(e);
                if (markedDone(household, m.optString("id") + "@" + times.optString(j), due)) {
                    e.put("status", "taken").put("takenAt", now);  // ticked in the app before its time: no reminder needed
                } else {
                    notifyDue(c, e, false);
                }
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
                boolean medicine = "medicine".equals(e.optString("kind", "medicine"));
                int sent = medicine ? textGuardians(c, e, false) : 0;
                e.put("status", "missed").put("missedAt", now).put("guardians", sent);
                if (medicine) notifyMissed(c, e, sent);
                else c.getSystemService(NotificationManager.class).cancel(notificationId(e.optString("key")));
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
            if (m == null || !m.optBoolean("on", true) || m.optBoolean("demo") || m.optString("name").trim().isEmpty()) continue;
            JSONArray times = m.optJSONArray("times");
            for (int j = 0; times != null && j < times.length(); j++) {
                int minutes = parseTime(times.optString(j));
                if (minutes < 0) continue;
                long due = nextDue(minutes, now);
                for (int d = 0; d < 7 && !onThisDay(m, due); d++) due = at(minutes, due + 24 * 60 * MINUTE);  // a weekly item: its next day
                if (onThisDay(m, due) && !ended(m, due)) next = Math.min(next, due);
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
        if (next != Long.MAX_VALUE) next = Math.min(next, at(0, now + 24 * 60 * MINUTE));  // the day's progress starts again at midnight
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
            showToday(c, log, now);
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

    /** The day's progress in the status bar: a quiet notification that stays there, with a progress bar. */
    private static void showToday(Context c, JSONArray log, long now) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        JSONObject h = Store.householdObject(c);
        JSONArray meds = h.optJSONArray("meds");
        int total = 0;
        int done = 0;
        long nextAt = Long.MAX_VALUE;
        String nextName = "";
        long dayStart = at(0, now);
        for (int i = 0; meds != null && i < meds.length(); i++) {
            JSONObject m = meds.optJSONObject(i);
            if (m == null || !m.optBoolean("on", true) || m.optString("name").trim().isEmpty() || ended(m, dayStart) || !onThisDay(m, dayStart)) continue;
            String id = m.optString("id");
            JSONArray times = m.optJSONArray("times");
            if (times == null || times.length() == 0) {
                total++;
                if (markedDone(h, id, now)) done++;
                continue;
            }
            for (int j = 0; j < times.length(); j++) {
                int minutes = parseTime(times.optString(j));
                if (minutes < 0) continue;
                long due = at(minutes, now);
                if (due < m.optLong("since", 0)) continue;
                total++;
                JSONObject e = find(log, id + "@" + due);
                if ((e != null && "taken".equals(e.optString("status"))) || markedDone(h, id + "@" + times.optString(j), now)) done++;
                else if (due > now && due < nextAt) {
                    nextAt = due;
                    nextName = m.optString("name").trim();
                }
            }
        }
        if (total == 0 || h.optBoolean("noStatusBar", false)) {
            nm.cancel(TODAY_ID);
            return;
        }
        NotificationChannel ch = new NotificationChannel(CH_TODAY, "Today's progress", NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("How much of today's care plan is done");
        ch.setShowBadge(false);
        nm.createNotificationChannel(ch);
        Intent open = new Intent(c, MainActivity.class).putExtra("open", "care")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent content = PendingIntent.getActivity(c, TODAY_ID, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        String text = done >= total ? "All done for today." : !nextName.isEmpty() ? "Next: " + nextName + " at " + clock(nextAt) : (total - done) + " still to do today.";
        Notification n = new Notification.Builder(c, CH_TODAY)
                .setSmallIcon(R.drawable.ic_stat_aura)
                .setContentTitle("Today: " + done + " of " + total + " done")
                .setContentText(text)
                .setProgress(total, done, false)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setContentIntent(content)
                .build();
        nm.notify(TODAY_ID, n);
    }

    // ---------- texts and notifications ----------

    private static int textGuardians(Context c, JSONObject e, boolean takenUpdate) {
        boolean test = e.optBoolean("test");
        String person = Store.personName(c, e.optString("person"));
        if (person.isEmpty()) person = "Your family member";
        String med = e.optString("name") + (e.optString("dose").isEmpty() ? "" : " (" + e.optString("dose") + ")");
        String msg = takenUpdate
                ? "AuraHealth update: " + person + " marked " + med + " as taken at " + clock(System.currentTimeMillis()) + "."
                : person + " has not marked " + med + " as taken. It was due at " + clock(e.optLong("due")) + ", "
                + e.optInt("wait", 30) + " min ago. Please check on them.";
        msg = (test ? "TEST from AuraHealth: " : takenUpdate ? "" : "AuraHealth: ") + msg + (test ? " (Only a test.)" : " (Prototype)");
        return Sms.send(c, Store.contactsWith(c, "guardian"), msg);
    }

    private static void notifyDue(Context c, JSONObject e, boolean again) {
        String person = Store.personName(c, e.optString("person"));
        StringBuilder text = new StringBuilder();
        if (!e.optString("dose").isEmpty()) text.append(e.optString("dose")).append(" · ");
        if (!person.isEmpty()) text.append("for ").append(person).append(" · ");
        text.append("due ").append(clock(e.optLong("due"))).append(". Tap \"Done\" when it is done.");
        String kind = e.optString("kind", "medicine");
        String label = "food".equals(kind) ? "Food" : "exercise".equals(kind) ? "Exercise" : "care".equals(kind) ? "Care plan" : "Medicine time";
        post(c, e, (again ? "Reminder: not done yet: " : label + ": ") + e.optString("name"), text.toString(), true);
    }

    private static void notifyMissed(Context c, JSONObject e, int sent) {
        String text = sent > 0 ? (sent == 1 ? "Sending a text to your guardian." : "Sending a text to " + sent + " guardians.")
                : "No text was sent. Check the guardian's number and the SMS permission in AuraHealth.";
        post(c, e, "Not marked taken: " + e.optString("name"), text + " Tap \"Done\" if it was taken.", false);
    }

    private static void post(Context c, JSONObject e, String title, String text, boolean loud) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        NotificationChannel ch = new NotificationChannel(CH_MEDS, "Medicine reminders", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Medicine times and doses not marked taken");
        ch.enableVibration(true);
        nm.createNotificationChannel(ch);
        String key = e.optString("key");
        Intent open = new Intent(c, MainActivity.class).putExtra("open", "care")
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
                .addAction(new Notification.Action.Builder(null, "Done", takenPi).build())
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

    private static String kindOf(JSONObject m) {
        String kind = m.optString("kind", "medicine");
        return kind.isEmpty() ? "medicine" : kind;
    }

    /** A course or plan with an end date stops by itself. */
    private static boolean ended(JSONObject m, long when) {
        long until = m.optLong("until", 0);
        return until > 0 && when > until;
    }

    /** A weekly item is only for its own day. weekday: 0 is Sunday, missing means every day. */
    private static boolean onThisDay(JSONObject m, long when) {
        if (!m.has("weekday") || m.isNull("weekday")) return true;
        Calendar cal = Calendar.getInstance();
        cal.setTimeInMillis(when);
        return m.optInt("weekday") == cal.get(Calendar.DAY_OF_WEEK) - Calendar.SUNDAY;
    }

    /** Ticked by hand in the app for that day. */
    private static boolean markedDone(JSONObject household, String itemId, long when) {
        JSONObject days = household.optJSONObject("days");
        JSONObject day = days == null ? null : days.optJSONObject(new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(when)));
        JSONArray done = day == null ? null : day.optJSONArray("done");
        for (int i = 0; done != null && i < done.length(); i++) {
            if (itemId.equals(done.optString(i))) return true;
        }
        return false;
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
