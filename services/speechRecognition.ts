import type { TranscriptItem } from "../types";

type SpeechRecognitionType = any;

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionType;
    SpeechRecognition?: SpeechRecognitionType;
  }
}

function getCtor(): SpeechRecognitionType | null {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export type SpeechSession = {
  start: () => void;
  stop: () => void;
  isSupported: boolean;
};

export function createSpeechSession(params: {
  lang?: string; // "vi-VN"
  onData: (items: TranscriptItem[]) => void; // trả: [final..., interim(last)]
  onError?: (msg: string) => void;
  onState?: (listening: boolean) => void;
}): SpeechSession {
  const Ctor = getCtor();
  const isSupported = !!Ctor;

  let rec: any = null;

  // ✅ chặn lặp theo index (desktop)
  let lastFinalIndex = 0;

  // ✅ chặn lặp theo nội dung (mobile)
  let lastFinalText = "";

  const start = () => {
    if (!Ctor) {
      params.onError?.("Trình duyệt không hỗ trợ Web Speech API (hãy dùng Chrome/Edge).");
      return;
    }

    // tạo instance mới mỗi lần start để tránh trạng thái lỗi
    rec = new Ctor();
    rec.lang = params.lang ?? "vi-VN";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    // reset mốc mỗi lần start
    lastFinalIndex = 0;
    lastFinalText = "";

    rec.onstart = () => params.onState?.(true);

    rec.onresult = (event: any) => {
      const out: TranscriptItem[] = [];
      let newestInterim = "";

      // Duyệt tất cả results hiện có để ổn định (mobile đôi khi trả resultIndex "kỳ")
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        const raw = (r?.[0]?.transcript ?? "").trim();
        if (!raw) continue;

        if (r.isFinal) {
          // 1) chặn lặp theo index
          if (i < lastFinalIndex) continue;

          // 2) chặn lặp theo nội dung + chỉ commit phần tăng thêm
          let toCommit = raw;

          // Nếu raw mới là "mở rộng" của raw cũ: "alo" -> "alo 1" -> "alo 1 2"
          if (lastFinalText && raw.startsWith(lastFinalText)) {
            toCommit = raw.slice(lastFinalText.length).trim();
          } else {
            // Trường hợp engine bắn y chang nhiều lần
            if (raw === lastFinalText) {
              lastFinalIndex = i + 1;
              continue;
            }
          }

          // update state
          lastFinalText = raw;
          lastFinalIndex = i + 1;

          if (!toCommit) continue;

          out.push({
            id: `final_${i}_${Date.now()}`,
            text: toCommit,
            isFinal: true,
            ts: Date.now(),
          });
        } else {
          // chỉ giữ interim mới nhất
          newestInterim = raw;
        }
      }

      // nếu muốn vẫn gửi interim (App đang filter final nên không ảnh hưởng)
      if (newestInterim) {
        out.push({
          id: `interim_${Date.now()}`,
          text: newestInterim,
          isFinal: false,
          ts: Date.now(),
        });
      }

      if (out.length) params.onData(out);
    };

    rec.onerror = (e: any) => {
      const code = e?.error ? String(e.error) : "unknown";
      params.onError?.(`SpeechRecognition error: ${code}`);
    };

    rec.onend = () => {
      params.onState?.(false);
      rec = null;
    };

    try {
      rec.start();
    } catch (err: any) {
      params.onError?.(`Không start được: ${err?.message ?? String(err)}`);
      params.onState?.(false);
      rec = null;
    }
  };

  const stop = () => {
    try {
      rec?.stop?.();
    } catch (err: any) {
      params.onError?.(`Không stop được: ${err?.message ?? String(err)}`);
    }
  };

  return { start, stop, isSupported };
}
