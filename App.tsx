import { useMemo, useRef, useState } from "react";
import { createSpeechSession } from "./services/speechRecognition";

export default function App() {
  const [lang, setLang] = useState("vi-VN");
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");

  // Chỉ lưu text final
  const [text, setText] = useState("");

  const sessionRef = useRef<ReturnType<typeof createSpeechSession> | null>(null);

  const isSupported = useMemo(() => {
    const s = createSpeechSession({ lang: "vi-VN", onData: () => {} });
    return s.isSupported;
  }, []);

  const start = () => {
    setError("");

    sessionRef.current = createSpeechSession({
      lang,
      onData: (items) => {
        // ✅ chỉ lấy final
        const finals = items.filter((x) => x.isFinal).map((x) => x.text).filter(Boolean);
        if (!finals.length) return;

        // Append final vào textarea (mỗi cụm 1 dòng)
        setText((prev) => (prev ? `${prev}\n${finals.join("\n")}` : finals.join("\n")));
      },
      onError: (msg) => setError(msg),
      onState: (on) => setListening(on),
    });

    sessionRef.current.start();
  };

  const stop = () => {
    sessionRef.current?.stop();
  };

  const clear = () => {
    setText("");
    setError("");
  };

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(text.trim());
    } catch {
      setError("Copy thất bại (trình duyệt chặn Clipboard).");
    }
  };

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

      {/* ✅ Chỉ hiện chữ final */}
      <textarea
        value={text}
        readOnly
        placeholder="Bấm Start rồi nói... (chỉ hiện khi hệ thống 'chốt' câu)"
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
        Tip: Nếu bạn thấy “ra chữ chậm” là do chỉ hiện <code>final</code>. Muốn ra chữ ngay khi đang nói thì phải dùng <code>interim</code>.
      </div>
    </div>
  );
}
