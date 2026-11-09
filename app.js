/* ========================================
   CORAZÓN CONECTADO — Versión 1
   Pestañas + subida + sincronización Supabase
   ======================================== */

(function () {
  'use strict';

  var state = {
    images: [],
    tracks: [],
    currentTrack: null,
    coupleCode: null,
    connected: false
  };

  var supabaseClient = null;
  var realtimeChannel = null;
  var START_DATE = new Date(2026, 6, 3, 0, 0, 0);

  function $(id) {
    return document.getElementById(id);
  }

  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  // ---------- Pestañas ----------
  function switchTab(target) {
    qsa('.tab').forEach(function (t) {
      if (t.getAttribute('data-tab') === target) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });

    qsa('.panel').forEach(function (p) {
      if (p.id === target) {
        p.classList.add('active');
        p.style.cssText = 'display:block !important';
      } else {
        p.classList.remove('active');
        p.style.cssText = 'display:none !important';
      }
    });
  }

  function initTabs() {
    var nav = $('nav-tabs');
    if (!nav) return;

    nav.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.tab') : null;
      if (!btn) {
        // fallback
        var el = e.target;
        while (el && el !== nav) {
          if (el.classList && el.classList.contains('tab')) { btn = el; break; }
          el = el.parentNode;
        }
      }
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      var target = btn.getAttribute('data-tab');
      if (target) switchTab(target);
    });

    switchTab('imagenes');
  }

  // ---------- Sync UI ----------
  function setSyncUI(connected, message) {
    state.connected = connected;
    var dot = $('sync-dot');
    var status = $('sync-status');
    var note = $('sync-note');

    if (dot) {
      if (connected) {
        dot.style.background = '#22c55e';
        dot.style.boxShadow = '0 0 12px #22c55e';
      } else {
        dot.style.background = '#ff2d95';
        dot.style.boxShadow = '0 0 12px #ff2d95';
      }
    }
    if (status) {
      status.textContent = connected ? 'SINCRONIZADO' : 'LOCAL';
      status.style.color = connected ? '#86efac' : '';
    }
    if (note) {
      note.textContent = message || (connected ? 'Conectado' : 'Modo local');
    }
  }

  // ---------- Local ----------
  function saveLocal() {
    try {
      localStorage.setItem('cc_images', JSON.stringify(state.images));
      localStorage.setItem('cc_tracks', JSON.stringify(state.tracks));
    } catch (e) {
      console.warn('localStorage error', e);
    }
  }

  function loadLocal() {
    try {
      var imgs = localStorage.getItem('cc_images');
      var trks = localStorage.getItem('cc_tracks');
      if (imgs) state.images = JSON.parse(imgs);
      if (trks) state.tracks = JSON.parse(trks);
    } catch (e) {
      state.images = [];
      state.tracks = [];
    }
  }

  // ---------- Supabase ----------
  function getSupabaseConfig() {
    var url = localStorage.getItem('cc_supabase_url');
    var key = localStorage.getItem('cc_supabase_key');
    if (url && key) return { url: url, key: key };
    return null;
  }

  function initSupabase() {
    var config = getSupabaseConfig();
    if (!config) return false;
    if (!window.supabase || !window.supabase.createClient) {
      console.warn('Supabase SDK no cargó');
      return false;
    }
    try {
      supabaseClient = window.supabase.createClient(config.url, config.key);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  async function loadFromCloud() {
    if (!supabaseClient || !state.coupleCode) return;

    var result = await supabaseClient
      .from('shared_items')
      .select('*')
      .eq('couple_code', state.coupleCode)
      .order('created_at', { ascending: false });

    if (result.error) {
      console.error(result.error);
      setSyncUI(false, 'Error: ' + result.error.message);
      return;
    }

    var data = result.data || [];
    state.images = data.filter(function (i) { return i.type === 'image'; });
    state.tracks = data.filter(function (i) { return i.type === 'music'; });
    renderGallery();
    renderPlaylist();
  }

  function subscribeRealtime() {
    if (!supabaseClient || !state.coupleCode) return;
    if (realtimeChannel) {
      try { supabaseClient.removeChannel(realtimeChannel); } catch (e) {}
      realtimeChannel = null;
    }

    realtimeChannel = supabaseClient
      .channel('items_' + state.coupleCode)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shared_items',
          filter: 'couple_code=eq.' + state.coupleCode
        },
        function () { loadFromCloud(); }
      )
      .subscribe(function (status) {
        if (status === 'SUBSCRIBED') {
          setSyncUI(true, 'Conectado a "' + state.coupleCode + '" · sincronización activa');
        }
      });
  }

  async function connectCouple(code) {
    var clean = (code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!clean || clean.length < 4) {
      alert('El código debe tener al menos 4 letras o números');
      return;
    }

    if (!initSupabase()) {
      alert('Primero guardá la URL y la clave de Supabase en esta misma pestaña (abajo)');
      return;
    }

    state.coupleCode = clean;
    localStorage.setItem('cc_couple_code', clean);
    var codeInput = $('couple-code');
    if (codeInput) codeInput.value = clean;

    await loadFromCloud();
    subscribeRealtime();
    setSyncUI(true, 'Conectado a "' + clean + '"');
  }

  // ---------- Comprimir imagen ----------
  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(url);
        var maxW = 1000;
        var w = img.width;
        var h = img.height;
        if (w > maxW) {
          h = Math.round(h * maxW / w);
          w = maxW;
        }
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(function (blob) {
          if (blob) resolve(blob);
          else reject(new Error('No se pudo comprimir'));
        }, 'image/jpeg', 0.75);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('Imagen inválida'));
      };
      img.src = url;
    });
  }

  function readFileAsDataURL(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function uploadToCloud(file, type) {
    var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    var safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    var path = state.coupleCode + '/' + type + '/' + id + '_' + safeName;

    var up = await supabaseClient.storage
      .from('couple-files')
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (up.error) throw up.error;

    var pub = supabaseClient.storage.from('couple-files').getPublicUrl(path);
    var url = pub.data.publicUrl;
    var name = type === 'music' ? safeName.replace(/\.[^/.]+$/, '') : safeName;

    var ins = await supabaseClient.from('shared_items').insert({
      id: id,
      couple_code: state.coupleCode,
      type: type,
      name: name,
      url: url,
      created_at: Date.now()
    });

    if (ins.error) throw ins.error;
    return { id: id, url: url, name: name };
  }

  function addLocalImage(dataUrl, name) {
    var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    state.images.unshift({ id: id, url: dataUrl, name: name, type: 'image', created_at: Date.now() });
    saveLocal();
    renderGallery();
  }

  function addLocalTrack(dataUrl, name) {
    var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    state.tracks.unshift({ id: id, url: dataUrl, name: name, type: 'music', created_at: Date.now() });
    saveLocal();
    renderPlaylist();
  }

  // ---------- Handle imágenes ----------
  async function handleImages(files) {
    var list = Array.prototype.slice.call(files);
    var progress = $('image-progress');
    var fill = $('image-progress-fill');
    var text = $('image-progress-text');

    if (progress) progress.hidden = false;
    if (fill) fill.style.width = '0%';

    for (var i = 0; i < list.length; i++) {
      var file = list[i];
      if (!file.type || file.type.indexOf('image/') !== 0) continue;

      try {
        if (text) text.textContent = 'Procesando ' + file.name + '...';
        if (fill) fill.style.width = '30%';

        var blob = await compressImage(file);
        var jpegFile = new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });

        if (state.connected && supabaseClient && state.coupleCode) {
          if (text) text.textContent = 'Subiendo ' + file.name + '...';
          if (fill) fill.style.width = '60%';
          await uploadToCloud(jpegFile, 'image');
          await loadFromCloud();
        } else {
          var dataUrl = await readFileAsDataURL(jpegFile);
          addLocalImage(dataUrl, file.name);
        }

        if (fill) fill.style.width = '100%';
      } catch (err) {
        console.error(err);
        alert('Error con ' + file.name + ': ' + (err.message || err));
      }
    }

    if (progress) progress.hidden = true;
  }

  // ---------- Handle música ----------
  async function handleMusic(files) {
    var list = Array.prototype.slice.call(files);
    var progress = $('music-progress');
    var fill = $('music-progress-fill');
    var text = $('music-progress-text');

    if (progress) progress.hidden = false;
    if (fill) fill.style.width = '0%';

    for (var i = 0; i < list.length; i++) {
      var file = list[i];
      if (!file.type || file.type.indexOf('audio/') !== 0) continue;
      if (file.size > 15 * 1024 * 1024) {
        alert(file.name + ' es muy pesada (máx 15 MB)');
        continue;
      }

      try {
        if (text) text.textContent = 'Subiendo ' + file.name + '...';
        if (fill) fill.style.width = '40%';

        var cleanName = file.name.replace(/\.[^/.]+$/, '');

        if (state.connected && supabaseClient && state.coupleCode) {
          await uploadToCloud(file, 'music');
          await loadFromCloud();
        } else {
          var dataUrl = await readFileAsDataURL(file);
          addLocalTrack(dataUrl, cleanName);
        }

        if (fill) fill.style.width = '100%';
      } catch (err) {
        console.error(err);
        alert('Error con ' + file.name + ': ' + (err.message || err));
      }
    }

    if (progress) progress.hidden = true;
  }

  // ---------- Render ----------
  function renderGallery() {
    var gallery = $('image-gallery');
    if (!gallery) return;

    if (!state.images.length) {
      gallery.innerHTML = '<div class="empty-state"><p>Aún no hay imágenes</p><p class="hint">Subí la primera foto</p></div>';
      return;
    }

    gallery.innerHTML = state.images.map(function (img) {
      return '<div class="gallery-item" data-id="' + img.id + '">' +
        '<img src="' + img.url + '" alt="' + (img.name || '') + '" loading="lazy">' +
        '<button type="button" class="remove-btn" data-id="' + img.id + '" title="Eliminar">✕</button>' +
        '</div>';
    }).join('');

    qsa('.remove-btn', gallery).forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        removeImage(btn.getAttribute('data-id'));
      });
    });
  }

  async function removeImage(id) {
    if (!confirm('¿Eliminar esta imagen?')) return;

    if (state.connected && supabaseClient) {
      try {
        await supabaseClient.from('shared_items').delete().eq('id', id);
        await loadFromCloud();
      } catch (e) {
        alert('No se pudo eliminar: ' + e.message);
      }
    } else {
      state.images = state.images.filter(function (i) { return i.id !== id; });
      saveLocal();
      renderGallery();
    }
  }

  function renderPlaylist() {
    var playlist = $('music-playlist');
    var player = $('player');
    if (!playlist) return;

    if (!state.tracks.length) {
      playlist.innerHTML = '<div class="empty-state"><p>Aún no hay canciones</p><p class="hint">Subí la primera canción</p></div>';
      if (player) player.hidden = true;
      return;
    }

    playlist.innerHTML = state.tracks.map(function (track) {
      var playing = state.currentTrack === track.id ? ' playing' : '';
      return '<div class="track' + playing + '" data-id="' + track.id + '">' +
        '<span class="track-icon">♪</span>' +
        '<div class="track-info"><div class="track-name">' + track.name + '</div></div>' +
        '<button type="button" class="track-remove" data-id="' + track.id + '" title="Eliminar">✕</button>' +
        '</div>';
    }).join('');

    qsa('.track', playlist).forEach(function (el) {
      el.addEventListener('click', function (e) {
        if (e.target.classList.contains('track-remove')) return;
        playTrack(el.getAttribute('data-id'));
      });
    });

    qsa('.track-remove', playlist).forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        removeTrack(btn.getAttribute('data-id'));
      });
    });
  }

  function playTrack(id) {
    var track = null;
    for (var i = 0; i < state.tracks.length; i++) {
      if (state.tracks[i].id === id) { track = state.tracks[i]; break; }
    }
    if (!track) return;

    state.currentTrack = id;
    var audio = $('audio-player');
    var title = $('now-playing');
    var player = $('player');
    if (audio) {
      audio.src = track.url;
      audio.play().catch(function () {});
    }
    if (title) title.textContent = track.name;
    if (player) player.hidden = false;
    renderPlaylist();
  }

  async function removeTrack(id) {
    if (!confirm('¿Eliminar esta canción?')) return;

    if (state.currentTrack === id) {
      var audio = $('audio-player');
      if (audio) audio.pause();
      state.currentTrack = null;
      var player = $('player');
      if (player) player.hidden = true;
    }

    if (state.connected && supabaseClient) {
      try {
        await supabaseClient.from('shared_items').delete().eq('id', id);
        await loadFromCloud();
      } catch (e) {
        alert('No se pudo eliminar: ' + e.message);
      }
    } else {
      state.tracks = state.tracks.filter(function (t) { return t.id !== id; });
      saveLocal();
      renderPlaylist();
    }
  }

  // ---------- Upload zones ----------
  function setupUpload(zoneId, inputId, handler) {
    var zone = $(zoneId);
    var input = $(inputId);
    if (!zone || !input) return;

    input.style.display = 'none';

    zone.addEventListener('click', function () {
      input.click();
    });

    zone.addEventListener('dragover', function (e) {
      e.preventDefault();
      zone.classList.add('dragover');
    });

    zone.addEventListener('dragleave', function () {
      zone.classList.remove('dragover');
    });

    zone.addEventListener('drop', function (e) {
      e.preventDefault();
      zone.classList.remove('dragover');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        handler(e.dataTransfer.files);
      }
    });

    input.addEventListener('change', function () {
      if (input.files && input.files.length) {
        handler(input.files);
        input.value = '';
      }
    });
  }

  // ---------- Nombres ----------
  function loadNames() {
    try {
      var saved = localStorage.getItem('cc_names');
      if (saved) {
        var n = JSON.parse(saved);
        var n1 = $('name1');
        var n2 = $('name2');
        var badge = $('couple-names');
        if (n1) n1.value = n.name1 || 'Aharon';
        if (n2) n2.value = n.name2 || 'Mafer';
        if (badge) badge.textContent = (n.name1 || 'Aharon') + ' & ' + (n.name2 || 'Mafer');
      }
    } catch (e) {}
  }

  function initNames() {
    var btn = $('save-names');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var name1 = (($('name1') && $('name1').value) || 'Aharon').trim() || 'Aharon';
      var name2 = (($('name2') && $('name2').value) || 'Mafer').trim() || 'Mafer';
      localStorage.setItem('cc_names', JSON.stringify({ name1: name1, name2: name2 }));
      var badge = $('couple-names');
      if (badge) badge.textContent = name1 + ' & ' + name2;
      btn.textContent = '¡Guardado!';
      setTimeout(function () { btn.textContent = 'Guardar apodos'; }, 1500);
    });
  }

  // ---------- Sync controls ----------
  function initSyncControls() {
    var connectBtn = $('connect-btn');
    var saveBtn = $('save-supabase');
    var codeInput = $('couple-code');
    var urlInput = $('supabase-url');
    var keyInput = $('supabase-key');

    var savedCode = localStorage.getItem('cc_couple_code');
    if (savedCode && codeInput) codeInput.value = savedCode;

    var cfg = getSupabaseConfig();
    if (cfg) {
      if (urlInput) urlInput.value = cfg.url;
      if (keyInput) keyInput.value = cfg.key;
    }

    if (connectBtn) {
      connectBtn.addEventListener('click', function () {
        connectCouple(codeInput ? codeInput.value : '');
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        var url = urlInput ? urlInput.value.trim() : '';
        var key = keyInput ? keyInput.value.trim() : '';
        if (!url || !key) {
          alert('Completá la URL y la clave anon public');
          return;
        }
        localStorage.setItem('cc_supabase_url', url);
        localStorage.setItem('cc_supabase_key', key);
        saveBtn.textContent = '¡Guardado!';
        setTimeout(function () { saveBtn.textContent = 'Guardar Supabase'; }, 1500);

        var code = localStorage.getItem('cc_couple_code') || (codeInput ? codeInput.value : '');
        if (code) connectCouple(code);
      });
    }

    if (savedCode && cfg) {
      connectCouple(savedCode);
    } else {
      setSyncUI(false, 'Modo local · configurá Supabase para sincronizar entre dispositivos');
    }
  }

  // ---------- Reloj ----------
  function updateLoveTimer() {
    var now = new Date();
    var diff = now - START_DATE;
    var daysEl = $('days');
    var hoursEl = $('hours');
    var minutesEl = $('minutes');
    var secondsEl = $('seconds');
    if (!daysEl) return;

    if (diff < 0) {
      daysEl.textContent = '0';
      if (hoursEl) hoursEl.textContent = '0';
      if (minutesEl) minutesEl.textContent = '0';
      if (secondsEl) secondsEl.textContent = '0';
      return;
    }

    var total = Math.floor(diff / 1000);
    daysEl.textContent = Math.floor(total / 86400);
    if (hoursEl) hoursEl.textContent = String(Math.floor((total % 86400) / 3600)).padStart(2, '0');
    if (minutesEl) minutesEl.textContent = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
    if (secondsEl) secondsEl.textContent = String(total % 60).padStart(2, '0');
  }

  // ---------- Init ----------
  function init() {
    initTabs();
    setupUpload('upload-images', 'image-input', handleImages);
    setupUpload('upload-music', 'music-input', handleMusic);
    loadNames();
    initNames();
    loadLocal();
    renderGallery();
    renderPlaylist();
    initSyncControls();
    updateLoveTimer();
    setInterval(updateLoveTimer, 1000);
    console.log('%c♥ Corazón Conectado listo', 'color:#ff2d95');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
