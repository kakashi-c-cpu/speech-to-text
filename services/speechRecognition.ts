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
  lang?: string;
  onData: (items: TranscriptItem[]) => void; // sẽ trả: [final] hoặc [interim]
  onError?: (msg: string) => void;
  onState?: (listening: boolean) => void;
  pauseMs?: number; // ✅ thời gian im lặng để chốt (default 700ms)
}): SpeechSession {
  const Ctor = getCtor();
  const isSupported = !!Ctor;

  let rec: any = null;

  // debounce timer
  let t: any = null;
  const pauseMs = params.pauseMs ?? 700;

  // buffer câu hiện tại
  let latestText = ""; // text mới nhất (interim hoặc final)
  let lastCommitted = ""; // text đã commit gần nhất (để chống commit lại y chang)

  const clearTimer = () => {
    if (t) {
      clearTimeout(t);
      t = null;
    }
  };

  const commitIfNeeded = () => {
    clearTimer();
    const finalText = (latestText || "").trim();
    if (!finalText) return;
    if (finalText === lastCommitted) return; // ✅ chống lặp

    lastCommitted = finalText;

    params.onData([
      {
        id: `final_${Date.now()}`,
        text: finalText,
        isFinal: true,
        ts: Date.now(),
      },
    ]);
  };

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

    // reset
    clearTimer();
    latestText = "";
    lastCommitted = "";

    rec.onstart = () => params.onState?.(true);

    rec.onresult = (event: any) => {
      let best = "";

      // Lấy transcript "mới nhất" trong toàn bộ results
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        const text = (r?.[0]?.transcript ?? "").trim();
        if (!text) continue;

        // lấy cái cuối cùng (thường là câu đang nói / vừa nhận)
        best = text;
      }

      if (!best) return;

      latestText = best;

      // ✅ emit interim để UI có thể hiển thị realtime (tuỳ App có dùng hay không)
      params.onData([
        {
          id: `interim_${Date.now()}`,
          text: latestText,
          isFinal: false,
          ts: Date.now(),
        },
      ]);

      // ✅ debounce: im lặng pauseMs thì commit 1 lần
      clearTimer();
      t = setTimeout(() => {
        commitIfNeeded();
      }, pauseMs);
    };

    rec.onerror = (e: any) => {
      const code = e?.error ? String(e.error) : "unknown";
      params.onError?.(`SpeechRecognition error: ${code}`);
    };

    rec.onend = () => {
      // nếu đang có câu dở dang, chốt luôn khi kết thúc
      commitIfNeeded();

      params.onState?.(false);
      clearTimer();
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
      // stop -> onend sẽ commitIfNeeded()
      rec?.stop?.();
    } catch (err: any) {
      params.onError?.(`Không stop được: ${err?.message ?? String(err)}`);
    }
  };

  return { start, stop, isSupported };
}
