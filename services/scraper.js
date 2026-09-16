const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://drivedepobre.com';

// Cache simples em memória com TTL (Time To Live) de 10 minutos
const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
  }
});

function getFromCache(key) {
  const cached = cache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return cached.data;
}

function setToCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

// Icones por idioma para deixar a interface estilo Netflix/Streaming
const LANGUAGE_POSTERS = {
  'inglês': 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=600&q=80',
  'espanhol': 'https://images.unsplash.com/photo-1543783207-ec64e4d95325?auto=format&fit=crop&w=600&q=80',
  'francês': 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=600&q=80',
  'alemão': 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=600&q=80',
  'italiano': 'https://images.unsplash.com/photo-1529260830199-42c24126f198?auto=format&fit=crop&w=600&q=80',
  'japonês': 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80',
  'mandarim': 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=600&q=80',
  'russo': 'https://images.unsplash.com/photo-1513326718677-b964603b136d?auto=format&fit=crop&w=600&q=80',
  'latim': 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=600&q=80',
  'libras': 'https://images.unsplash.com/photo-1516534775068-ba3e7458af70?auto=format&fit=crop&w=600&q=80',
  'multi-idiomas': 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80'
};

const DEFAULT_POSTER = 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=600&q=80';

/**
 * Busca e parseia a lista principal de idiomas em /idiomas
 */
async function getLanguages() {
  const cacheKey = 'languages';
  const cachedData = getFromCache(cacheKey);
  if (cachedData) return cachedData;

  const response = await client.get('/idiomas');
  const $ = cheerio.load(response.data);
  const languages = [];

  $('#file-list tr.folder-table__row').each((_, row) => {
    const $row = $(row);
    const $link = $row.find('a.file-link');
    const href = $link.attr('href') || '';
    const name = $row.find('.file-name').text().trim();
    const size = $row.find('.folder-table__cell--size').text().trim();
    const isTrending = $row.find('.badge').length > 0;

    if (name && href.startsWith('/idiomas/')) {
      const id = href.replace('/idiomas/', '');
      const cleanNameKey = name.toLowerCase();
      const poster = LANGUAGE_POSTERS[cleanNameKey] || DEFAULT_POSTER;

      languages.push({
        id,
        name,
        href,
        size,
        isTrending,
        poster,
        type: 'language'
      });
    }
  });

  setToCache(cacheKey, languages);
  return languages;
}

/**
 * Busca o conteúdo de qualquer pasta/categoria do drivedepobre (/idiomas/:folderId)
 */
async function getFolderContents(folderId = '') {
  const path = folderId ? `/idiomas/${folderId}` : '/idiomas';
  const cacheKey = `folder_${folderId || 'root'}`;
  const cachedData = getFromCache(cacheKey);
  if (cachedData) return cachedData;

  const response = await client.get(path);
  const $ = cheerio.load(response.data);

  const title = $('.folder-header__title').text().replace('- Pasta no Drive de Pobre', '').trim() || 'Idiomas';

  // Breadcrumbs para navegação de voltar
  const breadcrumbs = [];
  $('#responsiveBreadcrumb .breadcrumb-item').each((_, item) => {
    const $item = $(item);
    const $a = $item.find('a');
    const text = $item.attr('title') || $item.find('.breadcrumb-text').text().trim();
    const href = $a.attr('href') || '';
    if (text) {
      breadcrumbs.push({
        name: text,
        id: href.replace('/idiomas/', '').replace('/', ''),
        href
      });
    }
  });

  const items = [];

  $('#file-list tr.folder-table__row').each((_, row) => {
    const $row = $(row);
    const $link = $row.find('a.file-link');
    const href = $link.attr('href') || '';
    const name = $row.find('.file-name').text().trim();
    const size = $row.find('.folder-table__cell--size').text().trim();
    const date = $row.find('.folder-table__cell--date').text().trim();
    const downloadUrl = $row.attr('data-download-url') || '';
    const sizeBytes = parseInt($row.attr('data-size-bytes') || '0', 10);
    const iconSpan = $row.find('.file-icon');
    const isFolder = iconSpan.hasClass('icon-folder');
    const isVideo = iconSpan.hasClass('icon-video') || name.match(/\.(mp4|mkv|webm|avi|mov)$/i);
    const isAudio = iconSpan.hasClass('icon-audio') || name.match(/\.(mp3|aac|m4a|flac)$/i);
    const isImage = iconSpan.hasClass('icon-image') || name.match(/\.(png|jpg|jpeg|webp)$/i);
    const isPdf = iconSpan.hasClass('icon-pdf') || name.match(/\.pdf$/i);

    const isMp4 = name.toLowerCase().endsWith('.mp4');

    if (name && href) {
      // Filtrar para exibir somente pastas e arquivos com final .mp4
      if (isFolder || isMp4) {
        const id = href.replace('/idiomas/', '');

        items.push({
          id,
          name,
          href,
          size,
          sizeBytes,
          date,
          downloadUrl,
          isFolder,
          itemType: isFolder ? 'folder' : 'video',
          type: isFolder ? 'folder' : 'video'
        });
      }
    }
  });

  const result = {
    id: folderId,
    title,
    breadcrumbs,
    items
  };

  setToCache(cacheKey, result);
  return result;
}

/**
 * Resolve o link direto de streaming de vídeo de um arquivo
 */
async function getVideoStreamDetails(fileId) {
  const cacheKey = `video_${fileId}`;
  const cachedData = getFromCache(cacheKey);
  if (cachedData) return cachedData;

  const pagePath = `/idiomas/${fileId}`;
  const response = await client.get(pagePath);
  const $ = cheerio.load(response.data);

  const title = $('.file-header-name').text().trim() || $('#main-content h1').text().trim();
  const size = $('.file-size-badge').text().replace('storage', '').trim();
  
  // Tentar encontrar URL do vídeo via player element
  let directStreamUrl = $('#player source#videoSource').attr('src') || '';
  
  // Se não estiver direto no source element, procurar no json viewer-config
  if (!directStreamUrl) {
    const jsonConfig = $('#viewer-config').html();
    if (jsonConfig) {
      try {
        const parsed = JSON.parse(jsonConfig);
        if (parsed && parsed.viewUrl) {
          directStreamUrl = parsed.viewUrl;
        }
      } catch (e) {}
    }
  }

  // Se ainda assim não encontrou, o link de download redireciona para a CDN
  if (!directStreamUrl) {
    const downloadBtnUrl = `/download/${fileId}`;
    try {
      const headRes = await client.get(downloadBtnUrl, { maxRedirects: 0, validateStatus: status => status >= 200 && status < 400 });
      if (headRes.headers.location) {
        directStreamUrl = headRes.headers.location;
      }
    } catch (e) {
      if (e.response && e.response.headers && e.response.headers.location) {
        directStreamUrl = e.response.headers.location;
      }
    }
  }

  const result = {
    fileId,
    title,
    size,
    streamUrl: directStreamUrl || `${BASE_URL}/download/${fileId}`
  };

  if (directStreamUrl) {
    setToCache(cacheKey, result);
  }

  return result;
}

module.exports = {
  getLanguages,
  getFolderContents,
  getVideoStreamDetails
};
