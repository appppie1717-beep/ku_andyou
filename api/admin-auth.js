// ku앤유 관리자 비밀번호를 서버에서 확인합니다.
const { isRateLimited, readJsonBody, verifyPassword } = require("./admin-security");

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (isRateLimited(request)) {
    response.status(429).json({ error: "Too many attempts" });
    return;
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  const body = await readJsonBody(request, 10_000);

  if (!body || !verifyPassword(body.password, adminPassword)) {
    response.status(401).json({ error: "Wrong password" });
    return;
  }

  response.setHeader("Cache-Control", "no-store");
  response.status(200).json({ ok: true });
};
