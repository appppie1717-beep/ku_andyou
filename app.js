// ku앤유 사이트 표시와 관리자 수정 화면을 제어합니다.
const SUPABASE_URL = "https://qgjxyqehvftddypltzrd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_GZpT_mDZdyN4owNb35efuQ_lRy4OXZW";

const defaultSettings = {
  id: "main",
  hero_lead: "게임방송 하고싶대",
  stream_url: "https://chzzk.naver.com/7f43db49e367d87397c3a38d57dad71f",
  schedule_note: "치지직 방송 기준",
  footer_text: "애플파이 - asoul122@naver.com",
  social_links: [
    { platform: "x", label: "X", url: "https://x.com/kuen_29", is_visible: true },
    { platform: "youtube", label: "YouTube", url: "https://www.youtube.com/@ku_10617", is_visible: true },
    { platform: "tiktok", label: "TikTok", url: "https://www.tiktok.com/@ku10617?_t=ZS-981IbiPrETl", is_visible: true },
    { platform: "discord", label: "Discord", url: "https://discord.com/invite/kryKRuhds9", is_visible: true }
  ],
  profile_items: [
    { label: "키", value: "161cm", is_visible: true },
    { label: "좋아하는 음식", value: "냉면", is_visible: true },
    { label: "싫어하는 음식", value: "유부초밥", is_visible: true },
    { label: "취미", value: "시나리오, 그림", is_visible: true },
    { label: "방송 포인트", value: "말이 많다", is_visible: true },
    { label: "취향", value: "어른 취향 토크", is_visible: true }
  ],
  schedule_items: [
    { day: "화요일", time: "오후 6시 - 12시", is_visible: true },
    { day: "목요일", time: "오후 8시 - 10시", is_visible: true },
    { day: "토요일", time: "오후 8시 - 9시", is_visible: true }
  ]
};

const state = {
  settings: structuredClone(defaultSettings),
  clips: [],
  adminPassword: ""
};

const clipGrid = document.querySelector("#clipGrid");
const emptyState = document.querySelector("#emptyState");
const resultCount = document.querySelector("#resultCount");
const template = document.querySelector("#clipCardTemplate");
const playerModal = document.querySelector("#playerModal");
const clipPlayer = document.querySelector("#clipPlayer");
const localPlayer = document.querySelector("#localPlayer");
const playerTitle = document.querySelector("#playerTitle");
const externalPlayerLink = document.querySelector("#externalPlayerLink");
const streamLink = document.querySelector("#streamLink");
const liveBadge = document.querySelector("#liveBadge");
const profileSection = document.querySelector(".profile-section");
const profileToggle = document.querySelector(".profile-toggle");
const profileDetails = document.querySelector("#profileDetails");
const profileGrid = document.querySelector("#profileGrid");
const scheduleGrid = document.querySelector("#scheduleGrid");
const scheduleNote = document.querySelector("#scheduleNote");
const siteFooter = document.querySelector("#siteFooter");
const heroLead = document.querySelector(".hero-lead");
const adminOpen = document.querySelector("#adminOpen");
const adminModal = document.querySelector("#adminModal");
const adminLoginForm = document.querySelector("#adminLoginForm");
const adminEditor = document.querySelector("#adminEditor");
const adminPassword = document.querySelector("#adminPassword");
const adminLoginMessage = document.querySelector("#adminLoginMessage");
const adminStatus = document.querySelector("#adminStatus");
const adminLogout = document.querySelector("#adminLogout");
const settingHeroLead = document.querySelector("#settingHeroLead");
const settingStreamUrl = document.querySelector("#settingStreamUrl");
const settingScheduleNote = document.querySelector("#settingScheduleNote");
const settingFooter = document.querySelector("#settingFooter");
const socialX = document.querySelector("#socialX");
const socialYoutube = document.querySelector("#socialYoutube");
const socialTiktok = document.querySelector("#socialTiktok");
const socialDiscord = document.querySelector("#socialDiscord");
const profileText = document.querySelector("#profileText");
const scheduleText = document.querySelector("#scheduleText");
const clipEditorList = document.querySelector("#clipEditorList");
const addClip = document.querySelector("#addClip");

