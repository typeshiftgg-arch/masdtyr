import express from "express";
import { createServer as createViteServer } from "vite";
import apiRouter from "./src/backend/api";
import serverless from "serverless-http";

const app = express();
app.use(express.json({ limit: '10mb' }));

// API Routes
app.use("/api", apiRouter);
app.use("/.netlify/functions/api", apiRouter);

// Export for Netlify
export const handler = serverless(app);

// Local development server
if (process.env.NODE_ENV !== "production" && !process.env.NETLIFY) {
  async function startDevServer() {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    const PORT = 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
  startDevServer();
}


