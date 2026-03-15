import { cn, formatDate } from "@/lib/utils";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { User, Sparkles } from "lucide-react";
import type { Message } from "@workspace/api-client-react/src/generated/api.schemas";

interface MessageBubbleProps {
  message: Message & { id: number };
  isLast?: boolean;
  isStreaming?: boolean;
}

function parseContent(raw: string): { text: string; imageUrl?: string } {
  const match = raw.match(/\n\n\[image:(data:[^\]]+)\]$/);
  if (match) {
    return {
      text: raw.slice(0, raw.length - match[0].length).trim(),
      imageUrl: match[1],
    };
  }
  return { text: raw };
}

export function MessageBubble({ message, isLast, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const { text, imageUrl } = parseContent(message.content || "");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn("flex w-full group", isUser ? "justify-end" : "justify-start")}
    >
      <div className={cn("flex gap-3 max-w-[85%] md:max-w-[72%]", isUser ? "flex-row-reverse" : "flex-row")}>
        {/* Avatar */}
        <div className="flex-shrink-0 mt-0.5">
          {isUser ? (
            <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md shadow-primary/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
          )}
        </div>

        {/* Bubble */}
        <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
          {/* Image if any */}
          {imageUrl && (
            <img
              src={imageUrl}
              alt="Ảnh đính kèm"
              className="max-w-xs max-h-64 rounded-xl object-cover border border-border/40 shadow-sm mb-1"
            />
          )}

          {/* Text bubble (show if has text or is streaming) */}
          {(text || isStreaming) && (
            <div
              className={cn(
                "px-4 py-3 shadow-sm relative",
                isUser
                  ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm"
                  : "bg-card border border-border/50 text-foreground rounded-2xl rounded-tl-sm"
              )}
            >
              {isUser ? (
                <p className="whitespace-pre-wrap leading-relaxed text-sm">{text}</p>
              ) : (
                <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-p:my-1 prose-pre:bg-background/80 prose-pre:border prose-pre:border-border prose-code:text-primary prose-a:text-primary">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {text}
                  </ReactMarkdown>
                  {isStreaming && (
                    <span className="inline-block w-1.5 h-4 bg-primary/70 ml-0.5 animate-pulse rounded-sm align-middle" />
                  )}
                </div>
              )}
            </div>
          )}

          <span className="text-[11px] text-muted-foreground/50 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {message.createdAt ? formatDate(message.createdAt) : ""}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
