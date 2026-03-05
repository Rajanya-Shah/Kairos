/* ================================================================
   Kairos – Frontend SPA  v2
   ★ Global poll every 3s — no page refresh needed
   ★ Toast notifications for messages & friend requests
   ★ Auto-updates sidebar previews and unread dots
   ================================================================ */

'use strict';

// ── Config ────────────────────────────────────────────────────────
const API = {
    auth: '../backend/auth.php',
    addFriend: '../backend/addFriend.php',
    send: '../backend/sendMessage.php',
    getMessages: '../backend/getMessages.php',
    poll: '../backend/poll.php',
};

// ── State ─────────────────────────────────────────────────────────
const state = {
    me: null,
    contacts: [],
    activeContact: null,
    lastMsgId: 0,
    chatLastId: 0,
    globalTimer: null,
    typingTimer: null,
    contactFilter: '',
    seenFRIds: new Set(),
    whisperMode: false,
};

// ================================================================
// INIT
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
    injectToastContainer();
    checkSession();

    const input = document.getElementById('message-input');
    if (input) {
        input.addEventListener('focus', () => document.body.classList.add('focus-mode'));
        input.addEventListener('blur', () => {
            if (input.value.trim() === '') document.body.classList.remove('focus-mode');
        });
    }
});

function injectToastContainer() {
    const div = document.createElement('div');
    div.id = 'toast-container';
    document.body.appendChild(div);
}

async function checkSession() {
    try {
        const me = await api('GET', API.auth, { action: 'me' });
        if (me && me.id) {
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
    const t = document.getElementById(id);
    if (!t) return;
    t.classList.remove('hidden');
    void t.offsetWidth;
    t.classList.add('active');
}

// ================================================================
// AUTH
// ================================================================
function switchAuthTab(tab) {
    clearAuthErrors();
    const showLogin = tab === 'login';
    document.getElementById('form-login').classList.toggle('hidden', !showLogin);
    document.getElementById('form-register').classList.toggle('hidden', showLogin);
    document.getElementById('tab-login').classList.toggle('active', showLogin);
    document.getElementById('tab-register').classList.toggle('active', !showLogin);
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
    } catch { showAuthError('auth-error', 'Connection error. Try again.'); }
    finally { setLoading(btn, false); }
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
    } catch { showAuthError('reg-error', 'Connection error. Try again.'); }
    finally { setLoading(btn, false); }
}

async function handleLogout() {
    stopGlobalPoll();
    await api('POST', API.auth, { action: 'logout' });
    state.me = state.activeContact = null;
    state.contacts = []; state.lastMsgId = 0; state.seenFRIds.clear();
    closeSettings();
    showView('view-auth');
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    switchAuthTab('login');
}

function showAuthError(id, msg) {
    const el = document.getElementById(id);
    if (el) { el.textContent = msg; el.classList.remove('hidden'); }
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
    loadContacts().then(startGlobalPoll);
}

// ================================================================
// GLOBAL POLL (messages + friend requests — no page refresh!)
// ================================================================
function startGlobalPoll() {
    stopGlobalPoll();
    doPoll(); // immediate first run
    state.globalTimer = setInterval(doPoll, 3000);
}
function stopGlobalPoll() {
    if (state.globalTimer) { clearInterval(state.globalTimer); state.globalTimer = null; }
}

async function doPoll() {
    if (!state.me) return;
    try {
        const data = await api('GET', API.poll, { after_msg_id: state.lastMsgId });
        if (!data || data.error) return;

        // ── New messages received
        if (data.new_messages && data.new_messages.length > 0) {
            handleIncomingMessages(data.new_messages);
        }

        // ── Update global max id
        if (data.max_msg_id > state.lastMsgId) {
            state.lastMsgId = data.max_msg_id;
        }

        // ── Friend requests
        if (data.friend_requests && data.friend_requests.length > 0) {
            handleFriendRequestNotifications(data.friend_requests);
        }

    } catch { /* silent – network hiccup */ }
}

function handleIncomingMessages(messages) {
    // Group by sender
    const bySender = {};
    messages.forEach(m => {
        if (!bySender[m.sender_id]) bySender[m.sender_id] = [];
        bySender[m.sender_id].push(m);
    });

    Object.values(bySender).forEach(msgs => {
        const latest = msgs[msgs.length - 1];
        const contact = state.contacts.find(c => c.id === latest.sender_id);
        const senderName = latest.sender_username || (contact ? contact.username : 'Someone');

        // Update sidebar preview + unread dot
        updateContactPreview(latest.sender_id, latest);
        if (!state.activeContact || state.activeContact.id !== latest.sender_id) {
            setUnreadDot(latest.sender_id, true);
        }

        // If this chat is open, append to it
        if (state.activeContact && state.activeContact.id === latest.sender_id) {
            msgs.forEach(m => {
                if (m.id > state.chatLastId) {
                    appendMessage(m, true);
                    state.chatLastId = m.id;
                }
            });
        } else {
            // Toast notification
            const preview = latest.content.length > 60
                ? latest.content.slice(0, 60) + '…'
                : latest.content;
            showToast(senderName, preview, 'message', () => {
                const c = state.contacts.find(c => c.id === latest.sender_id);
                if (c) openChat(c);
            });
        }
    });
}

