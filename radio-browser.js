// Radio Browser API helper.
// The service exposes multiple mirrors. We start with all.api.radio-browser.info
// and fall back to known mirrors if needed.

const RADIO_BROWSER_MIRRORS = [
  'https://all.api.radio-browser.info',
  'https://de1.api.radio-browser.info',
  'https://nl1.api.radio-browser.info'
];

const USER_AGENT = 'World Radio Chrome Extension/0.1.0';

function buildSearchUrl(base, filters = {}) {
  const url = new URL('/json/stations/search', base);
  const params = new URLSearchParams();

  if (filters.name) params.set('name', filters.name);
  if (filters.countrycode) params.set('countrycode', filters.countrycode);
  if (filters.language) params.set('language', filters.language);
  if (filters.tag) params.set('tag', filters.tag);

  params.set('hidebroken', 'true');
  params.set('order', 'votes');
  params.set('reverse', 'true');
  params.set('limit', String(Math.min(Math.max(filters.limit || 40, 1), 100)));

  url.search = params.toString();
  return url.toString();
}

async function requestJson(pathOrUrl) {
  let lastError = null;

  for (const mirror of RADIO_BROWSER_MIRRORS) {
    const target = pathOrUrl.startsWith('http')
      ? pathOrUrl
      : new URL(pathOrUrl, mirror).toString();

    try {
      const response = await fetch(target, {
        headers: { 'User-Agent': USER_AGENT }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Radio Browser API unavailable');
}

export async function searchStations(filters = {}) {
  // Try each mirror explicitly so a failed mirror does not block discovery.
  let lastError = null;

  for (const mirror of RADIO_BROWSER_MIRRORS) {
    try {
      const url = buildSearchUrl(mirror, filters);
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const stations = await response.json();
      return stations.filter(station => station.url_resolved || station.url);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Radio Browser API unavailable');
}

export async function getCountries() {
  return requestJson('/json/countries?order=stationcount&reverse=true&hidebroken=true&limit=250');
}

export async function getLanguages() {
  return requestJson('/json/languages?order=stationcount&reverse=true&hidebroken=true&limit=250');
}