const fallbackClips = [
  {
    title: "ku앤유 클립",
    url: "https://chzzk.naver.com/7f43db49e367d87397c3a38d57dad71f",
    video: ""
  }
];

init();

async function init() {
  updateLiveStatus();
  window.setInterval(updateLiveStatus, 60000);
  initProfileToggle();
  initPlayerModal();
  initAdminModal();
  await loadContent();
}

async function loadContent() {
  const [settings, clips] = await Promise.all([loadSettings(), loadClips()]);
  state.settings = settings || structuredClone(defaultSettings);
  state.clips = clips.length > 0 ? clips : await loadFallbackClips();
  applySettings();
  renderClips();
  fillAdminForm();
}

async function loadSettings() {
  try {
    const rows = await supabaseRest("site_settings?id=eq.main&select=*");
    return rows[0] || null;
  } catch (error) {
    return null;
  }
}

async function loadClips() {
  try {
    return await supabaseRest("clips?is_visible=eq.true&select=*&order=sort_order.asc,id.asc");
  } catch (error) {
    return [];
  }
}

async function loadFallbackClips() {
  try {
    const response = await fetch("./clips.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const clips = await response.json();
    return Array.isArray(clips) ? clips : fallbackClips;
  } catch (error) {
    resultCount.textContent = "클립 데이터를 불러오지 못해 기본 링크를 표시합니다.";
    return fallbackClips;
  }
}

async function supabaseRest(path) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`
    }
  });

  if (!response.ok) {
    throw new Error(`Supabase HTTP ${response.status}`);
  }

  return response.json();
}

function applySettings() {
  const settings = normalizeSettings(state.settings);
  heroLead.textContent = settings.hero_lead;
  streamLink.href = settings.stream_url;
  scheduleNote.textContent = settings.schedule_note;
  siteFooter.textContent = settings.footer_text;

  settings.social_links.forEach((link) => {
    const element = document.querySelector(`[data-social-platform="${link.platform}"]`);
    if (!element) return;
    element.href = link.url || "#";
    element.hidden = link.is_visible === false || !link.url;
  });

  profileGrid.innerHTML = "";
  settings.profile_items.filter(isVisibleItem).forEach((item) => {
    const wrapper = document.createElement("div");
    const term = document.createElement("dt");
    const value = document.createElement("dd");
    term.textContent = item.label;
    value.textContent = item.value;
    wrapper.append(term, value);
    profileGrid.append(wrapper);
  });

  scheduleGrid.innerHTML = "";
  settings.schedule_items.filter(isVisibleItem).forEach((item) => {
    const card = document.createElement("article");
    const day = document.createElement("p");
    const time = document.createElement("strong");
    card.className = "schedule-card";
    day.textContent = item.day;
    time.textContent = item.time;
    card.append(day, time);
    scheduleGrid.append(card);
  });
}

function normalizeSettings(settings) {
  return {
    ...defaultSettings,
    ...settings,
    social_links: Array.isArray(settings.social_links) ? settings.social_links : defaultSettings.social_links,
    profile_items: Array.isArray(settings.profile_items) ? settings.profile_items : defaultSettings.profile_items,
    schedule_items: Array.isArray(settings.schedule_items) ? settings.schedule_items : defaultSettings.schedule_items
  };
}

function isVisibleItem(item) {
  return item && item.is_visible !== false;
}

async function updateLiveStatus() {
  if (!streamLink || !liveBadge) return;

  try {
    const response = await fetch("./api/live-status", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const status = await response.json();
    setLiveStatus(Boolean(status.live));
  } catch (error) {
    setLiveStatus(false);
  }
}

function setLiveStatus(isLive) {
  streamLink.classList.toggle("is-live", isLive);
  streamLink.setAttribute(
    "aria-label",
    isLive ? "ku앤유 방송 바로가기, 현재 방송 중" : "ku앤유 방송 바로가기"
  );
  liveBadge.hidden = !isLive;
}

function initProfileToggle() {
  if (!profileSection || !profileToggle || !profileDetails) return;

  profileToggle.addEventListener("click", () => {
    const isOpen = profileToggle.getAttribute("aria-expanded") === "true";
    profileToggle.setAttribute("aria-expanded", String(!isOpen));
    profileToggle.querySelector("span").textContent = isOpen ? "정보 보기" : "정보 닫기";
    profileSection.classList.toggle("is-open", !isOpen);
    profileDetails.setAttribute("aria-hidden", String(isOpen));
    profileDetails.hidden = isOpen;
  });
}

function renderClips() {
  clipGrid.innerHTML = "";
  emptyState.hidden = state.clips.length > 0;
  resultCount.textContent = `${state.clips.length}개 클립을 표시 중입니다.`;

  state.clips.forEach((clip) => {
    const card = template.content.firstElementChild.cloneNode(true);
    const clipOpen = card.querySelector(".clip-open");
    const thumbVideo = card.querySelector(".thumb-video");
    const clipLabel = card.querySelector(".clip-label");

    thumbVideo.src = clip.video ? `${encodeURI(clip.video)}#t=0.1` : "";
    if (clip.thumbnail) {
      clipOpen.style.backgroundImage = `url("${encodeURI(clip.thumbnail)}")`;
      clipOpen.style.backgroundSize = "cover";
      clipOpen.style.backgroundPosition = "center";
    }
    clipLabel.textContent = clip.title || "제목 없는 클립";
    clipOpen.setAttribute("aria-label", clip.title || "클립 열기");
    clipOpen.addEventListener("click", () => openPlayer(clip));

    clipGrid.append(card);
  });
}

