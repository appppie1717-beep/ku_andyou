// ku앤유 치지직 방송 상태를 확인하는 Vercel 서버리스 함수입니다.
const CHANNEL_ID = "7f43db49e367d87397c3a38d57dad71f";
const CHZZK_CHANNEL_URL = `https://api.chzzk.naver.com/service/v1/channels/${CHANNEL_ID}`;

module.exports = async function handler(request, response) {
  try {
    const chzzkResponse = await fetch(CHZZK_CHANNEL_URL, {
      headers: {
        Accept: "application/json",
        "User-Agent": "ku-andyou/1.0"
      }
    });

    if (!chzzkResponse.ok) {
      throw new Error(`CHZZK HTTP ${chzzkResponse.status}`);
    }

    const payload = await chzzkResponse.json();
    const content = payload && payload.content ? payload.content : {};

    response.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    response.status(200).json({
      live: Boolean(content.openLive),
      channelName: content.channelName || null
    });
  } catch (error) {
    response.setHeader("Cache-Control", "no-store");
    response.status(502).json({
      live: false,
      error: "Unable to check live status"
    });
  }
};
