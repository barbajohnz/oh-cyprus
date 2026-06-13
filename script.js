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
  { time: 0,   bulb: 'desk', brightness: 100, color: 'WarmWhite', fade: 9 },
  { time: 75,  bulb: 'desk', brightness: 100, hue: 30, saturation: 100 },
  { time: 100, bulb: 'desk', brightness: 50,  hue: 30, saturation: 100 },
  { time: 120, bulb: 'desk', brightness: 50,  color: 'WarmWhite' },
  { time: 160, bulb: 'desk', brightness: 1,   color: 'WarmWhite', fade: 4 },
];

// === SEGMENT 2 LIGHTING CUES (single bulb) ===
// Pink is hue 330. If it looks too magenta, lower toward 320; toward 345 is rosier.
const SEG2_CUES = [
  { time: 5,   bulb: 'seg2', brightness: 50,  color: 'WarmWhite', fade: 5 },
  { time: 41,  bulb: 'seg2', brightness: 100, color: 'WarmWhite', fade: 3 },
  { time: 65,  bulb: 'seg2', flicker: 'onoff', duration: 14, brightness: 100, color: 'WarmWhite' },
  { time: 90,  bulb: 'seg2', brightness: 100, hue: 330, saturation: 100 },
  { time: 100, bulb: 'seg2', brightness: 100, color: 'WarmWhite' },
  { time: 131, bulb: 'seg2', flicker: 'onoff', duration: 22, brightness: 50, color: 'WarmWhite' },
  { time: 156, bulb: 'seg2', brightness: 50,  color: 'WarmWhite' },
  { time: 165, bulb: 'seg2', brightness: 100, hue: 330, saturation: 100 },
  { time: 177, bulb: 'seg2', brightness: 50,  color: 'WarmWhite' },
  { time: 185, bulb: 'seg2', brightness: 5,   color: 'WarmWhite', fade: 3 },
  { time: 225, bulb: 'seg2', brightness: 50,  hue: 330, saturation: 100 },
  { time: 300, bulb: 'seg2', flicker: 'color', duration: 13, brightness: 100 },
  { time: 315, bulb: 'seg2', brightness: 50,  color: 'WarmWhite' },
  { time: 322, bulb: 'seg2', brightness: 1,   color: 'WarmWhite', fade: 3 },
];

// === SEGMENT 3 LIGHTING CUES (single bulb) ===
// Purple is hue 270. Red is hue 0.
const SEG3_CUES = [
  { time: 0,   bulb: 'seg3', brightness: 100, color: 'WarmWhite', fade: 5 },
  { time: 15,  bulb: 'seg3', flicker: 'onoff', duration: 10, brightness: 100, hue: 270, saturation: 100 },
  { time: 25,  bulb: 'seg3', on: false },
  { time: 57,  bulb: 'seg3', brightness: 1,   color: 'WarmWhite' },
  { time: 80,  bulb: 'seg3', brightness: 25,  color: 'WarmWhite' },
  { time: 118, bulb: 'seg3', brightness: 5,   color: 'WarmWhite' },
  { time: 151, bulb: 'seg3', brightness: 100, hue: 0, saturation: 100 },
  { time: 216, bulb: 'seg3', brightness: 100, color: 'WarmWhite' },
  { time: 247, bulb: 'seg3', brightness: 1,   color: 'WarmWhite', fade: 4 },
];

// === SEGMENT CONFIG ===
const SEGMENT_CUES  = { 1: SEG1_CUES, 2: SEG2_CUES, 3: SEG3_CUES };
const SEGMENT_BULB  = { 1: 'desk', 2: 'seg2', 3: 'seg3' };
const CONTINUE_TIME = { 1: 160, 2: 322, 3: 247, 4: 76 };

// Tracks which cues have fired so each runs once. Keys are namespaced per segment.
const firedCues = new Set();

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
  const progressBar = document.getElementById(`progress-${i}`);
  const nextTarget  = i < TOTAL_SEGMENTS ? `${i + 1}` : 'end';
  const continueBtn = document.querySelector(`.continue-btn[data-next="${nextTarget}"]`);

  const cues       = SEGMENT_CUES[i];
  const bulb       = SEGMENT_BULB[i];
  const continueAt = CONTINUE_TIME[i];

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

  // Starting a segment from the top resets its bulb to off and clears its fired cues
  if (cues && bulb) {
    audio.addEventListener('play', () => {
      if (audio.currentTime < 1) {
        sendCue(bulb, { on: false });
        cues.forEach((c, idx) => firedCues.delete(`${i}-${idx}`));
      }
    });
  }

  // Progress bar + lighting cues + continue reveal
  audio.addEventListener('timeupdate', () => {
    const t = audio.currentTime;
    if (audio.duration) {
      progressBar.style.width = `${(t / audio.duration) * 100}%`;
    }
    if (cues) {
      cues.forEach((cue, idx) => {
        const key = `${i}-${idx}`;
        if (!firedCues.has(key) && t >= cue.time) {
          firedCues.add(key);
          const { bulb: cueBulb, ...opts } = cue;
          delete opts.time;
          sendCue(cueBulb, opts);
        }
      });
    }
    if (continueAt != null && t >= continueAt) {
      continueBtn.classList.remove('hidden');
    }
  });

  // Segment ends
  audio.addEventListener('ended', () => {
    playBtn.textContent = 'Play';
    progressBar.style.width = '100%';
    saveProgress(i);
    continueBtn.classList.remove('hidden');
  });
}

// === CONTINUE BUTTONS ===
document.querySelectorAll('.continue-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const next = btn.dataset.next;
    // Turn off the bulb of the segment being left, for the next visitor
    if (next === '2')   sendCue('desk', { on: false });  // leaving Segment 1
    if (next === '3')   sendCue('seg2', { on: false });  // leaving Segment 2
    if (next === '4')   sendCue('seg3', { on: false });  // leaving Segment 3
    showScreen(next);
  });
});

// === GLOBAL RESTART ===
document.querySelectorAll('.global-restart-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    for (let j = 1; j <= TOTAL_SEGMENTS; j++) {
      const a = document.getElementById(`audio-${j}`);
      if (a && !a.paused) { a.pause(); a.currentTime = 0; }
      const pb = document.querySelector(`.play-btn[data-segment="${j}"]`);
      if (pb) pb.textContent = 'Play';
    }
    sendCue('desk', { on: false });
    sendCue('seg2', { on: false });
    sendCue('seg3', { on: false });
    localStorage.removeItem('oh-cyprus-progress');
    unlockedUpTo = 0;
    firedCues.clear();
    document.querySelectorAll('.continue-btn').forEach(b => b.classList.add('hidden'));
    showScreen('welcome');
  });
});

// === INIT — run intro animation on first load ===
runIntroAnimation();