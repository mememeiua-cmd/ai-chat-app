import { useListConversations, useCreateConversation, useDeleteConversation } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, MessageSquare, Trash2, Loader2, Sparkles } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export function Sidebar() {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const { data: conversations, isLoading } = useListConversations();
  
  const createMutation = useCreateConversation({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
        setLocation(`/${data.id}`);
      }
    }
  });

  const deleteMutation = useDeleteConversation({
    mutation: {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
        if (location === `/${variables.conversationId}`) {
          setLocation("/");
        }
      }
    }
  });

  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleCreate = () => {
    createMutation.mutate({ data: { title: "New Conversation" } });
  };

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.preventDefault(); // Prevent link click
    setDeletingId(id);
    deleteMutation.mutate({ conversationId: id }, {
      onSettled: () => setDeletingId(null)
    });
  };

  return (
    <div className="w-72 flex-shrink-0 bg-sidebar border-r border-sidebar-border h-full flex flex-col z-20 shadow-[4px_0_24px_rgba(0,0,0,0.2)]">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border/50">
        <button
          onClick={handleCreate}
          disabled={createMutation.isPending}
          className="w-full flex items-center gap-2 px-4 py-3 rounded-xl font-semibold bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
        >
          {createMutation.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Plus className="w-5 h-5" />
          )}
          <span>New Chat</span>
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : conversations?.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground flex flex-col items-center gap-3">
            <Sparkles className="w-8 h-8 opacity-20" />
            <p className="text-sm">No conversations yet.<br/>Start a new one above!</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {conversations?.sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).map((conv) => {
              const isActive = location === `/${conv.id}`;
              const isDeleting = deletingId === conv.id;
              
              return (
                <motion.div
                  key={conv.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                >
                  <Link
                    href={`/${conv.id}`}
                    className={cn(
                      "group flex items-center justify-between p-3 rounded-lg transition-all duration-200 relative overflow-hidden",
                      isActive 
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-inner" 
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                  >
                    {isActive && (
                      <motion.div 
                        layoutId="active-pill" 
                        className="absolute left-0 top-0 bottom-0 w-1 bg-primary"
                      />
                    )}
                    
                    <div className="flex items-center gap-3 overflow-hidden">
                      <MessageSquare className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                      <div className="flex flex-col overflow-hidden">
                        <span className="truncate text-sm font-medium">{conv.title}</span>
                        <span className="text-[10px] text-muted-foreground/70 font-mono tracking-tighter">
                          {formatDate(conv.updatedAt)}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleDelete(e, conv.id)}
                      disabled={isDeleting}
                      className={cn(
                        "p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors",
                        isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                        isDeleting && "opacity-100 text-destructive"
                      )}
                    >
                      {isDeleting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
      
      {/* Footer Logo/Brand */}
      <div className="p-4 border-t border-sidebar-border/50 bg-sidebar-accent/20">
        <div className="flex items-center gap-3">
           <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
              <Sparkles className="w-4 h-4 text-white" />
           </div>
           <div>
             <div className="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">Nexus AI</div>
             <div className="text-xs text-muted-foreground font-medium">Replit Agent Build</div>
           </div>
        </div>
      </div>
    </div>
  );
}
