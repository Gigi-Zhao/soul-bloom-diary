import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: '0.0.0.0',
    port: 8080,
    allowedHosts: [
      'cheery-leglike-yelena.ngrok-free.dev',
    ],
    // 注意：不在这里配置 API 代理，因为：
    // 1. 前端代码已经有回退机制，可以直接调用 Vercel 生产环境 API
    // 2. 代理配置可能会干扰 TypeScript 模块解析（如 api/model-config.ts）
    // 3. 如果需要在本地运行 API，请使用 `vercel dev` 命令
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
