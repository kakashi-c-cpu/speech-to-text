import { useMemo, useRef, useState } from "react";
import { createSpeechSession } from "./services/speechRecognition";
import type { TranscriptItem } from "./types";

export default function App() {
  const [lang, setLang] = useState("vi-VN");
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");

  const [finalText, setFinalText] = useState(""); // ✅ chỉ câu đã chốt
  const [live, setLive] = useState(""); // ✅ đang nói

  const sessionRef = useRef<ReturnType<typeof createSpeechSession> | null>(null);

  const isSupported = useMemo(() => {
    const s = createSpeechSession({ lang: "vi-VN", onData: () => {} });
    return s.isSupported;
  }, []);

  const start = () => {
    setError("");

    sessionRef.current = createSpeechSession({
      lang,
      pauseMs: 700, // ✅ chỉnh 500-1000 tuỳ thích
      onData: (items: TranscriptItem[]) => {
        const last = items[items.length - 1];
        if (!last) return;

        if (last.isFinal) {
          const t = (last.text ?? "").trim();
          if (!t) return;

          setFinalText((prev) => (prev ? `${prev}\n${t}` : t));
          setLive(""); // clear live khi đã chốt
        } else {
          setLive((last.text ?? "").trim());
        }
      },
      onError: (msg) => setError(msg),
      onState: (on) => setListening(on),
    });

    sessionRef.current.start();
  };

  const stop = () => sessionRef.current?.stop();

  const clear = () => {
    setFinalText("");
    setLive("");
    setError("");
  };

  const copyAll = async () => {
    try {
      const combined = `${finalText}${live ? `\n${live}` : ""}`.trim();
      await navigator.clipboard.writeText(combined);
    } catch {
      setError("Copy thất bại (trình duyệt chặn Clipboard).");
    }
  };

  const display = `${finalText}${live ? `\n${live}` : ""}`.trimStart();

  return (
    <div style={{ maxWidth: 900, margin: "24px auto", padding: 16, fontFamily: "system-ui" }}>
      <h2>Speech-to-Text</h2>

      {!isSupported && (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            background: "#fff1f2",
            border: "1px solid #fecaca",
            marginBottom: 12,
          }}
        >
          Trình duyệt không hỗ trợ Web Speech API. Hãy dùng Chrome/Edge desktop.
        </div>
      )}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", margin: "12px 0" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          Ngôn ngữ:
          <select value={lang} onChange={(e) => setLang(e.target.value)} style={{ padding: 8, borderRadius: 10 }}>
            <option value="vi-VN">Tiếng Việt (vi-VN)</option>
            <option value="en-US">English (en-US)</option>
            <option value="ja-JP">日本語 (ja-JP)</option>
            <option value="ko-KR">한국어 (ko-KR)</option>
          </select>
        </label>

        {!listening ? (
          <button onClick={start} disabled={!isSupported} style={{ padding: "10px 14px", borderRadius: 12 }}>
            ▶ Start
          </button>
        ) : (
          <button onClick={stop} style={{ padding: "10px 14px", borderRadius: 12 }}>
            ■ Stop
          </button>
        )}

        <button onClick={clear} style={{ padding: "10px 14px", borderRadius: 12 }}>
          Clear
        </button>

        <button onClick={copyAll} style={{ padding: "10px 14px", borderRadius: 12 }}>
          Copy
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            background: "#fff1f2",
            border: "1px solid #fecaca",
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ marginBottom: 8, opacity: 0.7 }}>{listening ? "Đang nghe..." : "Đang dừng."}</div>

      <textarea
        value={display}
        readOnly
        placeholder="Bấm Start rồi nói... (pause ~700ms sẽ chốt thành 1 dòng)"
        style={{
          width: "100%",
          minHeight: 360,
          padding: 12,
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          fontSize: 16,
          lineHeight: 1.5,
          resize: "vertical",
        }}
      />

      <div style={{ marginTop: 12, opacity: 0.75 }}>
        Tip: Mobile sẽ “chốt” 1 câu khi bạn ngừng nói khoảng <code>pauseMs</code> (mặc định 700ms).
      </div>
    </div>
  );
}
