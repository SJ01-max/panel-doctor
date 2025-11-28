import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 백엔드 API 주소 (환경 변수 또는 기본값)
const BACKEND_API_URL = process.env.BACKEND_API_URL || 
  process.env.VITE_API_BASE_URL?.replace('/api', '') ||
  "http://capstone-front-back-nlb-5df2d37f3e3da2a2.elb.ap-northeast-2.amazonaws.com:5000";

app.use(
  "/api",
  createProxyMiddleware({
    target: BACKEND_API_URL,
    changeOrigin: true,
  })
);

const distPath = path.join(__dirname, "out");
app.use(express.static(distPath));

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
});
