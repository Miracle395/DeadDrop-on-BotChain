// ── DEADDROP on BOT CHAIN. ────────────────────────────

import {
  connectWallet as botConnectWallet,
  createDrop as botCreateDrop,
  claimDrop as botClaimDrop,
  hashContent,
  verifyContentHash as botVerifyContentHash
} from './deaddrop-botchain.js';

const SUPABASE_URL = 'https://xkpohkywptcoggdencwh.supabase.co';

const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrcG9oa3l3cHRjb2dnZGVuY3doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxODY4MzgsImV4cCI6MjA4Nzc2MjgzOH0.sGeNfG-WvoTUA3xQGXFiHJ3Wn0OLvEdz47wUTma0-IQ';

// ── VIEW SYSTEM ──────────────────────────────────────────
function enterApp() {
  const overlay = document.getElementById('transition-overlay');
  overlay.classList.add('entering');
  setTimeout(() => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-app').classList.add('active');
    document.getElementById('scanlines').classList.add('visible');
    window.scrollTo(0, 0);
    overlay.classList.remove('entering');
    if (window.location.hash.startsWith('#read:')) {
  switchTabDirect('read');
  document.getElementById('read-link-input').value = window.location.hash;
  readMessages();
}
  }, 350);
}

function goHome() {
  const overlay = document.getElementById('transition-overlay');
  overlay.classList.add('entering');
  setTimeout(() => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-landing').classList.add('active');
    document.getElementById('scanlines').classList.remove('visible');
    window.scrollTo(0, 0);
    overlay.classList.remove('entering');
  }, 350);
}

function scrollToId(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!document.getElementById('view-landing').classList.contains('active')) {
    goHome();
    setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 600);
  } else {
    el.scrollIntoView({ behavior: 'smooth' });
  }
}

// ── CUSTOM CURSOR ─────────────────────────────────────────
const cursor = document.getElementById('cursor');
const cursorDot = document.getElementById('cursor-dot');
let mx = 0, my = 0, cx = 0, cy = 0;
const trails = [];
for (let i = 0; i < 8; i++) {
  const t = document.createElement('div');
  t.className = 'cursor-trail';
  document.body.appendChild(t);
  trails.push({ el: t, x: 0, y: 0 });
}

document.addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  cursorDot.style.left = mx + 'px';
  cursorDot.style.top = my + 'px';
});

function animateCursor() {
  cx += (mx - cx) * 0.12;
  cy += (my - cy) * 0.12;
  cursor.style.left = cx + 'px';
  cursor.style.top = cy + 'px';
  for (let i = trails.length - 1; i >= 0; i--) {
    const prev = i === 0 ? { x: cx, y: cy } : trails[i - 1];
    trails[i].x += (prev.x - trails[i].x) * 0.4;
    trails[i].y += (prev.y - trails[i].y) * 0.4;
    trails[i].el.style.left = trails[i].x + 'px';
    trails[i].el.style.top = trails[i].y + 'px';
    trails[i].el.style.opacity = (1 - i / trails.length) * 0.35;
  }
  requestAnimationFrame(animateCursor);
}
animateCursor();

document.querySelectorAll('button, a, [onclick], .step, .prop, .stat-block, .social-btn').forEach(el => {
  el.addEventListener('mouseenter', () => cursor.classList.add('hovering'));
  el.addEventListener('mouseleave', () => cursor.classList.remove('hovering'));
});

// ── HERO CANVAS ───────────────────────────────────────────
const heroCanvas = document.getElementById('hero-canvas');
const hCtx = heroCanvas.getContext('2d');
let dots = [];

function resizeHeroCanvas() {
  heroCanvas.width = heroCanvas.offsetWidth;
  heroCanvas.height = heroCanvas.offsetHeight;
  buildDots();
}

function buildDots() {
  dots = [];
  const spacing = 40;
  for (let x = 0; x < heroCanvas.width; x += spacing) {
    for (let y = 0; y < heroCanvas.height; y += spacing) {
      dots.push({
        x, y, ox: x, oy: y,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 1.2 + 0.4,
        opacity: Math.random() * 0.4 + 0.1,
      });
    }
  }
}

