/* CJX Framework - Stage-based Animations */

document.addEventListener('DOMContentLoaded', function () {
  initCJXAnimations();
  initInfoPanel();
  initLoginForm();
  initChatInput();
  initMobileSidebar();
});

/* CJX entrance animations based on body class */
function initCJXAnimations() {
  const entranceElements = document.querySelectorAll('[data-cjx-entrance]');
  entranceElements.forEach(function (element, index) {
    element.style.animationDelay = (index * 0.1) + 's';
  });
}

/* Info Panel toggle */
function initInfoPanel() {
  const infoBtn = document.querySelector('.info-btn');
  const infoPanel = document.querySelector('.info-panel');
  const closeBtn = document.querySelector('.info-panel .close-btn');

  if (infoBtn && infoPanel) {
    infoBtn.addEventListener('click', function () {
      infoPanel.classList.toggle('open');
    });
  }

  if (closeBtn && infoPanel) {
    closeBtn.addEventListener('click', function () {
      infoPanel.classList.remove('open');
    });
  }

  const memberCount = document.querySelector('.member-count');
  if (memberCount && infoPanel) {
    memberCount.addEventListener('click', function () {
      infoPanel.classList.add('open');
    });
  }
}

/* Login Form interactions */
function initLoginForm() {
  const tokenInput = document.querySelector('#token-input');
  const signInBtn = document.querySelector('#sign-in-btn');
  const errorMsg = document.querySelector('.login-error');

  if (!tokenInput || !signInBtn) return;

  tokenInput.addEventListener('input', function () {
    signInBtn.disabled = tokenInput.value.trim().length === 0;
    if (errorMsg) {
      errorMsg.classList.remove('visible');
      tokenInput.classList.remove('error');
    }
  });

  signInBtn.addEventListener('click', function () {
    const token = tokenInput.value.trim();
    if (!token) return;

    signInBtn.disabled = true;
    signInBtn.innerHTML = '<span class="login-spinner" style="display:inline-block"></span>';

    setTimeout(function () {
      if (token === 'valid-token') {
        window.location.href = 's02-main-layout.html';
      } else {
        signInBtn.disabled = false;
        signInBtn.textContent = 'Sign In';
        if (errorMsg) {
          errorMsg.textContent = 'Invalid or expired token';
          errorMsg.classList.add('visible');
          tokenInput.classList.add('error');
        }
      }
    }, 1200);
  });

  tokenInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      signInBtn.click();
    }
  });
}

/* Chat Input auto-grow and send behavior */
function initChatInput() {
  const chatInput = document.querySelector('.chat-input');
  const sendBtn = document.querySelector('.send-btn');

  if (!chatInput || !sendBtn) return;

  chatInput.addEventListener('input', function () {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
    sendBtn.disabled = chatInput.value.trim().length === 0;
  });

  chatInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (chatInput.value.trim()) {
        chatInput.value = '';
        chatInput.style.height = 'auto';
        sendBtn.disabled = true;
      }
    }
  });
}

/* Mobile sidebar toggle */
function initMobileSidebar() {
  const hamburger = document.querySelector('.hamburger-btn');
  const sidebar = document.querySelector('.sidebar');

  if (!hamburger || !sidebar) return;

  hamburger.addEventListener('click', function () {
    sidebar.classList.toggle('hide-mobile');
  });
}
