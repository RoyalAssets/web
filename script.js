const music = document.querySelector('.music');
const backgroundVideo = document.querySelector('.background-video');
const modeButtons = document.querySelectorAll('[data-mode]');
const hero = document.querySelector('.hero');

// Keep each mode's video and music paths together so they stay in sync.
const modes = {
  default: { video: 'default-mode/background.mp4', music: 'default-mode/music.mp3' },
  dark: { video: 'dark-mode/darkbg.mp4', music: 'dark-mode/dark.mp3' },
  light: { video: 'light-mode/light.mp4', music: 'light-mode/lightmusic.mp3' }
};
let musicEnabled = false;
let musicLoadToken = 0;
let transitionToken = 0;

function setMode(mode) {
  // Use the default mode if the saved value is missing or not recognized.
  const assets = modes[mode] ? mode : 'default';
  const shouldResume = musicEnabled;

  // A token lets an older audio load know that a newer mode has been selected.
  const loadToken = ++musicLoadToken;
  document.body.dataset.theme = assets;
  backgroundVideo.src = modes[assets].video;

  // Pause before changing tracks so the old track does not overlap the new one.
  if (shouldResume && !music.paused) music.pause();
  music.src = modes[assets].music;
  backgroundVideo.load();

  // Browsers can block media playback, so handle the rejected play promises.
  backgroundVideo.play().catch(() => {});
  if (shouldResume) {
    music.addEventListener('canplay', () => {
      // Only resume if this is still the latest audio load.
      if (loadToken === musicLoadToken && musicEnabled) {
        music.play().catch(() => {
          musicEnabled = false;
        });
      }
    }, { once: true });
  }
  music.load();
  modeButtons.forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.mode === assets));
  });

  // Storage may be disabled in private browsing, so keep the page usable either way.
  try { localStorage.setItem('royalassets-mode', assets); } catch (error) {}
}

function changeMode(mode) {
  const nextMode = modes[mode] ? mode : 'default';
  if (modeChanging || nextMode === document.body.dataset.theme) return;
  modeChanging = true;

  // Ignore callbacks from an earlier transition if another one has started.
  const currentTransition = ++transitionToken;
  const finish = () => {
    if (currentTransition !== transitionToken) return;
    document.body.classList.remove('mode-transitioning');
    hero.classList.remove('is-sliding-out', 'is-sliding-in');
    modeChanging = false;
  };
  document.body.classList.add('mode-transitioning');
  hero.classList.add('is-sliding-out');
  window.setTimeout(() => {
    if (currentTransition !== transitionToken) return;

    // Finish the transition when the new video is ready, or use the timeout below.
    backgroundVideo.addEventListener('loadeddata', finish, { once: true });
    setMode(nextMode);
    hero.classList.remove('is-sliding-out');
    hero.classList.add('is-sliding-in');
    requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.remove('is-sliding-in')));
  }, 300);
  window.setTimeout(finish, 1300);
}

let modeChanging = false;
modeButtons.forEach(button => button.addEventListener('click', () => changeMode(button.dataset.mode)));
let savedMode = 'default';

// Remember the visitor's last selected mode when browser storage is available.
try { savedMode = localStorage.getItem('royalassets-mode') || 'default'; } catch (error) {}
setMode(savedMode);

async function startMusic() {
  if (musicEnabled) return;
  musicEnabled = true;
  const playToken = musicLoadToken;

  // Audio often needs a user gesture because of browser autoplay rules.
  try {
    await music.play();
  } catch (error) {
    if (playToken === musicLoadToken) musicEnabled = false;
  }
}
startMusic();
document.addEventListener('pointerdown', startMusic, { once: true });
document.addEventListener('keydown', startMusic, { once: true });

// Update the visible text one character at a time, then repeat in reverse.
const name = 'RoyalAssets';
const typewriterText = document.querySelector('.typewriter-text');
function typeName(index = 0) {
  if (index <= name.length) {
    typewriterText.textContent = name.slice(0, index);
    window.setTimeout(() => typeName(index + 1), index === name.length ? 2300 : 165);
    return;
  }
  eraseName(name.length);
}
function eraseName(index) {
  if (index >= 0) {
    typewriterText.textContent = name.slice(0, index);
    window.setTimeout(() => eraseName(index - 1), index === 0 ? 650 : 125);
    return;
  }
  typeName();
}
typeName();
