/* ================================================================
   Kairos – Frontend SPA Logic
   Handles: auth, view routing, contacts, chat, polling,
            typing indicator, add-friend modal, settings panel
   ================================================================ */

'use strict';

// ── Config ────────────────────────────────────────────────────────
const API = {
    auth: '../backend/auth.php',
    addFriend: '../backend/addFriend.php',
    send: '../backend/sendMessage.php',
    getMessages: '../backend/getMessages.php',
};

// ── State ─────────────────────────────────────────────────────────
const state = {
    me: null,               // { id, username }
    contacts: [],           // list of contact objects
    activeContact: null,    // currently open contact
    lastMessageId: 0,       // for incremental polling
    pollTimer: null,
    typingTimer: null,
    typingShown: false,
    contactFilter: '',
};

// ================================================================
// INIT
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
});

async function checkSession() {
    try {
        const me = await api('GET', API.auth, { action: 'me' });
        if (me.id) {
            state.me = me;
            enterApp();
        } else {
            showView('view-auth');
        }
    } catch {
        showView('view-auth');
    }
}

// ================================================================
// VIEW ROUTER
// ================================================================
function showView(id) {
    document.querySelectorAll('.view').forEach(v => {
        v.classList.remove('active');
        v.classList.add('hidden');
    });
    const target = document.getElementById(id);
    if (target) {
        target.classList.remove('hidden');
        // Force reflow for animation
        void target.offsetWidth;
        target.classList.add('active');
    }
}

// ================================================================
// AUTH
// ================================================================
function switchAuthTab(tab) {
    const loginForm = document.getElementById('form-login');
    const registerForm = document.getElementById('form-register');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');

    clearAuthErrors();

    if (tab === 'login') {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
    } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    clearAuthErrors();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('btn-login');

    setLoading(btn, true);
    try {
        const res = await api('POST', API.auth, { action: 'login', username, password });
        if (res.error) { showAuthError('auth-error', res.error); return; }
        state.me = { id: res.id, username: res.username };
        enterApp();
    } catch (err) {
        showAuthError('auth-error', 'Connection error. Please try again.');
    } finally {
        setLoading(btn, false);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    clearAuthErrors();
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    const btn = document.getElementById('btn-register');

    setLoading(btn, true);
    try {
        const res = await api('POST', API.auth, { action: 'register', username, password });
        if (res.error) { showAuthError('reg-error', res.error); return; }
        state.me = { id: res.id, username: res.username };
        enterApp();
    } catch {
        showAuthError('reg-error', 'Connection error. Please try again.');
    } finally {
        setLoading(btn, false);
    }
}

async function handleLogout() {
    await api('POST', API.auth, { action: 'logout' });
    state.me = null;
    state.activeContact = null;
    state.contacts = [];
    stopPolling();
    closeSettings();
    showView('view-auth');
    // Reset form
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    switchAuthTab('login');
}

function showAuthError(id, message) {
    const el = document.getElementById(id);
    if (el) { el.textContent = message; el.classList.remove('hidden'); }
}
function clearAuthErrors() {
    ['auth-error', 'reg-error'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.textContent = ''; el.classList.add('hidden'); }
    });
}

// ================================================================
// APP ENTRY
// ================================================================
function enterApp() {
    showView('view-app');
    updateSettingsPanel();
    loadContacts();
}

// ================================================================
// CONTACTS / SIDEBAR
// ================================================================
async function loadContacts() {
    try {
        const contacts = await api('GET', API.addFriend, { action: 'list' });
        state.contacts = contacts;
        renderContacts();
    } catch {
        console.error('Failed to load contacts.');
    }
}

