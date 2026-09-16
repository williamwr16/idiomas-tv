/**
 * IdiomasTV - Fullscreen Custom Video Player Manager for Android TV
 */
class TVVideoPlayer {
  constructor() {
    this.modal = document.getElementById('video-player-modal');
    this.video = document.getElementById('tv-video');
    this.controlsOverlay = document.getElementById('player-controls');
    
    this.titleEl = document.getElementById('player-title');
    this.subtitleEl = document.getElementById('player-subtitle');
    this.currentTimeEl = document.getElementById('player-current-time');
    this.durationEl = document.getElementById('player-duration');
    this.progressFill = document.getElementById('player-progress-fill');
    
    this.speedBtn = document.getElementById('player-speed-btn');
    this.speedLabel = document.getElementById('speed-label');
    this.speedMenu = document.getElementById('speed-menu');
    this.playPauseBtn = document.getElementById('player-playpause-btn');
    this.closeBtn = document.getElementById('player-close-btn');
    this.rewindBtn = document.getElementById('player-rewind-btn');
    this.forwardBtn = document.getElementById('player-forward-btn');
    this.nextBtn = document.getElementById('player-next-btn');

    this.currentVideoData = null;
    this.playlist = [];
    this.currentIndex = 0;
    this.controlsTimeout = null;
    this.saveProgressInterval = null;

    this.initEvents();
  }

