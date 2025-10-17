// ==UserScript==
// @name         Pekora Profile — UI Tweaks + Settings
// @namespace    https://www.pekora.zip/
// @version      1.0
// @description  Render Pekora profiles with a customizable UI: theme, avatar size, compact mode, collectibles toggle, font size. Saves prefs to localStorage.
// @match        https://www.pekora.zip/users/*/profile
// @grant        none
// @run-at       document_idle
// ==/UserScript==

(function(){
  'use strict';

  /* -----------------------------
     CONFIG / default UI variables
     ----------------------------- */
  const DEFAULTS = {
    theme: 'dark',           // 'dark' or 'light'
    avatarSize: 112,         // px
    compact: false,          // compact mode (less spacing, hide bio/collectibles)
    showCollectibles: false,
    fontSize: 14             // base font size in px
  };

  const STORAGE_KEY = 'pekora_ui_prefs_v1';

  function loadPrefs(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {...DEFAULTS};
      const parsed = JSON.parse(raw);
      return {...DEFAULTS, ...parsed};
    } catch(e) { return {...DEFAULTS}; }
  }
  function savePrefs(p){ localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); }

  let prefs = loadPrefs();

  /* -----------------------------
     Helpers: escape, date format
     ----------------------------- */
  const esc = s => String(s == null ? '' : s)
    .replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);

  function fdate(iso){
    try { return new Date(iso).toLocaleString(); } catch(e){ return iso || 'N/A'; }
  }

  /* -----------------------------
     Find userId (same robust finder)
     ----------------------------- */
  function findUserId(){
    const urlMatch = window.location.pathname.match(/\/users\/(\d+)\/profile/);
    if (urlMatch && urlMatch[1]) return urlMatch[1];
    const el = document.querySelector('[data-userid], [data-user-id], [data-id]');
    if (el) {
      const v = el.getAttribute('data-userid') || el.getAttribute('data-user-id') || el.getAttribute('data-id');
      if (v && /^\d+$/.test(v)) return v;
    }
    const link = Array.from(document.querySelectorAll('a[href*="/users/"]')).find(a => /\/users\/\d+/.test(a.href));
    if (link) {
      const m = link.href.match(/\/users\/(\d+)/);
      if (m && m[1]) return m[1];
    }
    const img = Array.from(document.querySelectorAll('img[src*="avatar.ashx"], img[src*="userId="]')).find(i => i.src && /userId=\d+/.test(i.src));
    if (img) {
      const mm = img.src.match(/userId=(\d+)/);
      if (mm && mm[1]) return mm[1];
    }
    const bodyMatch = document.body.innerText.match(/\bUser\s*ID[: ]+(\d{3,12})\b/i) || document.body.innerText.match(/\bID[: ]+(\d{3,12})\b/);
    if (bodyMatch && bodyMatch[1]) return bodyMatch[1];
    // no prompt fallback here - prefer explicit paste if not found
    console.warn('[Pekora UI] Could not auto-detect userId.');
    return null;
  }

  const userId = findUserId();
  if (!userId) return;

  const PROFILE_API = `https://www.pekora.zip/apisite/users/v1/users/${userId}`;
  const COLLECTIBLES_API = `https://www.pekora.zip/internal/collectibles?userId=${userId}`;
  const AVATAR_THUMB = `https://www.pekora.zip/thumbs/avatar.ashx?userId=${userId}`;

  /* -----------------------------
     Inject CSS (uses CSS variables for quick tweaks)
     ----------------------------- */
  function injectCss(){
    const existing = document.getElementById('pekora-ui-style');
    if (existing) existing.remove();

    // variable values depend on prefs
    const avatar = prefs.avatarSize + 'px';
    const baseFont = prefs.fontSize + 'px';

    const darkVars = `
      --bg: #071025;
      --card: linear-gradient(180deg,#081522,#07131d);
      --text: #e6eef8;
      --muted: #9fb0c9;
      --accent: #1e90ff;
      --danger: #ff3b3b;
      --glass: rgba(255,255,255,0.02);
      --gap: 12px;
      --radius: 10px;
    `;
    const lightVars = `
      --bg: #f6f8fb;
      --card: linear-gradient(180deg,#ffffff,#f7fbff);
      --text: #0b1b2b;
      --muted: #5b6b7a;
      --accent: #0b7cff;
      --danger: #d33b3b;
      --glass: rgba(9,18,28,0.03);
      --gap: 12px;
      --radius: 8px;
    `;

    const vars = prefs.theme === 'light' ? lightVars : darkVars;

    const css = `
      :root {
        ${vars}
        --avatar-size: ${avatar};
        --base-font: ${baseFont};
      }

#pekora-profile-restore {
    max-width: 1400px;   /* make it very wide */
    margin: 30px auto;
    padding: 40px;       /* reduce from 100px so content fits better */
    border-radius: var(--radius);
    background: var(--card);
    color: var(--text);
    font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial;
    font-size: var(--base-font);
    box-shadow: 0 10px 30px rgba(2,6,23,0.6);
    z-index: 999999;
}


#pekora-profile-restore .top {
    display: flex;
    gap: var(--gap);
    align-items: flex-start;
    justify-content: flex-start; /* keep things aligned to left */
}

      #pekora-profile-restore .avatar {
        width: var(--avatar-size);
        height: var(--avatar-size);
        border-radius: 10px;
        object-fit: cover;
        border: 2px solid rgba(255,255,255,0.04);
        flex-shrink:0;
      }

      #pekora-profile-restore .meta .display {
        font-weight: 800;
        font-size: calc(var(--base-font) * 1.4);
      }

      #pekora-profile-restore .meta .handle {
        color: var(--muted);
      }

      #pekora-profile-restore .badges {
        margin-top:6px;
        display:flex;
        gap:8px;
        flex-wrap:wrap;
      }

      .badge {
        padding:6px 8px;
        border-radius:8px;
        font-weight:700;
        font-size: calc(var(--base-font) * 0.9);
      }
      .badge.banned { background: var(--danger); color: #fff; }
      .badge.active { background: var(--accent); color: #fff; }
      .stat-row { margin-top:10px; display:flex; gap:18px; color:var(--muted); flex-wrap:wrap; }

      .bio {
        margin-top:12px;
        padding:12px;
        background: var(--glass);
        border-radius:8px;
        white-space: pre-wrap;
        color: var(--text);
      }

      .collectibles {
        margin-top:12px;
      }
      .collectibles .grid {
        display:flex;
        gap:8px;
        flex-wrap:wrap;
      }
      .collectibles img {
        width:64px; height:64px; border-radius:6px; object-fit:cover; border:1px solid rgba(255,255,255,0.04);
      }

      /* settings button */
      #pekora-ui-gear {
        position: absolute;
        right: 14px;
        top: 14px;
        background: transparent;
        border: none;
        color: var(--muted);
        cursor: pointer;
        font-size: calc(var(--base-font) * 1.05);
      }

      #pekora-ui-settings {
        position: absolute;
        right: 14px;
        top: 48px;
        background: var(--card);
        border-radius:8px;
        border: 1px solid rgba(255,255,255,0.03);
        padding:10px;
        box-shadow: 0 6px 18px rgba(0,0,0,0.4);
        display:none;
        min-width:220px;
      }

      #pekora-ui-settings label { display:block; font-size:12px; color:var(--muted); margin-top:8px; }
      #pekora-ui-settings input[type="range"] { width:100%; }
      #pekora-ui-settings button { margin-top:8px; padding:6px 8px; border-radius:6px; cursor:pointer; border:none; background:var(--accent); color:#fff; font-weight:700; }
      #pekora-ui-settings .row { display:flex; gap:8px; align-items:center; margin-top:8px; }

      /* compact tweaks */
      #pekora-profile-restore.compact {
        padding:8px;
      }
      #pekora-profile-restore.compact .bio,
      #pekora-profile-restore.compact .collectibles { display:none; }
    `;

    const style = document.createElement('style');
    style.id = 'pekora-ui-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* -----------------------------
     Render card and settings UI
     ----------------------------- */
function createContainerIfNeeded() {
    // Try to find Pekora's default 404 container
    let c = document.querySelector('.container-0-2-102.section-content');
    if (c) {
        // Clear the "Page Not Found" content so the profile can display there
        c.innerHTML = '';
    } else {
        // Fallback in case the structure changes or container doesn't exist
        c = document.createElement('div');
        c.className = 'container-0-2-102 section-content flex justify-content-between';
        document.body.prepend(c);
    }

    // Add an ID for styling
    c.id = 'pekora-profile-restore';
    return c;
}


function renderProfile(data) {
  // Only render for banned users
  if (!data.isBanned) return;

  const container = document.querySelector('.container-0-2-102.section-content');
  if (!container) return;
  container.innerHTML = '';

  const html = `
    <div class="profileContainer-0-2-31 container-0-2-32">
      <div class="row flex" style="gap: 40px; align-items: flex-start; flex-wrap: wrap;">
        <div class="col flex flex-column" style="max-width: 300px; align-items: center;">
          <img src="https://www.pekora.zip/thumbs/avatar.ashx?userId=${data.id}"
               alt="${data.name}"
               class="avatarContainer-0-2-142"
               style="width: 180px; height: 180px; border-radius: 16px; margin-bottom: 12px;">
          <h2 style="font-size: 28px; font-weight: 600;">${data.displayName}</h2>
          <p style="color: var(--text-color-secondary); font-size: 16px;">@${data.name}</p>

          <div class="badgeRow flex" style="gap: 6px; margin-top: 8px;">
            ${data.isBanned ? '<span class="badge" style="background:#e23; color:white; padding:4px 8px; border-radius:6px;">Banned</span>' : ''}
            ${data.hasVerifiedBadge ? '<span class="badge" style="background:#007bff; color:white; padding:4px 8px; border-radius:6px;">Verified</span>' : ''}
            ${data.isStaff ? '<span class="badge" style="background:#ffcc00; padding:4px 8px; border-radius:6px;">Staff</span>' : ''}
          </div>

          <div class="statRow flex flex-column" style="margin-top: 16px; font-size: 14px; color: var(--text-color-secondary); text-align: center;">
            <div><b>User ID:</b> ${data.id}</div>
            <div><b>Created:</b> ${new Date(data.created).toLocaleString()}</div>
            <div><b>RAP:</b> ${data.inventory_rap?.toLocaleString() ?? 'N/A'}</div>
          </div>
        </div>

        <div class="col flex flex-column" style="flex: 1; min-width: 300px;">
          <div style="margin-bottom: 24px;">
            <h3 style="font-size: 18px; font-weight: 500;">About Me</h3>
            <p style="white-space: pre-wrap; margin-top: 6px;">${data.description || 'This user has no bio.'}</p>
          </div>

          <div class="profileSections flex flex-column" style="gap: 24px;">
            <div>
              <h3 style="font-size: 18px; font-weight: 500;">Account Info</h3>
              <div class="grid flex flex-column" style="gap: 6px; margin-top: 8px;">
                <div><b>Is Banned:</b> ${data.isBanned}</div>
                <div><b>Is Staff:</b> ${data.isStaff}</div>
                <div><b>Has Verified Badge:</b> ${data.hasVerifiedBadge}</div>
                <div><b>Inventory RAP:</b> ${data.inventory_rap?.toLocaleString() ?? 'N/A'}</div>
                <div><b>Created:</b> ${new Date(data.created).toLocaleString()}</div>
              </div>
            </div>

            <div>
              <h3 style="font-size: 18px; font-weight: 500;">Friends</h3>
              <div class="grid flex" style="gap: 8px; flex-wrap: wrap; opacity: 0.5;">[Friends Placeholder]</div>
            </div>

            <div>
              <h3 style="font-size: 18px; font-weight: 500;">Groups</h3>
              <div class="grid flex" style="gap: 8px; flex-wrap: wrap; opacity: 0.5;">[Groups Placeholder]</div>
            </div>

            <div>
              <h3 style="font-size: 18px; font-weight: 500;">Badges</h3>
              <div class="grid flex" style="gap: 8px; flex-wrap: wrap; opacity: 0.5;">[Badges Placeholder]</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}


  /* -----------------------------
     Fetch data and render
     ----------------------------- */
async function fetchDataAndRender(){
    try {
        const pRes = await fetch(PROFILE_API, { headers: { Accept: 'application/json' }});
        if (!pRes.ok) throw new Error('Profile API error ' + pRes.status);
        const pdata = await pRes.json();

        let cdata = null;
        try {
            const cRes = await fetch(COLLECTIBLES_API, { headers: { Accept: 'application/json' }});
            if (cRes.ok) cdata = await cRes.json();
        } catch(e){}

        renderProfile(pdata, cdata);
    } catch (err) {
        console.error('[Pekora UI]', err);
        const c = createErrorCard(err);
        const main = document.querySelector('main') || document.body;
        main.prepend(c);
    }
}

  function createErrorCard(err){
    const div = document.createElement('div');
    div.id = 'pekora-profile-restore';
    div.style = 'max-width:900px;margin:20px auto;padding:12px;border-radius:8px;background:#2b0b0b;color:#ffdede';
    div.innerHTML = `<strong>Could not fetch profile:</strong><div style="margin-top:8px">${esc(String(err.message || err))}</div>`;
    return div;
  }

  // kick off
  fetchDataAndRender();

})();
