import { useState, useRef, KeyboardEvent } from "react";
import { Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (content: string) => void;
  isPending: boolean;
  disabled?: boolean;
}

export function ChatInput({ onSend, isPending, disabled }: ChatInputProps) {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (content.trim() && !isPending && !disabled) {
      onSend(content.trim());
      setContent("");
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'; // reset height
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    // Auto-resize logic
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  return (
    <div className="p-4 w-full max-w-4xl mx-auto">
      <div className={cn(
        "relative flex items-end gap-2 bg-card border border-border/50 rounded-3xl p-2 shadow-lg shadow-black/10 transition-all duration-300",
        "focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10 focus-within:shadow-xl",
        disabled && "opacity-50 grayscale-[0.5] pointer-events-none"
      )}>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Message AI Assistant..."
          disabled={disabled || isPending}
          rows={1}
          className="w-full bg-transparent border-0 text-foreground placeholder:text-muted-foreground resize-none focus:ring-0 focus:outline-none py-3 px-4 min-h-[48px] max-h-[200px] text-sm sm:text-base custom-scrollbar"
          style={{ overflowY: content.split('\n').length > 5 ? 'auto' : 'hidden' }}
        />
        
        <button
          onClick={handleSubmit}
          disabled={!content.trim() || isPending || disabled}
          className={cn(
            "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 mb-1 mr-1",
            content.trim() && !isPending && !disabled
              ? "bg-primary text-primary-foreground hover:scale-105 shadow-md shadow-primary/25"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          {isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-4 h-4 ml-0.5" />
          )}
        </button>
      </div>
      <div className="text-center mt-2">
        <span className="text-[10px] text-muted-foreground/60 font-medium tracking-wide">
          AI can make mistakes. Consider verifying important information.
        </span>
      </div>
    </div>
  );
}