function openPlayer(clip) {
  const url = clip.url || state.settings.stream_url || defaultSettings.stream_url;
  playerTitle.textContent = clip.title || "제목 없는 클립";
  externalPlayerLink.href = url;

  clipPlayer.src = "about:blank";
  localPlayer.pause();
  localPlayer.removeAttribute("src");

  if (clip.video) {
    localPlayer.src = encodeURI(clip.video);
    localPlayer.hidden = false;
    clipPlayer.hidden = true;
    localPlayer.load();
  } else if (clip.embed_url || clip.embedUrl) {
    clipPlayer.src = clip.embed_url || clip.embedUrl;
    localPlayer.hidden = true;
    clipPlayer.hidden = false;
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  playerModal.hidden = false;
  document.body.style.overflow = "hidden";
}

function initPlayerModal() {
  document.querySelectorAll("[data-close-player]").forEach((element) => {
    element.addEventListener("click", closePlayer);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closePlayer();
      closeAdmin();
    }
  });
}

function closePlayer() {
  if (playerModal.hidden) return;
  playerModal.hidden = true;
  localPlayer.pause();
  localPlayer.removeAttribute("src");
  clipPlayer.src = "about:blank";
  document.body.style.overflow = "";
}

function initAdminModal() {
  if (!adminOpen || !adminModal) return;

  adminOpen.addEventListener("click", openAdmin);
  document.querySelectorAll("[data-close-admin]").forEach((element) => {
    element.addEventListener("click", closeAdmin);
  });
  adminLoginForm.addEventListener("submit", handleAdminLogin);
  adminEditor.addEventListener("submit", handleAdminSave);
  adminLogout.addEventListener("click", handleAdminLogout);
  addClip.addEventListener("click", () => {
    state.clips.push({
      title: "",
      url: state.settings.stream_url || defaultSettings.stream_url,
      video: "",
      embed_url: "",
      thumbnail: "",
      sort_order: state.clips.length + 1,
      is_visible: true
    });
    renderClipEditor();
  });
}

