/* ================================================================
   Kairos – Frontend SPA  v3
   ★ 5 Major Features: Inbox, Avatars, Image Sharing, Burn, Typing Sync
   ================================================================ */

'use strict';

// ── Config ────────────────────────────────────────────────────────
const API = {
    auth: '../backend/auth.php',
    addFriend: '../backend/addFriend.php',
    send: '../backend/sendMessage.php',
    getMessages: '../backend/getMessages.php',
    poll: '../backend/poll.php',
    updateTyping: '../backend/updateTyping.php',
    updateTheme: '../backend/updateTheme.php',
    updateProfile: '../backend/updateProfile.php',
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
    burnMode: false,
    selectedImage: null,
    isTyping: false,
    burnTimers: {}, // msgId -> timeLeft
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
    if (document.getElementById('toast-container')) return;
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
        state.me = { id: res.id, username: res.username, avatar: res.avatar };
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
    loadContacts().then(() => {
        startGlobalPoll();
        showInboxView();
    });
}

// ================================================================
// GLOBAL POLL
// ================================================================
function startGlobalPoll() {
    stopGlobalPoll();
    doPoll();
    state.globalTimer = setInterval(doPoll, 3000);
}
function stopGlobalPoll() {
    if (state.globalTimer) { clearInterval(state.globalTimer); state.globalTimer = null; }
}

async function doPoll() {
    if (!state.me) return;
    try {
        const params = { after_msg_id: state.lastMsgId };
        if (state.activeContact) params.active_contact_id = state.activeContact.id;

        const data = await api('GET', API.poll, params);
        if (!data || data.error) return;

        if (data.new_messages && data.new_messages.length > 0) {
            handleIncomingMessages(data.new_messages);
        }

        if (data.max_msg_id > state.lastMsgId) {
            state.lastMsgId = data.max_msg_id;
        }

        if (data.friend_requests && data.friend_requests.length > 0) {
            handleFriendRequestNotifications(data.friend_requests);
        }

        // Live Typing Indicator
        const indicator = document.getElementById('typing-indicator');
        if (data.is_typing) {
            indicator.classList.remove('hidden');
        } else {
            indicator.classList.add('hidden');
        }

    } catch { /* silent */ }
}

function handleIncomingMessages(messages) {
    const bySender = {};
    messages.forEach(m => {
        if (!bySender[m.sender_id]) bySender[m.sender_id] = [];
        bySender[m.sender_id].push(m);
    });

    Object.values(bySender).forEach(msgs => {
        const latest = msgs[msgs.length - 1];
        const contact = state.contacts.find(c => c.id === latest.sender_id);
        const senderName = latest.sender_username || (contact ? contact.username : 'Someone');

        updateContactPreview(latest.sender_id, latest);
        if (!state.activeContact || state.activeContact.id !== latest.sender_id) {
            setUnreadDot(latest.sender_id, true);
        }

        if (state.activeContact && state.activeContact.id === latest.sender_id) {
            msgs.forEach(m => {
                if (m.id > state.chatLastId) {
                    appendMessage(m, true);
                    state.chatLastId = m.id;
                }
            });
        } else {
            const preview = latest.type === 'image' ? 'Sent an image' : latest.content;
            const toastTxt = preview.length > 60 ? preview.slice(0, 60) + '…' : preview;
            showToast(senderName, toastTxt, 'message', () => {
                const c = state.contacts.find(c => c.id === latest.sender_id);
                if (c) openChat(c);
            });
        }
    });

    // Refresh Inbox View if visible
    if (!state.activeContact) renderInbox();
}

