// ku앤유 방송 시작 상태를 확인하고 디스코드 시작 알림을 보냅니다.
const CHANNEL_ID = "7f43db49e367d87397c3a38d57dad71f";
const CHZZK_CHANNEL_URL = `https://api.chzzk.naver.com/service/v1/channels/${CHANNEL_ID}`;
const STREAM_URL = `https://chzzk.naver.com/${CHANNEL_ID}`;
const ALERT_MESSAGE = `ku앤유 방송 시작했습니다!\n     ${STREAM_URL}`;
const STATE_ID = "chzzk_main";

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (!supabaseUrl || !serviceKey || !discordWebhookUrl) {
    response.status(500).json({ error: "Live alert API is not configured" });
    return;
  }

  try {
    const liveStatus = await fetchLiveStatus();
    const claim = await claimLiveAlert(supabaseUrl, serviceKey, liveStatus.live);

    if (!claim.should_alert) {
      response.setHeader("Cache-Control", "no-store");
      response.status(200).json({
        live: liveStatus.live,
        alertSent: false,
        reason: claim.reason
      });
      return;
    }

    try {
      await sendDiscordAlert(discordWebhookUrl);
    } catch (error) {
      await markAlertFailed(supabaseUrl, serviceKey, error.message);
      throw error;
    }

    await markAlertSent(supabaseUrl, serviceKey);

    response.setHeader("Cache-Control", "no-store");
    response.status(200).json({
      live: true,
      alertSent: true
    });
  } catch (error) {
    console.error("Unable to process live alert", error);
    response.setHeader("Cache-Control", "no-store");
    response.status(502).json({ error: "Unable to process live alert" });
  }
};

async function fetchLiveStatus() {
  const response = await fetch(CHZZK_CHANNEL_URL, {
    headers: {
      Accept: "application/json",
      "User-Agent": "ku-andyou-live-alert/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`CHZZK HTTP ${response.status}`);
  }

  const payload = await response.json();
  const content = payload && payload.content ? payload.content : {};

  return {
    live: Boolean(content.openLive),
    channelName: content.channelName || null
  };
}

async function claimLiveAlert(supabaseUrl, serviceKey, isLive) {
  const rows = await supabaseRequest(supabaseUrl, serviceKey, "rpc/claim_live_start_alert", {
    method: "POST",
    body: {
      p_state_id: STATE_ID,
      p_is_live: isLive
    }
  });

  return Array.isArray(rows) ? rows[0] : rows;
}

async function markAlertSent(supabaseUrl, serviceKey) {
  await supabaseRequest(supabaseUrl, serviceKey, "rpc/mark_live_start_alert_sent", {
    method: "POST",
    body: {
      p_state_id: STATE_ID
    }
  });
}

async function markAlertFailed(supabaseUrl, serviceKey, errorMessage) {
  await supabaseRequest(supabaseUrl, serviceKey, "rpc/mark_live_start_alert_failed", {
    method: "POST",
    body: {
      p_state_id: STATE_ID,
      p_error: errorMessage
    }
  });
}

async function sendDiscordAlert(webhookUrl) {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      content: ALERT_MESSAGE,
      allowed_mentions: {
        parse: []
      }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord HTTP ${response.status}: ${text.slice(0, 500)}`);
  }
}

async function supabaseRequest(supabaseUrl, serviceKey, path, options) {
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`
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

  return text ? JSON.parse(text) : null;
}
