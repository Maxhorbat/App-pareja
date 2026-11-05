/* ========================================
   CORAZÓN CONECTADO — Versión 1
   Sincronización 100% gratis con Supabase
   ======================================== */

const state = {
  images: [],
  tracks: [],
  currentTrack: null,
  coupleCode: null,
  connected: false
};

let supabase = null;
let realtimeChannel = null;

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
const coupleCodeInput = document.getElementById('couple-code');
const connectBtn = document.getElementById('connect-btn');
const syncNote = document.getElementById('sync-note');
const syncDot = document.getElementById('sync-dot');
const syncStatus = document.getElementById('sync-status');
const supabaseUrlInput = document.getElementById('supabase-url');
const supabaseKeyInput = document.getElementById('supabase-key');
const saveSupabaseBtn = document.getElementById('save-supabase');
const imageProgress = document.getElementById('image-progress');
const imageProgressFill = document.getElementById('image-progress-fill');
const imageProgressText = document.getElementById('image-progress-text');
const musicProgress = document.getElementById('music-progress');
const musicProgressFill = document.getElementById('music-progress-fill');
const musicProgressText = document.getElementById('music-progress-text');

// ---------- Tabs ----------
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

// ---------- Upload helpers ----------
function setupUpload(zone, input, handler) {
  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handler(e.dataTransfer.files);
  });
  input.addEventListener('change', () => {
    if (input.files.length) {
      handler(input.files);
      input.value = '';
    }
  });
}

// ---------- Sync UI ----------
function setSyncUI(connected, message) {
  state.connected = connected;
  if (connected) {
    syncDot.style.background = '#22c55e';
    syncDot.style.boxShadow = '0 0 12px #22c55e';
    syncStatus.textContent = 'SINCRONIZADO';
    syncStatus.style.color = '#86efac';
  } else {
    syncDot.style.background = '#ff2d95';
    syncDot.style.boxShadow = '0 0 12px #ff2d95';
    syncStatus.textContent = 'SIN CONEXIÓN';
    syncStatus.style.color = '';
  }
  if (syncNote) syncNote.textContent = message || (connected ? 'Conectado y escuchando cambios' : 'No conectado');
}

// ---------- Supabase init ----------
function getSavedConfig() {
  try {
    const url = localStorage.getItem('https://ftjjrkdasansfyumsbci.supabase.co/rest/v1/');
    const key = localStorage.getItem('sb_publishable_QSAQxRLU8ldIurTV3oAnvg_PxInfucC');
    if (url && key) return { url, key };
  } catch (_) {}
  return null;
}

function initSupabase() {
  const config = getSavedConfig();
  if (!config) {
    setSyncUI(false, 'Falta configurar Supabase (ver sección Nosotros)');
    return false;
  }
  try {
    supabase = window.supabase.createClient(config.url, config.key);
    return true;
  } catch (e) {
    console.error(e);
    setSyncUI(false, 'Error al iniciar Supabase: ' + e.message);
    return false;
  }
}

async function loadItems() {
  if (!supabase || !state.coupleCode) return;

  const { data, error } = await supabase
    .from('shared_items')
    .select('*')
    .eq('couple_code', state.coupleCode)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    setSyncUI(false, 'Error al cargar: ' + error.message);
    return;
  }

  state.images = (data || []).filter(i => i.type === 'image');
  state.tracks = (data || []).filter(i => i.type === 'music');
  renderGallery();
  renderPlaylist();
}

function subscribeRealtime() {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  realtimeChannel = supabase
    .channel('shared_items_' + state.coupleCode)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'shared_items',
        filter: 'couple_code=eq.' + state.coupleCode
      },
      () => {
        loadItems();
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setSyncUI(true, 'Conectado al código "' + state.coupleCode + '". Todo se sincroniza en tiempo real.');
      }
    });
}

async function connectCouple(code) {
  const clean = (code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean || clean.length < 4) {
    alert('El código de pareja debe tener al menos 4 caracteres (letras y números)');
    return;
  }

  if (!initSupabase()) {
    alert('Primero configurá Supabase en la sección Nosotros (abajo del todo)');
    return;
  }

  state.coupleCode = clean;
  localStorage.setItem('cc_couple_code', clean);
  coupleCodeInput.value = clean;

  await loadItems();
  subscribeRealtime();
  setSyncUI(true, 'Conectado al código "' + clean + '". Todo lo que suban se verá en ambos dispositivos.');
}

// ---------- Comprimir imagen ----------
function compressImage(file, maxWidth, quality) {
  maxWidth = maxWidth || 1000;
  quality = quality || 0.75;
  return new Promise(function(resolve, reject) {
    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function() {
      URL.revokeObjectURL(url);
      var w = img.width;
      var h = img.height;
      if (w > maxWidth) {
        h = Math.round(h * maxWidth / w);
        w = maxWidth;
      }
      var canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(function(blob) {
        if (blob) resolve(blob);
        else reject(new Error('No se pudo comprimir'));
      }, 'image/jpeg', quality);
    };
    img.onerror = function() {
      URL.revokeObjectURL(url);
      reject(new Error('Imagen inválida'));
    };
    img.src = url;
  });
}

