import type { TranscriptItem } from "../types";

export default function TranscriptionList(props: {
  items: TranscriptItem[];
}) {
  const { items } = props;

  if (!items.length) return <div style={{ opacity: 0.7 }}>— Chưa có transcript —</div>;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {items.map((it) => (
        <div
          key={it.id}
          style={{
            padding: 12,
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            background: it.isFinal ? "#fff" : "#f8fafc",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 6 }}>
            {new Date(it.ts).toLocaleTimeString()} · {it.isFinal ? "Final" : "Interim"}
          </div>
          <div style={{ whiteSpace: "pre-wrap" }}>{it.text}</div>
        </div>
      ))}
    </div>
  );
}