function handleFriendRequestNotifications(requests) {
    requests.forEach(req => {
        if (state.seenFRIds.has(req.request_id)) return;
        state.seenFRIds.add(req.request_id);
        showBadgeOnAddFriendBtn(true);
        showToast(req.username, 'sent you a friend request', 'friend', () => openAddFriend());
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
        list.innerHTML = `<li class="contacts-placeholder">${state.contacts.length === 0 ? 'No contacts yet.' : 'No match.'}</li>`;
        return;
    }

    filtered.forEach(contact => {
        const li = document.createElement('li');
        li.className = 'contact-item' + (state.activeContact?.id === contact.id ? ' active' : '');
        li.dataset.id = contact.id;
        li.onclick = () => openChat(contact);

        const avatarHtml = contact.avatar
            ? `<img src="${contact.avatar}" alt="${contact.username}">`
            : contact.username.slice(0, 2).toUpperCase();

        li.innerHTML = `
            <div class="contact-avatar">${avatarHtml}</div>
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
// INBOX VIEW
// ================================================================
function showInboxView() {
    state.activeContact = null;
    document.querySelectorAll('.contact-item').forEach(el => el.classList.remove('active'));
    document.getElementById('inbox-view').classList.remove('hidden');
    document.getElementById('chat-active').classList.add('hidden');
    document.body.className = ''; // Reset theme
    renderInbox();
}

function renderInbox() {
    const list = document.getElementById('inbox-list');
    list.innerHTML = '';

    if (state.contacts.length === 0) {
        list.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:40px">No contacts yet. Add someone to start a conversation.</p>';
        return;
    }

    state.contacts.forEach(c => {
        const card = document.createElement('div');
        card.className = 'inbox-card';
        card.onclick = () => openChat(c);

        const avatarHtml = c.avatar
            ? `<img src="${c.avatar}" alt="${c.username}">`
            : c.username.slice(0, 2).toUpperCase();

        card.innerHTML = `
            <div class="inbox-card-top">
                <div class="inbox-card-avatar">${avatarHtml}</div>
                <div class="inbox-card-name">${escHtml(c.username)}</div>
            </div>
            <div class="inbox-card-preview" id="inbox-preview-${c.id}">No messages yet.</div>
            <div class="inbox-card-meta">
                <span class="inbox-card-time" id="inbox-time-${c.id}"></span>
                <span class="inbox-card-unread hidden" id="inbox-unread-${c.id}"></span>
            </div>
        `;
        list.appendChild(card);
        // If we had a message for them, it would update later via poll or we can trigger update now
    });
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

    document.getElementById('inbox-view').classList.add('hidden');
    document.getElementById('chat-active').classList.remove('hidden');

    // Theme
    document.body.className = contact.theme ? `theme-${contact.theme}` : '';
    document.getElementById('chat-theme-select').value = contact.theme || 'default';

    const avatarHtml = contact.avatar
        ? `<img src="${contact.avatar}" alt="${contact.username}">`
        : contact.username.slice(0, 2).toUpperCase();

    document.getElementById('chat-header-avatar').innerHTML = avatarHtml;
    document.getElementById('chat-header-name').textContent = contact.username;
    document.getElementById('messages-container').innerHTML = '';
    document.getElementById('message-input').value = '';
    removeImageAttach();

    await fetchAllMessages();
}

async function fetchAllMessages() {
    if (!state.activeContact) return;
    try {
        const messages = await api('GET', API.getMessages, { contact_id: state.activeContact.id });
        if (!Array.isArray(messages)) return;
        renderAllMessages(messages);
        if (messages.length > 0) {
            const last = messages[messages.length - 1];
            state.chatLastId = Math.max(...messages.map(m => m.id));
            updateContactPreview(state.activeContact.id, last);
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
    if (displayContent.startsWith('[W]')) { isWhisper = true; displayContent = displayContent.substring(3); }

    let burnHtml = '';
    if (msg.is_ephemeral && !isSent) {
        burnHtml = `<span class="burn-timer" id="burn-${msg.id}">10s 🔥</span>`;
        if (msg.status === 'seen') startBurnTimer(msg.id);
    } else if (msg.is_ephemeral && isSent) {
        burnHtml = `<span class="burn-timer">Ephemeral 🔥</span>`;
    }

    let contentHtml = '';
    if (msg.type === 'image') {
        contentHtml = `<img src="${msg.content}" onclick="openLightbox('${msg.content}')" alt="Shared Image">`;
    } else {
        contentHtml = `<div class="msg-text">${escHtml(displayContent)}</div>`;
    }

    row.innerHTML = `
    <div class="msg-bubble-wrap">
      <div class="msg-bubble ${isWhisper ? 'whisper' : ''} ${msg.is_ephemeral ? 'burn' : ''}">
        ${contentHtml}
      </div>
      <div class="msg-meta">
        ${burnHtml}
        <span class="msg-time">${formatTime(msg.created_at)}</span>
        ${isSent ? `<span class="msg-status ${msg.status}">${tickIcon(msg.status)}</span>` : ''}
      </div>
    </div>`;

    const bubbleEl = row.querySelector('.msg-bubble');
    if (isNewReceived && !isSent && msg.type === 'text') {
        typeWriterEffect(bubbleEl.querySelector('.msg-text'), displayContent, 18);
    }

    // Auto-start burn timer if needed
    if (msg.is_ephemeral && msg.status === 'seen' && !isSent) {
        setTimeout(() => startBurnTimer(msg.id), 100);
    }

    return row;
}

// ================================================================
// FEATURE HANDLERS
// ================================================================

// ── Image Sharing ──────────────────────────────────────────────
function handleImageAttach(e) {
    const file = e.target.files[0];
    if (!file) return;
    state.selectedImage = file;
    const reader = new FileReader();
    reader.onload = (re) => {
        document.getElementById('image-preview-img').src = re.target.result;
        document.getElementById('image-preview-container').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

function removeImageAttach() {
    state.selectedImage = null;
    document.getElementById('image-upload-input').value = '';
    document.getElementById('image-preview-container').classList.add('hidden');
}

function openLightbox(src) {
    const lb = document.getElementById('lightbox-overlay');
    document.getElementById('lightbox-img').src = src;
    lb.classList.remove('hidden');
    setTimeout(() => lb.classList.add('active'), 10);
}

function closeLightbox(e) {
    if (e && e.target.tagName === 'IMG') return;
    const lb = document.getElementById('lightbox-overlay');
    lb.classList.remove('active');
    setTimeout(() => lb.classList.add('hidden'), 300);
}

// ── Ephemeral Messages ─────────────────────────────────────────
function toggleBurnMode() {
    state.burnMode = !state.burnMode;
    document.getElementById('btn-burn').classList.toggle('active', state.burnMode);
}

function startBurnTimer(msgId) {
    if (state.burnTimers[msgId]) return;
    let timeLeft = 10;
    state.burnTimers[msgId] = true;
    const el = document.getElementById(`burn-${msgId}`);

    const itv = setInterval(() => {
        timeLeft--;
        if (el) el.textContent = `${timeLeft}s 🔥`;
        if (timeLeft <= 0) {
            clearInterval(itv);
            const row = document.querySelector(`.message-row[data-msg-id="${msgId}"]`);
            if (row) {
                row.style.opacity = '0';
                row.style.transform = 'scale(0.9)';
                setTimeout(() => row.remove(), 400);
            }
        }
    }, 1000);
}

// ── Typing Sync ────────────────────────────────────────────────
function handleTyping() {
    if (!state.activeContact) return;
    state.isTyping = true;
    api('POST', API.updateTyping, { typing_to_id: state.activeContact.id });

    clearTimeout(state.typingTimer);
    state.typingTimer = setTimeout(() => {
        state.isTyping = false;
        api('POST', API.updateTyping, { typing_to_id: 0 });
    }, 3000);
}

// ── Themes ─────────────────────────────────────────────────────
async function changeChatTheme(theme) {
    if (!state.activeContact) return;
    document.body.className = theme === 'default' ? '' : `theme-${theme}`;
    state.activeContact.theme = theme;
    await api('POST', API.updateTheme, { contact_id: state.activeContact.id, theme });
}

// ── Avatar Upload ──────────────────────────────────────────────
async function uploadAvatar(e) {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('avatar', file);

    try {
        const res = await fetch(API.updateProfile, {
            method: 'POST',
            body: formData,
            credentials: 'same-origin'
        });
        const json = await res.json();
        if (json.success) {
            state.me.avatar = json.avatar;
            updateSettingsPanel();
            showToast('Success', 'Avatar updated beautifully.', 'friend');
        } else {
            showToast('Error', json.error || 'Failed to upload.', 'error');
        }
    } catch { showToast('Error', 'Connection failed.', 'error'); }
}

// ================================================================
// CORE UTILS
// ================================================================

async function sendMessage() {
    const input = document.getElementById('message-input');
    let content = input.value.trim();
    if ((!content && !state.selectedImage) || !state.activeContact) return;

    const formData = new FormData();
    formData.append('receiver_id', state.activeContact.id);

    if (state.selectedImage) {
        formData.append('image', state.selectedImage);
    } else {
        if (state.whisperMode) content = '[W]' + content;
        formData.append('content', content);
    }

    if (state.burnMode) formData.append('is_ephemeral', 'true');

    input.value = ''; autoResizeTextarea(input);
    removeImageAttach();

    try {
        const res = await fetch(API.send, {
            method: 'POST',
            body: formData,
            credentials: 'same-origin'
        });
        const json = await res.json();
        if (json.message) {
            appendMessage(json.message);
            state.chatLastId = Math.max(state.chatLastId, json.message.id);
            updateContactPreview(state.activeContact.id, json.message);
        }
    } catch (e) { console.error('Send failed:', e); }
}

function updateContactPreview(contactId, msg) {
    const sidePrev = document.getElementById(`preview-${contactId}`);
    const sideTime = document.getElementById(`time-${contactId}`);
    const inPrev = document.getElementById(`inbox-preview-${contactId}`);
    const inTime = document.getElementById(`inbox-time-${contactId}`);

    let txt = (msg.sender_id === state.me.id ? 'You: ' : '');
    txt += msg.type === 'image' ? 'Sent an image' : msg.content;
    const displayTxt = txt.length > 36 ? txt.slice(0, 36) + '…' : txt;

    if (sidePrev) sidePrev.textContent = displayTxt;
    if (sideTime) sideTime.textContent = formatTime(msg.created_at);
    if (inPrev) inPrev.textContent = msg.type === 'image' ? (msg.sender_id === state.me.id ? 'You shared an image' : 'Shared an image') : msg.content;
    if (inTime) inTime.textContent = formatDate(msg.created_at) + ' ' + formatTime(msg.created_at);
}

function updateSettingsPanel() {
    if (!state.me) return;
    const a = document.getElementById('panel-avatar-display');
    const n = document.getElementById('panel-username-display');
    if (a) {
        a.innerHTML = state.me.avatar
            ? `<img src="${state.me.avatar}" alt="${state.me.username}">`
            : state.me.username.slice(0, 2).toUpperCase();
    }
    if (n) n.textContent = state.me.username;
}

// ── Rest of utils unchanged but integrated ──────────────────────

function typeWriterEffect(element, text, speed) {
    if (!element) return;
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

function handleInputKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function autoResizeTextarea(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 130) + 'px';
}

function scrollToBottom() {
    const c = document.getElementById('messages-container');
    if (c) c.scrollTop = c.scrollHeight;
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
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function tickIcon(s) {
    if (s === 'sent') return '✓';
    if (s === 'delivered') return '✓✓';
    if (s === 'seen') return '<span style="color:var(--accent-purple)">✓✓</span>';
    return '';
}

function makeDateSeparator(dateStr) {
    const el = document.createElement('div');
    el.className = 'date-separator'; el.dataset.date = dateStr;
    el.innerHTML = `<span>${dateStr}</span>`;
    return el;
}

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
    return res.json().catch(() => ({ error: 'Server error' }));
}

function setLoading(btn, loading) {
    const t = btn.querySelector('.btn-text');
    btn.disabled = loading;
    if (t) t.textContent = loading ? '…' : (btn.id === 'btn-login' ? 'Enter' : 'Create Account');
}

function showToast(title, message, type = 'message', onClick = null) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-type-${type}`;
    const icon = type === 'friend' ? '👤' : title.slice(0, 2).toUpperCase();
    toast.innerHTML = `<div class="toast-icon">${icon}</div><div class="toast-body"><div class="toast-title">${escHtml(title)}</div><div class="toast-msg">${escHtml(message)}</div></div><div class="toast-dot"></div>`;
    if (onClick) toast.onclick = () => { onClick(); toast.remove(); };
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('removing'); toast.onanimationend = () => toast.remove(); }, 5000);
}

function showBadgeOnAddFriendBtn(show) {
    const btn = document.getElementById('btn-open-add-friend');
    if (!btn) return;
    let badge = btn.querySelector('.notif-badge');
    if (show && !badge) {
        badge = document.createElement('span'); badge.className = 'notif-badge'; btn.appendChild(badge);
    } else if (!show && badge) badge.remove();
}

function openAddFriend() {
    showBadgeOnAddFriendBtn(false); state.seenFRIds.clear();
    document.getElementById('modal-add-friend').classList.remove('hidden');
    document.getElementById('friend-search-input').value = '';
    document.getElementById('friend-search-results').innerHTML = '';
    loadPendingRequests();
}
function closeAddFriend() { document.getElementById('modal-add-friend').classList.add('hidden'); }
function closeAddFriendOnBg(e) { if (e.target.id === 'modal-add-friend') closeAddFriend(); }

function openSettings() { updateSettingsPanel(); document.getElementById('panel-settings').classList.remove('hidden'); }
function closeSettings() { document.getElementById('panel-settings').classList.add('hidden'); }
function closeSettingsOnBg(e) { if (e.target.id === 'panel-settings') closeSettings(); }

async function searchUsers(q) {
    if (!q.trim()) return;
    const res = await api('GET', '../backend/addFriend.php', { action: 'search', q });
    const resultsEl = document.getElementById('friend-search-results');
    resultsEl.innerHTML = '';
    res.forEach(u => {
        const li = document.createElement('li'); li.className = 'search-result-item';
        li.innerHTML = `<span>${escHtml(u.username)}</span><button onclick="sendFriendRequest(${u.id}, this)">Add</button>`;
        resultsEl.appendChild(li);
    });
}
async function sendFriendRequest(id, btn) {
    btn.disabled = true;
    const res = await api('POST', '../backend/addFriend.php', { action: 'send', receiver_id: id });
    if (res.success) btn.textContent = 'Sent';
}
async function loadPendingRequests() {
    const res = await api('GET', '../backend/addFriend.php', { action: 'pending' });
    const list = document.getElementById('pending-list');
    list.innerHTML = res.length ? '' : '<li>No pending requests.</li>';
    res.forEach(r => {
        const li = document.createElement('li'); li.innerHTML = `${escHtml(r.username)} <button onclick="respondToRequest(${r.request_id}, 'accept', this)">Accept</button>`;
        list.appendChild(li);
    });
}
async function respondToRequest(id, action, btn) {
    const res = await api('POST', '../backend/addFriend.php', { action, request_id: id });
    if (res.success) { btn.closest('li').remove(); loadContacts(); }
}
