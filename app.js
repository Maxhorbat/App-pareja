/* ========================================
   CORAZÓN CONECTADO — Versión 1
   Lógica principal
   ======================================== */

// ---------- Estado ----------
const state = {
  images: [],
  tracks: [],
  currentTrack: null
};

// ---------- DOM ----------
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');
const imageInput = document.getElementById('image-input');
const musicInput = document.getElementById('music-input');
const uploadImages = document.getElementById('upload-images');
const uploadMusic = document.getElementById('upload-music');
const imageGallery = document.getElementById('image-gallery');
const musicPlaylist = document.getElementById('music-playlist');
const player = document.getElementById('player');
const audioPlayer = document.getElementById('audio-player');
const nowPlaying = document.getElementById('now-playing');
const name1Input = document.getElementById('name1');
const name2Input = document.getElementById('name2');
const saveNamesBtn = document.getElementById('save-names');
const coupleNamesEl = document.getElementById('couple-names');

// ---------- Navegación de pestañas ----------
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;

    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    panels.forEach(p => {
      p.classList.remove('active');
      if (p.id === target) p.classList.add('active');
    });
  });
});

// ---------- Utilidades de subida ----------
function setupUpload(zone, input, handler) {
  zone.addEventListener('click', () => input.click());

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('dragover');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('dragover');
  });

  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      handler(e.dataTransfer.files);
    }
  });

  input.addEventListener('change', () => {
    if (input.files.length) {
      handler(input.files);
      input.value = '';
    }
  });
}

// ---------- Imágenes ----------
function handleImages(files) {
  Array.from(files).forEach(file => {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = e => {
      const id = Date.now() + Math.random().toString(36).slice(2);
      state.images.push({ id, src: e.target.result, name: file.name });
      renderGallery();
      saveToLocal();
    };
    reader.readAsDataURL(file);
  });
}

function renderGallery() {
  if (state.images.length === 0) {
    imageGallery.innerHTML = `
      <div class="empty-state">
        <p>Aún no hay imágenes compartidas</p>
        <p class="hint">Sube la primera para empezar</p>
      </div>
    `;
    return;
  }

  imageGallery.innerHTML = state.images.map(img => `
    <div class="gallery-item" data-id="${img.id}">
      <img src="${img.src}" alt="${img.name}" loading="lazy">
      <button class="remove-btn" title="Eliminar">✕</button>
    </div>
  `).join('');

  imageGallery.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.closest('.gallery-item').dataset.id;
      state.images = state.images.filter(i => i.id !== id);
      renderGallery();
      saveToLocal();
    });
  });
}

// ---------- Música ----------
function handleMusic(files) {
  Array.from(files).forEach(file => {
    if (!file.type.startsWith('audio/')) return;

    const reader = new FileReader();
    reader.onload = e => {
      const id = Date.now() + Math.random().toString(36).slice(2);
      state.tracks.push({
        id,
        src: e.target.result,
        name: file.name.replace(/\.[^/.]+$/, '')
      });
      renderPlaylist();
      saveToLocal();
    };
    reader.readAsDataURL(file);
  });
}

function renderPlaylist() {
  if (state.tracks.length === 0) {
    musicPlaylist.innerHTML = `
      <div class="empty-state">
        <p>Aún no hay canciones compartidas</p>
        <p class="hint">Sube la primera canción de nuestra historia</p>
      </div>
    `;
    player.hidden = true;
    return;
  }

  musicPlaylist.innerHTML = state.tracks.map(track => `
    <div class="track ${state.currentTrack === track.id ? 'playing' : ''}" data-id="${track.id}">
      <span class="track-icon">♪</span>
      <div class="track-info">
        <div class="track-name">${track.name}</div>
      </div>
      <button class="track-remove" title="Eliminar">✕</button>
    </div>
  `).join('');

  musicPlaylist.querySelectorAll('.track').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.classList.contains('track-remove')) return;
      playTrack(el.dataset.id);
    });
  });

  musicPlaylist.querySelectorAll('.track-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.closest('.track').dataset.id;
      if (state.currentTrack === id) {
        audioPlayer.pause();
        state.currentTrack = null;
        player.hidden = true;
      }
      state.tracks = state.tracks.filter(t => t.id !== id);
      renderPlaylist();
      saveToLocal();
    });
  });
}

