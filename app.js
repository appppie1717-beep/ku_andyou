// ku앤유 클립 목록과 라이브 표시, 영상 모달을 제어합니다.
const state = {
  clips: []
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
const streamLink = document.querySelector(".stream-link");
const liveBadge = document.querySelector("#liveBadge");
const profileSection = document.querySelector(".profile-section");
const profileToggle = document.querySelector(".profile-toggle");
const profileDetails = document.querySelector("#profileDetails");

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

  try {
    const response = await fetch("./clips.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const clips = await response.json();
    state.clips = Array.isArray(clips) ? clips : fallbackClips;
  } catch (error) {
    state.clips = fallbackClips;
    resultCount.textContent = "clips.json을 불러오지 못해 기본 링크를 표시합니다.";
  }

  renderClips();
  initProfileToggle();

  document.querySelectorAll("[data-close-player]").forEach((element) => {
    element.addEventListener("click", closePlayer);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePlayer();
  });
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
    clipLabel.textContent = clip.title || "제목 없는 클립";
    clipOpen.setAttribute("aria-label", clip.title || "클립 열기");
    clipOpen.addEventListener("click", () => openPlayer(clip));

    clipGrid.append(card);
  });
}

function openPlayer(clip) {
  const url = clip.url || "https://chzzk.naver.com/7f43db49e367d87397c3a38d57dad71f";
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
  } else if (clip.embedUrl) {
    clipPlayer.src = clip.embedUrl;
    localPlayer.hidden = true;
    clipPlayer.hidden = false;
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  playerModal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closePlayer() {
  if (playerModal.hidden) return;
  playerModal.hidden = true;
  localPlayer.pause();
  localPlayer.removeAttribute("src");
  clipPlayer.src = "about:blank";
  document.body.style.overflow = "";
}
