import { searchStations } from './radio-browser.js';

const list = document.getElementById('station-list');
const message = document.getElementById('message');
const resultCount = document.getElementById('result-count');
const searchInput = document.getElementById('search');
const countrySelect = document.getElementById('country');
const languageSelect = document.getElementById('language');
const playButton = document.getElementById('play');
const volumeInput = document.getElementById('volume');
const playerTitle = document.getElementById('player-title');
const playerStatus = document.getElementById('player-status');
const playerMeta = document.getElementById('player-meta');
const playerArt = document.getElementById('player-art');
const audio = document.getElementById('audio');
const importFileInput = document.getElementById('import-file');
const playIcon = playButton.querySelector('.play-icon');

const STORAGE_KEY = 'world-radio-pwa-v1';

let stations = [];
let favorites = [];
let recent = [];
let currentStationId = null;
let currentFilter = 'all';
let playerState = { station: null, playing: false, status: 'Ready', volume: 0.8 };
let searchTimer = null;
let sleepTimer = null;

const fallbackStations = [
  { stationuuid: 'demo-abc-melbourne', name: 'ABC Radio Melbourne', countrycode: 'AU', language: 'english', codec: 'AAC', bitrate: 115, tags: 'news,talk', favicon: '', url_resolved: 'https://live-radio01.mediahubaustralia.com/3LRW/mp3/' },
  { stationuuid: 'demo-3aw', name: '3AW 693 Melbourne', countrycode: 'AU', language: 'english', codec: 'MP3', bitrate: 48, tags: 'talk,news', favicon: '', url_resolved: 'https://playerservices.streamtheworld.com/api/livestream-redirect/3AW.mp3' },
  { stationuuid: 'demo-abc-national', name: 'ABC Radio National', countrycode: 'AU', language: 'english', codec: 'AAC', bitrate: 115, tags: 'news,talk', favicon: '', url_resolved: 'https://live-radio01.mediahubaustralia.com/2RNW/mp3/' },
  { stationuuid: 'demo-sbs', name: 'SBS Radio 1', countrycode: 'AU', language: 'english', codec: 'AAC', bitrate: 64, tags: 'news,talk', favicon: '', url_resolved: 'https://sbs-ice.streamguys1.com/sbs1.mp3' }
];

function loadState() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    favorites = Array.isArray(data.favorites) ? data.favorites : [];
    recent = Array.isArray(data.recent) ? data.recent : [];
    playerState = { ...playerState, ...(data.playerState || {}) };
    currentStationId = playerState.station?.stationuuid || null;
    volumeInput.value = String(Number.isFinite(playerState.volume) ? playerState.volume : 0.8);
    audio.volume = Number(volumeInput.value);
    updatePlayer(playerState.station);
    setPlayButtonState(false);
  } catch (_) {}
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    favorites,
    recent: recent.slice(0, 20),
    playerState: {
      ...playerState,
      playing: false,
      status: playerState.station ? 'Ready' : 'Ready'
    }
  }));
}

function showMessage(text) {
  message.textContent = text;
  message.hidden = !text;
}

function initials(name) {
  const words = String(name || '?').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  return words.length === 1 ? words[0].slice(0, 2).toUpperCase() : (words[0][0] + words[1][0]).toUpperCase();
}

function countryFlag(code) {
  if (!code || code.length !== 2) return '🌐';
  return code.toUpperCase().split('').map(c => String.fromCodePoint(127397 + c.charCodeAt(0))).join('');
}

function stationDetail(station) {
  if (!station) return '—';
  const country = station.countrycode ? `${countryFlag(station.countrycode)} ${station.countrycode}` : '';
  const bitrate = station.bitrate ? `${station.bitrate} kbps` : '';
  return [country, bitrate, station.codec || ''].filter(Boolean).join(' · ');
}

function tagMatch(station, tag) {
  const tags = String(station.tags || '').toLowerCase();
  return tags.split(',').some(item => item.trim() === tag || item.trim().includes(tag));
}

function isFavorite(id) {
  return favorites.some(station => station.stationuuid === id);
}

function visibleStations() {
  if (currentFilter === 'saved') return favorites;
  if (currentFilter === 'recent') {
    const byId = new Map(stations.map(s => [s.stationuuid, s]));
    const favById = new Map(favorites.map(s => [s.stationuuid, s]));
    return recent.map(id => byId.get(id) || favById.get(id)).filter(Boolean);
  }
  let result = [...stations];
  if (['music','news','talk','sports','jazz'].includes(currentFilter)) {
    result = result.filter(s => tagMatch(s, currentFilter));
  }
  return result;
}

