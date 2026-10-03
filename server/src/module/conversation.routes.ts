import { FastifyInstance } from "fastify";
import authMiddleware from "../middleware/authMiddleware";

export async function conversationRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.get("/conversations", async (request, reply) => {

    // ----------------------------------------
    // 2. Get user ID from JWT
    // ----------------------------------------

    const userId = Number(request.userId);

    // ----------------------------------------
    // 3. Get user's conversations
    // ----------------------------------------

    const conversations = await app.prisma.conversation.findMany({
      where: {
        userId,
      },

      orderBy: {
        updatedAt: "desc",
      },

      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // ----------------------------------------
    // 4. Return conversations
    // ----------------------------------------

    return reply.send({
      conversations,
    });
  });

  app.get("/conversations/:id/messages", async (request, reply) => {
    
    // ----------------------------------------
    // 2. Get user ID from JWT
    // ----------------------------------------

    const userId = Number(request.userId);

    // ----------------------------------------
    // 3. Get conversation ID from URL
    // ----------------------------------------

    const { id } = request.params as {
      id: string;
    };

    const conversationId = Number(id);

    if (!Number.isInteger(conversationId) || conversationId <= 0) {
      return reply.status(400).send({
        error: "Invalid conversation ID",
      });
    }

    // ----------------------------------------
    // 4. Verify ownership
    // ----------------------------------------

    const conversation = await app.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId,
      },

      select: {
        id: true,
        title: true,
      },
    });

    if (!conversation) {
      return reply.status(404).send({
        error: "Conversation not found",
      });
    }

    // ----------------------------------------
    // 5. Get messages
    // ----------------------------------------

    const messages = await app.prisma.message.findMany({
      where: {
        conversationId,
      },

      orderBy: {
        createdAt: "asc",
      },

      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
      },
    });

    // ----------------------------------------
    // 6. Return conversation + messages
    // ----------------------------------------

    return reply.send({
      conversation,
      messages,
    });
  });

  app.delete("/conversations/:id", async (request, reply) => {
  
    const userId = Number(request.userId);
  
    const { id } = request.params as {
      id: string;
    };
  
    const conversationId = Number(id);
  
    if (!Number.isInteger(conversationId) || conversationId <= 0) {
      return reply.status(400).send({
        error: "Invalid conversation ID",
      });
    }

    const conversation = await app.prisma.conversation.findFirst({
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
  
    await app.prisma.conversation.delete({
      where: {
        id: conversationId,
      },
    });
  
    return reply.send({
      success: true,
      conversationId,
    });
  });
}