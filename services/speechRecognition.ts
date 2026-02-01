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
  onData: (items: TranscriptItem[]) => void;
  onError?: (msg: string) => void;
  onState?: (listening: boolean) => void;
  pauseMs?: number; // default 700
}): SpeechSession {
  const Ctor = getCtor();
  const isSupported = !!Ctor;

  let rec: any = null;

  // ✅ token để ignore late events của session cũ
  let runId = 0;

  // debounce timer
  let t: any = null;
  const pauseMs = params.pauseMs ?? 700;

  // buffer
  let latestText = "";
  let lastCommitted = ""; // normalized

  const norm = (s: string) =>
    s
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[.。!?]+$/g, ""); // bỏ dấu cuối câu hay gây lặp

  const clearTimer = () => {
    if (t) {
      clearTimeout(t);
      t = null;
    }
  };

  const commitIfNeeded = (myRunId: number) => {
    if (myRunId !== runId) return;

    const finalText = norm(latestText || "");
    if (!finalText) return;

    if (finalText === lastCommitted) return;
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

    runId += 1;
    const myRunId = runId;

    // stop instance cũ (nếu có)
    try {
      rec?.stop?.();
    } catch {
      // ignore
    }

    clearTimer();
    latestText = "";
    // ❗không reset lastCommitted để tránh lặp do onend trễ

    rec = new Ctor();
    rec.lang = params.lang ?? "vi-VN";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      if (myRunId !== runId) return;
      params.onState?.(true);
    };

    rec.onresult = (event: any) => {
      if (myRunId !== runId) return;

      let best = "";

      // lấy transcript mới nhất
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        const text = (r?.[0]?.transcript ?? "").trim();
        if (!text) continue;
        best = text;
      }

      if (!best) return;

      latestText = best;

      // emit interim để UI hiển thị realtime
      params.onData([
        {
          id: `interim_${Date.now()}`,
          text: latestText,
          isFinal: false,
          ts: Date.now(),
        },
      ]);

      // debounce: pauseMs im lặng => commit 1 lần
      clearTimer();
      t = setTimeout(() => commitIfNeeded(myRunId), pauseMs);
    };

    rec.onerror = (e: any) => {
      if (myRunId !== runId) return;
      const code = e?.error ? String(e.error) : "unknown";
      params.onError?.(`SpeechRecognition error: ${code}`);
    };

    rec.onend = () => {
      if (myRunId !== runId) return;

      // ✅ QUAN TRỌNG: KHÔNG commit ở đây nữa để tránh lặp 1 lần sau khi đã commit bằng pause
      // commitIfNeeded(myRunId);

      params.onState?.(false);
      clearTimer();
      rec = null;
    };

    try {
      rec.start();
    } catch (err: any) {
      if (myRunId !== runId) return;
      params.onError?.(`Không start được: ${err?.message ?? String(err)}`);
      params.onState?.(false);
      clearTimer();
      rec = null;
    }
  };

  const stop = () => {
    // stop sẽ trigger onend, nhưng onend không commit nữa => không bị lặp
    try {
      rec?.stop?.();
    } catch (err: any) {
      params.onError?.(`Không stop được: ${err?.message ?? String(err)}`);
    }
  };

  return { start, stop, isSupported };
}
