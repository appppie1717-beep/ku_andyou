// ku앤유 관리자 API의 비밀번호 검증과 요청 제한을 돕습니다.
const crypto = require("crypto");

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 12;
const attempts = new Map();

function readClientId(request) {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded) {
    return forwarded.split(",")[0].trim();
  }

  return request.socket?.remoteAddress || "unknown";
}

function isRateLimited(request) {
  const clientId = readClientId(request);
  const now = Date.now();
  const record = attempts.get(clientId) || { count: 0, resetAt: now + WINDOW_MS };

  if (record.resetAt <= now) {
    record.count = 0;
    record.resetAt = now + WINDOW_MS;
  }

  record.count += 1;
  attempts.set(clientId, record);
  return record.count > MAX_ATTEMPTS;
}

function verifyPassword(input, expected) {
  if (typeof input !== "string" || typeof expected !== "string" || !expected) {
    return false;
  }

  const inputBuffer = Buffer.from(input);
  const expectedBuffer = Buffer.from(expected);

  if (inputBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(inputBuffer, expectedBuffer);
}

async function readJsonBody(request, maxBodyBytes = 80_000) {
  let raw = "";

  for await (const chunk of request) {
    raw += chunk;
    if (Buffer.byteLength(raw) > maxBodyBytes) {
      return null;
    }
  }

  try {
    return JSON.parse(raw || "{}");
  } catch (error) {
    return null;
  }
}

module.exports = {
  isRateLimited,
  readJsonBody,
  verifyPassword
};
