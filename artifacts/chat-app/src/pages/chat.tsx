import { useRoute, useLocation } from "wouter";
import { useGetConversation } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/chat/sidebar";
import { ChatInput } from "@/components/chat/chat-input";
import { MessageBubble } from "@/components/chat/message-bubble";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import { useChatScroll } from "@/hooks/use-chat-scroll";
import { useStreamChat, type StreamMessage } from "@/hooks/use-stream-chat";
import { Sparkles, Bot, AlertCircle, Menu } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useCallback } from "react";

export function ChatPage() {
  const [match, params] = useRoute("/:id");
  const conversationId = match ? parseInt(params.id) : null;
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      {/* Sidebar — hidden on mobile, visible on md+ */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 flex flex-col relative min-w-0 w-full">
        {!conversationId ? (
          <>
            {/* Mobile top bar */}
            <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border/30">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-xl hover:bg-muted/60 transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-bold text-sm">Nexus AI</span>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center p-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-md w-full text-center space-y-6"
              >
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/30 to-accent/20 border border-primary/20 flex items-center justify-center shadow-xl shadow-primary/10">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tight">Nexus AI</h1>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Trợ lý AI thông minh. Hỏi bất cứ điều gì, gửi ảnh, hoặc kết nối GitHub.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-left">
                  {[
                    { icon: "💬", title: "Trò chuyện", desc: "Đặt câu hỏi, nhận câu trả lời" },
                    { icon: "🖼️", title: "Phân tích ảnh", desc: "Gửi ảnh để AI phân tích" },
                    { icon: "⌨️", title: "Code & Debug", desc: "Viết và giải thích code" },
                    { icon: "🔗", title: "GitHub", desc: "Xem và sửa file từ repo" },
                  ].map((item) => (
                    <div key={item.title} className="bg-card border border-border/50 rounded-xl p-3 space-y-1">
                      <div className="text-xl">{item.icon}</div>
                      <div className="font-semibold text-xs">{item.title}</div>
                      <div className="text-[11px] text-muted-foreground">{item.desc}</div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground/50">
                  Nhấn <span className="font-medium text-muted-foreground">☰</span> hoặc nút <span className="font-medium text-muted-foreground">+ Cuộc trò chuyện mới</span> để bắt đầu
                </p>
              </motion.div>
            </div>
          </>
        ) : isLoading ? (
          <>
            <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border/30">
              <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl hover:bg-muted/60 transition-colors">
                <Menu className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Bot className="w-8 h-8 animate-pulse text-primary/50" />
                <p className="text-sm">Đang tải cuộc trò chuyện...</p>
              </div>
            </div>
          </>
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
            <header className="h-14 flex items-center px-4 border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-20 shrink-0 gap-3">
              {/* Hamburger on mobile */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden p-2 rounded-xl hover:bg-muted/60 transition-colors flex-shrink-0"
              >
                <Menu className="w-5 h-5" />
              </button>
              <h2 className="font-semibold truncate flex-1 text-sm">{conversation?.title}</h2>
            </header>

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4"
            >
              {allMessages.length === 0 && (
                <div className="h-full flex items-center justify-center text-muted-foreground/60 text-sm">
                  Gửi tin nhắn đầu tiên để bắt đầu
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

            <div className="shrink-0 px-3 pb-4 pt-2 bg-background border-t border-border/30">
              <ChatInput onSend={handleSend} isPending={isPending} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
