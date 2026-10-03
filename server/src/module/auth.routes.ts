import { FastifyInstance } from "fastify";
import authMiddleware from "../middleware/authMiddleware";

export default function authenticationRoutes(fastify: FastifyInstance) {
  fastify.post("/login", async (req, reply) => {
    const { username, password } = req.body as any;
    try {

      const normalizedUsername = username.trim().toLowerCase();

      const user = await fastify.prisma.user.findUnique({
        where: { username: normalizedUsername },
      });

      if (!user) {
        return reply.status(404).send({ error: "User not found." });
      }

      const isPasswordValid = user.password === password;

      if (isPasswordValid) {
        const token = fastify.jwt.sign({ userId: user.id }, { expiresIn: "24h" });
        return reply.send({ token });
      } else {
        return reply.status(401).send({ error: "Invalid password." });
      }
    } catch (error) {
      console.error("Error during login:", error);
      reply.status(500).send({ error: "Login failed" });
    }
  });

  fastify.post("/register", async (req, reply) => {
    const { username, password } = req.body as {
      username: string,
      password: string
    };
  
    try {
      const normalizedUsername = username.trim().toLowerCase();
  
      // check existing user
      const existingUser = await fastify.prisma.user.findUnique({
        where: { username: normalizedUsername },
      });
  
      if (existingUser) {
        return reply.status(400).send({ error: "Email is already in use." });
      }
  
      // create user
      const newUser = await fastify.prisma.user.create({
        data: {
          username,
          password
        },
      });
  
      const token = fastify.jwt.sign({ userId: newUser.id }, { expiresIn: "24h" });
      return reply.send({ token });
  
    } catch (error) {
      console.error("Error during registration:", error);
      return reply.status(500).send({ error: "Registration failed" });
    }
  });

  fastify.get(
    "/me",
    {
      preHandler: authMiddleware
    },
    async (request, reply) => {
      return {
        authenticated: true,
        user: request.user,
      };
    }
  );
}