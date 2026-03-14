import { useRoute, useLocation } from "wouter";
import { useGetConversation, useSendMessage } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/chat/sidebar";
import { ChatInput } from "@/components/chat/chat-input";
import { MessageBubble } from "@/components/chat/message-bubble";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import { useChatScroll } from "@/hooks/use-chat-scroll";
import { Sparkles, Bot, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

export function ChatPage() {
  const [match, params] = useRoute("/:id");
  const conversationId = match ? parseInt(params.id) : null;
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: conversation, isLoading, isError } = useGetConversation(
    conversationId || 0,
    { query: { enabled: !!conversationId } }
  );

  const sendMessageMutation = useSendMessage({
    mutation: {
      onSuccess: (data) => {
        // Optimistically update the current conversation cache
        if (conversationId) {
          queryClient.setQueryData(
            [`/api/conversations/${conversationId}`],
            (old: any) => {
              if (!old) return old;
              return {
                ...old,
                messages: [...old.messages, data.userMessage, data.assistantMessage]
              };
            }
          );
        }
        // Invalidate list to update timestamp/counts
        queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      }
    }
  });

  const scrollRef = useChatScroll([conversation?.messages, sendMessageMutation.isPending]);

  const handleSend = (content: string) => {
    if (!conversationId) return;
    sendMessageMutation.mutate({
      conversationId,
      data: { content }
    });
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans selection:bg-primary/30">
      <Sidebar />
      
      <main className="flex-1 flex flex-col relative z-10 bg-background/50">
        {/* Abstract Background for main area */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <img 
            src={`${import.meta.env.BASE_URL}images/empty-state-bg.png`}
            alt="Background"
            className="w-full h-full object-cover opacity-10 mix-blend-screen"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background via-background/90 to-background" />
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col relative z-10">
          {!conversationId ? (
            // Empty State - No Conversation Selected
            <div className="flex-1 flex items-center justify-center p-8">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-md text-center space-y-6"
              >
                <div className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 flex items-center justify-center shadow-2xl shadow-primary/10 relative">
                   <div className="absolute inset-0 blur-xl bg-primary/20 rounded-full" />
                   <Sparkles className="w-12 h-12 text-primary relative z-10" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tight">Welcome to Nexus AI</h1>
                  <p className="text-muted-foreground">Select a conversation from the sidebar or start a new one to begin chatting.</p>
                </div>
              </motion.div>
            </div>
          ) : isLoading ? (
            // Loading State
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4 text-muted-foreground">
                <Bot className="w-8 h-8 animate-pulse text-primary/50" />
                <p className="text-sm font-medium">Loading conversation...</p>
              </div>
            </div>
          ) : isError ? (
            // Error State
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center space-y-4 bg-destructive/10 p-6 rounded-2xl border border-destructive/20">
                <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
                <p className="text-destructive font-medium">Failed to load conversation.</p>
                <button 
                  onClick={() => setLocation("/")}
                  className="text-sm text-foreground underline underline-offset-4 hover:text-primary transition-colors"
                >
                  Return to home
                </button>
              </div>
            </div>
          ) : (
            // Chat Area
            <>
              {/* Top Header Bar for Mobile (Optional, currently sidebar handles desktop) */}
              <header className="h-16 flex items-center px-6 border-b border-border/40 bg-background/50 backdrop-blur-md sticky top-0 z-20">
                <h2 className="font-semibold text-lg tracking-tight truncate">{conversation?.title}</h2>
              </header>

              <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 custom-scrollbar scroll-smooth"
              >
                {conversation?.messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <p>This is the beginning of your conversation.</p>
                  </div>
                ) : (
                  conversation?.messages.map((msg, idx) => (
                    <MessageBubble 
                      key={msg.id} 
                      message={msg} 
                      isLast={idx === conversation.messages.length - 1}
                    />
                  ))
                )}
                
                {sendMessageMutation.isPending && <TypingIndicator />}
              </div>
              
              {/* Input Area */}
              <div className="shrink-0 pt-2 pb-6 px-4 bg-gradient-to-t from-background via-background to-transparent z-20">
                <ChatInput 
                  onSend={handleSend} 
                  isPending={sendMessageMutation.isPending} 
                />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