function handleFriendRequestNotifications(requests) {
    requests.forEach(req => {
        if (state.seenFRIds.has(req.request_id)) return;
        state.seenFRIds.add(req.request_id);
        showBadgeOnAddFriendBtn(true);
        showToast(
            req.username,
            'sent you a friend request',
            'friend',
            () => openAddFriend()
        );
    });
}

// ================================================================
// CONTACTS / SIDEBAR
// ================================================================
async function loadContacts() {
    try {
        const contacts = await api('GET', API.addFriend, { action: 'list' });
        state.contacts = contacts;
        renderContacts();
    } catch { console.error('Failed to load contacts.'); }
}

function renderContacts() {
    const list = document.getElementById('contacts-list');
    const filter = state.contactFilter.toLowerCase();
    list.innerHTML = '';
    const filtered = state.contacts.filter(c => c.username.toLowerCase().includes(filter));

    if (filtered.length === 0) {
        const li = document.createElement('li');
        li.className = 'contacts-placeholder';
        li.textContent = state.contacts.length === 0 ? 'No contacts yet. Add someone.' : 'No match.';
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
        <span class="unread-dot hidden" id="unread-${contact.id}"></span>
      </div>`;
        list.appendChild(li);
    });
}

function filterContacts(value) {
    state.contactFilter = value;
    renderContacts();
}

function setUnreadDot(contactId, show) {
    const dot = document.getElementById(`unread-${contactId}`);
    if (dot) dot.classList.toggle('hidden', !show);
}

// ================================================================
// CHAT
// ================================================================
async function openChat(contact) {
    state.activeContact = contact;
    state.chatLastId = 0;
    setUnreadDot(contact.id, false);

    document.querySelectorAll('.contact-item').forEach(el =>
        el.classList.toggle('active', parseInt(el.dataset.id) === contact.id));

    document.getElementById('chat-empty').classList.add('hidden');
    document.getElementById('chat-active').classList.remove('hidden');

    const initials = contact.username.slice(0, 2).toUpperCase();
    document.getElementById('chat-header-avatar').textContent = initials;
    document.getElementById('chat-header-name').textContent = contact.username;
    document.getElementById('messages-container').innerHTML = '';
    document.getElementById('message-input').value = '';

    // Mobile
    document.getElementById('chat-panel').classList.add('show-mobile');
    document.querySelector('.sidebar')?.classList.add('hide-mobile');

    await fetchAllMessages();
}

async function fetchAllMessages() {
    if (!state.activeContact) return;
    try {
        const messages = await api('GET', API.getMessages, { contact_id: state.activeContact.id });
        if (!Array.isArray(messages)) return;
        renderAllMessages(messages);
        if (messages.length > 0) {
            const maxId = Math.max(...messages.map(m => m.id));
            state.chatLastId = maxId;
            if (maxId > state.lastMsgId) state.lastMsgId = maxId;
            updateContactPreview(state.activeContact.id, messages[messages.length - 1]);
        }
    } catch (e) { console.error(e); }
}

function renderAllMessages(messages) {
    const container = document.getElementById('messages-container');
    container.innerHTML = '';
    let lastDate = null;
    messages.forEach(msg => {
        const d = formatDate(msg.created_at);
        if (d !== lastDate) { container.appendChild(makeDateSeparator(d)); lastDate = d; }
        container.appendChild(makeMessageEl(msg));
        if (msg.id > state.chatLastId) state.chatLastId = msg.id;
    });
    scrollToBottom();
}

function appendMessage(msg, isNewReceived = false) {
    const container = document.getElementById('messages-container');
    // Date separator if needed
    const msgDate = formatDate(msg.created_at);
    const lastSep = container.querySelector('.date-separator:last-of-type');
    if (!lastSep || lastSep.dataset.date !== msgDate) container.appendChild(makeDateSeparator(msgDate));
    container.appendChild(makeMessageEl(msg, isNewReceived));
    scrollToBottom();
}

function makeMessageEl(msg, isNewReceived = false) {
    const isSent = msg.sender_id === state.me.id;
    const row = document.createElement('div');
    row.className = `message-row ${isSent ? 'sent' : 'received'}`;
    row.dataset.msgId = msg.id;

    let displayContent = msg.content;
    let isWhisper = false;
    if (displayContent.startsWith('[W]')) {
        isWhisper = true;
        displayContent = displayContent.substring(3);
    }

    row.innerHTML = `
    <div class="msg-bubble-wrap">
      <div class="msg-bubble ${isWhisper ? 'whisper' : ''}"></div>
      <div class="msg-meta">
        <span class="msg-time">${formatTime(msg.created_at)}</span>
        ${isSent ? `<span class="msg-status ${msg.status}">${tickIcon(msg.status)}</span>` : ''}
      </div>
    </div>`;

    const bubbleEl = row.querySelector('.msg-bubble');
    if (isNewReceived && !isSent) {
        typeWriterEffect(bubbleEl, displayContent, 18);
    } else {
        bubbleEl.textContent = displayContent;
    }

    return row;
}

function typeWriterEffect(element, text, speed) {
    element.textContent = '';
    let i = 0;
    function type() {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
            scrollToBottom();
            setTimeout(type, speed);
        }
    }
    type();
}

function makeDateSeparator(dateStr) {
    const el = document.createElement('div');
    el.className = 'date-separator'; el.dataset.date = dateStr;
    el.innerHTML = `<span>${dateStr}</span>`;
    return el;
}

function tickIcon(s) {
    if (s === 'sent') return '<span title="Sent">✓</span>';
    if (s === 'delivered') return '<span title="Delivered">✓✓</span>';
    if (s === 'seen') return '<span title="Seen">✓✓</span>';
    return '';
}

function updateContactPreview(contactId, msg) {
    const el = document.getElementById(`preview-${contactId}`);
    const time = document.getElementById(`time-${contactId}`);
    if (el) {
        const txt = (msg.sender_id === state.me.id ? 'You: ' : '') + msg.content;
        el.textContent = txt.length > 36 ? txt.slice(0, 36) + '…' : txt;
    }
    if (time) time.textContent = formatTime(msg.created_at);
}

function scrollToBottom() {
    const c = document.getElementById('messages-container');
    if (c) c.scrollTop = c.scrollHeight;
}

// ── Send ─────────────────────────────────────────────────────────
async function sendMessage() {
    const input = document.getElementById('message-input');
    let content = input.value.trim();
    if (!content || !state.activeContact) return;

    input.value = ''; autoResizeTextarea(input);
    if (document.activeElement !== input) document.body.classList.remove('focus-mode');

    if (state.whisperMode) content = '[W]' + content;

    try {
        const res = await api('POST', API.send, {
            receiver_id: state.activeContact.id, content,
        });
        if (res.message) {
            appendMessage(res.message);
            const id = res.message.id;
            if (id > state.chatLastId) state.chatLastId = id;
            if (id > state.lastMsgId) state.lastMsgId = id;
            updateContactPreview(state.activeContact.id, res.message);
        }
    } catch (e) { console.error('Send failed:', e); }
}

function handleInputKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function autoResizeTextarea(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 130) + 'px';
}

function handleTyping() {
    clearTimeout(state.typingTimer);
    state.typingTimer = setTimeout(() => { }, 2000);
}

function toggleWhisper() {
    state.whisperMode = !state.whisperMode;
    const btn = document.getElementById('btn-whisper');
    if (btn) btn.classList.toggle('active', state.whisperMode);
}

// ================================================================
// TOAST NOTIFICATION SYSTEM
// ================================================================
function showToast(title, message, type = 'message', onClick = null) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-type-${type}`;

    const initials = title.slice(0, 2).toUpperCase();
    const icon = type === 'friend'
        ? `<div class="toast-icon" style="color:var(--color-success)">👤</div>`
        : `<div class="toast-icon">${initials}</div>`;

    toast.innerHTML = `
    ${icon}
    <div class="toast-body">
      <div class="toast-title">${escHtml(title)}</div>
      <div class="toast-msg">${escHtml(message)}</div>
    </div>
    <div class="toast-dot"></div>`;

    if (onClick) toast.addEventListener('click', () => { onClick(); removeToast(toast); });
    container.appendChild(toast);

    // Browser notification (if permitted)
    sendBrowserNotification(title, message);

    // Auto-remove after 5s
    const timer = setTimeout(() => removeToast(toast), 5000);
    toast._timer = timer;
}

function removeToast(toast) {
    if (!toast.parentNode) return;
    clearTimeout(toast._timer);
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
}

// Browser / OS notifications
function sendBrowserNotification(title, body) {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
        new Notification(`Kairos — ${title}`, { body, icon: '' });
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(p => {
            if (p === 'granted') new Notification(`Kairos — ${title}`, { body });
        });
    }
}

