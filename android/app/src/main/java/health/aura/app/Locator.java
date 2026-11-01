package health.aura.app;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationManager;
import android.os.Build;
import android.os.CancellationSignal;
import android.os.Handler;
import android.os.Looper;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Where the phone is, from Android's own location service (GPS and mobile network; no Google services, no
 * internet needed for a GPS fix). Used for the link in alert texts and for "Share my location".
 */
final class Locator {
    interface Done {
        void got(Location location);  // null if no location is known
    }

    private Locator() {}

    static boolean allowed(Context c) {
        return c.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || c.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    static boolean enabled(Context c) {
        LocationManager lm = c.getSystemService(LocationManager.class);
        return lm != null && (Build.VERSION.SDK_INT < 28 || lm.isLocationEnabled());
    }

    /** The newest location Android already knows, at once. May be old or null. */
    static Location last(Context c) {
        if (!allowed(c)) return null;
        LocationManager lm = c.getSystemService(LocationManager.class);
        Location best = null;
        for (String p : providers()) {
            try {
                Location l = lm.getLastKnownLocation(p);
                if (l != null && (best == null || l.getTime() > best.getTime())) best = l;
            } catch (RuntimeException ignored) {  // provider missing or permission withdrawn
            }
        }
        return best;
    }

    /** Ask for a fresh fix; gives up after timeoutMs and returns the last known location instead. */
    static void current(Context c, long timeoutMs, Done done) {
        Handler main = new Handler(Looper.getMainLooper());
        AtomicBoolean finished = new AtomicBoolean(false);
        Runnable fallback = () -> {
            if (finished.compareAndSet(false, true)) done.got(last(c));
        };
        if (!allowed(c) || Build.VERSION.SDK_INT < 30) {
            main.post(fallback);
            return;
        }
        LocationManager lm = c.getSystemService(LocationManager.class);
        CancellationSignal cancel = new CancellationSignal();
        main.postDelayed(() -> {
            cancel.cancel();
            fallback.run();
        }, timeoutMs);
        boolean asked = false;
        for (String p : providers()) {
            try {
                if (!lm.isProviderEnabled(p)) continue;
                lm.getCurrentLocation(p, cancel, c.getMainExecutor(), l -> {
                    if (l != null && finished.compareAndSet(false, true)) {
                        cancel.cancel();
                        done.got(l);
                    }
                });
                asked = true;
            } catch (RuntimeException ignored) {
            }
        }
        if (!asked) main.post(fallback);
    }

    private static String[] providers() {
        return Build.VERSION.SDK_INT >= 31
                ? new String[] {LocationManager.FUSED_PROVIDER, LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER}
                : new String[] {LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER};
    }

    static String mapsLink(Location l) {
        return String.format(Locale.US, "https://maps.google.com/?q=%.6f,%.6f", l.getLatitude(), l.getLongitude());
    }

    /** For a text message: the map link, how precise it is and when it was measured. */
    static String describe(Location l) {
        String when = new SimpleDateFormat("HH:mm", Locale.US).format(new Date(l.getTime()));
        return mapsLink(l) + String.format(Locale.US, " (within about %d m, measured %s)", Math.round(l.getAccuracy()), when);
    }
}