function openAdmin() {
  fillAdminForm();
  adminModal.hidden = false;
  document.body.style.overflow = "hidden";
  if (!state.adminPassword) {
    adminPassword.focus();
  }
}

function closeAdmin() {
  if (!adminModal || adminModal.hidden) return;
  adminModal.hidden = true;
  document.body.style.overflow = "";
}

async function handleAdminLogin(event) {
  event.preventDefault();
  const password = adminPassword.value.trim();

  const submitButton = adminLoginForm.querySelector(".admin-primary");
  submitButton.disabled = true;
  adminLoginMessage.textContent = "확인 중입니다.";

  try {
    const response = await fetch("./api/admin-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });

    if (!response.ok) {
      throw new Error("비밀번호가 맞지 않습니다.");
    }

    state.adminPassword = password;
    setAdminMode(true);
    adminLoginMessage.textContent = "";
    adminStatus.textContent = "관리자 모드입니다.";
  } catch (error) {
    state.adminPassword = "";
    setAdminMode(false);
    adminPassword.value = "";
    adminLoginMessage.textContent = error.message;
    adminPassword.focus();
  } finally {
    submitButton.disabled = false;
  }
}

function handleAdminLogout() {
  state.adminPassword = "";
  adminPassword.value = "";
  adminLoginMessage.textContent = "";
  setAdminMode(false);
}

function setAdminMode(isEditing) {
  adminLoginForm.hidden = isEditing;
  adminEditor.hidden = !isEditing;
}

function fillAdminForm() {
  const settings = normalizeSettings(state.settings);
  settingHeroLead.value = settings.hero_lead;
  settingStreamUrl.value = settings.stream_url;
  settingScheduleNote.value = settings.schedule_note;
  settingFooter.value = settings.footer_text;
  socialX.value = findSocialUrl("x", settings);
  socialYoutube.value = findSocialUrl("youtube", settings);
  socialTiktok.value = findSocialUrl("tiktok", settings);
  socialDiscord.value = findSocialUrl("discord", settings);
  profileText.value = settings.profile_items.map((item) => `${item.label}=${item.value}`).join("\n");
  scheduleText.value = settings.schedule_items.map((item) => `${item.day}=${item.time}`).join("\n");
  renderClipEditor();
}

function findSocialUrl(platform, settings) {
  return settings.social_links.find((link) => link.platform === platform)?.url || "";
}

function renderClipEditor() {
  clipEditorList.innerHTML = "";
  state.clips.forEach((clip, index) => {
    const row = document.createElement("div");
    row.className = "clip-edit-row";
    row.innerHTML = `
      <label class="clip-wide">제목<input data-clip-field="title" data-index="${index}" type="text" value="${escapeAttribute(clip.title || "")}" /></label>
      <label class="clip-wide">원본 링크<input data-clip-field="url" data-index="${index}" type="url" value="${escapeAttribute(clip.url || "")}" /></label>
      <label>영상 경로<input data-clip-field="video" data-index="${index}" type="text" value="${escapeAttribute(clip.video || "")}" /></label>
      <label>임베드 URL<input data-clip-field="embed_url" data-index="${index}" type="url" value="${escapeAttribute(clip.embed_url || clip.embedUrl || "")}" /></label>
      <label>썸네일<input data-clip-field="thumbnail" data-index="${index}" type="text" value="${escapeAttribute(clip.thumbnail || "")}" /></label>
      <label>순서<input data-clip-field="sort_order" data-index="${index}" type="number" min="1" value="${Number(clip.sort_order || index + 1)}" /></label>
      <div class="clip-edit-actions">
        <label><input data-clip-field="is_visible" data-index="${index}" type="checkbox" ${clip.is_visible === false ? "" : "checked"} /> 공개</label>
        <button class="admin-secondary" data-delete-clip="${index}" type="button">숨김/삭제</button>
      </div>
    `;
    clipEditorList.append(row);
  });

  clipEditorList.querySelectorAll("[data-clip-field]").forEach((input) => {
    input.addEventListener("input", updateClipFromInput);
    input.addEventListener("change", updateClipFromInput);
  });
  clipEditorList.querySelectorAll("[data-delete-clip]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.deleteClip);
      state.clips[index].is_visible = false;
      renderClipEditor();
    });
  });
}