function animateDots() {
  hCtx.clearRect(0, 0, heroCanvas.width, heroCanvas.height);
  const t = Date.now() * 0.001;
  dots.forEach((d, i) => {
    d.x = d.ox + Math.sin(t * 0.5 + i * 0.1) * 4;
    d.y = d.oy + Math.cos(t * 0.4 + i * 0.13) * 4;
    hCtx.globalAlpha = d.opacity;
    hCtx.fillStyle = '#ffffff';
    hCtx.beginPath();
    hCtx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
    hCtx.fill();
  });
  requestAnimationFrame(animateDots);
}

window.addEventListener('resize', resizeHeroCanvas);
resizeHeroCanvas();
animateDots();

// ── GLITCH TEXT ───────────────────────────────────────────
const glitchTitle = document.getElementById('glitch-title');
const GLITCH_CHARS = '!@#$%^&*<>?/\\|01█▓░▒';
const ORIGINAL_TEXT = 'Leave\nno\ntrace.';

function glitchText(el, finalText, duration = 1200) {
  const parts = finalText.split('');
  let frame = 0;
  const totalFrames = Math.floor(duration / 40);
  const interval = setInterval(() => {
    let output = '';
    parts.forEach((char, i) => {
      const progress = frame / totalFrames;
      const charProgress = i / parts.length;
      if (char === '\n') { output += '<br>'; return; }
      if (char === ' ') { output += ' '; return; }
      if (progress > charProgress + 0.2) {
        output += char;
      } else {
        output += `<span style="color:var(--crimsn);opacity:0.7">${GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]}</span>`;
      }
    });
    el.innerHTML = output.replace(/\n/g, '<br>') + (frame % 4 < 2 ? '<span style="color:var(--crimsn);opacity:0.5">_</span>' : '');
    frame++;
    if (frame > totalFrames) {
      clearInterval(interval);
      el.innerHTML = 'Leave<br><span class="dim-word">no</span><br>trace.';
    }
  }, 40);
}

setTimeout(() => glitchText(glitchTitle, ORIGINAL_TEXT, 1400), 800);
setInterval(() => {
  if (document.getElementById('view-landing').classList.contains('active')) {
    glitchText(glitchTitle, ORIGINAL_TEXT, 1000);
  }
}, 9000);

// ── SCROLL REVEAL ─────────────────────────────────────────
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.08 });
document.querySelectorAll('.reveal-on-scroll').forEach(el => revealObserver.observe(el));

// ── COUNT-UP ANIMATION ────────────────────────────────────
const countObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target;
    const target = parseInt(el.dataset.target);
    const suffix = el.dataset.suffix || '';
    const duration = 1800;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target) + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    };
    tick();
    countObserver.unobserve(el);
  });
}, { threshold: 0.5 });
document.querySelectorAll('[data-target]').forEach(el => countObserver.observe(el));

// ── NAV SHRINK ON SCROLL ──────────────────────────────────
window.addEventListener('scroll', () => {
  document.getElementById('main-nav').classList.toggle('scrolled', window.scrollY > 60);
});


// ── BOT CHAIN WALLET ──────────────────────────────────────

let connectedAddress = null;
let signer = null;

function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function onWalletConnected(address) {
  const btn = document.getElementById('wallet-btn');
  connectedAddress = address;
  const short = address.slice(0, 4) + '...' + address.slice(-4);
  btn.textContent = short;
  btn.className = 'connected';
  btn.disabled = false;
  if (document.getElementById('view-inbox').classList.contains('active')) {
    openInboxConnectedState();
  }
  updateInboxBadge();
}

function onWalletDisconnected() {
  const btn = document.getElementById('wallet-btn');
  connectedAddress = null;
  signer = null;
  btn.textContent = 'Connect Wallet';
  btn.className = '';
  btn.disabled = false;
  const inboxOpen = document.getElementById('inbox-open');
  const inboxLocked = document.getElementById('inbox-locked');
  if (inboxOpen) inboxOpen.style.display = 'none';
  if (inboxLocked) inboxLocked.style.display = 'flex';
}

async function connectWallet() {
  const btn = document.getElementById('wallet-btn');

  if (connectedAddress) {
    onWalletDisconnected();
    return;
  }

  btn.textContent = 'Connecting...';
  btn.disabled = true;

  try {
    const result = await botConnectWallet();
    signer = result.signer;
    onWalletConnected(result.address);
  } catch(e) {
    console.error('Wallet connect failed:', e);
    btn.textContent = 'Connect Wallet';
    btn.className = '';
    btn.disabled = false;
    alert(e.message || 'Wallet connection failed.');
  }
}

