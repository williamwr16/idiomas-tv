const DEFAULT_SERVER = 'https://idiomas-tv.vercel.app';
let savedUrl = localStorage.getItem('idiomastv_server_url');
let SERVER_BASE = (savedUrl && savedUrl.trim().startsWith('http')) ? savedUrl.trim() : DEFAULT_SERVER;

if (SERVER_BASE.endsWith('/')) {
  SERVER_BASE = SERVER_BASE.slice(0, -1);
}
window.SERVER_BASE = SERVER_BASE;

document.addEventListener('DOMContentLoaded', () => {
  const App = {
    currentSection: 'home-section',
    currentFolderId: '',
    folderHistoryStack: [],

    init() {
      window.App = this;
      this.bindNavigation();
      this.initSettings();
      this.loadHomeData();
      this.setupGlobalBack();
      this.setupSearch();
      this.checkServerHealth();

      window.updateContinueWatchingScreen = () => this.renderContinueWatching();
    },

    bindNavigation() {
      document.querySelectorAll('.sidebar-menu .nav-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const targetSection = btn.dataset.target;

          document.querySelectorAll('.sidebar-menu .nav-item').forEach(n => n.classList.remove('active'));
          btn.classList.add('active');

          this.showSection(targetSection);
        });
      });
    },

    showSection(sectionId) {
      this.currentSection = sectionId;

      document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
      const activeSec = document.getElementById(sectionId);
      if (activeSec) activeSec.classList.add('active');

      // Atualizar sidebar active button
      document.querySelectorAll('.sidebar-menu .nav-item').forEach(n => {
        if (n.dataset.target === sectionId) {
          n.classList.add('active');
        } else {
          n.classList.remove('active');
        }
      });

      const breadcrumbBar = document.getElementById('breadcrumb-bar');
      if (sectionId === 'folder-section') {
        breadcrumbBar.style.display = 'flex';
      } else {
        breadcrumbBar.style.display = 'none';
      }

      if (sectionId === 'home-section') {
        this.renderContinueWatching();
      } else if (sectionId === 'languages-section') {
        this.loadLanguagesGrid();
      } else if (sectionId === 'continue-section') {
        this.renderContinueWatchingFull();
      } else if (sectionId === 'settings-section') {
        this.updateSettingsDisplay();
      }

      // Focar no primeiro item focado da seção ativa para a TV
      setTimeout(() => {
        const firstFocusable = activeSec ? activeSec.querySelector('.focusable') : null;
        if (firstFocusable && window.tvRemote) window.tvRemote.setFocus(firstFocusable);
      }, 150);
    },

    async checkServerHealth() {
      const dot = document.getElementById('server-status-dot');
      const text = document.getElementById('server-status-text');

      try {
        const res = await fetch(`${SERVER_BASE}/api/languages`, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          if (dot) dot.className = 'status-dot online';
          if (text) text.textContent = 'Drive de Pobre Conectado';
        } else {
          throw new Error('Servidor retornou erro');
        }
      } catch (err) {
        if (dot) dot.className = 'status-dot offline';
        if (text) text.textContent = 'Servidor Desconectado';
      }
    },

    initSettings() {
      const input = document.getElementById('server-ip-input');
      const saveBtn = document.getElementById('btn-save-server-ip');
      const resetBtn = document.getElementById('btn-reset-server-ip');

      if (input) input.value = SERVER_BASE;
      this.updateSettingsDisplay();

      if (saveBtn) {
        saveBtn.addEventListener('click', () => {
          let newUrl = input.value.trim();
          if (!newUrl) newUrl = DEFAULT_SERVER;

          if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
            newUrl = `http://${newUrl}`;
          }

          if (newUrl.endsWith('/')) {
            newUrl = newUrl.slice(0, -1);
          }

          SERVER_BASE = newUrl;
          window.SERVER_BASE = SERVER_BASE;
          localStorage.setItem('idiomastv_server_url', SERVER_BASE);

          this.updateSettingsDisplay();
          this.checkServerHealth();
          this.loadHomeData();
          alert(`Servidor atualizado para: ${SERVER_BASE}`);
        });
      }

      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          SERVER_BASE = DEFAULT_SERVER;
          window.SERVER_BASE = SERVER_BASE;
          localStorage.removeItem('idiomastv_server_url');
          if (input) input.value = DEFAULT_SERVER;
          this.updateSettingsDisplay();
          this.checkServerHealth();
          this.loadHomeData();
          alert(`IP restaurado para o padrão: ${DEFAULT_SERVER}`);
        });
      }
    },

    updateSettingsDisplay() {
      const display = document.getElementById('current-server-url-display');
      const input = document.getElementById('server-ip-input');
      if (display) display.textContent = SERVER_BASE;
      if (input && document.activeElement !== input) input.value = SERVER_BASE;
    },

    showErrorUI(containerId, title, message) {
      const container = document.getElementById(containerId);
      if (!container) return;

      container.innerHTML = `
        <div class="error-container">
          <span class="material-icons-round warning-icon">wifi_off</span>
          <h3>${title}</h3>
          <p>${message}</p>
          <p style="font-size: 0.85rem; color: var(--text-muted);">IP Configurado: <strong style="color: var(--primary);">${SERVER_BASE}</strong></p>
          <div style="display: flex; gap: 1rem; margin-top: 1rem;">
            <button class="btn-primary focusable" id="err-btn-settings" tabindex="0">
              <span class="material-icons-round">settings</span>
              <span>Configurar IP do PC</span>
            </button>
            <button class="btn-secondary focusable" id="err-btn-retry" tabindex="0">
              <span class="material-icons-round">refresh</span>
              <span>Tentar Novamente</span>
            </button>
          </div>
        </div>
      `;

      const settingsBtn = document.getElementById('err-btn-settings');
      const retryBtn = document.getElementById('err-btn-retry');

      if (settingsBtn) settingsBtn.onclick = () => this.showSection('settings-section');
      if (retryBtn) retryBtn.onclick = () => this.loadHomeData();

      setTimeout(() => {
        if (settingsBtn && window.tvRemote) window.tvRemote.setFocus(settingsBtn);
      }, 100);
    },

    async loadHomeData() {
      try {
        const res = await fetch(`${SERVER_BASE}/api/languages`);
        const data = await res.json();

        if (data.success && data.data && data.data.length > 0) {
          const languages = data.data;
          this.renderLanguagesTrack(languages);

          const featured = languages.find(l => l.name.toLowerCase().includes('inglês')) || languages[0];
          if (featured) {
            this.updateHero(featured);
          }
          this.checkServerHealth();
        } else {
          throw new Error('Nenhum idioma retornado pelo servidor');
        }
      } catch (err) {
        console.error('Erro ao carregar dados da home:', err);
        this.showErrorUI(
          'languages-track',
          'Não foi possível conectar ao Servidor no PC',
          'Verifique se o seu computador está ligado e executando o servidor no endereço correto.'
        );
      }

      this.renderContinueWatching();
    },

    updateHero(language) {
      document.getElementById('hero-title').textContent = language.name;
      document.getElementById('hero-size').textContent = language.size || 'Disponível no Servidor';
      document.getElementById('hero-desc').textContent = `Explore cursos e materiais completos para o aprendizado de ${language.name}. Conteúdo completo com videoaulas organizadas por níveis.`;
      
      const heroBg = document.getElementById('hero-bg');
      if (heroBg) heroBg.style.backgroundImage = `url('${language.poster}')`;

      const playBtn = document.getElementById('hero-play-btn');
      if (playBtn) {
        playBtn.onclick = () => {
          this.openFolder(language.id, language.name);
        };
      }
    },

    renderLanguagesTrack(languages) {
      const track = document.getElementById('languages-track');
      if (!track) return;
      track.innerHTML = '';

      languages.forEach(lang => {
        const card = document.createElement('div');
        card.className = 'media-card focusable';
        card.tabIndex = 0;

        card.innerHTML = `
          <div class="media-card-poster" style="background-image: url('${lang.poster}');">
            ${lang.isTrending ? '<span class="card-badge">EM ALTA</span>' : ''}
            <div class="media-card-overlay">
              <h3 class="card-title">${lang.name}</h3>
              <span class="card-meta">${lang.size || 'Curso Completo'}</span>
            </div>
          </div>
        `;

        card.onclick = () => this.openFolder(lang.id, lang.name);
        track.appendChild(card);
      });
    },

    async loadLanguagesGrid() {
      const grid = document.getElementById('languages-grid');
      if (!grid) return;
      grid.innerHTML = '<div class="skeleton-card"></div><div class="skeleton-card"></div>';

      try {
        const res = await fetch(`${SERVER_BASE}/api/languages`);
        const data = await res.json();

        if (data.success && data.data && data.data.length > 0) {
          grid.innerHTML = '';
          data.data.forEach(lang => {
            const card = document.createElement('div');
            card.className = 'media-card focusable';
            card.tabIndex = 0;

            card.innerHTML = `
              <div class="media-card-poster" style="background-image: url('${lang.poster}');">
                ${lang.isTrending ? '<span class="card-badge">EM ALTA</span>' : ''}
                <div class="media-card-overlay">
                  <h3 class="card-title">${lang.name}</h3>
                  <span class="card-meta">${lang.size || 'Curso Completo'}</span>
                </div>
              </div>
            `;

            card.onclick = () => this.openFolder(lang.id, lang.name);
            grid.appendChild(card);
          });
        } else {
          throw new Error('Nenhum idioma disponível.');
        }
      } catch (err) {
        this.showErrorUI(
          'languages-grid',
          'Erro ao carregar idiomas',
          'Não foi possível obter a lista de idiomas do servidor.'
        );
      }
    },

    async openFolder(folderId, title = '') {
      this.folderHistoryStack.push({ id: this.currentFolderId, title: document.getElementById('folder-title').textContent });
      this.currentFolderId = folderId;

      document.getElementById('folder-title').textContent = title || 'Carregando...';
      document.getElementById('folder-subtitle').textContent = 'Conteúdo do Drive de Pobre';
      
      const grid = document.getElementById('folder-items-grid');
      grid.innerHTML = '<p class="text-muted" style="padding: 2rem;">Carregando módulos e videoaulas...</p>';

      this.showSection('folder-section');

      try {
        const res = await fetch(`${SERVER_BASE}/api/folder/${folderId}`);
        const data = await res.json();

        if (data.success && data.data) {
          const folderData = data.data;
          document.getElementById('folder-title').textContent = folderData.title || title;
          
          this.renderBreadcrumbs(folderData.breadcrumbs);
          this.renderFolderItems(folderData.items, folderData.title || title);
        } else {
          throw new Error('Falha ao abrir pasta.');
        }
      } catch (err) {
        console.error('Erro ao abrir pasta:', err);
        this.showErrorUI(
          'folder-items-grid',
          'Erro ao carregar conteúdo da pasta',
          'Não foi possível comunicar com o servidor para abrir esta pasta.'
        );
      }
    },

    renderBreadcrumbs(breadcrumbs) {
      const pathEl = document.getElementById('breadcrumb-path');
      if (!pathEl) return;
      pathEl.innerHTML = '';

      if (!breadcrumbs || breadcrumbs.length === 0) return;

      breadcrumbs.forEach((b, idx) => {
        const isLast = idx === breadcrumbs.length - 1;
        const span = document.createElement('span');
        if (isLast) {
          span.className = 'current';
          span.textContent = b.name;
        } else {
          span.textContent = `${b.name} > `;
        }
        pathEl.appendChild(span);
      });
    },

    renderFolderItems(items, courseTitle) {
      const grid = document.getElementById('folder-items-grid');
      if (!grid) return;
      grid.innerHTML = '';

      if (!items || items.length === 0) {
        grid.innerHTML = '<p class="text-muted" style="padding: 2rem;">Nenhum arquivo ou pasta encontrado.</p>';
        return;
      }

      items.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'folder-item-card focusable';
        card.tabIndex = 0;

        let iconName = 'folder';
        let iconClass = '';
        let subText = item.size || 'Pasta';

        if (item.isFolder) {
          iconName = 'folder';
        } else if (item.itemType === 'video') {
          iconName = 'play_circle';
          iconClass = 'video';
          subText = `Vídeo · ${item.size || ''}`;
        } else if (item.itemType === 'audio') {
          iconName = 'audiotrack';
          subText = `Áudio · ${item.size || ''}`;
        } else if (item.itemType === 'pdf') {
          iconName = 'picture_as_pdf';
          subText = `PDF · ${item.size || ''}`;
        } else {
          iconName = 'insert_drive_file';
          subText = item.size || 'Arquivo';
        }

        card.innerHTML = `
          <div class="folder-item-icon ${iconClass}">
            <span class="material-icons-round">${iconName}</span>
          </div>
          <div class="folder-item-info">
            <h4 class="folder-item-name" title="${item.name}">${item.name}</h4>
            <span class="folder-item-sub">${subText}</span>
          </div>
        `;

        if (item.isFolder) {
          card.onclick = () => this.openFolder(item.id, item.name);
        } else if (item.itemType === 'video') {
          card.onclick = () => {
            window.tvPlayer.playVideo(item, courseTitle, items, index);
          };
        } else {
          card.onclick = () => {
            window.open(`https://drivedepobre.com/idiomas/${item.id}`, '_blank');
          };
        }

        grid.appendChild(card);
      });

      // Focar no primeiro arquivo/pasta para facilitar na TV
      setTimeout(() => {
        const firstCard = grid.querySelector('.focusable');
        if (firstCard && window.tvRemote) window.tvRemote.setFocus(firstCard);
      }, 100);
    },

    setupGlobalBack() {
      const backBtn = document.getElementById('btn-global-back');
      if (backBtn) {
        backBtn.onclick = () => {
          if (this.folderHistoryStack.length > 1) {
            const prev = this.folderHistoryStack.pop();
            if (prev && prev.id) {
              this.openFolder(prev.id, prev.title);
              this.folderHistoryStack.pop();
            } else {
              this.showSection('home-section');
            }
          } else {
            this.showSection('home-section');
          }
        };
      }
    },

    renderContinueWatching() {
      const container = document.getElementById('rail-continue-container');
      const track = document.getElementById('continue-track');
      const history = window.tvPlayer ? window.tvPlayer.getHistory() : [];

      if (!container || !track) return;

      if (!history || history.length === 0) {
        container.style.display = 'none';
        return;
      }

      container.style.display = 'block';
      track.innerHTML = '';

      history.slice(0, 10).forEach(item => {
        const card = document.createElement('div');
        card.className = 'media-card focusable';
        card.tabIndex = 0;

        const percent = Math.min(100, Math.max(0, item.percentage || 0));

        card.innerHTML = `
          <div class="media-card-poster" style="background-image: url('https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80');">
            <span class="card-badge">AULA</span>
            <div class="media-card-overlay">
              <h3 class="card-title">${item.name}</h3>
              <span class="card-meta">${item.courseTitle || 'Aula de Idioma'}</span>
              <div class="card-progress-bar">
                <div class="card-progress-fill" style="width: ${percent}%;"></div>
              </div>
            </div>
          </div>
        `;

        card.onclick = () => {
          window.tvPlayer.playVideo({ id: item.id, name: item.name }, item.courseTitle);
        };

        track.appendChild(card);
      });
    },

    renderContinueWatchingFull() {
      const grid = document.getElementById('continue-grid');
      if (!grid) return;

      const history = window.tvPlayer ? window.tvPlayer.getHistory() : [];

      if (!history || history.length === 0) {
        grid.innerHTML = '<p class="text-muted" style="padding: 2rem;">Você ainda não começou a assistir a nenhuma aula.</p>';
        return;
      }

      grid.innerHTML = '';
      history.forEach(item => {
        const card = document.createElement('div');
        card.className = 'media-card focusable';
        card.tabIndex = 0;

        const percent = Math.min(100, Math.max(0, item.percentage || 0));

        card.innerHTML = `
          <div class="media-card-poster" style="background-image: url('https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80');">
            <span class="card-badge">${percent > 90 ? 'CONCLUÍDO' : 'EM ANDAMENTO'}</span>
            <div class="media-card-overlay">
              <h3 class="card-title">${item.name}</h3>
              <span class="card-meta">${item.courseTitle || 'Aula'}</span>
              <div class="card-progress-bar">
                <div class="card-progress-fill" style="width: ${percent}%;"></div>
              </div>
            </div>
          </div>
        `;

        card.onclick = () => {
          window.tvPlayer.playVideo({ id: item.id, name: item.name }, item.courseTitle);
        };

        grid.appendChild(card);
      });
    },

    setupSearch() {
      const input = document.getElementById('search-input');
      const resultsContainer = document.getElementById('search-results');
      let debounceTimeout = null;

      if (!input || !resultsContainer) return;

      input.addEventListener('input', () => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(async () => {
          const query = input.value.trim();
          if (!query) {
            resultsContainer.innerHTML = '<p class="search-placeholder">Use o teclado na tela para pesquisar cursos de idiomas.</p>';
            return;
          }

          resultsContainer.innerHTML = '<p class="text-muted" style="padding: 2rem;">Pesquisando no Drive de Pobre...</p>';

          try {
            const res = await fetch(`${SERVER_BASE}/api/search?q=${encodeURIComponent(query)}`);
            const data = await res.json();

            if (data.success && data.data && data.data.length > 0) {
              resultsContainer.innerHTML = '<div class="grid-container" id="search-grid"></div>';
              const searchGrid = document.getElementById('search-grid');

              data.data.forEach(item => {
                const card = document.createElement('div');
                card.className = 'media-card focusable';
                card.tabIndex = 0;

                card.innerHTML = `
                  <div class="media-card-poster" style="background-image: url('${item.poster}');">
                    <div class="media-card-overlay">
                      <h3 class="card-title">${item.name}</h3>
                      <span class="card-meta">${item.size || 'Curso'}</span>
                    </div>
                  </div>
                `;

                card.onclick = () => this.openFolder(item.id, item.name);
                searchGrid.appendChild(card);
              });
            } else {
              resultsContainer.innerHTML = '<p class="search-placeholder">Nenhum curso ou idioma encontrado para sua pesquisa.</p>';
            }
          } catch (err) {
            resultsContainer.innerHTML = '<p class="text-muted" style="padding: 2rem;">Erro ao realizar pesquisa. Verifique se o servidor está ativo.</p>';
          }
        }, 400);
      });
    }
  };

  App.init();
});
