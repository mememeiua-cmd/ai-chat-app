import { motion } from "framer-motion";

export function TypingIndicator() {
  return (
    <div className="flex w-full justify-start mt-4 mb-2">
      <div className="flex gap-4 max-w-[75%]">
        <div className="flex-shrink-0 mt-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
              className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
            />
          </div>
        </div>
        <div className="px-5 py-4 bg-card border border-border/50 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-1.5 h-[48px]">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 bg-primary/60 rounded-full"
              animate={{ y: ["0%", "-50%", "0%"] }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.15,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