// ── CRYPTO — AES-256-GCM ──────────────────────────────────
// Used to encrypt message before storing on-chain
async function generateKey() {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}
async function exportKey(key) {
  const raw = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(raw)));
}
async function importKey(b64) {
  const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['decrypt']);
}

async function encryptMessage(text) {
  const key = await generateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const exportedKey = await exportKey(key);
  const payload = new Uint8Array(12 + ciphertext.byteLength);
  payload.set(iv, 0);
  payload.set(new Uint8Array(ciphertext), 12);
  const b64payload = btoa(String.fromCharCode(...payload));
  return { b64payload, keyB64: exportedKey };
}

async function decryptPayload(b64payload, keyB64) {
  const payload = Uint8Array.from(atob(b64payload), c => c.charCodeAt(0));
  const iv = payload.slice(0, 12);
  const ciphertext = payload.slice(12);
  const key = await importKey(keyB64);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

// ── DROP FLOW (SENDER) ────────────────────────────────────
let selfDestruct = true;
let requestProof = true; // always use ZK on Stellar

function toggleAccordion(row) {
  const isOpen = row.classList.contains('open');
  document.querySelectorAll('.compare-acc-row.open').forEach(r => r.classList.remove('open'));
  if (!isOpen) row.classList.add('open');
}

function toggleChip(el) {
  el.classList.toggle('on');
  if (el.id === 'chip-selfdes') selfDestruct = el.classList.contains('on');
  if (el.id === 'chip-proof') requestProof = el.classList.contains('on');
}

async function dropMessage() {
  const input = document.getElementById('msg-input');
  const text = input.value.trim();
  if (!text) { flashInput(); return; }

  const btn = document.getElementById('drop-btn');
  const btnText = document.getElementById('drop-btn-text');
  const progress = document.getElementById('btn-progress');
  const statusBox = document.getElementById('status-box');

  input.classList.add('burning');
  btn.disabled = true;
  statusBox.className = 'show';

  try {
    // Step 1: Encrypt
    btnText.textContent = 'Encrypting...';
    progress.style.width = '20%';
    statusBox.innerHTML = `<div class="status-uploading"><p><span class="spinner"></span> Encrypting message with AES-256-GCM...</p></div>`;
    await sleep(400);
    const { b64payload, keyB64 } = await encryptMessage(text);

   // Step 2: resolve recipient
    if (!signer) throw new Error('Connect your wallet first.');
    const recipientAddress = window.location.pathname.split('/drop/')[1] || document.getElementById('recipient-input')?.value.trim();
    const recipientArg = recipientAddress || '0x0000000000000000000000000000000000000000';

    // Step 3: Save to Supabase
    btnText.textContent = 'Storing encrypted message...';
    progress.style.width = '65%';
    statusBox.innerHTML = `<div class="status-uploading"><p><span class="spinner"></span> Storing encrypted message...</p></div>`;

    const res = await fetch(`${SUPABASE_URL}/rest/v1/private_messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON,
        'Authorization': `Bearer ${SUPABASE_ANON}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        encrypted_message: b64payload + ':' + keyB64,
        recipient_address: recipientArg === '0x0000000000000000000000000000000000000000' ? null : recipientArg
      })
    });
    if (!res.ok) throw new Error('Failed to store message. Try again.');
    const [row] = await res.json();
    const dropId = row.id;
    
  // Step 3b: Submit to BOT Chain contract
    btnText.textContent = 'Submitting to BOT Chain...';
    const contentHash = hashContent(b64payload);
    const keyHash = hashContent(keyB64);
    const { dropId: chainDropId, txHash } = await botCreateDrop(signer, recipientArg, contentHash, keyHash, 0);

    await fetch(`${SUPABASE_URL}/rest/v1/private_messages?id=eq.${dropId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON,
        'Authorization': `Bearer ${SUPABASE_ANON}`
      },
      body: JSON.stringify({ chain_drop_id: chainDropId.toString() })
    });

    progress.style.width = '100%';
    await sleep(300);

    const shareUrl = `${window.location.origin}/#read:${dropId}`;

    statusBox.innerHTML = `
      <div class="result-card">
        <div class="result-label">// Drop ready — share this link</div>
        <div class="result-link-wrap">
          <div id="result-link">${shareUrl}</div>
          <button id="copy-btn" onclick="copyLink('${escapeForAttr(shareUrl)}')">Copy</button>
        </div>
        <div class="result-meta">
          <div>Drop ID: <span>${dropId.slice(0,8)}...</span></div>
          <div>Encryption: <span>AES-256-GCM</span></div>
          <div>Chain: <span>BOT Chain Testnet</span></div>
          <div>Storage: <span>Encrypted · Supabase</span></div>
        </div>
      </div>
    `;

    fireParticles();
    input.classList.remove('burning');
    input.value = '';
    updateCounter();
    btn.disabled = false;
    btnText.textContent = 'Encrypt & Drop';
    progress.style.width = '0%';

  } catch(err) {
    input.classList.remove('burning');
    btn.disabled = false;
    btnText.textContent = 'Encrypt & Drop';
    progress.style.width = '0%';
    statusBox.innerHTML = `<div class="error-card">${err.message}</div>`;
  }
}

