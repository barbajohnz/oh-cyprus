const TOTAL_SEGMENTS = 4;
let unlockedUpTo = parseInt(localStorage.getItem('oh-cyprus-progress') || '0');

const bell = new Audio('audio/bell.mp3');
const phoneRing = new Audio('audio/phone-ring.mp3');

// Unlock audio on first user tap (required for iOS Safari)
function unlockAudio() {
  bell.play().then(() => bell.pause()).catch(() => {});
  phoneRing.play().then(() => phoneRing.pause()).catch(() => {});
  document.body.removeEventListener('touchstart', unlockAudio);
  document.body.removeEventListener('click', unlockAudio);
}
document.body.addEventListener('touchstart', unlockAudio);
document.body.addEventListener('click', unlockAudio);

// === SCREEN NAVIGATION ===
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(`screen-${id}`);
  if (target) {
    target.classList.add('active');
    window.scrollTo(0, 0);
  }
}

function saveProgress(segment) {
  if (segment > unlockedUpTo) {
    unlockedUpTo = segment;
    localStorage.setItem('oh-cyprus-progress', segment);
  }
}

// === INTRO ANIMATION ===
function runIntroAnimation() {
  const svg = document.getElementById('intro-svg');
  const allPaths = Array.from(svg.querySelectorAll('path'));

  // All paths are strokes in this SVG
  const strokePaths = allPaths;

  // Set up stroke paths for drawing animation
  strokePaths.forEach(path => {
    const len = path.getTotalLength();
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = len;
    path.style.opacity = '1';
    path.style.transition = 'none';
  });

  // Animate each stroke path sequentially with slight overlap
  // MS_PER_PX controls drawing speed — lower is faster
  const MS_PER_PX = 5;
  const OVERLAP = 0.55;
  const INITIAL_PAUSE = 500;

  let cumulativeDelay = INITIAL_PAUSE;

  strokePaths.forEach((path) => {
    const len = path.getTotalLength();
    const duration = Math.max(200, len * MS_PER_PX);

    setTimeout((p, d) => {
      p.style.transition = `stroke-dashoffset ${d}ms cubic-bezier(0.25, 0.1, 0.25, 1)`;
      p.style.strokeDashoffset = '0';
    }, cumulativeDelay, path, duration);

    cumulativeDelay += duration * OVERLAP;
  });

  // After everything finishes, pause then transition to welcome
  const totalAnimationTime = cumulativeDelay + 800;

  setTimeout(() => {
    transitionFromIntro();
  }, totalAnimationTime);
}

function transitionFromIntro() {
  const introScreen = document.getElementById('screen-intro');
  introScreen.style.transition = 'opacity 0.9s ease';
  introScreen.style.opacity = '0';
  setTimeout(() => {
    introScreen.style.transition = '';
    introScreen.style.opacity = '';
    showScreen('welcome');
  }, 900);
}

// Skip button
document.getElementById('intro-skip').addEventListener('click', () => {
  transitionFromIntro();
});

// === WELCOME SCREEN ===
const headphoneCheckbox = document.getElementById('headphone-confirm');
const beginBtn = document.getElementById('begin-btn');
const resumeNote = document.getElementById('resume-note');
const restartBtn = document.getElementById('restart-btn');

if (unlockedUpTo > 0 && unlockedUpTo < TOTAL_SEGMENTS) {
  resumeNote.style.display = 'block';
}

headphoneCheckbox.addEventListener('change', () => {
  beginBtn.disabled = !headphoneCheckbox.checked;
});

beginBtn.addEventListener('click', () => {
  if (unlockedUpTo >= TOTAL_SEGMENTS) {
    showScreen('end');
  } else if (unlockedUpTo > 0) {
    showScreen(unlockedUpTo + 1);
  } else {
    showScreen(1);
  }
});

restartBtn.addEventListener('click', () => {
  localStorage.removeItem('oh-cyprus-progress');
  unlockedUpTo = 0;
  resumeNote.style.display = 'none';
  showScreen(1);
});

// === AUDIO PLAYERS ===
for (let i = 1; i <= TOTAL_SEGMENTS; i++) {
  const audio       = document.getElementById(`audio-${i}`);
  const playBtn     = document.querySelector(`.play-btn[data-segment="${i}"]`);
  const restartABtn = document.querySelector(`.restart-btn[data-segment="${i}"]`);
  const progressBar = document.getElementById(`progress-${i}`);
  const nextTarget  = i < TOTAL_SEGMENTS ? `${i + 1}` : 'end';
  const continueBtn = document.querySelector(`.continue-btn[data-next="${nextTarget}"]`);

  // Play / Pause
  playBtn.addEventListener('click', () => {
    if (audio.paused) {
      for (let j = 1; j <= TOTAL_SEGMENTS; j++) {
        if (j !== i) {
          const other = document.getElementById(`audio-${j}`);
          if (other && !other.paused) {
            other.pause();
            document.querySelector(`.play-btn[data-segment="${j}"]`).textContent = 'Play';
          }
        }
      }
      audio.play();
      playBtn.textContent = 'Pause';
    } else {
      audio.pause();
      playBtn.textContent = 'Play';
    }
  });

  // Restart
  restartABtn.addEventListener('click', () => {
    audio.currentTime = 0;
    audio.play();
    playBtn.textContent = 'Pause';
  });

  // Progress bar
  audio.addEventListener('timeupdate', () => {
    if (audio.duration) {
      progressBar.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
    }
  });

  // Segment ends — play chime then show continue button
  audio.addEventListener('ended', () => {
    playBtn.textContent = 'Play';
    progressBar.style.width = '100%';
    saveProgress(i);
    const chime = i === 3 ? phoneRing : bell;
    chime.currentTime = 0;
    chime.play();
    chime.addEventListener('ended', () => {
      continueBtn.classList.remove('hidden');
    }, { once: true });
  });
}

// === CONTINUE BUTTONS ===
document.querySelectorAll('.continue-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    showScreen(btn.dataset.next);
  });
});

// === GLOBAL RESTART ===
document.querySelectorAll('.global-restart-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    localStorage.removeItem('oh-cyprus-progress');
    unlockedUpTo = 0;
    document.querySelectorAll('.continue-btn').forEach(b => b.classList.add('hidden'));
    showScreen('welcome');
  });
});

// === INIT — run intro animation on first load ===
runIntroAnimation();