function renderContacts() {
    const list = document.getElementById('contacts-list');
    const filter = state.contactFilter.toLowerCase();
    list.innerHTML = '';

    const filtered = state.contacts.filter(c =>
        c.username.toLowerCase().includes(filter)
    );

    if (filtered.length === 0) {
        const li = document.createElement('li');
        li.className = 'contacts-placeholder';
        li.textContent = state.contacts.length === 0
            ? 'No contacts yet. Add someone.'
            : 'No matching contacts.';
        list.appendChild(li);
        return;
    }

    filtered.forEach(contact => {
        const li = document.createElement('li');
        li.className = 'contact-item' + (state.activeContact?.id === contact.id ? ' active' : '');
        li.dataset.id = contact.id;
        li.onclick = () => openChat(contact);

        const initials = contact.username.slice(0, 2).toUpperCase();
        li.innerHTML = `
      <div class="contact-avatar">${initials}</div>
      <div class="contact-info">
        <div class="contact-name">${escHtml(contact.username)}</div>
        <div class="contact-preview" id="preview-${contact.id}">—</div>
      </div>
      <div class="contact-meta">
        <span class="contact-time" id="time-${contact.id}"></span>
      </div>
    `;
        list.appendChild(li);
    });
}

function filterContacts(value) {
    state.contactFilter = value;
    renderContacts();
}

// ================================================================
// CHAT
// ================================================================
async function openChat(contact) {
    state.activeContact = contact;
    state.lastMessageId = 0;
    stopPolling();

    // Update sidebar selection
    document.querySelectorAll('.contact-item').forEach(el => {
        el.classList.toggle('active', parseInt(el.dataset.id) === contact.id);
    });

    // Show chat area
    document.getElementById('chat-empty').classList.add('hidden');
    const chatActive = document.getElementById('chat-active');
    chatActive.classList.remove('hidden');

    // Set header
    const initials = contact.username.slice(0, 2).toUpperCase();
    document.getElementById('chat-header-avatar').textContent = initials;
    document.getElementById('chat-header-name').textContent = contact.username;

    // Clear messages
    document.getElementById('messages-container').innerHTML = '';
    document.getElementById('message-input').value = '';

    // Mobile: show chat panel
    document.getElementById('chat-panel').classList.add('show-mobile');
    document.querySelector('.sidebar')?.classList.add('hide-mobile');

    await fetchMessages();
    startPolling();
}

async function fetchMessages(incremental = false) {
    if (!state.activeContact) return;

    try {
        const params = { contact_id: state.activeContact.id };
        if (incremental && state.lastMessageId > 0) {
            params.after = state.lastMessageId;
        }

        const messages = await api('GET', API.getMessages, params);
        if (!Array.isArray(messages)) return;

        if (incremental) {
            messages.forEach(appendMessage);
        } else {
            renderAllMessages(messages);
        }

        if (messages.length > 0) {
            state.lastMessageId = Math.max(...messages.map(m => m.id), state.lastMessageId);
            updateContactPreview(state.activeContact.id, messages[messages.length - 1]);
        }
    } catch (e) {
        console.error('fetchMessages error:', e);
    }
}

function renderAllMessages(messages) {
    const container = document.getElementById('messages-container');
    container.innerHTML = '';

    let lastDate = null;
    messages.forEach(msg => {
        const msgDate = formatDate(msg.created_at);
        if (msgDate !== lastDate) {
            container.appendChild(makeDateSeparator(msgDate));
            lastDate = msgDate;
        }
        container.appendChild(makeMessageEl(msg));

        if (msg.id > state.lastMessageId) state.lastMessageId = msg.id;
    });

    scrollToBottom();
}

function appendMessage(msg) {
    const container = document.getElementById('messages-container');
    const msgDate = formatDate(msg.created_at);

    // Date separator if this is a new day
    const lastSep = container.querySelector('.date-separator:last-of-type');
    const lastSepDate = lastSep ? lastSep.dataset.date : null;
    if (msgDate !== lastSepDate) {
        container.appendChild(makeDateSeparator(msgDate));
    }

    container.appendChild(makeMessageEl(msg));
    scrollToBottom();
}

function makeMessageEl(msg) {
    const isSent = msg.sender_id === state.me.id;
    const row = document.createElement('div');
    row.className = `message-row ${isSent ? 'sent' : 'received'}`;
    row.dataset.msgId = msg.id;

    const statusIcon = isSent ? tickIcon(msg.status) : '';
    row.innerHTML = `
    <div class="msg-bubble-wrap">
      <div class="msg-bubble">${escHtml(msg.content)}</div>
      <div class="msg-meta">
        <span class="msg-time">${formatTime(msg.created_at)}</span>
        ${isSent ? `<span class="msg-status ${msg.status}">${statusIcon}</span>` : ''}
      </div>
    </div>
  `;
    return row;
}