function renderStations() {
  const visible = visibleStations();
  resultCount.textContent = `${visible.length} station${visible.length === 1 ? '' : 's'}`;
  list.innerHTML = '';

  if (!visible.length) {
    showMessage(currentFilter === 'saved'
      ? 'No favourite stations yet. Click ★ to save one.'
      : 'No stations found. Try another search or filter.');
    return;
  }
  showMessage('');

  visible.slice(0, 60).forEach(station => {
    const row = document.createElement('article');
    row.className = `station${station.stationuuid === currentStationId && playerState.playing ? ' playing' : ''}`;

    const logo = document.createElement('div');
    logo.className = 'station-logo';
    logo.textContent = initials(station.name);
    if (station.favicon) {
      const img = document.createElement('img');
      img.src = station.favicon;
      img.alt = '';
      img.addEventListener('error', () => img.remove());
      logo.textContent = '';
      logo.appendChild(img);
    }

    const info = document.createElement('div');
    info.className = 'station-info';
    const name = document.createElement('div');
    name.className = 'station-name';
    name.textContent = station.name || 'Unnamed station';
    const detail = document.createElement('div');
    detail.className = 'station-detail';
    detail.textContent = stationDetail(station);
    info.append(name, detail);

    const save = document.createElement('button');
    save.type = 'button';
    save.className = `save-btn${isFavorite(station.stationuuid) ? ' saved' : ''}`;
    save.textContent = isFavorite(station.stationuuid) ? '★' : '☆';
    save.title = isFavorite(station.stationuuid) ? 'Remove from favourites' : 'Save favourite station';
    save.setAttribute('aria-label', save.title);
    save.addEventListener('click', event => {
      event.stopPropagation();
      toggleFavorite(station);
    });

    row.append(logo, info, save);
    row.addEventListener('click', () => playStation(station));
    list.appendChild(row);
  });
}

function toggleFavorite(station) {
  if (isFavorite(station.stationuuid)) {
    favorites = favorites.filter(item => item.stationuuid !== station.stationuuid);
    showMessage(`Removed “${station.name}” from favourites.`);
  } else {
    favorites = [station, ...favorites.filter(item => item.stationuuid !== station.stationuuid)];
    showMessage(`Saved “${station.name}” to favourites.`);
  }
  saveState();
  renderStations();
}

function updatePlayer(station) {
  if (!station) {
    playerTitle.textContent = 'Select a station';
    playerStatus.textContent = 'Ready';
    playerMeta.textContent = '—';
    playerArt.textContent = '36';
    return;
  }
  playerTitle.textContent = station.name || 'Unnamed station';
  playerStatus.textContent = playerState.status || 'Ready';
  playerMeta.textContent = stationDetail(station);
  playerArt.textContent = initials(station.name);
}

function setPlayButtonState(playing) {
  playButton.title = playing ? 'Pause' : 'Play';
  playButton.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  playIcon.classList.toggle('pause-icon', Boolean(playing));
}

async function playStation(station) {
  if (!station) return;
  const url = station.url_resolved || station.url;
  if (!url) {
    showMessage('This station has no playable stream URL.');
    return;
  }

  currentStationId = station.stationuuid;
  playerState = { ...playerState, station, playing: false, status: 'Connecting…' };
  updatePlayer(station);
  renderStations();

  audio.pause();
  audio.src = url;
  audio.volume = Number.isFinite(playerState.volume) ? playerState.volume : 0.8;
  audio.load();

  try {
    await audio.play();
    playerState = { ...playerState, station, playing: true, status: 'Playing' };
    recent = [station.stationuuid, ...recent.filter(id => id !== station.stationuuid)].slice(0, 20);
    saveState();
    updatePlayer(station);
    setPlayButtonState(true);
    renderStations();
  } catch (error) {
    playerState = { ...playerState, station, playing: false, status: 'Stream unavailable' };
    saveState();
    updatePlayer(station);
    setPlayButtonState(false);
    renderStations();
    showMessage('This station could not be played. The stream may be offline or unsupported by your browser.');
  }
}

async function togglePlay() {
  if (!playerState.station) {
    const first = visibleStations()[0] || stations[0];
    if (first) await playStation(first);
    return;
  }
  if (audio.paused) {
    try {
      await audio.play();
    } catch (_) {
      await playStation(playerState.station);
    }
  } else {
    audio.pause();
  }
}

async function changeStation(direction) {
  const source = visibleStations();
  if (!source.length) return;
  const current = source.findIndex(s => s.stationuuid === currentStationId);
  const index = current < 0 ? (direction > 0 ? 0 : source.length - 1) : (current + direction + source.length) % source.length;
  await playStation(source[index]);
}

async function loadStations() {
  if (currentFilter === 'saved' || currentFilter === 'recent') {
    renderStations();
    return;
  }

  const filters = {
    countrycode: countrySelect.value,
    language: languageSelect.value,
    name: searchInput.value.trim(),
    tag: ['music','news','talk','sports','jazz'].includes(currentFilter) ? currentFilter : '',
    limit: 50
  };

  showMessage('Loading stations…');
  resultCount.textContent = 'Loading…';

  try {
    const remote = await searchStations(filters);
    stations = remote.length ? remote : fallbackStations;
    showMessage('');
  } catch (_) {
    stations = fallbackStations;
    showMessage('Radio Browser is temporarily unavailable. Showing the built-in sample list.');
  }
  renderStations();
}

function scheduleSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadStations, 400);
}

