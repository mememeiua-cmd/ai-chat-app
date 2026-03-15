import { useRoute, useLocation } from "wouter";
import { useGetConversation } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/chat/sidebar";
import { ChatInput } from "@/components/chat/chat-input";
import { MessageBubble } from "@/components/chat/message-bubble";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import { useChatScroll } from "@/hooks/use-chat-scroll";
import { useStreamChat, type StreamMessage } from "@/hooks/use-stream-chat";
import { Sparkles, Bot, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useCallback } from "react";

export function ChatPage() {
  const [match, params] = useRoute("/:id");
  const conversationId = match ? parseInt(params.id) : null;
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: conversation, isLoading, isError } = useGetConversation(
    conversationId || 0,
    { query: { enabled: !!conversationId } }
  );

  const [localMessages, setLocalMessages] = useState<StreamMessage[]>([]);
  const { sendMessage, streamingContent, isPending, error } = useStreamChat(conversationId);

  const scrollRef = useChatScroll([conversation?.messages, localMessages, streamingContent, isPending]);

  const handleSend = useCallback(async (content: string, imageBase64?: string, imageMimeType?: string) => {
    if (!conversationId) return;

    const optimisticUserMsg: StreamMessage = {
      id: Date.now(),
      role: "user",
      content: imageBase64 ? `${content}\n\n[image:data:${imageMimeType};base64,${imageBase64}]` : content,
      createdAt: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, optimisticUserMsg]);

    await sendMessage(content, imageBase64, imageMimeType, (userMsg, assistantMsg) => {
      setLocalMessages([]);
      queryClient.setQueryData(
        [`/api/conversations/${conversationId}`],
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            messages: [...(old.messages || []), userMsg, assistantMsg],
          };
        }
      );
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    });
  }, [conversationId, sendMessage, queryClient]);

  const allMessages = [
    ...(conversation?.messages || []),
    ...localMessages.filter(
      (lm) => !(conversation?.messages || []).find((m: any) => m.id === lm.id)
    ),
  ];

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col relative min-w-0">
        {!conversationId ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-lg text-center space-y-8"
            >
              <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-primary/30 to-accent/20 border border-primary/20 flex items-center justify-center shadow-xl shadow-primary/10">
                <Sparkles className="w-10 h-10 text-primary" />
              </div>
              <div className="space-y-3">
                <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/60">
                  Nexus AI
                </h1>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Trợ lý AI thông minh. Hỏi bất cứ điều gì, gửi ảnh, hoặc kết nối với GitHub để xem và chỉnh sửa code.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-left">
                {[
                  { icon: "💬", title: "Trò chuyện", desc: "Đặt câu hỏi, nhận câu trả lời chi tiết" },
                  { icon: "🖼️", title: "Phân tích ảnh", desc: "Gửi ảnh để AI nhận xét và phân tích" },
                  { icon: "⌨️", title: "Code & Debug", desc: "Viết, sửa và giải thích code" },
                  { icon: "🔗", title: "GitHub", desc: "Xem và sửa file trực tiếp từ repo" },
                ].map((item) => (
                  <div key={item.title} className="bg-card border border-border/50 rounded-xl p-4 space-y-1">
                    <div className="text-2xl">{item.icon}</div>
                    <div className="font-semibold text-sm">{item.title}</div>
                    <div className="text-xs text-muted-foreground">{item.desc}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        ) : isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Bot className="w-8 h-8 animate-pulse text-primary/50" />
              <p className="text-sm">Đang tải cuộc trò chuyện...</p>
            </div>
          </div>
        ) : isError ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center space-y-4 bg-destructive/10 p-6 rounded-2xl border border-destructive/20">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
              <p className="text-destructive font-medium">Không thể tải cuộc trò chuyện.</p>
              <button
                onClick={() => setLocation("/")}
                className="text-sm underline underline-offset-4 hover:text-primary transition-colors"
              >
                Về trang chủ
              </button>
            </div>
          </div>
        ) : (
          <>
            <header className="h-14 flex items-center px-5 border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-20 shrink-0">
              <h2 className="font-semibold truncate">{conversation?.title}</h2>
            </header>

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4"
            >
              {allMessages.length === 0 && (
                <div className="h-full flex items-center justify-center text-muted-foreground/60 text-sm">
                  Gửi tin nhắn đầu tiên để bắt đầu cuộc trò chuyện
                </div>
              )}
              {allMessages.map((msg, idx) => (
                <MessageBubble
                  key={msg.id}
                  message={msg as any}
                  isLast={idx === allMessages.length - 1}
                />
              ))}

              {isPending && streamingContent !== null && (
                <MessageBubble
                  message={{
                    id: -1,
                    role: "assistant",
                    content: streamingContent || "",
                    createdAt: new Date().toISOString(),
                    conversationId: conversationId!,
                  } as any}
                  isStreaming
                />
              )}

              {isPending && streamingContent === "" && <TypingIndicator />}

              {error && (
                <div className="flex justify-center">
                  <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2">
                    Lỗi: {error}
                  </div>
                </div>
              )}
            </div>

            <div className="shrink-0 px-4 pb-4 pt-2 bg-background border-t border-border/30">
              <ChatInput onSend={handleSend} isPending={isPending} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
