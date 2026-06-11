// ku앤유 관리자 저장 요청을 검증하고 Supabase에 반영합니다.
const { isRateLimited, readJsonBody, verifyPassword } = require("./admin-security");

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!supabaseUrl || !serviceKey || !adminPassword) {
    response.status(500).json({ error: "Admin API is not configured" });
    return;
  }

  if (isRateLimited(request)) {
    response.status(429).json({ error: "Too many attempts" });
    return;
  }

  const body = await readJsonBody(request);
  if (!body) {
    response.status(400).json({ error: "Invalid JSON body" });
    return;
  }

  if (!verifyPassword(body.password, adminPassword)) {
    response.status(401).json({ error: "Wrong password" });
    return;
  }

  const settings = sanitizeSettings(body.settings);
  const clips = sanitizeClips(body.clips);

  try {
    const savedContent = await replaceSiteContent(supabaseUrl, serviceKey, settings, clips);
    response.setHeader("Cache-Control", "no-store");
    response.status(200).json(savedContent);
  } catch (error) {
    console.error("Unable to save admin content", error);
    response.status(502).json({ error: "Unable to save content" });
  }
};

async function replaceSiteContent(supabaseUrl, serviceKey, settings, clips) {
  return supabaseRequest(supabaseUrl, serviceKey, "rpc/replace_site_content", {
    method: "POST",
    body: {
      p_settings: settings,
      p_clips: clips
    },
    prefer: "return=representation"
  });
}

async function supabaseRequest(supabaseUrl, serviceKey, path, options) {
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    Prefer: options.prefer || "return=representation"
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method: options.method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Supabase HTTP ${response.status}: ${text.slice(0, 1000)}`);
  }

  if (response.status === 204) return null;
  return text ? JSON.parse(text) : null;
}

function sanitizeSettings(input = {}) {
  return {
    id: "main",
    hero_lead: cleanText(input.hero_lead, 160) || "게임방송 하고싶대",
    stream_url: cleanUrl(input.stream_url) || "https://chzzk.naver.com/7f43db49e367d87397c3a38d57dad71f",
    schedule_note: cleanText(input.schedule_note, 80) || "치지직 방송 기준",
    footer_text: cleanText(input.footer_text, 120) || "애플파이 - asoul122@naver.com",
    social_links: sanitizeSocialLinks(input.social_links),
    profile_items: sanitizeKeyValueItems(input.profile_items, "label", "value", 12),
    schedule_items: sanitizeKeyValueItems(input.schedule_items, "day", "time", 8)
  };
}

function sanitizeSocialLinks(input) {
  const allowed = new Set(["x", "youtube", "tiktok", "discord"]);
  return Array.isArray(input)
    ? input
        .filter((item) => item && allowed.has(item.platform))
        .map((item, index) => ({
          platform: item.platform,
          label: cleanText(item.label, 30) || item.platform,
          url: cleanUrl(item.url),
          sort_order: index + 1,
          is_visible: Boolean(item.is_visible) && Boolean(cleanUrl(item.url))
        }))
    : [];
}

function sanitizeKeyValueItems(input, keyName, valueName, maxItems) {
  return Array.isArray(input)
    ? input
        .slice(0, maxItems)
        .map((item, index) => ({
          [keyName]: cleanText(item?.[keyName], 40),
          [valueName]: cleanText(item?.[valueName], 120),
          sort_order: index + 1,
          is_visible: item?.is_visible !== false
        }))
        .filter((item) => item[keyName] && item[valueName])
    : [];
}

function sanitizeClips(input) {
  return Array.isArray(input)
    ? input.slice(0, 80).map((clip, index) => ({
        title: cleanText(clip.title, 120) || "제목 없는 클립",
        url: cleanUrl(clip.url) || "https://chzzk.naver.com/7f43db49e367d87397c3a38d57dad71f",
        video: cleanAssetPath(clip.video),
        embed_url: cleanUrl(clip.embed_url),
        thumbnail: cleanAssetPath(clip.thumbnail) || cleanUrl(clip.thumbnail),
        sort_order: Number.isFinite(Number(clip.sort_order)) ? Number(clip.sort_order) : index + 1,
        is_visible: clip.is_visible !== false
      }))
    : [];
}

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function cleanUrl(value) {
  const text = cleanText(value, 400);
  if (!text) return "";

  try {
    const url = new URL(text);
    return url.protocol === "https:" ? url.toString() : "";
  } catch (error) {
    return "";
  }
}

function cleanAssetPath(value) {
  const text = cleanText(value, 400);
  if (!text) return "";
  if (/^(clips|images)\//.test(text) && !text.includes("..")) return text;
  return "";
}