function exportSavedStations() {
  const payload = {
    format: 'world-radio-saved-stations',
    version: 1,
    exportedAt: new Date().toISOString(),
    stations: favorites
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `world-radio-saved-stations-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showMessage(`Exported ${favorites.length} saved station${favorites.length === 1 ? '' : 's'}.`);
}

function normalizeImportedStation(station) {
  if (!station || typeof station !== 'object') return null;
  const stationuuid = String(station.stationuuid || '').trim();
  const name = String(station.name || '').trim();
  const url = String(station.url_resolved || station.url || '').trim();
  if (!stationuuid || !name || !url) return null;
  return {
    stationuuid, name,
    countrycode: String(station.countrycode || '').toUpperCase(),
    language: String(station.language || ''),
    codec: String(station.codec || ''),
    bitrate: Number(station.bitrate) || 0,
    tags: String(station.tags || ''),
    favicon: String(station.favicon || ''),
    url_resolved: url
  };
}

async function importSavedStations(file) {
  try {
    const data = JSON.parse(await file.text());
    const source = Array.isArray(data) ? data : data?.stations;
    if (!Array.isArray(source)) throw new Error('The file does not contain a station list.');
    const imported = source.map(normalizeImportedStation).filter(Boolean);
    if (!imported.length) throw new Error('No valid saved stations were found.');

    const byId = new Map(favorites.map(station => [station.stationuuid, station]));
    imported.forEach(station => byId.set(station.stationuuid, station));
    favorites = [...byId.values()];
    saveState();
    renderStations();
    showMessage(`Imported ${imported.length} saved station${imported.length === 1 ? '' : 's'}.`);
  } catch (error) {
    showMessage(`Import failed: ${error?.message || 'Invalid JSON file.'}`);
  } finally {
    importFileInput.value = '';
  }
}

playButton.addEventListener('click', togglePlay);
volumeInput.addEventListener('input', () => {
  const volume = Math.max(0, Math.min(1, Number(volumeInput.value)));
  playerState.volume = volume;
  audio.volume = volume;
  saveState();
});

document.getElementById('prev').addEventListener('click', () => changeStation(-1));
document.getElementById('next').addEventListener('click', () => changeStation(1));
document.getElementById('shuffle').addEventListener('click', async () => {
  const source = visibleStations();
  if (source.length) await playStation(source[Math.floor(Math.random() * source.length)]);
});

document.getElementById('sleep').addEventListener('click', () => {
  const minutes = Number(prompt('Sleep timer: enter minutes (1–180), or 0 to cancel.', '30'));
  if (!Number.isFinite(minutes) || minutes < 0) return;
  if (minutes === 0) {
    if (sleepTimer) clearTimeout(sleepTimer);
    showMessage('Sleep timer cancelled.');
    return;
  }
  if (sleepTimer) clearTimeout(sleepTimer);
  sleepTimer = setTimeout(() => {
    audio.pause();
    showMessage('Sleep timer stopped playback.');
  }, Math.min(minutes, 180) * 60 * 1000);
  showMessage(`Sleep timer set for ${minutes} minute${minutes === 1 ? '' : 's'}.`);
});

countrySelect.addEventListener('change', loadStations);
languageSelect.addEventListener('change', loadStations);
searchInput.addEventListener('input', scheduleSearch);
document.getElementById('refresh').addEventListener('click', loadStations);
document.getElementById('export-saved').addEventListener('click', exportSavedStations);
document.getElementById('import-saved').addEventListener('click', () => importFileInput.click());
importFileInput.addEventListener('change', async () => {
  const file = importFileInput.files?.[0];
  if (file) await importSavedStations(file);
});

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(item => item.classList.remove('active'));
    tab.classList.add('active');
    currentFilter = tab.dataset.filter || 'all';
    loadStations();
  });
});

document.querySelectorAll('.tag').forEach(tag => {
  tag.addEventListener('click', () => {
    document.querySelectorAll('.tag').forEach(item => item.classList.remove('active'));
    tag.classList.add('active');
    const value = tag.dataset.tag;
    if (value) {
      currentFilter = value;
      document.querySelectorAll('.tab').forEach(item => item.classList.toggle('active', item.dataset.filter === value));
      loadStations();
    }
  });
});

audio.addEventListener('playing', () => {
  playerState.playing = true;
  playerState.status = 'Playing';
  saveState();
  updatePlayer(playerState.station);
  setPlayButtonState(true);
  renderStations();
});

audio.addEventListener('pause', () => {
  playerState.playing = false;
  if (playerState.station) playerState.status = 'Paused';
  saveState();
  updatePlayer(playerState.station);
  setPlayButtonState(false);
  renderStations();
});

audio.addEventListener('waiting', () => {
  if (playerState.station) playerState.status = 'Buffering…';
  updatePlayer(playerState.station);
});

audio.addEventListener('error', () => {
  playerState.playing = false;
  playerState.status = 'Stream error';
  saveState();
  updatePlayer(playerState.station);
  setPlayButtonState(false);
  showMessage('The station stream is unavailable or unsupported by your browser.');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
}

loadState();
await loadStations();