function playTrack(id) {
  const track = state.tracks.find(t => t.id === id);
  if (!track) return;

  state.currentTrack = id;
  audioPlayer.src = track.src;
  nowPlaying.textContent = track.name;
  player.hidden = false;
  audioPlayer.play();
  renderPlaylist();
}

// ---------- Nombres de la pareja ----------
function loadNames() {
  const saved = localStorage.getItem('cc_names');
  if (saved) {
    try {
      const { name1, name2 } = JSON.parse(saved);
      name1Input.value = name1 || 'Tú';
      name2Input.value = name2 || 'Yo';
      coupleNamesEl.textContent = `${name1 || 'Tú'} & ${name2 || 'Yo'}`;
    } catch (_) {}
  }
}

saveNamesBtn.addEventListener('click', () => {
  const name1 = name1Input.value.trim() || 'Tú';
  const name2 = name2Input.value.trim() || 'Yo';
  localStorage.setItem('cc_names', JSON.stringify({ name1, name2 }));
  coupleNamesEl.textContent = `${name1} & ${name2}`;

  // Feedback visual simple
  saveNamesBtn.textContent = '¡Guardado!';
  setTimeout(() => {
    saveNamesBtn.textContent = 'Guardar apodos';
  }, 1500);
});

// ---------- Persistencia local ----------
function saveToLocal() {
  // Guardamos solo metadatos + data URLs (limitado, pero ok para v1)
  try {
    localStorage.setItem('cc_images', JSON.stringify(state.images));
    localStorage.setItem('cc_tracks', JSON.stringify(state.tracks));
  } catch (e) {
    console.warn('No se pudo guardar en localStorage (posible límite de tamaño):', e);
  }
}

function loadFromLocal() {
  try {
    const images = localStorage.getItem('cc_images');
    const tracks = localStorage.getItem('cc_tracks');
    if (images) state.images = JSON.parse(images);
    if (tracks) state.tracks = JSON.parse(tracks);
  } catch (_) {
    state.images = [];
    state.tracks = [];
  }
}

// ---------- Reloj de días de novios ----------
// Fecha de inicio: 3 de julio de 2026
const START_DATE = new Date(2026, 6, 3, 0, 0, 0); // mes 6 = julio

const daysEl = document.getElementById('days');
const hoursEl = document.getElementById('hours');
const minutesEl = document.getElementById('minutes');
const secondsEl = document.getElementById('seconds');

function updateLoveTimer() {
  const now = new Date();
  let diff = now - START_DATE;

  // Si la fecha aún no llega, mostrar ceros
  if (diff < 0) {
    daysEl.textContent = '0';
    hoursEl.textContent = '0';
    minutesEl.textContent = '0';
    secondsEl.textContent = '0';
    return;
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  daysEl.textContent = days;
  hoursEl.textContent = String(hours).padStart(2, '0');
  minutesEl.textContent = String(minutes).padStart(2, '0');
  secondsEl.textContent = String(seconds).padStart(2, '0');
}

// ---------- Inicialización ----------
setupUpload(uploadImages, imageInput, handleImages);
setupUpload(uploadMusic, musicInput, handleMusic);

loadNames();
loadFromLocal();
renderGallery();
renderPlaylist();

// Iniciar reloj (actualiza cada segundo)
updateLoveTimer();
setInterval(updateLoveTimer, 1000);

console.log('%c♥ Corazón Conectado v1.0 listo', 'color: #ff2d95; font-size: 14px;');
