import health.aura.app.KnockDetector;

import java.util.Random;

/**
 * Laptop test for the knock detector with made-up sounds. Run from android/:
 *   javac -d build/check app/src/main/java/health/aura/app/KnockDetector.java tools/KnockDetectorCheck.java
 *   java -cp build/check KnockDetectorCheck
 */
public class KnockDetectorCheck {
    static final int RATE = 16000;
    static final int FRAME = 160;
    static int failures = 0;

    interface Sound {
        double at(double t);
    }

    static int run(String name, double seconds, Sound sound, int expectPatterns) {
        KnockDetector d = new KnockDetector();
        Random noise = new Random(7);
        int patterns = 0;
        short[] buf = new short[FRAME];
        int frames = (int) (seconds * RATE / FRAME);
        for (int f = 0; f < frames; f++) {
            for (int i = 0; i < FRAME; i++) {
                double t = (f * FRAME + i) / (double) RATE;
                double v = sound.at(t) + noise.nextGaussian() * 0.003;
                buf[i] = (short) Math.max(-32768, Math.min(32767, v * 32767));
            }
            if (d.process(buf, FRAME, f * 10L) == KnockDetector.PATTERN) patterns++;
        }
        boolean ok = patterns == expectPatterns;
        if (!ok) failures++;
        System.out.printf("%-48s patterns=%d expected=%d %s%n", name, patterns, expectPatterns, ok ? "OK" : "FAIL");
        return patterns;
    }

    /** A knock: a burst of noise that dies away in about 15 ms. */
    static double knock(double t, double start, double amp, Random r) {
        if (t < start || t > start + 0.08) return 0;
        return amp * Math.exp(-(t - start) / 0.012) * (r.nextDouble() * 2 - 1);
    }

    public static void main(String[] args) {
        Random r = new Random(1);
        run("3 knocks, 0.4 s apart", 4, t -> knock(t, 1.0, 0.4, r) + knock(t, 1.4, 0.4, r) + knock(t, 1.8, 0.4, r), 1);
        run("3 soft knocks, 0.6 s apart", 4, t -> knock(t, 1.0, 0.12, r) + knock(t, 1.6, 0.12, r) + knock(t, 2.2, 0.12, r), 1);
        run("3 very soft knocks (amplitude 0.03)", 4, t -> knock(t, 1.0, 0.03, r) + knock(t, 1.5, 0.03, r) + knock(t, 2.0, 0.03, r), 1);
        run("quiet speech-like, 6 syllables", 5, t -> {
            double s = (t % 0.35) < 0.2 && t > 1 && t < 3.1 ? 0.05 : 0;
            return s * Math.sin(2 * Math.PI * 180 * t);
        }, 0);
        run("2 knocks only", 4, t -> knock(t, 1.0, 0.4, r) + knock(t, 1.4, 0.4, r), 0);
        run("3 knocks too slow (2 s apart)", 8, t -> knock(t, 1.0, 0.4, r) + knock(t, 3.0, 0.4, r) + knock(t, 5.0, 0.4, r), 0);
        run("one knock that bounces (40 ms)", 4, t -> knock(t, 1.0, 0.4, r) + knock(t, 1.04, 0.3, r) + knock(t, 1.08, 0.2, r), 0);
        run("speech-like: 6 syllables of 200 ms", 5, t -> {
            double s = (t % 0.35) < 0.2 && t > 1 && t < 3.1 ? 0.3 : 0;
            return s * Math.sin(2 * Math.PI * 180 * t) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 4 * t));
        }, 0);
        run("TV music, steady", 5, t -> 0.2 * Math.sin(2 * Math.PI * 440 * t) * (0.5 + 0.5 * Math.sin(2 * Math.PI * 2 * t)), 0);
        run("door slam once", 4, t -> t > 1 && t < 1.25 ? 0.6 * Math.exp(-(t - 1) / 0.08) * (r.nextDouble() * 2 - 1) : 0, 0);
        run("3 knocks twice (cool-down stops the 2nd)", 6, t -> knock(t, 1.0, 0.4, r) + knock(t, 1.4, 0.4, r)
                + knock(t, 1.8, 0.4, r) + knock(t, 3.0, 0.4, r) + knock(t, 3.4, 0.4, r) + knock(t, 3.8, 0.4, r), 1);
        System.out.println(failures == 0 ? "ALL OK" : failures + " FAILED");
        System.exit(failures == 0 ? 0 : 1);
    }
}