function makeDateSeparator(dateStr) {
    const el = document.createElement('div');
    el.className = 'date-separator';
    el.dataset.date = dateStr;
    el.innerHTML = `<span>${dateStr}</span>`;
    return el;
}

function tickIcon(status) {
    if (status === 'sent') return '✓';
    if (status === 'delivered') return '✓✓';
    if (status === 'seen') return '✓✓';
    return '';
}

function updateContactPreview(contactId, msg) {
    const el = document.getElementById(`preview-${contactId}`);
    const time = document.getElementById(`time-${contactId}`);
    if (el) {
        const preview = msg.sender_id === state.me.id
            ? 'You: ' + msg.content
            : msg.content;
        el.textContent = preview.length > 38 ? preview.slice(0, 38) + '…' : preview;
    }
    if (time) time.textContent = formatTime(msg.created_at);
}

function scrollToBottom() {
    const c = document.getElementById('messages-container');
    if (c) c.scrollTop = c.scrollHeight;
}

// ── Polling ─────────────────────────────────────────────────────
function startPolling() {
    stopPolling();
    state.pollTimer = setInterval(() => fetchMessages(true), 3000);
}
function stopPolling() {
    if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
}

// ── Send ─────────────────────────────────────────────────────────
async function sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    if (!content || !state.activeContact) return;

    input.value = '';
    autoResizeTextarea(input);
    hideTypingIndicator();

    try {
        const res = await api('POST', API.send, {
            receiver_id: state.activeContact.id,
            content,
        });
        if (res.message) {
            appendMessage(res.message);
            if (res.message.id > state.lastMessageId) state.lastMessageId = res.message.id;
            updateContactPreview(state.activeContact.id, res.message);
        }
    } catch (e) {
        console.error('Send failed:', e);
    }
}

function handleInputKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

function autoResizeTextarea(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
}

// ── Typing indicator (cosmetic) ──────────────────────────────────
function handleTyping() {
    if (!state.typingShown) {
        // For demo purposes: show a brief mock typing indicator on the first keystroke
        // In production you'd broadcast via a presence channel
    }
    clearTimeout(state.typingTimer);
    state.typingTimer = setTimeout(hideTypingIndicator, 2000);
}

function showTypingIndicator() {
    const el = document.getElementById('typing-indicator');
    if (el) { el.classList.remove('hidden'); state.typingShown = true; scrollToBottom(); }
}
function hideTypingIndicator() {
    const el = document.getElementById('typing-indicator');
    if (el) { el.classList.add('hidden'); state.typingShown = false; }
}

// ================================================================
// ADD FRIEND MODAL
// ================================================================
function openAddFriend() {
    document.getElementById('modal-add-friend').classList.remove('hidden');
    document.getElementById('friend-search-input').value = '';
    document.getElementById('friend-search-results').innerHTML = '';
    loadPendingRequests();
}

function closeAddFriend() {
    document.getElementById('modal-add-friend').classList.add('hidden');
}

function closeAddFriendOnBg(e) {
    if (e.target === document.getElementById('modal-add-friend')) closeAddFriend();
}

let searchDebounce = null;
function searchUsers(q) {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(async () => {
        const resultsEl = document.getElementById('friend-search-results');
        resultsEl.innerHTML = '';
        if (q.trim().length < 1) return;

        try {
            const results = await api('GET', API.addFriend, { action: 'search', q });
            if (!results.length) {
                resultsEl.innerHTML = '<li style="color:var(--text-muted);font-size:.85rem;padding:8px 0">No users found.</li>';
                return;
            }
            results.forEach(u => {
                const li = document.createElement('li');
                li.className = 'search-result-item';
                li.innerHTML = `
          <div class="result-avatar">${u.username.slice(0, 2).toUpperCase()}</div>
          <span class="result-name">${escHtml(u.username)}</span>
          <button class="btn-add" onclick="sendFriendRequest(${u.id}, this)">Add</button>
        `;
                resultsEl.appendChild(li);
            });
        } catch { /* silent */ }
    }, 350);
}

