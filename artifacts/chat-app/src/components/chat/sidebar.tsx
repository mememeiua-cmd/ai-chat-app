import { useListConversations, useCreateConversation, useDeleteConversation } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus, MessageSquare, Trash2, Loader2, Sparkles, Github
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { GitHubPanel } from "@/components/github/github-panel";

export function Sidebar() {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [showGitHub, setShowGitHub] = useState(false);

  const { data: conversations, isLoading } = useListConversations();

  const createMutation = useCreateConversation({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
        setLocation(`/${data.id}`);
      },
    },
  });

  const deleteMutation = useDeleteConversation({
    mutation: {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
        if (location === `/${variables.conversationId}`) {
          setLocation("/");
        }
      },
    },
  });

  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleCreate = () => {
    createMutation.mutate({ data: { title: "Cuộc trò chuyện mới" } });
  };

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    setDeletingId(id);
    deleteMutation.mutate({ conversationId: id }, {
      onSettled: () => setDeletingId(null),
    });
  };

  return (
    <>
      {/* Main Sidebar */}
      <div className="w-64 flex-shrink-0 bg-sidebar border-r border-sidebar-border h-full flex flex-col z-20">
        {/* Brand header */}
        <div className="px-4 pt-5 pb-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-bold text-sm">Nexus AI</div>
            <div className="text-[10px] text-muted-foreground">AI Assistant</div>
          </div>
        </div>

        {/* New Chat Button */}
        <div className="px-3 pb-3">
          <button
            onClick={handleCreate}
            disabled={createMutation.isPending}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 shadow-md shadow-primary/25 hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0"
          >
            {createMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            <span>Cuộc trò chuyện mới</span>
          </button>
        </div>

        <div className="px-3 pb-2">
          <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-1">Lịch sử</span>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-0.5 pb-2">
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/50" />
            </div>
          ) : conversations?.length === 0 ? (
            <div className="text-center py-8 px-4 text-muted-foreground/50 text-xs">
              Chưa có cuộc trò chuyện nào
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {conversations
                ?.slice()
                .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                .map((conv) => {
                  const isActive = location === `/${conv.id}`;
                  const isDeleting = deletingId === conv.id;
                  return (
                    <motion.div
                      key={conv.id}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                    >
                      <Link
                        href={`/${conv.id}`}
                        className={cn(
                          "group flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-150 relative overflow-hidden",
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                        )}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="active-indicator"
                            className="absolute left-0 top-2 bottom-2 w-0.5 bg-primary rounded-full"
                          />
                        )}
                        <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
                          <MessageSquare
                            className={cn(
                              "w-3.5 h-3.5 flex-shrink-0",
                              isActive ? "text-primary" : "text-muted-foreground/60"
                            )}
                          />
                          <div className="overflow-hidden">
                            <div className="text-[13px] font-medium truncate">{conv.title}</div>
                            <div className="text-[10px] text-muted-foreground/50">
                              {formatDate(conv.updatedAt)}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleDelete(e, conv.id)}
                          disabled={isDeleting}
                          className={cn(
                            "flex-shrink-0 p-1 rounded-md hover:bg-destructive/15 hover:text-destructive transition-colors",
                            isActive ? "opacity-60 hover:opacity-100" : "opacity-0 group-hover:opacity-60 hover:!opacity-100",
                            isDeleting && "opacity-100 text-destructive"
                          )}
                        >
                          {isDeleting ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                        </button>
                      </Link>
                    </motion.div>
                  );
                })}
            </AnimatePresence>
          )}
        </div>

        {/* GitHub Button */}
        <div className="px-3 py-3 border-t border-sidebar-border/50">
          <button
            onClick={() => setShowGitHub((v) => !v)}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
              showGitHub
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
            )}
          >
            <Github className="w-4 h-4" />
            <span>GitHub</span>
            {localStorage.getItem("gh_token") && (
              <span className="ml-auto text-[9px] bg-green-500/20 text-green-400 border border-green-500/20 rounded-full px-1.5 py-0.5">
                •
              </span>
            )}
          </button>
        </div>
      </div>

      {/* GitHub Panel (side panel) */}
      <AnimatePresence>
        {showGitHub && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 340, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden flex-shrink-0"
          >
            <GitHubPanel onClose={() => setShowGitHub(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
