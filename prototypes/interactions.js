/* CJX Framework - Stage-based Animations */

document.addEventListener('DOMContentLoaded', function () {
  initCJXAnimations();
  initInfoPanel();
  initLoginForm();
  initChatInput();
  initMobileSidebar();
  initAdminModal();
  initAvatarPicker();
  initWebhookRows();
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

/* S-06: Admin modal (Generate Token) */
function initAdminModal() {
  const generateBtn = document.querySelector('#generate-token-btn');
  const modal = document.querySelector('#generate-modal');
  const cancelBtn = document.querySelector('#cancel-modal-btn');
  const isAgentCheck = document.querySelector('#is-agent-check');
  const agentFields = document.querySelector('#agent-fields');

  if (!generateBtn || !modal) return;

  generateBtn.addEventListener('click', function () {
    modal.classList.add('open');
  });

  if (cancelBtn) {
    cancelBtn.addEventListener('click', function () {
      modal.classList.remove('open');
    });
  }

  modal.addEventListener('click', function (event) {
    if (event.target === modal) {
      modal.classList.remove('open');
    }
  });

  if (isAgentCheck && agentFields) {
    isAgentCheck.addEventListener('change', function () {
      agentFields.style.display = isAgentCheck.checked ? 'block' : 'none';
    });
  }
}

/* S-07: Avatar style picker */
function initAvatarPicker() {
  const avatarBtns = document.querySelectorAll('.avatar-style-btn');
  const previewImage = document.querySelector('#avatar-preview');
  const selectedName = document.querySelector('#selected-style-name');
  const nicknameInput = document.querySelector('#nickname-input');

  if (!avatarBtns.length || !previewImage) return;

  function updatePreview(style, nickname) {
    const seed = nickname || 'User';
    previewImage.src = 'https://api.dicebear.com/9.x/' + style + '/svg?seed=' + encodeURIComponent(seed);
  }

  avatarBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      avatarBtns.forEach(function (otherBtn) { otherBtn.classList.remove('selected'); });
      btn.classList.add('selected');
      const style = btn.getAttribute('data-style');
      if (selectedName) selectedName.textContent = btn.querySelector('.avatar-style-name').textContent;
      const nickname = nicknameInput ? nicknameInput.value : 'User';
      updatePreview(style, nickname);
    });
  });

  if (nicknameInput) {
    nicknameInput.addEventListener('input', function () {
      const selectedBtn = document.querySelector('.avatar-style-btn.selected');
      const style = selectedBtn ? selectedBtn.getAttribute('data-style') : 'adventurer';
      updatePreview(style, nicknameInput.value);
    });
  }
}

/* S-08: Webhook log row expand/collapse */
function initWebhookRows() {
  const expandableRows = document.querySelectorAll('.webhook-row.expandable');

  expandableRows.forEach(function (row) {
    row.addEventListener('click', function () {
      const detailRow = row.nextElementSibling;
      if (!detailRow || !detailRow.classList.contains('webhook-detail')) return;

      const isExpanded = row.getAttribute('data-expanded') === 'true';
      if (isExpanded) {
        detailRow.style.display = 'none';
        row.setAttribute('data-expanded', 'false');
      } else {
        detailRow.style.display = 'table-row';
        row.setAttribute('data-expanded', 'true');
      }
    });
  });
}
