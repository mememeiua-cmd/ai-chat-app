import { useRoute, useLocation } from "wouter";
import { useGetConversation, useCreateConversation } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/chat/sidebar";
import { MessageBubble } from "@/components/chat/message-bubble";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import { useChatScroll } from "@/hooks/use-chat-scroll";
import { useStreamChat, type StreamMessage } from "@/hooks/use-stream-chat";
import { Sparkles, Bot, AlertCircle, Menu, Send, ImagePlus, X, Loader2 } from "lucide-react";
import { useState, useCallback, useRef, useEffect, KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

interface PendingMsg {
  text: string;
  imageBase64?: string;
  imageMimeType?: string;
}

export function ChatPage() {
  const [match, params] = useRoute("/:id");
  const conversationId = match ? parseInt(params.id) : null;
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Input state
  const [inputText, setInputText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState("image/jpeg");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Pending first message — sent after navigation to new conversation
  const pendingMsg = useRef<PendingMsg | null>(null);

  const createConv = useCreateConversation();

  const { data: conversation, isLoading, isError } = useGetConversation(
    conversationId || 0,
    { query: { enabled: !!conversationId } }
  );

  const [localMessages, setLocalMessages] = useState<StreamMessage[]>([]);
  const { sendMessage, streamingContent, isPending, error } = useStreamChat(conversationId);
  const scrollRef = useChatScroll([conversation?.messages, localMessages, streamingContent, isPending]);

  // When we land on a conversation with a pending message, send it
  useEffect(() => {
    if (!conversationId || !pendingMsg.current) return;
    const { text, imageBase64: b64, imageMimeType: mime } = pendingMsg.current;
    pendingMsg.current = null;

    if (!text && !b64) return;

    const optimistic: StreamMessage = {
      id: Date.now(),
      role: "user",
      content: b64 ? `${text}\n\n[image:data:${mime};base64,${b64}]` : text,
      createdAt: new Date().toISOString(),
    };
    setLocalMessages([optimistic]);
    setIsCreating(false);

    sendMessage(text, b64, mime, (userMsg, assistantMsg) => {
      setLocalMessages([]);
      queryClient.setQueryData(
        [`/api/conversations/${conversationId}`],
        (old: any) => old ? { ...old, messages: [...(old.messages || []), userMsg, assistantMsg] } : old
      );
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    });
  }, [conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const allMessages = [
    ...(conversation?.messages || []),
    ...localMessages.filter(
      (lm) => !(conversation?.messages || []).find((m: any) => m.id === lm.id)
    ),
  ];

  const clearImage = () => { setImagePreview(null); setImageBase64(null); };

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const mime = file.type || "image/jpeg";
    setImageMimeType(mime);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setImageBase64(result.split(",")[1]);
      setImagePreview(result);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    for (const item of e.clipboardData.items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (!file) continue;
        setImageMimeType(file.type);
        const reader = new FileReader();
        reader.onload = (ev) => {
          const result = ev.target?.result as string;
          setImageBase64(result.split(",")[1]);
          setImagePreview(result);
        };
        reader.readAsDataURL(file);
        e.preventDefault();
        break;
      }
    }
  }, []);

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  };

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if ((!text && !imageBase64) || isPending || isCreating) return;

    // Capture current values
    const b64 = imageBase64 || undefined;
    const mime = imageMimeType;

    // Clear input immediately for responsiveness
    setInputText("");
    clearImage();
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    if (conversationId) {
      // Already in a conversation — send directly
      const optimistic: StreamMessage = {
        id: Date.now(),
        role: "user",
        content: b64 ? `${text}\n\n[image:data:${mime};base64,${b64}]` : text,
        createdAt: new Date().toISOString(),
      };
      setLocalMessages((prev) => [...prev, optimistic]);
      await sendMessage(text, b64, mime, (userMsg, assistantMsg) => {
        setLocalMessages([]);
        queryClient.setQueryData(
          [`/api/conversations/${conversationId}`],
          (old: any) => old ? { ...old, messages: [...(old.messages || []), userMsg, assistantMsg] } : old
        );
        queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      });
    } else {
      // Home screen — create a new conversation, store message as pending, then navigate
      setIsCreating(true);
      try {
        pendingMsg.current = { text, imageBase64: b64, imageMimeType: mime };
        const conv = await createConv.mutateAsync({ data: { title: text.slice(0, 60) || "Cuộc trò chuyện mới" } });
        queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
        setLocation(`/${conv.id}`);
        // pendingMsg is consumed in the useEffect above once conversationId updates
      } catch {
        pendingMsg.current = null;
        setIsCreating(false);
      }
    }
  }, [inputText, imageBase64, imageMimeType, isPending, isCreating, conversationId, sendMessage, createConv, queryClient, setLocation]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = !!(inputText.trim() || imageBase64) && !isPending && !isCreating;

  // ── Chat input bar — used on BOTH home screen and active conversation ──
  const ChatInputBar = (
    <div className="px-3 pb-4 pt-2 bg-background border-t border-border/30 shrink-0">
      <div className={cn(
        "relative flex flex-col bg-card border border-border/60 rounded-2xl shadow-lg transition-all duration-200 max-w-3xl mx-auto",
        "focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10"
      )}>
        {imagePreview && (
          <div className="px-3 pt-3">
            <div className="relative inline-block">
              <img src={imagePreview} alt="Ảnh đính kèm" className="h-20 w-auto rounded-xl object-cover border border-border/50" />
              <button onClick={clearImage} className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center shadow">
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
        <div className="flex items-end gap-1 p-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending || isCreating}
            className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors mb-0.5"
            title="Đính kèm ảnh"
          >
            <ImagePlus className="w-[18px] h-[18px]" />
          </button>
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => { setInputText(e.target.value); autoResize(e.target); }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Nhắn tin với Nexus AI..."
            rows={1}
            className="flex-1 bg-transparent border-0 text-foreground placeholder:text-muted-foreground/60 resize-none focus:ring-0 focus:outline-none py-2.5 px-2 min-h-[40px] max-h-[180px] text-sm leading-relaxed"
          />
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={cn(
              "flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 mb-0.5",
              canSend
                ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/30 active:scale-95"
                : "bg-muted text-muted-foreground/40 cursor-not-allowed"
            )}
          >
            {isPending || isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <p className="text-center text-[11px] text-muted-foreground/40 mt-1.5">
        Enter để gửi · Shift+Enter xuống dòng · Dán ảnh từ clipboard
      </p>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
    </div>
  );

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 flex flex-col min-w-0 w-full overflow-hidden">
        {/* Top header */}
        <header className="h-14 flex items-center gap-3 px-4 border-b border-border/40 bg-background/90 backdrop-blur-sm shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 rounded-xl hover:bg-muted/60 transition-colors flex-shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>
          {conversationId && !isLoading && !isError ? (
            <h2 className="font-semibold text-sm truncate flex-1">{conversation?.title}</h2>
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-bold text-sm">Nexus AI</span>
            </div>
          )}
        </header>

        {/* Body */}
        {!conversationId ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 flex flex-col items-center justify-center p-6 gap-5 overflow-y-auto">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/20 border border-primary/20 flex items-center justify-center shadow-lg">
                <Sparkles className="w-7 h-7 text-primary" />
              </div>
              <div className="text-center space-y-1.5 max-w-xs">
                <h1 className="text-xl font-bold">Xin chào!</h1>
                <p className="text-muted-foreground text-sm">Nhắn tin bên dưới để bắt đầu trò chuyện.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
                {[
                  { icon: "💬", text: "Đặt câu hỏi bất kỳ" },
                  { icon: "🖼️", text: "Gửi ảnh để phân tích" },
                  { icon: "⌨️", text: "Hỗ trợ code & debug" },
                  { icon: "🔗", text: "Kết nối GitHub repo" },
                ].map((item) => (
                  <button
                    key={item.text}
                    onClick={() => { setInputText(item.text); textareaRef.current?.focus(); }}
                    className="bg-card border border-border/50 rounded-xl p-3 text-left text-xs hover:border-primary/40 hover:bg-muted/50 transition-all active:scale-95"
                  >
                    <span className="text-base block mb-1">{item.icon}</span>
                    <span className="text-muted-foreground">{item.text}</span>
                  </button>
                ))}
              </div>
            </div>
            {ChatInputBar}
          </div>
        ) : isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Bot className="w-8 h-8 animate-pulse text-primary/50" />
              <p className="text-sm">Đang tải...</p>
            </div>
          </div>
        ) : isError ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center space-y-3 bg-destructive/10 p-5 rounded-2xl border border-destructive/20 max-w-xs w-full">
              <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
              <p className="text-destructive font-medium text-sm">Không tải được cuộc trò chuyện.</p>
              <button onClick={() => setLocation("/")} className="text-sm underline underline-offset-4 text-muted-foreground">
                Về trang chủ
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
              {allMessages.length === 0 && !isPending && (
                <div className="h-full flex items-center justify-center text-muted-foreground/50 text-sm">
                  Gửi tin nhắn đầu tiên để bắt đầu
                </div>
              )}
              {allMessages.map((msg, idx) => (
                <MessageBubble key={msg.id} message={msg as any} isLast={idx === allMessages.length - 1} />
              ))}
              {isPending && streamingContent !== null && (
                <MessageBubble
                  message={{ id: -1, role: "assistant", content: streamingContent || "", createdAt: new Date().toISOString(), conversationId: conversationId! } as any}
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
            {ChatInputBar}
          </div>
        )}
      </main>
    </div>
  );
}
