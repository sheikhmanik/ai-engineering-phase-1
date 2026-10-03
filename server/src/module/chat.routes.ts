import { FastifyInstance } from "fastify";
import { chatRequestSchema } from "./chat.schema";
import authMiddleware from "../middleware/authMiddleware";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

export async function chatRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.post(
    "/chat",
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {

    const userId = Number(request.userId);

    // ----------------------------------------
    // 2. Validate request body
    // ----------------------------------------

    const result = chatRequestSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        error: "Invalid request",
        details: result.error.flatten(),
      });
    }

    const { conversationId, message } = result.data;

    // ----------------------------------------
    // 3. Find or create conversation
    // ----------------------------------------

    let conversation;

    if (conversationId) {
      conversation = await app.prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId,
        },
      });

      if (!conversation) {
        return reply.status(404).send({
          error: "Conversation not found",
        });
      }
    } else {
      conversation = await app.prisma.conversation.create({
        data: {
          userId,
          title: message.slice(0, 50),
        },
      });
    }

    // ----------------------------------------
    // 4. Save user message
    // ----------------------------------------

    await app.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "user",
        content: message,
      },
    });

    // ----------------------------------------
    // 5. Load conversation history
    // ----------------------------------------

    const messages = await app.prisma.message.findMany({
      where: {
        conversationId: conversation.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
    });

    const history = messages.reverse();

    // ----------------------------------------
    // 6. Build messages for the LLM
    // ----------------------------------------

    const llmMessages = [
      {
        role: "system" as const,
        content:
          "You are a helpful AI assistant. Give clear, accurate, and useful answers.",
      },
    
      ...history.map((message) => ({
        role: message.role as "user" | "assistant" | "system",
        content: message.content,
      })),
    ];

    // ----------------------------------------
    // 7. Call your LLM provider here
    // ----------------------------------------

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: llmMessages,
      max_completion_tokens: 2000,
    });

    const assistantContent = String(completion.choices[0].message.content);

    // ----------------------------------------
    // 8. Save assistant message
    // ----------------------------------------

    const assistantMessage = await app.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "assistant",
        content: assistantContent,
      },
    });

    // ----------------------------------------
    // 9. Return response
    // ----------------------------------------

    return reply.send({
      conversationId: conversation.id,
      message: {
        id: assistantMessage.id,
        role: assistantMessage.role,
        content: assistantMessage.content,
      },
    });
  });
}