function updateClipFromInput(event) {
  const input = event.currentTarget;
  const clip = state.clips[Number(input.dataset.index)];
  const field = input.dataset.clipField;

  if (!clip) return;
  if (field === "is_visible") {
    clip[field] = input.checked;
  } else if (field === "sort_order") {
    clip[field] = Number(input.value || 0);
  } else {
    clip[field] = input.value.trim();
  }
}

async function handleAdminSave(event) {
  event.preventDefault();
  if (!state.adminPassword) return;

  const submitButton = adminEditor.querySelector(".admin-primary");
  submitButton.disabled = true;
  adminStatus.textContent = "저장 중입니다.";

  try {
    const payload = {
      password: state.adminPassword,
      settings: collectSettingsFromForm(),
      clips: state.clips.map(normalizeClipForSave)
    };
    const response = await fetch("./api/admin-content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }

    state.settings = result.settings || payload.settings;
    state.clips = Array.isArray(result.clips) ? result.clips : payload.clips.filter((clip) => clip.is_visible);
    applySettings();
    renderClips();
    fillAdminForm();
    adminStatus.textContent = "저장되었습니다.";
    window.alert("수정되었습니다");
    closeAdmin();
  } catch (error) {
    adminStatus.textContent = `저장 실패: ${error.message}`;
  } finally {
    submitButton.disabled = false;
  }
}

function collectSettingsFromForm() {
  return {
    id: "main",
    hero_lead: settingHeroLead.value.trim() || defaultSettings.hero_lead,
    stream_url: settingStreamUrl.value.trim() || defaultSettings.stream_url,
    schedule_note: settingScheduleNote.value.trim() || defaultSettings.schedule_note,
    footer_text: settingFooter.value.trim() || defaultSettings.footer_text,
    social_links: [
      { platform: "x", label: "X", url: socialX.value.trim(), is_visible: Boolean(socialX.value.trim()) },
      { platform: "youtube", label: "YouTube", url: socialYoutube.value.trim(), is_visible: Boolean(socialYoutube.value.trim()) },
      { platform: "tiktok", label: "TikTok", url: socialTiktok.value.trim(), is_visible: Boolean(socialTiktok.value.trim()) },
      { platform: "discord", label: "Discord", url: socialDiscord.value.trim(), is_visible: Boolean(socialDiscord.value.trim()) }
    ],
    profile_items: parseKeyValueLines(profileText.value, "label", "value"),
    schedule_items: parseKeyValueLines(scheduleText.value, "day", "time")
  };
}

function parseKeyValueLines(text, keyName, valueName) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [key, ...valueParts] = line.split("=");
      return {
        [keyName]: (key || "").trim(),
        [valueName]: valueParts.join("=").trim(),
        sort_order: index + 1,
        is_visible: true
      };
    })
    .filter((item) => item[keyName] && item[valueName]);
}

function normalizeClipForSave(clip, index) {
  return {
    id: clip.id || null,
    title: (clip.title || "").trim() || "제목 없는 클립",
    url: (clip.url || "").trim() || state.settings.stream_url || defaultSettings.stream_url,
    video: (clip.video || "").trim(),
    embed_url: (clip.embed_url || clip.embedUrl || "").trim(),
    thumbnail: (clip.thumbnail || "").trim(),
    sort_order: Number(clip.sort_order || index + 1),
    is_visible: clip.is_visible !== false
  };
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