// ---------- Subir archivo a Storage + guardar fila ----------
async function uploadAndSave(file, type, onProgress) {
  if (!state.coupleCode || !supabase) throw new Error('No hay conexión');

  var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  var safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  var path = state.coupleCode + '/' + type + '/' + id + '_' + safeName;

  var upResult = await supabase.storage
    .from('couple-files')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (upResult.error) throw upResult.error;

  var urlData = supabase.storage.from('couple-files').getPublicUrl(path);
  var url = urlData.data.publicUrl;

  var name = type === 'music' ? safeName.replace(/\.[^/.]+$/, '') : safeName;

  var dbResult = await supabase.from('shared_items').insert({
    id: id,
    couple_code: state.coupleCode,
    type: type,
    name: name,
    url: url,
    created_at: Date.now()
  });

  if (dbResult.error) throw dbResult.error;

  if (onProgress) onProgress(100);
  return { id: id, url: url, name: name };
}

// ---------- Imágenes ----------
async function handleImages(files) {
  if (!state.connected) {
    alert('Primero conectá el código de pareja en la pestaña Nosotros');
    return;
  }

  imageProgress.hidden = false;
  imageProgressFill.style.width = '0%';
  imageProgressText.textContent = 'Preparando...';

  var fileList = Array.from(files);
  for (var i = 0; i < fileList.length; i++) {
    var file = fileList[i];
    if (!file.type.startsWith('image/')) continue;
    try {
      imageProgressText.textContent = 'Comprimiendo ' + file.name + '...';
      imageProgressFill.style.width = '20%';
      var blob = await compressImage(file);
      imageProgressText.textContent = 'Subiendo ' + file.name + '...';
      imageProgressFill.style.width = '50%';

      await uploadAndSave(new File([blob], file.name, { type: 'image/jpeg' }), 'image', function(pct) {
        imageProgressFill.style.width = pct + '%';
      });
      imageProgressFill.style.width = '100%';
    } catch (e) {
      console.error(e);
      alert('Error al subir imagen: ' + (e.message || e.error_description || e));
    }
  }

  imageProgress.hidden = true;
  await loadItems();
}

function renderGallery() {
  if (state.images.length === 0) {
    imageGallery.innerHTML = '<div class="empty-state"><p>Aún no hay imágenes compartidas</p><p class="hint">' + (state.connected ? 'Sube la primera para empezar' : 'Conecta el código de pareja primero') + '</p></div>';
    return;
  }

  imageGallery.innerHTML = state.images.map(function(img) {
    return '<div class="gallery-item" data-id="' + img.id + '"><img src="' + img.url + '" alt="' + (img.name || '') + '" loading="lazy"><button class="remove-btn" title="Eliminar">✕</button></div>';
  }).join('');

  imageGallery.querySelectorAll('.remove-btn').forEach(function(btn) {
    btn.addEventListener('click', async function(e) {
      e.stopPropagation();
      if (!confirm('¿Eliminar esta imagen para ambos?')) return;
      var id = btn.closest('.gallery-item').dataset.id;
      try {
        await supabase.from('shared_items').delete().eq('id', id);
        await loadItems();
      } catch (err) {
        alert('No se pudo eliminar: ' + err.message);
      }
    });
  });
}

// ---------- Música ----------
async function handleMusic(files) {
  if (!state.connected) {
    alert('Primero conectá el código de pareja en la pestaña Nosotros');
    return;
  }

  musicProgress.hidden = false;
  musicProgressFill.style.width = '0%';

  var fileList = Array.from(files);
  for (var i = 0; i < fileList.length; i++) {
    var file = fileList[i];
    if (!file.type.startsWith('audio/')) continue;
    if (file.size > 15 * 1024 * 1024) {
      alert(file.name + ' es muy pesada (máx ~15 MB). Probá con otra versión más liviana.');
      continue;
    }
    try {
      musicProgressText.textContent = 'Subiendo ' + file.name + '...';
      musicProgressFill.style.width = '30%';

      await uploadAndSave(file, 'music', function() {
        musicProgressFill.style.width = '100%';
      });
    } catch (e) {
      console.error(e);
      alert('Error al subir canción: ' + (e.message || e.error_description || e));
    }
  }

  musicProgress.hidden = true;
  await loadItems();
}

