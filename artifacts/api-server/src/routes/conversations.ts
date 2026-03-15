import { Router, type IRouter } from "express";
import { eq, sql, desc } from "drizzle-orm";
import { db, conversations, messages } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  CreateConversationBody,
  GetConversationParams,
  DeleteConversationParams,
  SendMessageParams,
  SendMessageBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/conversations", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
      messageCount: sql<number>`cast(count(${messages.id}) as int)`,
    })
    .from(conversations)
    .leftJoin(messages, eq(messages.conversationId, conversations.id))
    .groupBy(conversations.id)
    .orderBy(desc(conversations.updatedAt));

  res.json(rows);
});

router.post("/conversations", async (req, res): Promise<void> => {
  const parsed = CreateConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [conversation] = await db
    .insert(conversations)
    .values({ title: parsed.data.title })
    .returning();

  res.status(201).json({
    ...conversation,
    messageCount: 0,
  });
});

router.get("/conversations/:conversationId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.conversationId) ? req.params.conversationId[0] : req.params.conversationId;
  const params = GetConversationParams.safeParse({ conversationId: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, params.data.conversationId));

  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, params.data.conversationId))
    .orderBy(messages.createdAt);

  res.json({ ...conversation, messages: msgs });
});

router.delete("/conversations/:conversationId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.conversationId) ? req.params.conversationId[0] : req.params.conversationId;
  const params = DeleteConversationParams.safeParse({ conversationId: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(conversations)
    .where(eq(conversations.id, params.data.conversationId))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  res.json({ success: true });
});

router.post("/conversations/:conversationId/messages", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.conversationId) ? req.params.conversationId[0] : req.params.conversationId;
  const params = SendMessageParams.safeParse({ conversationId: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = SendMessageBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const imageBase64: string | undefined = (req.body as any).imageBase64;
  const imageMimeType: string = (req.body as any).imageMimeType || "image/jpeg";

  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, params.data.conversationId));

  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, params.data.conversationId))
    .orderBy(messages.createdAt);

  const imageDataUrl = imageBase64
    ? `data:${imageMimeType};base64,${imageBase64.replace(/^data:[^;]+;base64,/, "")}`
    : undefined;

  const [userMsg] = await db
    .insert(messages)
    .values({
      conversationId: params.data.conversationId,
      role: "user",
      content: imageDataUrl
        ? `${body.data.content}\n\n[image:${imageDataUrl}]`
        : body.data.content,
    })
    .returning();

  const latestUserContent: any = imageBase64
    ? [
        { type: "text", text: body.data.content || "What is in this image?" },
        {
          type: "image_url",
          image_url: {
            url: imageDataUrl,
            detail: "auto",
          },
        },
      ]
    : body.data.content;

  const chatMessages: any[] = [
    {
      role: "system",
      content:
        "You are Nexus AI — a helpful, knowledgeable, and conversational AI assistant. Be thoughtful, detailed, and friendly. You can analyze images, write code, answer questions, and help with any topic.",
    },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content.replace(/\n\n\[image:[^\]]+\]/g, " [image attached]"),
    })),
    { role: "user", content: latestUserContent },
  ];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("X-User-Message-Id", String(userMsg.id));

  let fullResponse = "";

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: chatMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ error: err.message || "AI error" })}\n\n`);
    res.end();
    return;
  }

  const [assistantMsg] = await db
    .insert(messages)
    .values({
      conversationId: params.data.conversationId,
      role: "assistant",
      content: fullResponse,
    })
    .returning();

  // Auto-title the conversation after first exchange
  if (history.length === 0 && body.data.content) {
    try {
      const titleRes = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 20,
        messages: [
          {
            role: "user",
            content: `Generate a short title (max 6 words, no quotes) for a conversation that starts with: "${body.data.content.slice(0, 200)}"`,
          },
        ],
        stream: false,
      });
      const newTitle = titleRes.choices[0]?.message?.content?.trim();
      if (newTitle) {
        await db
          .update(conversations)
          .set({ title: newTitle, updatedAt: new Date() })
          .where(eq(conversations.id, params.data.conversationId));
      }
    } catch {
      // non-fatal
    }
  }

  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, params.data.conversationId));

  res.write(`data: ${JSON.stringify({ done: true, userMessage: userMsg, assistantMessage: assistantMsg })}\n\n`);
  res.end();
});

export default router;
