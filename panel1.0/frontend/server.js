import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(
  "/api",
  createProxyMiddleware({
    target:
      "http://capstone-front-back-nlb-5df2d37f3e3da2a2.elb.ap-northeast-2.amazonaws.com:5000",
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