// Badge on add friend button
function showBadgeOnAddFriendBtn(show) {
    const btn = document.getElementById('btn-open-add-friend');
    if (!btn) return;
    let badge = btn.querySelector('.notif-badge');
    if (show && !badge) {
        badge = document.createElement('span');
        badge.className = 'notif-badge';
        btn.appendChild(badge);
    } else if (!show && badge) {
        badge.remove();
    }
}

// ================================================================
// ADD FRIEND MODAL
// ================================================================
function openAddFriend() {
    showBadgeOnAddFriendBtn(false);
    state.seenFRIds.clear(); // reset so we don't re-toast on next poll
    document.getElementById('modal-add-friend').classList.remove('hidden');
    document.getElementById('friend-search-input').value = '';
    document.getElementById('friend-search-results').innerHTML = '';
    loadPendingRequests();
}
function closeAddFriend() { document.getElementById('modal-add-friend').classList.add('hidden'); }
function closeAddFriendOnBg(e) { if (e.target === document.getElementById('modal-add-friend')) closeAddFriend(); }

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
                resultsEl.innerHTML = '<li style="color:var(--text-muted);font-size:.82rem;padding:6px 0">No users found.</li>';
                return;
            }
            results.forEach(u => {
                const li = document.createElement('li'); li.className = 'search-result-item';
                li.innerHTML = `
          <div class="result-avatar">${u.username.slice(0, 2).toUpperCase()}</div>
          <span class="result-name">${escHtml(u.username)}</span>
          <button class="btn-add" onclick="sendFriendRequest(${u.id}, this)">Add</button>`;
                resultsEl.appendChild(li);
            });
        } catch { /* silent */ }
    }, 300);
}