// ── READ FLOW (RECIPIENT) ─────────────────────────────────
async function readMessages() {
  const linkInput = document.getElementById('read-link-input');
  const decryptBox = document.getElementById('decrypt-box');
  const raw = linkInput.value.trim() || window.location.hash;

  decryptBox.className = 'show';
  decryptBox.innerHTML = `<div class="status-uploading"><p><span class="spinner"></span> Fetching message...</p></div>`;

  try {
    // Parse drop ID from link or hash
    let dropId;
    if (raw.includes('#read:')) {
      dropId = raw.split('#read:')[1];
    } else if (raw.includes('read:')) {
      dropId = raw.split('read:')[1];
    } else {
      dropId = raw.replace('#', '').trim();
    }
    if (!dropId) throw new Error('Invalid DEADROP link.');

    // Fetch from Supabase
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/private_messages?id=eq.${dropId}&select=encrypted_message,chain_drop_id`,
      {
        headers: {
          'apikey': SUPABASE_ANON,
          'Authorization': `Bearer ${SUPABASE_ANON}`
        }
      }
    );
    if (!res.ok) throw new Error('Failed to fetch message.');
    const rows = await res.json();
    if (!rows.length) throw new Error('Drop not found or already deleted.');

    if (!signer) throw new Error('Connect your wallet first to claim this drop.');

    decryptBox.innerHTML = `<div class="status-uploading"><p><span class="spinner"></span> Claiming on-chain...</p></div>`;
    const chainDropId = rows[0].chain_drop_id;
    if (chainDropId) {
      await botClaimDrop(signer, chainDropId);
    }

    const [b64payload, keyB64] = rows[0].encrypted_message.split(':');

    decryptBox.innerHTML = `<div class="status-uploading"><p><span class="spinner"></span> Decrypting...</p></div>`;
    await sleep(400);

    const plaintext = await decryptPayload(b64payload, keyB64);
    const now = new Date().toISOString();

    decryptBox.innerHTML = `
      <div class="decrypted-card">
        <div class="decrypted-label">Decrypted message</div>
        <div id="decrypted-msg" class="reveal-animation">${escapeHtml(plaintext)}</div>
        <div class="decrypted-footer">
          <span>Claimed on BOT Chain</span>
          <span>Read at: ${now.replace('T',' ').slice(0,19)} UTC</span>
          <span>Key cleared from memory</span>
        </div>
      </div>
    `;
    history.replaceState(null, '', window.location.pathname);

  } catch(err) {
    decryptBox.innerHTML = `<div class="error-card">${err.message}</div>`;
  }
}

// ── URL HELPERS ───────────────────────────────────────────
function getRecipientFromURL() {
  // Support /drop/GXXXXX format
  const path = window.location.pathname;
  const match = path.match(/\/drop\/([A-Z0-9]{56})/);
  return match ? match[1] : null;
}

// ── PARTICLES ─────────────────────────────────────────────
function fireParticles() {
  const canvas = document.getElementById('particles');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.classList.add('show');

  const particles = [];
  for (let i = 0; i < 120; i++) {
    particles.push({
      x: canvas.width / 2 + (Math.random() - 0.5) * 400,
      y: canvas.height / 2 + (Math.random() - 0.5) * 300,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8 - 2,
      life: 1,
      size: Math.random() * 4 + 1,
      color: Math.random() > 0.5 ? '#C0002A' : '#f0f0f0'
    });
  }

  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.12; p.life -= 0.018;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    frame++;
    if (frame < 100) requestAnimationFrame(animate);
    else {
      canvas.classList.remove('show');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  animate();
}

// ── UTILS ─────────────────────────────────────────────────

function switchTab(name, el) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById(`panel-${name}`).classList.add('active');
}

function switchTabDirect(name) {
  document.querySelectorAll('.tab').forEach((t, i) => {
    t.classList.toggle('active', (i === 0 && name === 'compose') || (i === 1 && name === 'read'));
  });
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`panel-${name}`).classList.add('active');
}
function updateCounter() {
  const input = document.getElementById('msg-input');
  const counter = document.getElementById('char-counter');
  const len = input.value.length;
  counter.textContent = `${len} / 4000`;
  counter.className = 'char-counter' + (len > 3500 ? ' warn' : '');
}
function flashInput() {
  const input = document.getElementById('msg-input');
  input.style.borderColor = 'var(--crimsn)';
  setTimeout(() => input.style.borderColor = '', 600);
}
async function copyLink(url) {
  try {
    await navigator.clipboard.writeText(url);
    const btn = document.getElementById('copy-btn');
    if (btn) {
      btn.textContent = 'Copied!';
      btn.className = 'copied';
      setTimeout(() => { btn.textContent = 'Copy'; btn.className = ''; }, 2000);
    }
  } catch(e) { console.error(e); }
}
function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function escapeForAttr(str) {
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function showError(boxId, msg) {
  const box = document.getElementById(boxId);
  if (box) { box.className = 'show'; box.innerHTML = `<div class="error-card">${msg}</div>`; }
}

// ── INIT ──────────────────────────────────────────────────
window.addEventListener('load', () => {

  // Auto-read if hash present
  if (window.location.hash.startsWith('#read:')) {
    enterApp();
    switchTabDirect('read');
    document.getElementById('read-link-input').value = window.location.hash;
    readMessages();
  }

 // If URL is /drop/GXXXXX, show the anonymous sender view
  const recipient = getRecipientFromURL();
  if (recipient) {
    showDropView(recipient);
    return;
  }
});


// ── NEW VIEW FUNCTIONS ────────────────────────────────────

function showView(id) {
  const overlay = document.getElementById('transition-overlay');
  overlay.classList.add('entering');
  setTimeout(() => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    const needsScanlines = (id === 'view-app' || id === 'view-inbox');
    document.getElementById('scanlines').classList.toggle('visible', needsScanlines);
    window.scrollTo(0, 0);
    overlay.classList.remove('entering');
  }, 350);
}

function showInboxView() {
  showView('view-inbox');
  // Reveal correct state based on wallet connection
  if (connectedAddress) {
    openInboxConnectedState();
    updateInboxBadge();
  }
}

function showDropView(recipientAddress) {
  showView('view-drop');
  const addrEl = document.getElementById('drop-recipient-addr');
  if (addrEl) addrEl.textContent = recipientAddress;
  window._dropRecipient = recipientAddress;
}

function openInboxConnectedState() {
  const locked = document.getElementById('inbox-locked');
  const open = document.getElementById('inbox-open');
  if (locked) locked.style.display = 'none';
  if (open) {
    open.style.display = 'flex';
    const linkEl = document.getElementById('inbox-view-drop-link');
    if (linkEl) linkEl.textContent = `${window.location.origin}/drop/${connectedAddress}`;
    loadInboxMessages();
  }
}

// ── INBOX BADGE (unread count) ────────────────────────────
async function updateInboxBadge() {
  if (!connectedAddress) return;
  try {
    const messages = await fetchMessagesFromSupabase(connectedAddress);
    const total = messages.length;
    const storageKey = `deadrop_read_${connectedAddress}`;
    const readCount = parseInt(localStorage.getItem(storageKey) || '0');
    const unread = Math.max(0, total - readCount);
    const badge = document.getElementById('inbox-badge');
    if (!badge) return;
    if (unread > 0) {
      badge.textContent = unread > 99 ? '99+' : unread;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  } catch(e) { /* silent fail */ }
}

// ── FETCH MESSAGES FROM SUPABASE (for inbox) ──────────────
async function fetchMessagesFromSupabase(recipientAddress) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/private_messages?recipient_address=eq.${recipientAddress}&select=id,encrypted_message,created_at&order=created_at.desc`,
    { headers: { 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_ANON}` } }
  );
  if (!res.ok) throw new Error('Failed to fetch messages.');
  return res.json();
}

// ── LOAD + RENDER INBOX MESSAGES ──────────────────────────
async function loadInboxMessages() {
  const container = document.getElementById('inbox-view-messages');
  if (!container || !connectedAddress) return;
  container.innerHTML = `<div class="status-uploading"><p><span class="spinner"></span> Fetching drops...</p></div>`;
  try {
    const rows = await fetchMessagesFromSupabase(connectedAddress);

    // Mark all as read in localStorage
    const storageKey = `deadrop_read_${connectedAddress}`;
    localStorage.setItem(storageKey, String(rows.length));
    // Clear badge
    const badge = document.getElementById('inbox-badge');
    if (badge) badge.style.display = 'none';

    if (!rows.length) {
      container.innerHTML = `<div class="inbox-empty">// NO DROPS YET — share your link to receive messages</div>`;
      return;
    }

    container.innerHTML = '';
    rows.forEach(async (row, i) => {
      const card = document.createElement('div');
      card.className = 'inbox-message-card';
      const ts = row.created_at ? new Date(row.created_at).toISOString().replace('T',' ').slice(0,16) + ' UTC' : '—';
      card.innerHTML = `
        <div class="inbox-msg-meta">DROP #${String(i + 1).padStart(2, '0')}</div>
        <div class="inbox-msg-body" style="color:var(--dim);font-family:var(--font-mono);font-size:12px;">Decrypting...</div>
        <div class="inbox-msg-footer">
          <span>ZK-anonymous sender</span>
          <span>${ts}</span>
        </div>
      `;
      container.appendChild(card);
      const bodyEl = card.querySelector('.inbox-msg-body');
      try {
        const [b64payload, keyB64] = row.encrypted_message.split(':');
        const plaintext = await decryptPayload(b64payload, keyB64);
        bodyEl.textContent = plaintext;
        bodyEl.style.color = '';
        bodyEl.style.fontFamily = '';
        bodyEl.style.fontSize = '';
        bodyEl.classList.add('reveal-animation');
      } catch(e) {
        bodyEl.textContent = '[Could not decrypt]';
        bodyEl.style.color = 'var(--dim)';
      }
    });
  } catch(err) {
    container.innerHTML = `<div class="error-card">${err.message}</div>`;
  }
}

