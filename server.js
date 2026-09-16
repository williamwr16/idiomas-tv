const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const scraper = require('./services/scraper');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rota de Idiomas principais
app.get('/api/languages', async (req, res) => {
  try {
    const languages = await scraper.getLanguages();
    res.json({ success: true, data: languages });
  } catch (error) {
    console.error('Erro ao buscar idiomas:', error.message);
    res.status(500).json({ success: false, error: 'Falha ao buscar catálogo de idiomas.' });
  }
});

// Rota de navegação em pastas/cursos/módulos
app.get('/api/folder/:folderId?', async (req, res) => {
  try {
    const folderId = req.params.folderId || '';
    const folderData = await scraper.getFolderContents(folderId);
    res.json({ success: true, data: folderData });
  } catch (error) {
    console.error(`Erro ao buscar pasta ${req.params.folderId}:`, error.message);
    res.status(500).json({ success: false, error: 'Falha ao buscar conteúdo da pasta.' });
  }
});

// Rota para obter detalhes e link direto de reprodução do vídeo
app.get('/api/stream-info/:fileId', async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const streamDetails = await scraper.getVideoStreamDetails(fileId);
    res.json({ success: true, data: streamDetails });
  } catch (error) {
    console.error(`Erro ao obter stream do vídeo ${req.params.fileId}:`, error.message);
    res.status(500).json({ success: false, error: 'Falha ao obter link do vídeo.' });
  }
});

// Proxy de vídeo para contornar restrições de CORS e redirecionamentos no player HTML5
app.get('/api/video-proxy', async (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) {
    return res.status(400).send('URL do vídeo ausente.');
  }

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Referer': 'https://drivedepobre.com/'
    };

    if (req.headers.range) {
      headers.range = req.headers.range;
    }

    const response = await axios({
      method: 'get',
      url: videoUrl,
      headers: headers,
      responseType: 'stream',
      maxRedirects: 5,
      validateStatus: () => true
    });

    res.status(response.status);

    const passHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
    passHeaders.forEach(h => {
      if (response.headers[h]) {
        res.setHeader(h, response.headers[h]);
      }
    });

    if (!res.getHeader('content-type')) {
      res.setHeader('content-type', 'video/mp4');
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Origin, Content-Type, Accept');

    response.data.pipe(res);
  } catch (error) {
    console.error('Erro no video proxy:', error.message);
    if (!res.headersSent) {
      res.status(500).send('Erro ao transmitir vídeo.');
    }
  }
});

// Rota de busca global
app.get('/api/search', async (req, res) => {
  const query = (req.query.q || '').toLowerCase().trim();
  if (!query) {
    return res.json({ success: true, data: [] });
  }

  try {
    const languages = await scraper.getLanguages();
    const results = [];

    for (const lang of languages) {
      if (lang.name.toLowerCase().includes(query)) {
        results.push(lang);
      }
    }

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Erro na busca:', error.message);
    res.status(500).json({ success: false, error: 'Erro ao realizar pesquisa.' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(` IdiomasTV Server rodando com sucesso!`);
  console.log(` Local:   http://localhost:${PORT}`);
  console.log(` Redes:   http://192.168.10.68:${PORT}`);
  console.log(`====================================================`);
});
