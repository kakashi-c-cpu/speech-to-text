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

  // ✅ nhớ "mốc" final đã commit để không emit lại
  let lastFinalIndex = 0;

  const start = () => {
    if (!Ctor) {
      params.onError?.("Trình duyệt không hỗ trợ Web Speech API (hãy dùng Chrome/Edge).");
      return;
    }

    rec = new Ctor();
    rec.lang = params.lang ?? "vi-VN";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    // reset mốc mỗi lần start
    lastFinalIndex = 0;

    rec.onstart = () => params.onState?.(true);

    rec.onresult = (event: any) => {
      const out: TranscriptItem[] = [];
      let newestInterim = "";

      // Duyệt tất cả results hiện có để ổn định (engine đôi khi trả resultIndex "lạ")
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        const text = (r?.[0]?.transcript ?? "").trim();
        if (!text) continue;

        if (r.isFinal) {
          // ✅ chỉ lấy final mới (chưa commit)
          if (i >= lastFinalIndex) {
            out.push({
              // id ổn định theo index + time hiện tại cũng được
              id: `final_${i}_${Date.now()}`,
              text,
              isFinal: true,
              ts: Date.now(),
            });
            // cập nhật mốc: đã commit tới i
            lastFinalIndex = i + 1;
          }
        } else {
          // chỉ giữ interim mới nhất
          newestInterim = text;
        }
      }

      // nếu muốn vẫn gửi interim (App bạn đang filter final nên không ảnh hưởng)
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