// ── SEND DROP (from view-drop) ────────────────────────────
async function sendDrop() {
  const input = document.getElementById('drop-msg-input');
  const text = input.value.trim();
  if (!text) {
    input.style.borderColor = 'var(--crimsn)';
    setTimeout(() => input.style.borderColor = '', 600);
    return;
  }
  const recipient = window._dropRecipient;
  if (!recipient) {
    document.getElementById('drop-status-box').innerHTML = `<div class="error-card">No recipient found in URL.</div>`;
    return;
  }
  const btn = document.getElementById('drop-send-btn');
  const btnText = document.getElementById('drop-send-btn-text');
  const progress = document.getElementById('drop-btn-progress');
  const statusBox = document.getElementById('drop-status-box');

  btn.disabled = true;
  statusBox.innerHTML = '';

  try {
    btnText.textContent = 'Encrypting...';
    progress.style.width = '20%';
    statusBox.innerHTML = `<div class="status-uploading"><p><span class="spinner"></span> Encrypting message...</p></div>`;
    await sleep(300);
    const { b64payload, keyB64 } = await encryptMessage(text);

   if (!signer) throw new Error('Connect your wallet first.');

    btnText.textContent = 'Storing encrypted drop...';
    progress.style.width = '75%';
    statusBox.innerHTML = `<div class="status-uploading"><p><span class="spinner"></span> Storing encrypted drop...</p></div>`;

   const res = await fetch(`${SUPABASE_URL}/rest/v1/private_messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON,
        'Authorization': `Bearer ${SUPABASE_ANON}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        encrypted_message: b64payload + ':' + keyB64,
        recipient_address: recipient === '0x0000000000000000000000000000000000000000' ? null : recipient
      })
    });
    if (!res.ok) throw new Error('Failed to store drop. Try again.');
    const [row] = await res.json();
    const dropId = row.id;

    btnText.textContent = 'Submitting to BOT Chain...';
    progress.style.width = '75%';
    const contentHash = hashContent(b64payload);
    const keyHash = hashContent(keyB64);
    const { dropId: chainDropId } = await botCreateDrop(signer, recipient, contentHash, keyHash, 0);

    await fetch(`${SUPABASE_URL}/rest/v1/private_messages?id=eq.${dropId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON,
        'Authorization': `Bearer ${SUPABASE_ANON}`
      },
      body: JSON.stringify({ chain_drop_id: chainDropId.toString() })
    });

    progress.style.width = '100%';
    await sleep(300);

    statusBox.innerHTML = `
      <div class="result-card">
        <div class="result-label">// Drop delivered</div>
        <div class="result-meta">
          <div>Recipient: <span>${recipient.slice(0,8)}...${recipient.slice(-6)}</span></div>
          <div>Encryption: <span>AES-256-GCM</span></div>
          <div>Chain: <span>BOT Chain Testnet</span></div>
        </div>
      </div>
    `;
    fireParticles();
    input.value = '';
    updateDropCounter();
    btn.disabled = false;
    btnText.textContent = 'Encrypt & Send';
    progress.style.width = '0%';

  } catch(err) {
    btn.disabled = false;
    btnText.textContent = 'Encrypt & Send';
    progress.style.width = '0%';
    statusBox.innerHTML = `<div class="error-card">${err.message}</div>`;
  }
}

// ── DROP PAGE UTILS ───────────────────────────────────────
function updateDropCounter() {
  const input = document.getElementById('drop-msg-input');
  const counter = document.getElementById('drop-char-counter');
  if (!input || !counter) return;
  const len = input.value.length;
  counter.textContent = `${len} / 4000`;
  counter.className = 'char-counter' + (len > 3500 ? ' warn' : '');
}

async function copyInboxViewLink() {
  const linkEl = document.getElementById('inbox-view-drop-link');
  if (!linkEl) return;
  const btn = document.getElementById('inbox-view-copy-btn');
  try {
    await navigator.clipboard.writeText(linkEl.textContent);
    if (btn) { btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy', 2000); }
  } catch(e) { console.error(e); }
}


// ── EXPOSE TO GLOBAL SCOPE (required for IIFE bundle + inline onclick) ──
window.enterApp = enterApp;
window.goHome = goHome;
window.scrollToId = scrollToId;
window.connectWallet = connectWallet;
window.showInboxView = showInboxView;
window.sendDrop = sendDrop;
window.updateDropCounter = updateDropCounter;
window.copyInboxViewLink = copyInboxViewLink;
window.showDropView = showDropView;
window.switchTab = switchTab;
window.dropMessage = dropMessage;
window.toggleChip = toggleChip;
window.readMessages = readMessages;
window.updateCounter = updateCounter;
window.copyLink = copyLink;
window.loadInboxMessages = loadInboxMessages;
window.toggleAccordion = toggleAccordion;


// ── PHONE ANIMATION ────────────────────────────────
(function initPhoneDemo() {
  const CIPHER_CHARS = '$*#@!^/\\|%~&?';
  const MESSAGE = "They know about the meeting.";

  function randCipher(len) {
    let s = '';
    for (let i = 0; i < len; i++) s += CIPHER_CHARS[Math.floor(Math.random() * CIPHER_CHARS.length)];
    return s;
  }

  function setStageLabel(txt, cls) {
    const el = document.getElementById('stage-label');
    if (!el) return;
    el.textContent = txt;
    el.className = 'phone-stage-label' + (cls ? ' ' + cls : '');
  }
  function setSenderMsg(txt, cls) {
    const el = document.getElementById('sender-display');
    if (!el) return;
    el.textContent = txt;
    el.className = 'phone-message-area' + (cls ? ' ' + cls : '');
  }
  function setSenderStatus(txt, cls) {
    const el = document.getElementById('sender-status');
    if (!el) return;
    el.textContent = txt;
    el.className = 'phone-status' + (cls ? ' ' + cls : '');
  }
  function setRecipientMsg(txt, cls) {
    const el = document.getElementById('recipient-display');
    if (!el) return;
    el.textContent = txt;
    el.className = 'phone-message-area' + (cls ? ' ' + cls : '');
  }
  function setRecipientStatus(txt, cls) {
    const el = document.getElementById('recipient-status');
    if (!el) return;
    el.textContent = txt;
    el.className = 'phone-status' + (cls ? ' ' + cls : '');
  }
  function setGlow(phone, on) {
    const el = document.getElementById(phone);
    if (!el) return;
    el.classList.toggle('active-glow', on);
    el.classList.toggle('dark-state', false);
  }
  function setDark(phone) {
    const el = document.getElementById(phone);
    if (!el) return;
    el.classList.remove('active-glow');
    el.classList.add('dark-state');
  }

  function typeMessage(cb) {
    setSenderMsg('', '');
    setGlow('phone-sender', true);
    setStageLabel('// Stage 01 — Writing message', 'active');
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setSenderMsg(MESSAGE.slice(0, i) + (i < MESSAGE.length ? '|' : ''), '');
      if (i >= MESSAGE.length) { clearInterval(iv); setTimeout(cb, 600); }
    }, 55);
  }

  function encryptAndSeal(cb) {
    setStageLabel('// Stage 02 — Sealing (AES-256-GCM)', 'active');
    setSenderStatus('SEALING...', 'proof');
    let flicker = 0;
    const iv = setInterval(() => {
      setSenderMsg(randCipher(28), 'cipher');
      flicker++;
      if (flicker > 14) {
        clearInterval(iv);
        setSenderMsg(randCipher(28), 'cipher');
        setSenderStatus('✓ SEALED', 'proof');
        setTimeout(cb, 700);
      }
    }, 80);
  }

  function transmit(cb) {
    setStageLabel('// Stage 03 — Transmitting to BOT Chain', 'active');
    const line = document.getElementById('tx-line');
    const dot  = document.getElementById('tx-dot');
    const lbl  = document.getElementById('tx-label');
    if (line) line.classList.add('active');
    if (lbl)  { lbl.textContent = 'BOT CHAIN'; lbl.classList.add('visible'); }
    if (dot) {
      dot.classList.remove('traveling');
      void dot.offsetWidth;
      dot.classList.add('traveling');
    }
    setGlow('phone-recipient', true);
    setTimeout(() => {
      if (line) line.classList.remove('active');
      if (lbl)  lbl.classList.remove('visible');
      cb();
    }, 1000);
  }

  function decryptRecipient(cb) {
    setStageLabel('// Stage 04 — Recipient decrypting', 'active');
    setRecipientMsg(randCipher(28), 'cipher');
    setRecipientStatus('DECRYPTING...', 'proof');
    let flicker = 0;
    const iv = setInterval(() => {
      setRecipientMsg(randCipher(28), 'cipher');
      flicker++;
      if (flicker > 10) {
        clearInterval(iv);
        setRecipientMsg(MESSAGE, 'clean');
        setRecipientStatus('✓ MESSAGE RECEIVED', 'ok');
        setTimeout(cb, 1200);
      }
    }, 90);
  }

  function goSilent(cb) {
    setStageLabel('// No trace left', 'done');
    setSenderMsg('', 'dark');
    setSenderStatus('', 'gone');
    setRecipientMsg('', 'dark');
    setRecipientStatus('', 'gone');
    setDark('phone-sender');
    setDark('phone-recipient');
    setTimeout(cb, 2400);
  }

  function reset(cb) {
    setGlow('phone-sender', false);
    setGlow('phone-recipient', false);
    document.getElementById('phone-sender')?.classList.remove('dark-state');
    document.getElementById('phone-recipient')?.classList.remove('dark-state');
    setSenderMsg('', '');
    setSenderStatus('', '');
    setRecipientMsg('', '');
    setRecipientStatus('', '');
    setStageLabel('// Waiting...', '');
    setTimeout(cb, 800);
  }

  function runLoop() {
    reset(() =>
      typeMessage(() =>
        encryptAndSeal(() =>
          transmit(() =>
            decryptRecipient(() =>
              goSilent(() => runLoop())
            )
          )
        )
      )
    );
  }

  const section = document.getElementById('phone-demo');
  if (!section) return;
  let started = false;
  const obs = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && !started) {
      started = true;
      obs.disconnect();
      setTimeout(runLoop, 400);
    }
  }, { threshold: 0.3 });
  obs.observe(section);
})();

// ── THREAT MODEL — NULLIFIED STAMP ON SCROLL ──────────────
(function initThreatModel() {
  const cards = document.querySelectorAll('.threat-card[data-nullified]');
  if (!cards.length) return;
  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const card = entry.target;
        setTimeout(() => card.classList.add('stamped'), 300);
        obs.unobserve(card);
      }
    });
  }, { threshold: 0.55 });
  cards.forEach(c => obs.observe(c));
})();