async function sendFriendRequest(receiverId, btn) {
    btn.disabled = true; btn.textContent = '…';
    try {
        const res = await api('POST', API.addFriend, { action: 'send', receiver_id: receiverId });
        if (res.success) { btn.textContent = 'Sent ✓'; btn.style.color = 'var(--color-success)'; }
        else { btn.textContent = res.error || 'Error'; btn.disabled = false; }
    } catch { btn.textContent = 'Error'; btn.disabled = false; }
}

async function loadPendingRequests() {
    const list = document.getElementById('pending-list'); list.innerHTML = '';
    try {
        const pending = await api('GET', API.addFriend, { action: 'pending' });
        if (!pending.length) { list.innerHTML = '<li class="pending-placeholder">No pending requests.</li>'; return; }
        pending.forEach(req => {
            const li = document.createElement('li'); li.className = 'pending-item';
            li.innerHTML = `
        <div class="result-avatar">${req.username.slice(0, 2).toUpperCase()}</div>
        <span class="result-name">${escHtml(req.username)}</span>
        <button class="btn-accept" onclick="respondToRequest(${req.request_id}, 'accept', this)">✓</button>
        <button class="btn-reject" onclick="respondToRequest(${req.request_id}, 'reject', this)">✕</button>`;
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
            if (action === 'accept') await loadContacts();
        }
    } catch { btn.disabled = false; }
}

// ================================================================
// SETTINGS PANEL
// ================================================================
function openSettings() { updateSettingsPanel(); document.getElementById('panel-settings').classList.remove('hidden'); }
function closeSettings() { document.getElementById('panel-settings').classList.add('hidden'); }
function closeSettingsOnBg(e) { if (e.target === document.getElementById('panel-settings')) closeSettings(); }
function updateSettingsPanel() {
    if (!state.me) return;
    const initials = state.me.username.slice(0, 2).toUpperCase();
    const a = document.getElementById('panel-avatar-display');
    const n = document.getElementById('panel-username-display');
    if (a) a.textContent = initials;
    if (n) n.textContent = state.me.username;
}

// ================================================================
// UTILS
// ================================================================
async function api(method, url, params = {}) {
    let fetchUrl = url;
    const opts = { method, credentials: 'same-origin' };
    if (method === 'GET') {
        const qs = new URLSearchParams(params).toString();
        fetchUrl = qs ? url + '?' + qs : url;
    } else {
        opts.body = new URLSearchParams(params);
        opts.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    }
    const res = await fetch(fetchUrl, opts);
    const text = await res.text();
    try { return JSON.parse(text); }
    catch { console.error('Non-JSON:', text); return { error: 'Server error.' }; }
}

function setLoading(btn, loading) {
    const t = btn.querySelector('.btn-text');
    btn.disabled = loading;
    if (t) t.textContent = loading ? '…' : (btn.id === 'btn-login' ? 'Enter' : 'Create Account');
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function formatDate(dateStr) {
    const d = new Date(dateStr.replace(' ', 'T') + 'Z');
    const today = new Date(), yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (isSameDay(d, today)) return 'Today';
    if (isSameDay(d, yesterday)) return 'Yesterday';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTime(dateStr) {
    return new Date(dateStr.replace(' ', 'T') + 'Z')
        .toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true });
}

function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
}
