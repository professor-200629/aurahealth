package health.aura.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** The medicine alarm and the "Taken" button on a reminder (sent by AuraHealth itself only). */
public class MedReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        if (Meds.ACTION_TAKEN.equals(intent.getAction())) Meds.markTaken(c, intent.getStringExtra("key"));
        else Meds.run(c);
    }
}