  initEvents() {
    // Eventos do elemento Video
    this.video.addEventListener('timeupdate', () => this.onTimeUpdate());
    this.video.addEventListener('loadedmetadata', () => this.onLoadedMetadata());
    this.video.addEventListener('ended', () => this.onEnded());
    this.video.addEventListener('play', () => this.updatePlayPauseIcon());
    this.video.addEventListener('pause', () => this.updatePlayPauseIcon());

    // Botões dos controles
    this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
    this.rewindBtn.addEventListener('click', () => this.seekRelative(-10));
    this.forwardBtn.addEventListener('click', () => this.seekRelative(10));
    this.closeBtn.addEventListener('click', () => this.closePlayer());
    this.nextBtn.addEventListener('click', () => this.playNext());

    // Velocidade de reprodução
    this.speedBtn.addEventListener('click', () => this.toggleSpeedMenu());

    document.querySelectorAll('.speed-option').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const speed = parseFloat(e.target.dataset.speed);
        this.setPlaybackSpeed(speed);
        this.toggleSpeedMenu(false);
      });
    });

    // Manter controles visíveis no movimento do controle/mouse
    document.addEventListener('keydown', (e) => {
      if (this.modal.style.display !== 'none') {
        this.showControls();
      }
    });

    document.addEventListener('mousemove', () => {
      if (this.modal.style.display !== 'none') {
        this.showControls();
      }
    });
  }

  async playVideo(videoItem, courseTitle = 'Curso de Idiomas', playlist = [], index = 0) {
    this.currentVideoData = videoItem;
    this.playlist = playlist;
    this.currentIndex = index;

    this.titleEl.textContent = videoItem.name || 'Videoaula';
    this.subtitleEl.textContent = courseTitle;

    this.modal.style.display = 'block';
    this.showControls();

    // Adiciona o handler do botão VOLTAR do controle remoto para fechar o player
    window.tvRemote.pushBackHandler(() => {
      if (this.speedMenu.style.display !== 'none') {
        this.toggleSpeedMenu(false);
        return true;
      }
      this.closePlayer();
      return true;
    });

    try {
      const serverBase = window.SERVER_BASE || (typeof SERVER_BASE !== 'undefined' && SERVER_BASE) || 'http://192.168.10.68:3000';
      // Buscar link de vídeo resolvido via backend
      const res = await fetch(`${serverBase}/api/stream-info/${videoItem.id}`);
      const data = await res.json();

      let targetUrl = (data.success && data.data && data.data.streamUrl)
        ? data.data.streamUrl
        : `https://drivedepobre.com/download/${videoItem.id}`;

      // Sempre utilizar a rota de proxy local para garantir compatibilidade e suporte a Range 206
      const streamUrl = `${serverBase}/api/video-proxy?url=${encodeURIComponent(targetUrl)}`;

      this.video.src = streamUrl;
      this.video.load();
      this.video.play().catch(e => console.log('Autoplay prevenido:', e));

      // Verificar progresso salvo para retomar
      this.resumeProgressIfExists(videoItem.id);

      // Iniciar salvamento periódico de progresso
      this.startProgressSaving(courseTitle);

      // Focar no botão de Play/Pause para controle remoto
      setTimeout(() => window.tvRemote.setFocus(this.playPauseBtn), 300);

    } catch (err) {
      console.error('Erro ao carregar vídeo:', err);
      alert('Não foi possível carregar esta videoaula. Tente novamente.');
      this.closePlayer();
    }
  }

  togglePlayPause() {
    if (this.video.paused) {
      this.video.play();
    } else {
      this.video.pause();
    }
    this.showControls();
  }

  updatePlayPauseIcon() {
    const icon = this.playPauseBtn.querySelector('.material-icons-round');
    if (this.video.paused) {
      icon.textContent = 'play_arrow';
    } else {
      icon.textContent = 'pause';
    }
  }

  seekRelative(seconds) {
    if (this.video.duration) {
      this.video.currentTime = Math.max(0, Math.min(this.video.duration, this.video.currentTime + seconds));
    }
    this.showControls();
  }

  onTimeUpdate() {
    const current = this.video.currentTime || 0;
    const duration = this.video.duration || 0;

    this.currentTimeEl.textContent = this.formatTime(current);
    this.durationEl.textContent = this.formatTime(duration);

    if (duration > 0) {
      const percentage = (current / duration) * 100;
      this.progressFill.style.width = `${percentage}%`;
    }
  }

  onLoadedMetadata() {
    this.durationEl.textContent = this.formatTime(this.video.duration || 0);
  }

  onEnded() {
    this.saveProgress(100);
    this.playNext();
  }

  playNext() {
    if (this.playlist && this.playlist.length > this.currentIndex + 1) {
      const nextIndex = this.currentIndex + 1;
      const nextItem = this.playlist[nextIndex];
      if (nextItem && nextItem.itemType === 'video') {
        this.playVideo(nextItem, this.subtitleEl.textContent, this.playlist, nextIndex);
      } else {
        this.closePlayer();
      }
    } else {
      this.closePlayer();
    }
  }

  setPlaybackSpeed(speed) {
    this.video.playbackRate = speed;
    this.speedLabel.textContent = `${speed.toFixed(1)}x`;

    document.querySelectorAll('.speed-option').forEach(btn => {
      if (parseFloat(btn.dataset.speed) === speed) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  toggleSpeedMenu(force) {
    const isVisible = force !== undefined ? force : this.speedMenu.style.display === 'none';
    if (isVisible) {
      this.speedMenu.style.display = 'block';
      const activeBtn = this.speedMenu.querySelector('.speed-option.active') || this.speedMenu.querySelector('.speed-option');
      if (activeBtn) window.tvRemote.setFocus(activeBtn);
    } else {
      this.speedMenu.style.display = 'none';
      window.tvRemote.setFocus(this.speedBtn);
    }
  }

  showControls() {
    this.controlsOverlay.classList.remove('hidden');
    clearTimeout(this.controlsTimeout);
    this.controlsTimeout = setTimeout(() => {
      if (!this.video.paused && this.speedMenu.style.display === 'none') {
        this.controlsOverlay.classList.add('hidden');
      }
    }, 4500);
  }

  closePlayer() {
    this.saveProgress();
    this.video.pause();
    this.video.src = '';
    this.modal.style.display = 'none';
    this.speedMenu.style.display = 'none';
    clearInterval(this.saveProgressInterval);

    // Retornar o foco para o elemento anterior
    setTimeout(() => {
      const lastFocus = document.querySelector('.folder-item-card.focused') || document.querySelector('.sidebar-menu .focusable');
      if (lastFocus) window.tvRemote.setFocus(lastFocus);
    }, 200);
  }

  resumeProgressIfExists(fileId) {
    const history = this.getHistory();
    const item = history.find(h => h.id === fileId);
    if (item && item.currentTime > 5 && item.currentTime < item.duration - 10) {
      this.video.currentTime = item.currentTime;
    }
  }

  startProgressSaving(courseTitle) {
    clearInterval(this.saveProgressInterval);
    this.saveProgressInterval = setInterval(() => {
      this.saveProgress(null, courseTitle);
    }, 5000);
  }

  saveProgress(overridePercentage = null, courseTitle = '') {
    if (!this.currentVideoData || !this.video.duration) return;

    const fileId = this.currentVideoData.id;
    const currentTime = this.video.currentTime;
    const duration = this.video.duration;
    const percentage = overridePercentage !== null ? overridePercentage : (currentTime / duration) * 100;

    let history = this.getHistory();
    history = history.filter(h => h.id !== fileId);

    history.unshift({
      id: fileId,
      name: this.currentVideoData.name,
      courseTitle: courseTitle || this.subtitleEl.textContent,
      currentTime,
      duration,
      percentage,
      updatedAt: Date.now()
    });

    // Manter últimos 30 itens salvos
    if (history.length > 30) history = history.slice(0, 30);

    localStorage.setItem('idiomastv_history', JSON.stringify(history));

    // Atualiza a tela de Continuar Assistindo se visível
    if (window.updateContinueWatchingScreen) {
      window.updateContinueWatchingScreen();
    }
  }

  getHistory() {
    try {
      return JSON.parse(localStorage.getItem('idiomastv_history') || '[]');
    } catch (e) {
      return [];
    }
  }

  formatTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min < 10 ? '0' : ''}${min}:${sec < 10 ? '0' : ''}${sec}`;
  }
}

window.tvPlayer = new TVVideoPlayer();
