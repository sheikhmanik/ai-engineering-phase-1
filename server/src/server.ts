import "dotenv/config";
import Fastify from "fastify";
import { chatRoutes } from "./module/chat.routes";
import prismaPlugin from "./plugins/prisma";
import fastifyJwt from "@fastify/jwt";
import authenticationRoutes from "./module/auth.routes";
import fastifyCors from "@fastify/cors";
import { conversationRoutes } from "./module/conversation.routes";
import fastifyRateLimit from "@fastify/rate-limit";

const app = Fastify({ logger: true });

// Plugins
app.register(fastifyCors, {
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
});
app.register(prismaPlugin);
app.register(fastifyJwt, { secret: process.env.JWT_SECRET as string });
app.register(fastifyRateLimit, {
  global: false,
  hook: "preHandler",
  keyGenerator: (request) => String(request.userId),
});

app.get("/", async () => {
  return { message: "Server is running 🚀" };
});

app.register(authenticationRoutes, { prefix: "/auth" });
app.register(chatRoutes, { prefix: "/api" });
app.register(conversationRoutes, { prefix: "/api" });

const start = async () => {
  try {
    await app.listen({ port: 4000 });
    console.log("🚀 http://localhost:4000");
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();