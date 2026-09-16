/**
 * TV Remote Navigation Engine (D-Pad Controller for Android TV)
 */
class TVRemoteController {
  constructor() {
    this.currentFocused = null;
    this.backHandlers = [];
    this.init();
  }

  init() {
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    
    // Suporte também a mouse hover para facilitar testes no computador
    document.addEventListener('mouseover', (e) => {
      const focusable = e.target.closest('.focusable');
      if (focusable && focusable !== this.currentFocused) {
        this.setFocus(focusable);
      }
    });

    // Inicializa o primeiro foco na sidebar quando o DOM carregar
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        const firstBtn = document.querySelector('.sidebar-menu .focusable');
        if (firstBtn) this.setFocus(firstBtn);
      }, 200);
    });
  }

  setFocus(element) {
    if (!element) return;

    if (this.currentFocused) {
      this.currentFocused.classList.remove('focused');
    }

    this.currentFocused = element;
    this.currentFocused.classList.add('focused');

    if (typeof element.focus === 'function') {
      element.focus({ preventScroll: true });
    }

    this.scrollToElement(element);
  }

  scrollToElement(element) {
    if (!element) return;
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest'
    });
  }

  pushBackHandler(handler) {
    this.backHandlers.push(handler);
  }

  popBackHandler() {
    if (this.backHandlers.length > 0) {
      const handler = this.backHandlers.pop();
      return handler();
    }
    return false;
  }

  handleKeyDown(event) {
    const key = event.key || event.keyCode;
    const focusables = Array.from(document.querySelectorAll('.focusable:not([style*="display: none"]):not([disabled])'))
      .filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== 'hidden';
      });

    if (!this.currentFocused || !document.body.contains(this.currentFocused)) {
      if (focusables.length > 0) this.setFocus(focusables[0]);
      return;
    }

    switch (key) {
      case 'ArrowUp':
      case 38:
        event.preventDefault();
        this.navigateDirection('up', focusables);
        break;

      case 'ArrowDown':
      case 40:
        event.preventDefault();
        this.navigateDirection('down', focusables);
        break;

      case 'ArrowLeft':
      case 37:
        event.preventDefault();
        this.navigateDirection('left', focusables);
        break;

      case 'ArrowRight':
      case 39:
        event.preventDefault();
        this.navigateDirection('right', focusables);
        break;

      case 'Enter':
      case 13:
      case 66: // Android TV Select Center
        event.preventDefault();
        if (this.currentFocused) {
          this.currentFocused.click();
        }
        break;

      case 'Escape':
      case 'Backspace':
      case 27:
      case 8:
      case 461: // WebOS Back
      case 10009: // Tizen Back
        event.preventDefault();
        const handled = this.popBackHandler();
        if (!handled) {
          // Se não houver handler customizado, tenta clicar no botão global de voltar ou focar na sidebar
          const backBtn = document.getElementById('btn-global-back');
          if (backBtn && backBtn.offsetParent !== null) {
            backBtn.click();
          } else {
            const sidebarActive = document.querySelector('.sidebar-menu .nav-item.active');
            if (sidebarActive) this.setFocus(sidebarActive);
          }
        }
        break;
    }
  }

  navigateDirection(direction, focusables) {
    if (!this.currentFocused) return;
    const currentRect = this.currentFocused.getBoundingClientRect();
    const currentCenter = {
      x: currentRect.left + currentRect.width / 2,
      y: currentRect.top + currentRect.height / 2
    };

    let bestCandidate = null;
    let minDistance = Infinity;

    focusables.forEach(target => {
      if (target === this.currentFocused) return;
      const targetRect = target.getBoundingClientRect();
      const targetCenter = {
        x: targetRect.left + targetRect.width / 2,
        y: targetRect.top + targetRect.height / 2
      };

      let isCandidate = false;
      let primaryDistance = 0;
      let secondaryDistance = 0;

      if (direction === 'up' && targetCenter.y < currentCenter.y - 5) {
        isCandidate = true;
        primaryDistance = currentCenter.y - targetCenter.y;
        secondaryDistance = Math.abs(currentCenter.x - targetCenter.x);
      } else if (direction === 'down' && targetCenter.y > currentCenter.y + 5) {
        isCandidate = true;
        primaryDistance = targetCenter.y - currentCenter.y;
        secondaryDistance = Math.abs(currentCenter.x - targetCenter.x);
      } else if (direction === 'left' && targetCenter.x < currentCenter.x - 5) {
        isCandidate = true;
        primaryDistance = currentCenter.x - targetCenter.x;
        secondaryDistance = Math.abs(currentCenter.y - targetCenter.y);
      } else if (direction === 'right' && targetCenter.x > currentCenter.x + 5) {
        isCandidate = true;
        primaryDistance = targetCenter.x - currentCenter.x;
        secondaryDistance = Math.abs(currentCenter.y - targetCenter.y);
      }

      if (isCandidate) {
        // Peso menor para distância secundária para priorizar alinhamento da direção principal
        const distance = primaryDistance + secondaryDistance * 2.5;
        if (distance < minDistance) {
          minDistance = distance;
          bestCandidate = target;
        }
      }
    });

    if (bestCandidate) {
      this.setFocus(bestCandidate);
    }
  }
}

window.tvRemote = new TVRemoteController();