function renderPlaylist() {
  if (state.tracks.length === 0) {
    musicPlaylist.innerHTML = '<div class="empty-state"><p>Aún no hay canciones compartidas</p><p class="hint">' + (state.connected ? 'Sube la primera canción de nuestra historia' : 'Conecta el código de pareja primero') + '</p></div>';
    player.hidden = true;
    return;
  }

  musicPlaylist.innerHTML = state.tracks.map(function(track) {
    return '<div class="track ' + (state.currentTrack === track.id ? 'playing' : '') + '" data-id="' + track.id + '"><span class="track-icon">♪</span><div class="track-info"><div class="track-name">' + track.name + '</div></div><button class="track-remove" title="Eliminar">✕</button></div>';
  }).join('');

  musicPlaylist.querySelectorAll('.track').forEach(function(el) {
    el.addEventListener('click', function(e) {
      if (e.target.classList.contains('track-remove')) return;
      playTrack(el.dataset.id);
    });
  });

  musicPlaylist.querySelectorAll('.track-remove').forEach(function(btn) {
    btn.addEventListener('click', async function(e) {
      e.stopPropagation();
      if (!confirm('¿Eliminar esta canción para ambos?')) return;
      var id = btn.closest('.track').dataset.id;
      if (state.currentTrack === id) {
        audioPlayer.pause();
        state.currentTrack = null;
        player.hidden = true;
      }
      try {
        await supabase.from('shared_items').delete().eq('id', id);
        await loadItems();
      } catch (err) {
        alert('No se pudo eliminar: ' + err.message);
      }
    });
  });
}

function playTrack(id) {
  var track = state.tracks.find(function(t) { return t.id === id; });
  if (!track) return;
  state.currentTrack = id;
  audioPlayer.src = track.url;
  nowPlaying.textContent = track.name;
  player.hidden = false;
  audioPlayer.play().catch(function() {});
  renderPlaylist();
}

// ---------- Nombres ----------
function loadNames() {
  var saved = localStorage.getItem('cc_names');
  if (saved) {
    try {
      var parsed = JSON.parse(saved);
      name1Input.value = parsed.name1 || 'Aharon';
      name2Input.value = parsed.name2 || 'Mafer';
      coupleNamesEl.textContent = (parsed.name1 || 'Aharon') + ' & ' + (parsed.name2 || 'Mafer');
    } catch (_) {}
  }
}

saveNamesBtn.addEventListener('click', function() {
  var name1 = name1Input.value.trim() || 'Aharon';
  var name2 = name2Input.value.trim() || 'Mafer';
  localStorage.setItem('cc_names', JSON.stringify({ name1: name1, name2: name2 }));
  coupleNamesEl.textContent = name1 + ' & ' + name2;
  saveNamesBtn.textContent = '¡Guardado!';
  setTimeout(function() { saveNamesBtn.textContent = 'Guardar apodos'; }, 1500);
});

// ---------- Conectar código ----------
connectBtn.addEventListener('click', function() {
  connectCouple(coupleCodeInput.value);
});

// ---------- Guardar config Supabase ----------
saveSupabaseBtn.addEventListener('click', function() {
  var url = supabaseUrlInput.value.trim();
  var key = supabaseKeyInput.value.trim();
  if (!url || !key) {
    alert('Completá la URL y la clave anon public');
    return;
  }
  localStorage.setItem('cc_supabase_url', url);
  localStorage.setItem('cc_supabase_key', key);
  saveSupabaseBtn.textContent = '¡Guardado!';
  setTimeout(function() { saveSupabaseBtn.textContent = 'Guardar configuración Supabase'; }, 1500);

  var code = localStorage.getItem('cc_couple_code') || coupleCodeInput.value;
  if (code) connectCouple(code);
});

// ---------- Reloj ----------
var START_DATE = new Date(2026, 6, 3, 0, 0, 0);
var daysEl = document.getElementById('days');
var hoursEl = document.getElementById('hours');
var minutesEl = document.getElementById('minutes');
var secondsEl = document.getElementById('seconds');

function updateLoveTimer() {
  var now = new Date();
  var diff = now - START_DATE;
  if (diff < 0) {
    daysEl.textContent = '0';
    hoursEl.textContent = '0';
    minutesEl.textContent = '0';
    secondsEl.textContent = '0';
    return;
  }
  var totalSeconds = Math.floor(diff / 1000);
  daysEl.textContent = Math.floor(totalSeconds / 86400);
  hoursEl.textContent = String(Math.floor((totalSeconds % 86400) / 3600)).padStart(2, '0');
  minutesEl.textContent = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  secondsEl.textContent = String(totalSeconds % 60).padStart(2, '0');
}

// ---------- Init ----------
setupUpload(uploadImages, imageInput, handleImages);
setupUpload(uploadMusic, musicInput, handleMusic);
loadNames();

var savedCode = localStorage.getItem('cc_couple_code');
if (savedCode) coupleCodeInput.value = savedCode;

var savedConfig = getSavedConfig();
if (savedConfig) {
  supabaseUrlInput.value = savedConfig.url;
  supabaseKeyInput.value = savedConfig.key;
}

if (savedCode && savedConfig) {
  connectCouple(savedCode);
} else {
  setSyncUI(false, 'Configurá Supabase y el código de pareja en Nosotros');
}

updateLoveTimer();
setInterval(updateLoveTimer, 1000);

console.log('%c♥ Corazón Conectado v1.0 — Supabase gratis', 'color: #ff2d95; font-size: 14px;');
