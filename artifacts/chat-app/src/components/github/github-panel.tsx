import { useState, useEffect, useCallback } from "react";
import {
  Github, ChevronRight, ChevronDown, FileCode, Folder, FolderOpen,
  RefreshCw, Save, AlertCircle, Check, Lock, X, ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

interface TreeNode {
  path: string;
  type: "blob" | "tree";
  sha: string;
}

interface Repo {
  full_name: string;
  name: string;
  private: boolean;
  updated_at: string;
  default_branch: string;
}

interface FileContent {
  path: string;
  content: string;
  sha: string;
}

function ghHeaders(token: string) {
  return { "x-github-token": token };
}

function getLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    ts: "TypeScript", tsx: "TypeScript", js: "JavaScript", jsx: "JavaScript",
    py: "Python", go: "Go", rs: "Rust", java: "Java", kt: "Kotlin",
    css: "CSS", scss: "SCSS", html: "HTML", json: "JSON", yaml: "YAML",
    yml: "YAML", md: "Markdown", sh: "Shell", toml: "TOML",
  };
  return map[ext] || ext.toUpperCase() || "Text";
}

function buildTree(nodes: TreeNode[]) {
  const root: Record<string, any> = {};
  for (const node of nodes) {
    const parts = node.path.split("/");
    let cur = root;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (i === parts.length - 1) {
        cur[p] = node;
      } else {
        if (!cur[p]) cur[p] = { __children: {} };
        cur = cur[p].__children;
      }
    }
  }
  return root;
}

