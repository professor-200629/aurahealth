package health.aura.app;

/**
 * Hears "3 knocks". Works on 16 kHz mono 16-bit audio in 10 ms frames. Plain Java, no Android, so it can be
 * tested on a laptop.
 *
 * A knock is a sharp sound: it rises far above the room's background level and falls back within about 80 ms.
 * Speech, music and TV sound stay loud for longer, so they are not counted. Three knocks, each 0.12 to 1.5 s
 * apart and all within 3 s, make the signal. No sound is stored or sent anywhere.
 */
public final class KnockDetector {
    public static final int NONE = 0;
    public static final int KNOCK = 1;
    public static final int PATTERN = 2;

    static final int FRAME_MS = 10;
    static final double MIN_ENERGY = 1e-4;     // about 1% of full scale: quieter sounds are ignored
    static final double RISE_OVER_BG = 12.0;   // a knock must be this many times louder than the background
    static final double DECAY_TO = 0.2;        // ...and fall to this share of its peak...
    static final long DECAY_WITHIN_MS = 80;    // ...within this time
    static final long MAX_SOUND_MS = 120;      // longer than this is not a knock
    static final long MIN_GAP_MS = 120;
    static final long MAX_GAP_MS = 1500;
    static final long PATTERN_WITHIN_MS = 3000;
    static final long COOL_DOWN_MS = 10000;

    private double background = 1e-5;
    private double previous = 0;
    private boolean candidate = false;
    private boolean waitForQuiet = false;
    private double peak = 0;
    private long candidateStart = 0;
    private final long[] knocks = new long[3];
    private int knockCount = 0;
    private long coolDownUntil = 0;
    private double lastEnergy = 0;
    /** Why the last loud sound was or was not counted, for the diagnostic log. */
    public String lastDecision = "";

    /** Feed one frame; returns NONE, KNOCK (one knock heard) or PATTERN (three knocks: raise the alert). */
    public int process(short[] samples, int length, long timeMs) {
        double sum = 0;
        for (int i = 0; i < length; i++) {
            double v = samples[i] / 32768.0;
            sum += v * v;
        }
        double energy = length > 0 ? sum / length : 0;
        lastEnergy = energy;
        int result = NONE;

        if (candidate) {
            peak = Math.max(peak, energy);
            long elapsed = timeMs - candidateStart;
            if (energy < peak * DECAY_TO && elapsed <= DECAY_WITHIN_MS) {
                candidate = false;
                result = register(candidateStart);
                lastDecision = "short sound " + elapsed + " ms, peak " + peak + " -> " + (result == NONE ? "ignored" : "knock");
            } else if (elapsed > MAX_SOUND_MS) {
                candidate = false;
                waitForQuiet = true;  // a long sound: not a knock; wait until it ends
                lastDecision = "long sound (over " + MAX_SOUND_MS + " ms), peak " + peak + ", now " + energy + " -> not a knock";
            }
        } else if (waitForQuiet) {
            if (energy < background * 3) waitForQuiet = false;
            background = 0.999 * background + 0.001 * energy;
        } else if (energy > Math.max(background * RISE_OVER_BG, MIN_ENERGY) && energy > previous * 4) {
            candidate = true;
            peak = energy;
            candidateStart = timeMs;
        } else {
            background = Math.max(1e-7, 0.995 * background + 0.005 * energy);
        }
        previous = energy;
        return result;
    }

    private int register(long t) {
        if (t < coolDownUntil) return NONE;
        if (knockCount > 0) {
            long gap = t - knocks[knockCount - 1];
            if (gap < MIN_GAP_MS) return NONE;  // the same knock bouncing
            if (gap > MAX_GAP_MS) knockCount = 0;
        }
        if (knockCount == 3) {
            knocks[0] = knocks[1];
            knocks[1] = knocks[2];
            knockCount = 2;
        }
        knocks[knockCount++] = t;
        if (knockCount == 3 && t - knocks[0] <= PATTERN_WITHIN_MS) {
            knockCount = 0;
            coolDownUntil = t + COOL_DOWN_MS;
            return PATTERN;
        }
        return KNOCK;
    }

    /** Knocks heard in the current run (0 to 2), for the on-screen meter. */
    public int pendingKnocks() {
        return knockCount;
    }

    /** Loudness of the last frame from 0 to 1, for the on-screen meter. */
    public double level() {
        return Math.min(1.0, Math.sqrt(lastEnergy) * 4);
    }

    /** Energy of the last frame and the background estimate, for the diagnostic log. */
    public double lastEnergy() {
        return lastEnergy;
    }

    public double background() {
        return background;
    }

    public void reset() {
        knockCount = 0;
        candidate = false;
        waitForQuiet = false;
    }
}
