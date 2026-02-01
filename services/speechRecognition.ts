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

    rec.onstart = () => params.onState?.(true);

    rec.onresult = (event: any) => {
      const finals: TranscriptItem[] = [];
      let newestInterim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        const text = (r?.[0]?.transcript ?? "").trim();
        if (!text) continue;

        if (r.isFinal) {
          finals.push({
            id: `${Date.now()}_${i}_${Math.random().toString(16).slice(2)}`,
            text,
            isFinal: true,
            ts: Date.now(),
          });
        } else {
          // chỉ giữ interim mới nhất trong event
          newestInterim = text;
        }
      }

      const out: TranscriptItem[] = [
        ...finals,
        ...(newestInterim
          ? [
              {
                id: `${Date.now()}_interim_${Math.random().toString(16).slice(2)}`,
                text: newestInterim,
                isFinal: false,
                ts: Date.now(),
              },
            ]
          : []),
      ];

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