function FileTree({
  node, depth = 0, onFileClick,
}: {
  node: Record<string, any>;
  depth?: number;
  onFileClick: (n: TreeNode) => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const entries = Object.entries(node).sort(([a, av], [b, bv]) => {
    const aIsDir = av.__children !== undefined;
    const bIsDir = bv.__children !== undefined;
    if (aIsDir && !bIsDir) return -1;
    if (!aIsDir && bIsDir) return 1;
    return a.localeCompare(b);
  });

  return (
    <div>
      {entries.map(([name, val]) => {
        const isDir = val.__children !== undefined;
        const isOpen = open[name];
        return (
          <div key={name}>
            <button
              onClick={() => {
                if (isDir) setOpen((p) => ({ ...p, [name]: !p[name] }));
                else onFileClick(val as TreeNode);
              }}
              style={{ paddingLeft: `${8 + depth * 14}px` }}
              className={cn(
                "w-full text-left flex items-center gap-1.5 py-1 pr-2 text-xs rounded-md hover:bg-muted/50 transition-colors group",
                isDir ? "text-muted-foreground font-medium" : "text-foreground/80"
              )}
            >
              {isDir ? (
                <>
                  {isOpen ? <ChevronDown className="w-3 h-3 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 flex-shrink-0" />}
                  {isOpen ? <FolderOpen className="w-3.5 h-3.5 flex-shrink-0 text-yellow-500/80" /> : <Folder className="w-3.5 h-3.5 flex-shrink-0 text-yellow-500/80" />}
                </>
              ) : (
                <>
                  <span className="w-3 h-3 flex-shrink-0" />
                  <FileCode className="w-3.5 h-3.5 flex-shrink-0 text-primary/60" />
                </>
              )}
              <span className="truncate">{name}</span>
            </button>
            {isDir && isOpen && (
              <FileTree node={val.__children} depth={depth + 1} onFileClick={onFileClick} />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface GitHubPanelProps {
  onClose: () => void;
}

export function GitHubPanel({ onClose }: GitHubPanelProps) {
  const [token, setToken] = useState(() => localStorage.getItem("gh_token") || "");
  const [tokenInput, setTokenInput] = useState("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [tree, setTree] = useState<Record<string, any> | null>(null);
  const [openFile, setOpenFile] = useState<FileContent | null>(null);
  const [editContent, setEditContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fetchRepos = useCallback(async (t: string) => {
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`${API_BASE}/api/github/repos`, {
        headers: ghHeaders(t),
      });
      if (!res.ok) throw new Error(await res.text());
      setRepos(await res.json());
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }, []);

  const fetchTree = useCallback(async (repo: Repo) => {
    setLoading(true); setErr(null); setOpenFile(null); setTree(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/github/tree?owner=${repo.full_name.split("/")[0]}&repo=${repo.name}&branch=${repo.default_branch}`,
        { headers: ghHeaders(token) }
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTree(buildTree(data.tree));
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }, [token]);

  const fetchFile = useCallback(async (node: TreeNode) => {
    setLoading(true); setErr(null);
    const [owner, repo] = selectedRepo!.full_name.split("/");
    try {
      const res = await fetch(
        `${API_BASE}/api/github/file?owner=${owner}&repo=${repo}&path=${encodeURIComponent(node.path)}&ref=${selectedRepo!.default_branch}`,
        { headers: ghHeaders(token) }
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setOpenFile(data);
      setEditContent(data.content);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }, [token, selectedRepo]);

  const saveFile = useCallback(async () => {
    if (!openFile || !selectedRepo) return;
    setSaving(true); setErr(null);
    const [owner, repo] = selectedRepo.full_name.split("/");
    try {
      const res = await fetch(`${API_BASE}/api/github/file`, {
        method: "PUT",
        headers: { ...ghHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({
          owner, repo,
          path: openFile.path,
          content: editContent,
          sha: openFile.sha,
          message: `Update ${openFile.path} via Nexus AI`,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setOpenFile((prev) => prev ? { ...prev, sha: data.content.sha, content: editContent } : prev);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2000);
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }, [openFile, selectedRepo, token, editContent]);

  const connectGitHub = () => {
    if (!tokenInput.trim()) return;
    const t = tokenInput.trim();
    localStorage.setItem("gh_token", t);
    setToken(t);
    setTokenInput("");
    fetchRepos(t);
  };

  const disconnect = () => {
    localStorage.removeItem("gh_token");
    setToken(""); setRepos([]); setSelectedRepo(null); setTree(null); setOpenFile(null);
  };

  useEffect(() => {
    if (token) fetchRepos(token);
  }, []);

  return (
    <div className="flex flex-col h-full bg-sidebar border-l border-border/30 w-[340px] flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Github className="w-4 h-4 text-foreground/80" />
          <span className="font-semibold text-sm">GitHub</span>
          {token && (
            <span className="text-[10px] bg-green-500/20 text-green-400 border border-green-500/20 rounded-full px-2 py-0.5">
              Đã kết nối
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-1 hover:bg-muted/50 rounded-md transition-colors">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!token ? (
          /* Token input */
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                <span>GitHub Personal Access Token</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tạo token tại{" "}
                <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 inline-flex items-center gap-0.5">
                  github.com/settings/tokens
                  <ExternalLink className="w-3 h-3" />
                </a>{" "}
                với quyền <code className="text-[10px] bg-muted px-1 rounded">repo</code>
              </p>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="ghp_..."
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && connectGitHub()}
                className="flex-1 text-xs bg-muted/50 border border-border/60 rounded-lg px-3 py-2 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
              />
              <button
                onClick={connectGitHub}
                disabled={!tokenInput.trim()}
                className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
              >
                Kết nối
              </button>
            </div>
            {err && <p className="text-xs text-destructive">{err}</p>}
          </div>
        ) : !selectedRepo ? (
          /* Repo list */
          <div className="p-3 space-y-1">
            <div className="flex items-center justify-between px-1 py-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Repositories</span>
              <div className="flex gap-1">
                <button onClick={() => fetchRepos(token)} className="p-1 hover:bg-muted/50 rounded text-muted-foreground transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button onClick={disconnect} className="p-1 hover:bg-muted/50 rounded text-muted-foreground transition-colors text-[10px]">
                  Ngắt
                </button>
              </div>
            </div>
            {loading ? (
              <div className="flex justify-center py-6">
                <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : err ? (
              <p className="text-xs text-destructive px-2">{err}</p>
            ) : (
              repos.map((r) => (
                <button
                  key={r.full_name}
                  onClick={() => { setSelectedRepo(r); fetchTree(r); }}
                  className="w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <Github className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 overflow-hidden">
                    <div className="text-sm font-medium truncate">{r.name}</div>
                    <div className="text-[10px] text-muted-foreground">{r.full_name}</div>
                  </div>
                  {r.private && <Lock className="w-3 h-3 text-muted-foreground/50" />}
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))
            )}
          </div>
        ) : openFile ? (
          /* File editor */
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30 bg-muted/20">
              <button
                onClick={() => setOpenFile(null)}
                className="p-1 hover:bg-muted/50 rounded transition-colors text-muted-foreground"
              >
                <ChevronRight className="w-3.5 h-3.5 rotate-180" />
              </button>
              <div className="flex-1 overflow-hidden">
                <div className="text-xs font-medium truncate">{openFile.path.split("/").pop()}</div>
                <div className="text-[10px] text-muted-foreground/60 truncate">{openFile.path}</div>
              </div>
              <span className="text-[10px] text-muted-foreground/50">{getLanguage(openFile.path)}</span>
              <button
                onClick={saveFile}
                disabled={saving || editContent === openFile.content}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all",
                  savedOk
                    ? "bg-green-500/20 text-green-400"
                    : editContent !== openFile.content
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-muted text-muted-foreground opacity-50"
                )}
              >
                {savedOk ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
                {savedOk ? "Đã lưu" : saving ? "Lưu..." : "Lưu"}
              </button>
            </div>
            {err && (
              <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 text-destructive text-xs">
                <AlertCircle className="w-3.5 h-3.5" />
                {err}
              </div>
            )}
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="flex-1 bg-transparent text-xs font-mono text-foreground/80 p-3 resize-none outline-none leading-relaxed"
              spellCheck={false}
            />
          </div>
        ) : (
          /* File tree */
          <div className="p-3">
            <div className="flex items-center justify-between px-1 py-2">
              <button
                onClick={() => { setSelectedRepo(null); setTree(null); }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                <span>{selectedRepo.name}</span>
              </button>
              <button onClick={() => fetchTree(selectedRepo)} className="p-1 hover:bg-muted/50 rounded text-muted-foreground transition-colors">
                <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
              </button>
            </div>
            {loading ? (
              <div className="flex justify-center py-6">
                <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : err ? (
              <p className="text-xs text-destructive px-2">{err}</p>
            ) : tree ? (
              <FileTree node={tree} onFileClick={fetchFile} />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
