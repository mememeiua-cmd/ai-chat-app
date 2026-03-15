import { useState, useCallback, useRef } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export interface StreamMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export function useStreamChat(conversationId: number | null) {
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (
      content: string,
      imageBase64?: string,
      imageMimeType?: string,
      onDone?: (userMsg: StreamMessage, assistantMsg: StreamMessage) => void
    ) => {
      if (!conversationId || isPending) return;
      setIsPending(true);
      setStreamingContent("");
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const body: Record<string, string> = { content };
        if (imageBase64) {
          body.imageBase64 = imageBase64;
          body.imageMimeType = imageMimeType || "image/jpeg";
        }

        const res = await fetch(
          `${API_BASE}/api/conversations/${conversationId}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal,
          }
        );

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(errJson.error || res.statusText);
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const json = JSON.parse(line.slice(6));
              if (json.error) {
                setError(json.error);
              } else if (json.content) {
                accumulated += json.content;
                setStreamingContent(accumulated);
              } else if (json.done) {
                setStreamingContent(null);
                onDone?.(json.userMessage, json.assistantMessage);
              }
            } catch {
              // ignore malformed chunks
            }
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setError(err.message || "Network error");
        }
        setStreamingContent(null);
      } finally {
        setIsPending(false);
        abortRef.current = null;
      }
    },
    [conversationId, isPending]
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { sendMessage, streamingContent, isPending, error, abort };
}
