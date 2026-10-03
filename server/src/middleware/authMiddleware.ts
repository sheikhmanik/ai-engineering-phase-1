import { FastifyReply, FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
  }
}

export default async function authMiddleware( request: FastifyRequest, reply: FastifyReply) {
  try {
    const decoded = await request.jwtVerify<{ userId: string }>();
    request.userId = decoded.userId;

    // Fetch user
    const user = await request.server.prisma.user.findUnique({
      where: { id: Number(decoded.userId) },
    });

    if (!user) {
      return reply.status(401).send({
        message: "Unauthorized user"
      });
    }
  } catch (err) {
    return reply.status(401).send({
      message: "Unauthorized. Invalid or missing token.",
    });
  }
}