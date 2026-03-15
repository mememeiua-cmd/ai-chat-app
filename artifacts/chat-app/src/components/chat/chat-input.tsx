import { useState, useRef, KeyboardEvent, useCallback } from "react";
import { Send, Loader2, ImagePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (content: string, imageBase64?: string, imageMimeType?: string) => void;
  isPending: boolean;
  disabled?: boolean;
}

export function ChatInput({ onSend, isPending, disabled }: ChatInputProps) {
  const [content, setContent] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>("image/jpeg");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if ((!content.trim() && !imageBase64) || isPending || disabled) return;
    onSend(content.trim(), imageBase64 || undefined, imageMimeType);
    setContent("");
    setImagePreview(null);
    setImageBase64(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
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
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const mime = file.type || "image/jpeg";
    setImageMimeType(mime);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      const base64 = result.split(",")[1];
      setImageBase64(base64);
      setImagePreview(result);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (!file) continue;
        const mime = file.type;
        setImageMimeType(mime);
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

  const canSend = (content.trim() || imageBase64) && !isPending && !disabled;

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div
        className={cn(
          "relative flex flex-col bg-card border border-border/60 rounded-2xl shadow-lg transition-all duration-200",
          "focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 focus-within:shadow-xl focus-within:shadow-primary/5",
          disabled && "opacity-50 pointer-events-none"
        )}
      >
        {/* Image Preview */}
        {imagePreview && (
          <div className="px-3 pt-3">
            <div className="relative inline-block">
              <img
                src={imagePreview}
                alt="Ảnh đính kèm"
                className="h-24 w-auto rounded-xl object-cover border border-border/50 shadow-sm"
              />
              <button
                onClick={() => { setImagePreview(null); setImageBase64(null); }}
                className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center shadow-md hover:bg-destructive/80 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Input Row */}
        <div className="flex items-end gap-1 p-2">
          {/* Image upload button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending || disabled}
            className={cn(
              "flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 mb-0.5",
              "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
            title="Đính kèm ảnh"
          >
            <ImagePlus className="w-4.5 h-4.5" />
          </button>

          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Nhắn tin với Nexus AI..."
            disabled={disabled || isPending}
            rows={1}
            className="flex-1 bg-transparent border-0 text-foreground placeholder:text-muted-foreground/60 resize-none focus:ring-0 focus:outline-none py-2.5 px-2 min-h-[40px] max-h-[200px] text-sm leading-relaxed"
            style={{ overflowY: content.split("\n").length > 4 ? "auto" : "hidden" }}
          />

          <button
            onClick={handleSubmit}
            disabled={!canSend}
            className={cn(
              "flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 mb-0.5",
              canSend
                ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 shadow-md shadow-primary/30"
                : "bg-muted text-muted-foreground/40 cursor-not-allowed"
            )}
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageSelect}
      />

      <p className="text-center text-[11px] text-muted-foreground/40 mt-2">
        Nhấn Enter để gửi • Shift+Enter xuống dòng • Dán ảnh từ clipboard
      </p>
    </div>
  );
}