async function sendFriendRequest(receiverId, btn) {
    btn.disabled = true;
    btn.textContent = '…';
    try {
        const res = await api('POST', API.addFriend, { action: 'send', receiver_id: receiverId });
        if (res.success) {
            btn.textContent = 'Sent ✓';
            btn.style.color = 'var(--color-success)';
        } else {
            btn.textContent = res.error || 'Error';
            btn.disabled = false;
        }
    } catch { btn.textContent = 'Error'; btn.disabled = false; }
}

async function loadPendingRequests() {
    const list = document.getElementById('pending-list');
    list.innerHTML = '';
    try {
        const pending = await api('GET', API.addFriend, { action: 'pending' });
        if (!pending.length) {
            list.innerHTML = '<li class="pending-placeholder">No pending requests.</li>';
            return;
        }
        pending.forEach(req => {
            const li = document.createElement('li');
            li.className = 'pending-item';
            li.innerHTML = `
        <div class="result-avatar">${req.username.slice(0, 2).toUpperCase()}</div>
        <span class="result-name">${escHtml(req.username)}</span>
        <button class="btn-accept" onclick="respondToRequest(${req.request_id}, 'accept', this)">✓</button>
        <button class="btn-reject" onclick="respondToRequest(${req.request_id}, 'reject', this)">✕</button>
      `;
            list.appendChild(li);
        });
    } catch { /* silent */ }
}

async function respondToRequest(requestId, action, btn) {
    btn.disabled = true;
    try {
        const res = await api('POST', API.addFriend, { action, request_id: requestId });
        if (res.success) {
            btn.closest('.pending-item').remove();
            if (action === 'accept') {
                // Reload contacts to include the new connection
                await loadContacts();
            }
        }
    } catch { btn.disabled = false; }
}

// ================================================================
// SETTINGS PANEL
// ================================================================
function openSettings() {
    updateSettingsPanel();
    document.getElementById('panel-settings').classList.remove('hidden');
}

function closeSettings() {
    document.getElementById('panel-settings').classList.add('hidden');
}

function closeSettingsOnBg(e) {
    if (e.target === document.getElementById('panel-settings')) closeSettings();
}

function updateSettingsPanel() {
    if (!state.me) return;
    const initials = state.me.username.slice(0, 2).toUpperCase();
    const avatarEl = document.getElementById('panel-avatar-display');
    const nameEl = document.getElementById('panel-username-display');
    if (avatarEl) avatarEl.textContent = initials;
    if (nameEl) nameEl.textContent = state.me.username;
}

// ================================================================
// UTILS
// ================================================================

/** Generic fetch helper */
async function api(method, url, params = {}) {
    let fetchUrl = url;
    const options = { method, credentials: 'same-origin' };

    if (method === 'GET') {
        const qs = new URLSearchParams(params).toString();
        fetchUrl = qs ? url + '?' + qs : url;
    } else {
        const body = new URLSearchParams(params);
        options.body = body;
        options.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    }

    const res = await fetch(fetchUrl, options);
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch {
        console.error('Non-JSON response:', text);
        return { error: 'Server error.' };
    }
}

function setLoading(btn, loading) {
    const textEl = btn.querySelector('.btn-text');
    if (loading) {
        btn.disabled = true;
        if (textEl) textEl.textContent = '…';
    } else {
        btn.disabled = false;
        if (textEl) textEl.textContent = btn.id === 'btn-login' ? 'Enter' : 'Create Account';
    }
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatDate(dateStr) {
    const d = new Date(dateStr.replace(' ', 'T') + 'Z');
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

    if (isSameDay(d, today)) return 'Today';
    if (isSameDay(d, yesterday)) return 'Yesterday';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTime(dateStr) {
    const d = new Date(dateStr.replace(' ', 'T') + 'Z');
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true });
}

function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
}
