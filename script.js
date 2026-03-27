const TOTAL_SEGMENTS = 4;
let unlockedUpTo = parseInt(localStorage.getItem('oh-cyprus-progress') || '0');

const bell = new Audio('audio/bell.mp3');
const phoneRing = new Audio('audio/phone-ring.mp3');

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

// === INIT ===
showScreen('welcome');