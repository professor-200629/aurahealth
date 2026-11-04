package health.aura.app;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Talk to Aura without the laptop: the phone calls Meta Muse Glimmer on NVIDIA's free hosted API itself, over the
 * phone's own internet. The NVIDIA key is kept in this app's private storage on this phone only (never sent to the
 * laptop, never shown again). The page builds the prompt (packs/ai/aura_chat.json) and checks the answer.
 */
final class AiClient {
    static final String API = "https://integrate.api.nvidia.com/v1/chat/completions";
    static final String MODEL = "meta/muse-glimmer-30b";
    private static final String KEY_FILE = "ai_key.txt";
    private static final ExecutorService POOL = Executors.newSingleThreadExecutor();

    private AiClient() {}

    static String key(Context c) {
        try {
            File f = new File(c.getFilesDir(), KEY_FILE);
            return f.exists() ? new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8).trim() : "";
        } catch (IOException e) {
            return "";
        }
    }

    static boolean setKey(Context c, String key) {
        String k = key == null ? "" : key.trim();
        if (!k.matches("[A-Za-z0-9._\\-]{20,200}")) return false;
        try (FileOutputStream out = c.openFileOutput(KEY_FILE, Context.MODE_PRIVATE)) {
            out.write(k.getBytes(StandardCharsets.UTF_8));
            return true;
        } catch (IOException e) {
            return false;
        }
    }

    static void clearKey(Context c) {
        c.deleteFile(KEY_FILE);
    }

    /**
     * Ask the model once. request = {"id", "system", "user"}. The answer comes back to the page as an "ai" event:
     * {"type":"ai","id","ok":true,"content","ms"} or {"type":"ai","id","ok":false,"error"}.
     */
    static void ask(Context c, String requestJson) {
        POOL.execute(() -> {
            JSONObject out = new JSONObject();
            long started = System.currentTimeMillis();
            try {
                JSONObject req = new JSONObject(requestJson);
                out.put("type", "ai").put("id", req.optString("id"));
                String key = key(c);
                if (key.isEmpty()) {
                    out.put("ok", false).put("error", "no_key");
                } else {
                    JSONObject body = new JSONObject()
                            .put("model", MODEL)
                            .put("messages", new JSONArray()
                                    .put(new JSONObject().put("role", "system").put("content", req.optString("system")))
                                    .put(new JSONObject().put("role", "user").put("content", req.optString("user"))))
                            .put("temperature", 0)
                            .put("max_tokens", 1500)
                            .put("response_format", new JSONObject().put("type", "json_object"))
                            .put("reasoning_effort", "low");  // same settings as the laptop (backend/src/aurahealth/ai.py)
                    int readMs = Math.max(10_000, Math.min(req.optInt("timeoutMs", 90_000), 120_000));
                    String[] r = post(body, key, readMs);
                    if (r[0].equals("400") || r[0].equals("422")) {  // a host may reject the optional settings
                        body.remove("response_format");
                        body.remove("reasoning_effort");
                        r = post(body, key, readMs);
                    }
                    int code = Integer.parseInt(r[0]);
                    if (code == 401 || code == 403) out.put("ok", false).put("error", "key_rejected");
                    else if (code == 429) out.put("ok", false).put("error", "rate_limited");
                    else if (code >= 400) out.put("ok", false).put("error", "http_" + code);
                    else {
                        JSONObject data = new JSONObject(r[1]);
                        JSONArray choices = data.optJSONArray("choices");
                        JSONObject msg = choices == null ? null : choices.optJSONObject(0).optJSONObject("message");
                        String content = msg == null ? "" : msg.optString("content", "");
                        content = content.replaceAll("(?s)<think>.*?</think>", "").trim();
                        out.put("ok", true).put("content", content).put("ms", System.currentTimeMillis() - started)
                                .put("model", data.optString("model", MODEL));
                    }
                }
            } catch (SocketTimeoutException e) {
                safePut(out, "timeout");
            } catch (IOException e) {
                safePut(out, "network");
            } catch (JSONException | RuntimeException e) {
                safePut(out, "bad_response");
            }
            MainActivity.sendToWeb(out.toString());
        });
    }

    private static void safePut(JSONObject out, String error) {
        try {
            out.put("type", "ai").put("ok", false).put("error", error);
        } catch (JSONException ignored) {
        }
    }

    /** POST the body; returns {status code, response text}. The key goes only in the Authorization header. */
    private static String[] post(JSONObject body, String key, int readMs) throws IOException {
        HttpURLConnection conn = (HttpURLConnection) new URL(API).openConnection();
        try {
            conn.setConnectTimeout(10_000);
            conn.setReadTimeout(readMs);
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Accept", "application/json");
            conn.setRequestProperty("Authorization", "Bearer " + key);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }
            int code = conn.getResponseCode();
            InputStream in = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
            return new String[] {String.valueOf(code), read(in)};
        } finally {
            conn.disconnect();
        }
    }

    private static String read(InputStream in) throws IOException {
        if (in == null) return "";
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        byte[] b = new byte[8192];
        int n;
        while ((n = in.read(b)) > 0) buf.write(b, 0, n);
        in.close();
        return buf.toString("UTF-8");
    }
}
