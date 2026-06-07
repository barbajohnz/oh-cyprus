const TOTAL_SEGMENTS = 4;
let unlockedUpTo = parseInt(localStorage.getItem('oh-cyprus-progress') || '0');

// === PI LIGHTING SERVER ===
const PI = 'http://192.168.0.196:5000';

function sendCue(bulb, opts = {}) {
  const body = Object.assign({ bulb: bulb, on: true }, opts);
  fetch(`${PI}/cue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).catch(err => console.log('cue failed', bulb, err));
}

// === SEGMENT 1 LIGHTING CUES (single bulb) ===
const SEG1_CUES = [
  { time: 0,   bulb: 'desk', brightness: 100, color: 'WarmWhite', fade: 10 },
  { time: 75,  bulb: 'desk', brightness: 20,  color: 'WarmWhite', fade: 3 },
  { time: 78,  bulb: 'desk', brightness: 80,  color: 'WarmWhite', fade: 2 },
  { time: 88,  bulb: 'desk', brightness: 50,  hue: 30, saturation: 100 },
  { time: 121, bulb: 'desk', brightness: 100, hue: 30, saturation: 100, fade: 2 },
  { time: 140, bulb: 'desk', brightness: 60,  color: 'WarmWhite', fade: 4 },
  { time: 180, bulb: 'desk', brightness: 30,  color: 'WarmWhite', fade: 2 },
  { time: 182, bulb: 'desk', brightness: 70,  color: 'WarmWhite', fade: 2 },
  { time: 206, bulb: 'desk', brightness: 5,   color: 'WarmWhite', fade: 3 },
];

const bell = new Audio('audio/bell.mp3');

// Unlock audio on first user tap (required for iOS Safari)
function unlockAudio() {
  bell.play().then(() => bell.pause()).catch(() => {});
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

  const strokePaths = allPaths;

  strokePaths.forEach(path => {
    const len = path.getTotalLength();
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = len;
    path.style.opacity = '1';
    path.style.transition = 'none';
  });

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
    if (i === 1) firedCues.clear();
    audio.play();
    playBtn.textContent = 'Pause';
  });

  // Progress bar
  audio.addEventListener('timeupdate', () => {
    if (audio.duration) {
      progressBar.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
    }
  });

  // Segment 1 — lighting cues + bell baked in at 3:26
  if (i === 1) {
    // Start the room dark when beginning from the top.
    // Sensory bulb is forced off until its 1:28 cue. The desk
    // opening cue (time 0) already ramps up from black.
  audio.addEventListener('play', () => {
      if (audio.currentTime < 1) {
        sendCue('desk', { on: false });
        firedCues.clear();
      }
    });
    audio.addEventListener('timeupdate', () => {
      const t = audio.currentTime;
      SEG1_CUES.forEach((cue, idx) => {
        if (!firedCues.has(idx) && t >= cue.time) {
          firedCues.add(idx);
          const { bulb, ...opts } = cue;
          delete opts.time;
          sendCue(bulb, opts);
        }
      });
      if (t >= 206) {
        continueBtn.classList.remove('hidden');
      }
    });
  }

  // Segment 3 — phone ring baked in at 4:07
  if (i === 3) {
    audio.addEventListener('timeupdate', () => {
      if (audio.currentTime >= 247) {
        continueBtn.classList.remove('hidden');
      }
    });
  }

  // Segment ends
  audio.addEventListener('ended', () => {
    playBtn.textContent = 'Play';
    progressBar.style.width = '100%';
    saveProgress(i);
    continueBtn.classList.remove('hidden');
  });
}

// Tracks which Segment 1 cues have already fired so each runs once
const firedCues = new Set();

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
    firedCues.clear();
    document.querySelectorAll('.continue-btn').forEach(b => b.classList.add('hidden'));
    showScreen('welcome');
  });
});

// === INIT — run intro animation on first load ===
runIntroAnimation();