import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
const PORT = process.env.PORT || 5000;
const SUPPORTED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://api-performance-frontend-gpj0u4fwd.vercel.app/",
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/test", async (req, res) => {
  const {
    url,
    method = "GET",
    params = [],
    headers = {},
    body,
    auth = { type: "none" },
  } = req.body || {};

  if (!url || typeof url !== "string") {
    return res.status(400).json({
      status: null,
      responseTimeMs: 0,
      responseHeaders: null,
      error: "Please provide a valid URL.",
      data: null,
    });
  }

  const normalizedUrl = String(url).trim();
  if (!/^https?:\/\//i.test(normalizedUrl)) {
    return res.status(400).json({
      status: null,
      responseTimeMs: 0,
      responseHeaders: null,
      error: "URL must start with http:// or https://",
      data: null,
    });
  }

  const normalizedMethod = String(method).toUpperCase();
  if (!SUPPORTED_METHODS.includes(normalizedMethod)) {
    return res.status(400).json({
      status: null,
      responseTimeMs: 0,
      responseHeaders: null,
      error: `Unsupported method "${normalizedMethod}".`,
      data: null,
    });
  }

  // Convert [{ key, value }, ...] into an object while ignoring empty keys.
  const normalizedParams = Array.isArray(params)
    ? params.reduce((acc, item) => {
        if (!item || typeof item !== "object") return acc;
        const key = String(item.key || "").trim();
        if (!key) return acc;
        acc[key] = item.value ?? "";
        return acc;
      }, {})
    : {};

  const normalizedHeaders = (() => {
    if (Array.isArray(headers)) {
      return headers.reduce((acc, item) => {
        if (!item || typeof item !== "object") return acc;
        const key = String(item.key || "").trim();
        if (!key) return acc;
        acc[key] = item.value ?? "";
        return acc;
      }, {});
    }
    if (headers && typeof headers === "object") return headers;
    return {};
  })();

  const normalizedAuth = {
    type: String(auth?.type || "none").toLowerCase(),
    bearerToken: auth?.bearerToken || "",
    username: auth?.username || "",
    password: auth?.password || "",
  };

  const startTime = process.hrtime.bigint();

  try {
    // Build Axios config dynamically based on method, params, headers, body, and auth.
    const axiosConfig = {
      url: normalizedUrl,
      method: normalizedMethod,
      params: normalizedParams,
      headers: normalizedHeaders,
      timeout: 30000,
    };

    if (normalizedMethod !== "GET" && typeof body !== "undefined") {
      axiosConfig.data = body;
    }

    if (normalizedAuth.type === "bearer" && normalizedAuth.bearerToken) {
      axiosConfig.headers.Authorization = `Bearer ${normalizedAuth.bearerToken}`;
    }

    if (normalizedAuth.type === "basic") {
      axiosConfig.auth = {
        username: normalizedAuth.username,
        password: normalizedAuth.password,
      };
    }

    const response = await axios(axiosConfig);

    const endTime = process.hrtime.bigint();
    const responseTimeMs = Number(endTime - startTime) / 1_000_000;

    return res.json({
      status: response.status,
      responseTimeMs: Number(responseTimeMs.toFixed(2)),
      responseHeaders: response.headers,
      error: null,
      data: response.data,
    });
  } catch (error) {
    const endTime = process.hrtime.bigint();
    const responseTimeMs = Number(endTime - startTime) / 1_000_000;
    const upstreamStatus = error.response?.status || 502;
    const errorCode = error?.code || null;
    const fallbackMessage = errorCode
      ? `Request failed (${errorCode}).`
      : "Request failed.";
    const errorMessage =
      typeof error?.message === "string" && error.message.trim()
        ? error.message
        : fallbackMessage;

    // Return actual upstream error status when available.
    return res.status(upstreamStatus).json({
      status: error.response?.status || null,
      responseTimeMs: Number(responseTimeMs.toFixed(2)),
      responseHeaders: error.response?.headers || null,
      error: errorMessage,
      debug:
        error.response || !error
          ? null
          : {
              code: errorCode,
              syscall: error?.syscall || null,
              errno: error?.errno || null,
              address: error?.address || null,
              port: error?.port || null,
            },
      data: error.response?.data || null,
    });
  }
});

app.listen(PORT, () => {
  console.log(`API tester server is running on port ${PORT}`);
});
