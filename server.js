import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
const PORT = process.env.PORT || 5000;
const SUPPORTED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

app.use(cors());
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
      url,
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
    const upstreamStatus = error.response?.status || 500;

    // Return actual upstream error status when available.
    return res.status(upstreamStatus).json({
      status: error.response?.status || null,
      responseTimeMs: Number(responseTimeMs.toFixed(2)),
      responseHeaders: error.response?.headers || null,
      error: error.message || "Request failed.",
      data: error.response?.data || null,
    });
  }
});

app.listen(PORT, () => {
  console.log(`API tester server is running on port ${PORT}`);
});
