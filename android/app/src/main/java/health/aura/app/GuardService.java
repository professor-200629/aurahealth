package health.aura.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioRecord;
import android.media.MediaPlayer;
import android.media.MediaRecorder;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.telecom.TelecomManager;
import android.telephony.SmsManager;
import android.util.Log;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * The night guard. Listens for 3 knocks; then sounds an alarm and counts down 30 seconds. If nobody taps
 * "I'm OK", it phones the neighbour and texts the family. It never calls 112: Android does not allow apps to.
 * Audio is processed in memory frame by frame and never recorded or sent.
 */
public class GuardService extends Service {
    static final String START = "start";
    static final String STOP = "stop";
    static final String TEST = "test";
    static final String CANCEL = "cancel";
    static final int COUNTDOWN_SECONDS = 30;
    private static final String CH_GUARD = "guard";
    private static final String CH_ALERT = "alert";
    private static final int ID_GUARD = 1;
    private static final int ID_ALERT = 2;

    static volatile GuardService instance;

    private final Handler main = new Handler(Looper.getMainLooper());
    private volatile boolean listening = false;
    private Thread listener;
    private PowerManager.WakeLock wakeLock;
    private volatile boolean alertActive = false;
    private boolean alertTest = false;
    private int secondsLeft = 0;
    private MediaPlayer alarm;
    private int savedAlarmVolume = -1;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        NotificationManager nm = getSystemService(NotificationManager.class);
        NotificationChannel guard = new NotificationChannel(CH_GUARD, "Night guard", NotificationManager.IMPORTANCE_LOW);
        guard.setDescription("Shown while AuraHealth listens for 3 knocks");
        NotificationChannel alert = new NotificationChannel(CH_ALERT, "Emergency alert", NotificationManager.IMPORTANCE_HIGH);
        alert.setDescription("The \"Are you OK?\" countdown");
        alert.setSound(null, null);  // the alarm sound is played by the service itself
        alert.enableVibration(true);
        nm.createNotificationChannel(guard);
        nm.createNotificationChannel(alert);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : START;
        if (action == null) action = START;
        switch (action) {
            case START:
                startGuard();
                break;
            case STOP:
                stopGuard();
                break;
            case TEST:
                startAlert(true);
                break;
            case CANCEL:
                cancelAlert();
                break;
            default:
                break;
        }
        return listening ? START_STICKY : START_NOT_STICKY;
    }

    private boolean has(String permission) {
        return checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED;
    }

    private void startGuard() {
        if (!has(Manifest.permission.RECORD_AUDIO)) {
            stopSelf();
            return;
        }
        Notification n = guardNotification("Night guard is on: knock 3 times if you need help");
        if (Build.VERSION.SDK_INT >= 30) startForeground(ID_GUARD, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
        else startForeground(ID_GUARD, n);
        if (!listening) {
            Store.setGuardOn(this, true);
            Store.addEvent(this, "guard_on", null);
            startListening();
            PowerManager pm = getSystemService(PowerManager.class);
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "aura:guard");
            wakeLock.acquire(12 * 60 * 60 * 1000L);
        }
        MainActivity.sendToWeb("{\"type\":\"guard\",\"on\":true}");
        MainActivity.sendToWeb("{\"type\":\"queue\"}");
    }

    private void stopGuard() {
        if (listening) Store.addEvent(this, "guard_off", null);
        listening = false;
        Store.setGuardOn(this, false);
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (!alertActive) {
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
        }
        MainActivity.sendToWeb("{\"type\":\"guard\",\"on\":false}");
        MainActivity.sendToWeb("{\"type\":\"queue\"}");
    }

    private void startListening() {
        listening = true;
        listener = new Thread(() -> {
            int rate = 16000;
            int min = AudioRecord.getMinBufferSize(rate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
            AudioRecord rec;
            try {
                rec = new AudioRecord(MediaRecorder.AudioSource.MIC, rate, AudioFormat.CHANNEL_IN_MONO,
                        AudioFormat.ENCODING_PCM_16BIT, Math.max(min, 3200));
                rec.startRecording();
            } catch (SecurityException | IllegalStateException e) {
                listening = false;
                return;
            }
            KnockDetector detector = new KnockDetector();
            short[] frame = new short[160];
            long t = 0;
            long lastLevel = 0;
            int lastKnocks = -1;
            double peakEnergy = 0;
            while (listening) {
                int n = rec.read(frame, 0, frame.length);
                if (n <= 0) continue;
                t += 10;
                if (alertActive) continue;
                int r = detector.process(frame, n, t);
                peakEnergy = Math.max(peakEnergy, detector.lastEnergy());
                if (!detector.lastDecision.isEmpty()) {
                    Log.i("AuraGuard", detector.lastDecision);
                    detector.lastDecision = "";
                }
                if (t % 1000 == 0) {
                    // Loudness only (two numbers per second), never the sound itself.
                    Log.d("AuraGuard", String.format(Locale.US, "peak=%.5f bg=%.6f", peakEnergy, detector.background()));
                    peakEnergy = 0;
                }
                if (r == KnockDetector.PATTERN) {
                    main.post(() -> startAlert(false));
                }
                int pending = r == KnockDetector.PATTERN ? 3 : detector.pendingKnocks();
                if (pending != lastKnocks) {
                    lastKnocks = pending;
                    MainActivity.sendToWeb("{\"type\":\"knock\",\"count\":" + pending + "}");
                }
                if (t - lastLevel >= 150) {
                    lastLevel = t;
                    MainActivity.sendToWeb("{\"type\":\"level\",\"value\":" + String.format(Locale.US, "%.3f", detector.level()) + "}");
                }
            }
            rec.stop();
            rec.release();
        }, "aura-knock-listener");
        listener.start();
    }

    // ---------- the alert ----------

    void startAlert(boolean test) {
        if (alertActive) return;
        alertActive = true;
        alertTest = test;
        secondsLeft = COUNTDOWN_SECONDS;
        Store.addEvent(this, test ? "guard_test" : "guard_knock", null);
        MainActivity.sendToWeb("{\"type\":\"queue\"}");
        playAlarm();
        vibrate();
        showAlertNotification();
        tick();
    }

    private final Runnable ticker = this::tick;

    private void tick() {
        if (!alertActive) return;
        MainActivity.sendToWeb("{\"type\":\"alert\",\"stage\":\"countdown\",\"seconds\":" + secondsLeft + ",\"test\":" + alertTest + "}");
        if (secondsLeft <= 0) {
            finishAlert();
            return;
        }
        secondsLeft--;
        main.postDelayed(ticker, 1000);
    }

    void cancelAlert() {
        if (!alertActive) return;
        alertActive = false;
        main.removeCallbacks(ticker);
        stopAlarm();
        getSystemService(NotificationManager.class).cancel(ID_ALERT);
        Store.addEvent(this, "guard_cancel", null);
        MainActivity.sendToWeb("{\"type\":\"alert\",\"stage\":\"cancelled\"}");
        MainActivity.sendToWeb("{\"type\":\"queue\"}");
        if (!listening) stopSelf();
    }

    private void finishAlert() {
        alertActive = false;
        stopAlarm();
        getSystemService(NotificationManager.class).cancel(ID_ALERT);
        if (!alertTest) {
            callNeighbour();
            textFamily();
        }
        MainActivity.sendToWeb("{\"type\":\"alert\",\"stage\":\"calling\",\"test\":" + alertTest + "}");
        MainActivity.sendToWeb("{\"type\":\"queue\"}");
        if (!listening) stopSelf();
    }

    private void callNeighbour() {
        String number = Store.contact(this, "neighbour")[1];
        if (number.isEmpty() || !has(Manifest.permission.CALL_PHONE)) {
            Store.addEvent(this, "guard_failed", "neighbour");
            return;
        }
        try {
            TelecomManager tm = getSystemService(TelecomManager.class);
            tm.placeCall(Uri.fromParts("tel", number, null), new Bundle());
            Store.addEvent(this, "guard_call", "neighbour");
        } catch (SecurityException e) {
            Store.addEvent(this, "guard_failed", "neighbour");
        }
    }

    private void textFamily() {
        String[] family = Store.contact(this, "family");
        String[] neighbour = Store.contact(this, "neighbour");
        if (family[1].isEmpty() || !has(Manifest.permission.SEND_SMS)) {
            Store.addEvent(this, "guard_failed", "family");
            return;
        }
        String time = new SimpleDateFormat("HH:mm", Locale.US).format(new Date());
        String who = neighbour[0].isEmpty() ? "the neighbour" : neighbour[0];
        String msg = "AuraHealth alert: 3 knocks for help were heard at " + time
                + " and nobody tapped \"I'm OK\". " + who + " was phoned. Please check now or call 112. (Prototype)";
        try {
            SmsManager sms = Build.VERSION.SDK_INT >= 31 ? getSystemService(SmsManager.class) : SmsManager.getDefault();
            sms.sendMultipartTextMessage(family[1], null, sms.divideMessage(msg), null, null);
            Store.addEvent(this, "guard_sms", "family");
        } catch (RuntimeException e) {
            Store.addEvent(this, "guard_failed", "family");
        }
    }

    private void playAlarm() {
        try {
            AudioManager am = getSystemService(AudioManager.class);
            savedAlarmVolume = am.getStreamVolume(AudioManager.STREAM_ALARM);
            am.setStreamVolume(AudioManager.STREAM_ALARM, am.getStreamMaxVolume(AudioManager.STREAM_ALARM), 0);
            Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            alarm = new MediaPlayer();
            alarm.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            alarm.setDataSource(this, uri);
            alarm.setLooping(true);
            alarm.prepare();
            alarm.start();
        } catch (Exception e) {
            alarm = null;
        }
    }

    private void stopAlarm() {
        if (alarm != null) {
            try {
                alarm.stop();
            } catch (IllegalStateException ignored) {
            }
            alarm.release();
            alarm = null;
        }
        if (savedAlarmVolume >= 0) {
            getSystemService(AudioManager.class).setStreamVolume(AudioManager.STREAM_ALARM, savedAlarmVolume, 0);
            savedAlarmVolume = -1;
        }
        Vibrator v = getSystemService(Vibrator.class);
        if (v != null) v.cancel();
    }

    private void vibrate() {
        Vibrator v = getSystemService(Vibrator.class);
        if (v != null && v.hasVibrator()) {
            v.vibrate(VibrationEffect.createWaveform(new long[] {0, 600, 400}, 0));
        }
    }

    private void showAlertNotification() {
        Intent open = new Intent(this, MainActivity.class).putExtra("alert", true)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent full = PendingIntent.getActivity(this, 1, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Intent ok = new Intent(this, GuardService.class).setAction(CANCEL);
        PendingIntent cancel = PendingIntent.getService(this, 2, ok, PendingIntent.FLAG_IMMUTABLE);
        Notification n = new Notification.Builder(this, CH_ALERT)
                .setSmallIcon(R.drawable.ic_stat_aura)
                .setContentTitle("Are you OK?")
                .setContentText(alertTest ? "Test alert: nobody will be called" : "Tap \"I'm OK\", or the neighbour will be phoned in 30 seconds")
                .setCategory(Notification.CATEGORY_ALARM)
                .setFullScreenIntent(full, true)
                .setContentIntent(full)
                .addAction(new Notification.Action.Builder(null, "I'm OK", cancel).build())
                .setOngoing(true)
                .build();
        getSystemService(NotificationManager.class).notify(ID_ALERT, n);
    }

    private Notification guardNotification(String text) {
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this, CH_GUARD)
                .setSmallIcon(R.drawable.ic_stat_aura)
                .setContentTitle("AuraHealth")
                .setContentText(text)
                .setContentIntent(open)
                .setOngoing(true)
                .build();
    }

    static boolean isAlertActive() {
        GuardService s = instance;
        return s != null && s.alertActive;
    }

    static void send(Context c, String action) {
        Intent i = new Intent(c, GuardService.class).setAction(action);
        if (START.equals(action)) c.startForegroundService(i);
        else c.startService(i);
    }

    @Override
    public void onDestroy() {
        listening = false;
        main.removeCallbacks(ticker);
        stopAlarm();
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        instance = null;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
