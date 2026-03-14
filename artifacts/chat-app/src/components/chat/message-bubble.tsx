import { cn, formatDate } from "@/lib/utils";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { User, Sparkles } from "lucide-react";
import type { Message } from "@workspace/api-client-react/src/generated/api.schemas";

interface MessageBubbleProps {
  message: Message;
  isLast?: boolean;
}

export function MessageBubble({ message, isLast }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "flex w-full group",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div className={cn(
        "flex gap-4 max-w-[85%] md:max-w-[75%]",
        isUser ? "flex-row-reverse" : "flex-row"
      )}>
        
        {/* Avatar */}
        <div className="flex-shrink-0 mt-1">
          {isUser ? (
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 shadow-inner">
              <User className="w-4 h-4 text-primary" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 relative overflow-hidden">
              <div className="absolute inset-0 bg-white/20 backdrop-blur-sm" />
              <img 
                src={`${import.meta.env.BASE_URL}images/ai-avatar.png`} 
                alt="AI" 
                className="w-full h-full object-cover relative z-10 opacity-90 mix-blend-screen"
                onError={(e) => {
                  // Fallback if image not generated yet
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement?.querySelector('svg')?.classList.remove('hidden');
                }}
              />
              <Sparkles className="w-4 h-4 text-white relative z-10 hidden" />
            </div>
          )}
        </div>

        {/* Bubble */}
        <div className={cn(
          "flex flex-col gap-1",
          isUser ? "items-end" : "items-start"
        )}>
          <div className={cn(
            "px-5 py-3.5 shadow-sm",
            isUser 
              ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm" 
              : "bg-card border border-border/50 text-foreground rounded-2xl rounded-tl-sm shadow-black/5"
          )}>
            {isUser ? (
              <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
            ) : (
              <div className="prose prose-invert prose-p:leading-relaxed prose-pre:bg-background prose-pre:border prose-pre:border-border max-w-none prose-sm sm:prose-base prose-a:text-primary hover:prose-a:text-primary/80">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
          </div>
          
          <span className="text-[11px] font-medium text-muted-foreground/60 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {formatDate(message.createdAt)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
