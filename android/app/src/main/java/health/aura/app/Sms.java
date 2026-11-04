package health.aura.app;

import android.Manifest;
import android.app.Activity;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.telephony.SmsManager;
import android.telephony.SubscriptionManager;
import android.util.Log;

import java.util.ArrayList;
import java.util.List;

/**
 * Every text the app sends, with its real result. Android reports later whether the phone network accepted the text,
 * so the app can say "sent" or "failed" and not just assume. That report does not prove the other phone received it.
 */
final class Sms {
    static final String ACTION_RESULT = "health.aura.app.SMS_RESULT";
    private static int nextRequest = 7000;

    private Sms() {}

    /** Hands the text to Android for each person. Returns how many were accepted for sending. */
    static synchronized int send(Context c, List<String[]> to, String msg) {
        if (to.isEmpty()) return 0;
        if (c.checkSelfPermission(Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) {
            Store.setLastText(c, "failed", "permission");
            return 0;
        }
        int started = 0;
        try {
            SmsManager sms = manager(c);
            ArrayList<String> parts = sms.divideMessage(msg);
            for (String[] who : to) {
                ArrayList<PendingIntent> sent = new ArrayList<>();
                for (int i = 0; i < parts.size(); i++) {
                    Intent result = new Intent(c, MedReceiver.class).setAction(ACTION_RESULT);
                    sent.add(PendingIntent.getBroadcast(c, nextRequest++, result, PendingIntent.FLAG_IMMUTABLE));
                }
                sms.sendMultipartTextMessage(who[1], null, parts, sent, null);
                started++;
            }
            Store.setLastText(c, "sending", "");
        } catch (RuntimeException e) {
            Log.w("AuraSms", "text not sent: " + e.getClass().getSimpleName());
            Store.setLastText(c, "failed", "not_accepted");
        }
        return started;
    }

    /** Called by Android for each part of a text. */
    static void result(Context c, int code) {
        if (code == Activity.RESULT_OK) {
            Store.setLastText(c, "sent", "");
        } else {
            String why = code == SmsManager.RESULT_ERROR_NO_SERVICE ? "no_service"
                    : code == SmsManager.RESULT_ERROR_RADIO_OFF ? "airplane" : "code_" + code;
            Store.setLastText(c, "failed", why);
            Log.w("AuraSms", "text failed: " + why);
        }
        MainActivity.sendToWeb("{\"type\":\"meds\"}");
    }

    private static SmsManager manager(Context c) {
        SmsManager base = Build.VERSION.SDK_INT >= 31 ? c.getSystemService(SmsManager.class) : SmsManager.getDefault();
        int sub = SubscriptionManager.getDefaultSmsSubscriptionId();
        return sub != SubscriptionManager.INVALID_SUBSCRIPTION_ID ? base.createForSubscriptionId(sub) : base;
    }
}
