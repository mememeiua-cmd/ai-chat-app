import { Router, type IRouter } from "express";

const router: IRouter = Router();

async function ghFetch(path: string, token: string, options: RequestInit = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as any).message || res.statusText);
  }
  return res.json();
}

router.get("/github/repos", async (req, res): Promise<void> => {
  const token = req.headers["x-github-token"] as string;
  if (!token) {
    res.status(401).json({ error: "Missing GitHub token" });
    return;
  }
  try {
    const repos = await ghFetch("/user/repos?per_page=50&sort=updated", token);
    res.json(repos);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/github/tree", async (req, res): Promise<void> => {
  const token = req.headers["x-github-token"] as string;
  if (!token) {
    res.status(401).json({ error: "Missing GitHub token" });
    return;
  }
  const { owner, repo, branch = "main" } = req.query as Record<string, string>;
  if (!owner || !repo) {
    res.status(400).json({ error: "owner and repo are required" });
    return;
  }
  try {
    const data = await ghFetch(
      `/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      token
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/github/file", async (req, res): Promise<void> => {
  const token = req.headers["x-github-token"] as string;
  if (!token) {
    res.status(401).json({ error: "Missing GitHub token" });
    return;
  }
  const { owner, repo, path, ref = "main" } = req.query as Record<string, string>;
  if (!owner || !repo || !path) {
    res.status(400).json({ error: "owner, repo, and path are required" });
    return;
  }
  try {
    const data: any = await ghFetch(
      `/repos/${owner}/${repo}/contents/${path}?ref=${ref}`,
      token
    );
    const content = Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
    res.json({ content, sha: data.sha, path: data.path, name: data.name });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/github/file", async (req, res): Promise<void> => {
  const token = req.headers["x-github-token"] as string;
  if (!token) {
    res.status(401).json({ error: "Missing GitHub token" });
    return;
  }
  const { owner, repo, path, content, sha, message = "Update via Nexus AI" } = req.body as Record<string, string>;
  if (!owner || !repo || !path || !content || !sha) {
    res.status(400).json({ error: "owner, repo, path, content, sha are required" });
    return;
  }
  try {
    const b64 = Buffer.from(content).toString("base64");
    const data = await ghFetch(`/repos/${owner}/${repo}/contents/${path}`, token, {
      method: "PUT",
      body: JSON.stringify({ message, content: b64, sha }),
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
