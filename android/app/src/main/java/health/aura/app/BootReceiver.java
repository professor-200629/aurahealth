package health.aura.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** After a restart, an app update or a clock change, set the medicine alarm again (Android forgets alarms on restart). */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        Meds.run(c);
    }
}
