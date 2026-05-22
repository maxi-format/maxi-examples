if (location.protocol === 'file:') {
  document.getElementById('status-bar').className = 'err';
  document.getElementById('status-bar').textContent =
    '✗ Open this page via the server: http://localhost:8060/browser-client/ or http://localhost:8090/';
  document.getElementById('load-btn').disabled = true;
  throw new Error('Must be served over HTTP');
}

const MAXI_LIB = 'https://esm.sh/@maxi-format/maxi';
const { parseMaxi, dumpMaxi } = await import(MAXI_LIB);

// ── Register a MAXI language for highlight.js ─────────────────────────────
hljs.registerLanguage('maxi', () => ({
  name: 'MAXI',
  contains: [
    // # comment lines  (not ###)
    { scope: 'comment',  begin: /^[ \t]*#(?!##).*$/ },
    // ### section separator — dim structural line
    { scope: 'section',  begin: /^#{3}$/ },
    // @directive:value  — e.g. @schema:sports.mxs  @version:1.0.0
    {
      scope: 'meta',
      begin: /^@[a-zA-Z]+(?=:)/,
      end:   /$/,
      contains: [
        { scope: 'string', begin: /:.+/ },
      ],
    },
    // Type definition  P:Player(id:int|name(!)|...)
    {
      begin: /^[A-Z][A-Za-z0-9_-]*(?=:[A-Za-z])/,
      end:   /\)$/,
      contains: [
        { scope: 'keyword',     begin: /^[A-Z][A-Za-z0-9_-]*/ },
        { scope: 'title.class', begin: /(?<=:)[A-Za-z][A-Za-z0-9_]*(?=\()/ },
        { scope: 'params',      begin: /\(/, end: /\)/ },
      ],
    },
    // Record line  P(1|"Alice"|forward|1998|1)
    {
      begin: /^[A-Z][A-Za-z0-9_-]*(?=\()/,
      end:   /\)$/,
      contains: [
        { scope: 'title.function', begin: /^[A-Z][A-Za-z0-9_-]*/ },
        { scope: 'literal',        begin: /~/ },
        { scope: 'string',         begin: /"/, end: /"/ },
        { scope: 'number',         begin: /\b\d[\d.]*\b/ },
        { scope: 'punctuation',    begin: /\|/ },
        { scope: 'subst',          begin: /\[/, end: /\]/ },
      ],
    },
  ],
}));

// ── Backend selector ───────────────────────────────────────────────────────
const backendSelect = document.getElementById('backend-select');
const baseUrlInput  = document.getElementById('base-url');
const customLabel   = document.getElementById('custom-url-label');

function getBaseUrl() {
  return backendSelect.value === 'custom'
    ? baseUrlInput.value.replace(/\/$/, '')
    : backendSelect.value;
}

backendSelect.addEventListener('change', () => {
  const isCustom = backendSelect.value === 'custom';
  baseUrlInput.style.display  = isCustom ? '' : 'none';
  customLabel.style.display   = isCustom ? '' : 'none';
  if (!isCustom) baseUrlInput.value = backendSelect.value;
});

// ── Schema loader ──────────────────────────────────────────────────────────
const schemaCache = {};
async function loadSchema(name) {
  const cacheKey = getBaseUrl() + '/' + name;
  if (schemaCache[cacheKey]) return schemaCache[cacheKey];
  const res = await fetch(`${getBaseUrl()}/schema/${name}`);
  if (!res.ok) throw new Error(`Schema load failed: ${res.status}`);
  const text = await res.text();
  schemaCache[cacheKey] = text;
  return text;
}

const BASE = () => getBaseUrl();

// ── Schema-aware MAXI highlighter ─────────────────────────────────────────
function parseFieldMeta(schemaText) {
  const aliases = new Set();
  for (const line of schemaText.split('\n')) {
    const m = line.match(/^([A-Z][A-Za-z0-9_-]*):[A-Za-z]/);
    if (m) aliases.add(m[1]);
  }
  const refs  = new Map();
  const enums = new Map();
  for (const line of schemaText.split('\n')) {
    const m = line.match(/^([A-Z][A-Za-z0-9_-]*):[A-Za-z][A-Za-z0-9_]*\((.+)\)/);
    if (!m) continue;
    const typeAlias = m[1];
    const refIdxs  = new Set();
    const enumIdxs = new Set();
    m[2].split('|').forEach((f, i) => {
      const t = f.match(/(?<=:)[^\[!@(]+(\[[^\]]*\])?/);
      if (!t) return;
      const expr = t[0].replace(/[(!].*/, '').trim();
      if (aliases.has(expr))          refIdxs.add(i);
      else if (expr.startsWith('enum')) enumIdxs.add(i);
    });
    if (refIdxs.size)  refs.set(typeAlias, refIdxs);
    if (enumIdxs.size) enums.set(typeAlias, enumIdxs);
  }
  return { refs, enums };
}

const REF_OPEN   = '\x02REF\x03';
const REF_CLOSE  = '\x02/REF\x03';
const ENUM_OPEN  = '\x02ENUM\x03';
const ENUM_CLOSE = '\x02/ENUM\x03';

function splitFields(fieldsStr) {
  const out = [];
  let depth = 0, cur = '';
  for (const ch of fieldsStr) {
    if      (ch === '(' || ch === '[') { depth++; cur += ch; }
    else if (ch === ')' || ch === ']') { depth--; cur += ch; }
    else if (ch === '|' && depth === 0) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function annotateRecord(line, refs, enums) {
  const m = line.match(/^([A-Z][A-Za-z0-9_-]*)\((.+)\)$/s);
  if (!m) return line;
  const alias    = m[1];
  const refIdxs  = refs?.get(alias)  ?? new Set();
  const enumIdxs = enums?.get(alias) ?? new Set();
  if (!refIdxs.size && !enumIdxs.size) return line;
  const fields = splitFields(m[2]);
  const out = fields.map((f, i) => {
    if (refIdxs.has(i)  && /^\d+$/.test(f.trim())) return REF_OPEN  + f + REF_CLOSE;
    if (enumIdxs.has(i) && f.trim() !== '~')        return ENUM_OPEN + f + ENUM_CLOSE;
    return f;
  });
  return `${alias}(${out.join('|')})`;
}

function highlightMaxi(text, meta) {
  const src = meta
    ? text.split('\n').map(l => annotateRecord(l, meta.refs, meta.enums)).join('\n')
    : text;
  let html = hljs.highlight(src, { language: 'maxi' }).value;
  html = html
    .replaceAll(REF_OPEN,   '<span class="hljs-ref">')
    .replaceAll(REF_CLOSE,  '</span>')
    .replaceAll(ENUM_OPEN,  '<span class="hljs-enum">')
    .replaceAll(ENUM_CLOSE, '</span>');
  return html;
}

let _fieldMeta = null;
async function getFieldMeta() {
  if (_fieldMeta) return _fieldMeta;
  try {
    const schema = await loadSchema('sports.mxs');
    _fieldMeta = parseFieldMeta(schema);
  } catch { _fieldMeta = { refs: new Map(), enums: new Map() }; }
  return _fieldMeta;
}

// ── Wire panel builders ────────────────────────────────────────────────────
function buildWirePanel(entries, summaryLabel = 'wire') {
  const entryHtml = entries.map(e => {
    const methodCls = `method-${e.method.toLowerCase()}`;
    const statusCls = e.status < 400 ? 'status-2xx' : 'status-4xx';

    let inner = '';
    if (e.requestBody != null) {
      inner += `
        <div class="wire-entry-label req">
          <span class="method-badge ${methodCls}">${e.method}</span>
          <span class="url-text">${esc(e.url)}</span>
        </div>
        <pre><code class="hljs language-maxi">${highlightMaxi(e.requestBody, e.meta)}</code></pre>`;
    }
    inner += `
      <div class="wire-entry-label res" style="${e.requestBody ? 'margin-top:.5rem' : ''}">
        ${e.requestBody ? '' : `<span class="method-badge ${methodCls}">${e.method}</span>
        <span class="url-text">${esc(e.url)}</span>`}
        <span class="status-badge ${statusCls}">HTTP ${e.status}</span>
      </div>
      <pre><code class="hljs language-maxi">${highlightMaxi(e.responseBody, e.meta)}</code></pre>`;

    return `<div class="wire-entry">${inner}</div>`;
  }).join('');

  return `
    <div class="wire-panel">
      <details>
        <summary>
          ${summaryLabel === 'wire' ? '⬡ MAXI wire' : esc(summaryLabel)}
          <span style="color:#1e3a5f;margin-left:auto;font-size:0.65rem">${entries.length} exchange${entries.length > 1 ? 's' : ''}</span>
        </summary>
        <div class="wire-entries">${entryHtml}</div>
      </details>
    </div>`;
}

async function fetchMaxi(path) {
  const url  = BASE() + path;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  const text = await res.text();
  const [parsed, meta] = await Promise.all([
    parseMaxi(text, { loadSchema }),
    getFieldMeta(),
  ]);
  return { parsed, raw: text, url, status: res.status, meta };
}

// ── Helpers ────────────────────────────────────────────────────────────────
function pill(value, map) {
  const cls = map[value] ?? '';
  return `<span class="pill ${cls}">${value ?? '~'}</span>`;
}

const POSITION_MAP = {
  forward: 'pill-forward', midfielder: 'pill-midfielder',
  defender: 'pill-defender', goalkeeper: 'pill-goalkeeper',
};
const STATUS_MAP = {
  finished: 'pill-finished', scheduled: 'pill-scheduled',
  live: 'pill-live', cancelled: 'pill-cancelled',
};

function esc(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Card builders ──────────────────────────────────────────────────────────
function buildCard({ title, endpoint, thead, tbodyRows, wireEntries, note }) {
  const rowsHtml = tbodyRows.length
    ? tbodyRows.map(cells => `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${thead.length}" class="empty">No records</td></tr>`;
  return `
    <div class="card">
      <div class="card-header">
        <div>
          <h2>${esc(title)}</h2>
          <span class="endpoint">GET ${esc(endpoint)}</span>
        </div>
        <div style="display:flex;gap:.5rem;align-items:center">
          <span class="count">${tbodyRows.length} record${tbodyRows.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <div class="card-body">
        <table>
          <thead><tr>${thead.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
      ${note ? `<div class="transfers-note">${note}</div>` : ''}
      ${buildWirePanel(wireEntries)}
    </div>`;
}

function buildTeams({ parsed, raw, url, status, meta }) {
  const rows = parsed.records
    .filter(r => r.alias === 'T')
    .map(r => {
      const [id, name, city, founded, coach] = r.values;
      return [esc(id), esc(name), esc(city), esc(founded), esc(coach)];
    });
  return buildCard({
    title: 'Teams', endpoint: '/teams',
    thead: ['ID', 'Name', 'City', 'Founded', 'Coach'],
    tbodyRows: rows,
    wireEntries: [{ method: 'GET', url, status, responseBody: raw, meta }],
  });
}

function buildGames({ parsed, raw, url, status, meta }) {
  const rows = parsed.records
    .filter(r => r.alias === 'G')
    .map(r => {
      const [id, homeTeam, awayTeam, date, st, hs, as_] = r.values;
      return [
        esc(id), esc(homeTeam?.name ?? homeTeam), esc(awayTeam?.name ?? awayTeam), esc(date),
        pill(st, STATUS_MAP),
        `<span class="score">${esc(hs)} – ${esc(as_)}</span>`,
      ];
    });
  return buildCard({
    title: 'Games', endpoint: '/games',
    thead: ['ID', 'Home Team', 'Away Team', 'Date', 'Status', 'Score'],
    tbodyRows: rows,
    wireEntries: [{ method: 'GET', url, status, responseBody: raw, meta }],
  });
}

function buildTransfers({ parsed, raw, url, status, meta }) {
  const rows = parsed.records
    .filter(r => r.alias === 'X')
    .map(r => {
      const [id, player, fromTeam, toTeam, date, fee] = r.values;
      const playerName   = player?.name   ?? `#${player}`;
      const fromTeamName = fromTeam?.name ?? `#${fromTeam}`;
      const toTeamName   = toTeam?.name   ?? `#${toTeam}`;
      const feeHtml = (fee != null && fee !== '')
        ? `<span class="fee">€${Number(fee).toLocaleString()}</span>`
        : `<span class="free-transfer">free</span>`;
      return [
        esc(id), esc(playerName),
        `${esc(fromTeamName)}<span class="arrow">→</span>${esc(toTeamName)}`,
        esc(date), feeHtml,
      ];
    });

  const note = `ℹ️ Object references: each Player and Team is declared once in the MAXI response - ` +
               `Transfer records reference them by id. The parser resolves them into full objects automatically.`;

  return buildCard({
    title: 'Transfers', endpoint: '/transfers',
    thead: ['ID', 'Player', 'From → To', 'Date', 'Fee'],
    tbodyRows: rows, note,
    wireEntries: [{ method: 'GET', url, status, responseBody: raw, meta }],
  });
}

const T_PLAYER_DEF = {
  alias: 'P', name: 'Player',
  fields: [
    { name: 'id',        typeExpr: 'int' },
    { name: 'name',      constraints: [{ type: 'required' }] },
    { name: 'position',  typeExpr: 'enum[forward,midfielder,defender,goalkeeper]' },
    { name: 'birthYear', typeExpr: 'int' },
    { name: 'team',      typeExpr: 'T' },
  ],
};

function buildPlayerMaxi(player) {
  return dumpMaxi([player], {
    schemaFile: 'sports.mxs',
    defaultAlias: 'P',
    includeTypes: false,
    types: [T_PLAYER_DEF],
  });
}

async function createPlayer(player) {
  const body = buildPlayerMaxi(player);
  const res  = await fetch(`${BASE()}/players`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/maxi' },
    body,
  });
  const text   = await res.text();
  const parsed = await parseMaxi(text, { loadSchema });
  return { values: parsed.records[0].values, requestBody: body, responseBody: text, status: res.status };
}

async function updatePlayer(id, player) {
  const body = buildPlayerMaxi({ ...player, id });
  const res  = await fetch(`${BASE()}/players/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/maxi' },
    body,
  });
  const text   = await res.text();
  const parsed = await parseMaxi(text, { loadSchema });
  return { values: parsed.records[0].values, requestBody: body, responseBody: text, status: res.status };
}

async function deletePlayer(id) {
  const res = await fetch(`${BASE()}/players/${id}`, { method: 'DELETE' });
  if (res.status !== 204 && !res.ok) throw new Error(`DELETE /players/${id} → HTTP ${res.status}`);
  return res.status;
}

function buildPlayers({ parsed, raw, url, status, meta }) {
  const records = parsed.records.filter(r => r.alias === 'P');
  const tbodyRows = records.map(r => {
    const [id, name, pos, year, team] = r.values;
    const teamName = team?.name ?? String(team ?? '');
    const teamId   = team?.id   ?? team;
    return `<tr data-player-id="${id}">
      <td>${esc(String(id))}</td>
      <td>${esc(name)}</td>
      <td>${pill(pos, POSITION_MAP)}</td>
      <td>${esc(String(year))}</td>
      <td>${esc(teamName)}</td>
      <td><button class="btn-edit" data-action="edit-open"
          data-id="${id}" data-name="${esc(name)}" data-position="${esc(pos)}"
          data-birth-year="${esc(String(year))}" data-team-id="${esc(String(teamId))}">Edit</button>
          <button class="btn-delete" data-action="delete" data-id="${id}">✕</button></td>
    </tr>`;
  }).join('');

  return `
    <div class="card" id="card-players">
      <div class="card-header">
        <div>
          <h2>Players</h2>
          <span class="endpoint">GET /players</span>
        </div>
        <div style="display:flex;gap:.5rem;align-items:center">
          <span class="count" id="players-count">${records.length} record${records.length !== 1 ? 's' : ''}</span>
          <button class="create-toggle" id="create-player-btn">＋ New Player</button>
        </div>
      </div>
      <div class="card-body">
        <table id="players-table">
          <thead><tr>
            <th>ID</th><th>Name</th><th>Position</th><th>Birth Year</th><th>Team</th><th></th>
          </tr></thead>
          <tbody id="players-tbody">
            ${tbodyRows}
          </tbody>
        </table>
      </div>
      <div class="wire-panel" id="players-wire-panel">
        <details id="players-wire-details">
          <summary>
            ⬡ MAXI wire
            <span id="players-wire-count" style="color:#1e3a5f;margin-left:auto;font-size:0.65rem">1 exchange</span>
          </summary>
          <div class="wire-entries" id="players-wire-entries">
            ${buildWireEntry({ method: 'GET', url, status, responseBody: raw, meta })}
          </div>
        </details>
      </div>
    </div>`;
}

function buildWireEntry(e) {
  const methodCls = `method-${e.method.toLowerCase()}`;
  const statusCls = e.status < 400 ? 'status-2xx' : 'status-4xx';
  let inner = '';
  if (e.requestBody != null) {
    inner += `
      <div class="wire-entry-label req">
        <span class="method-badge ${methodCls}">${e.method}</span>
        <span class="url-text">${esc(e.url ?? '')}</span>
      </div>
      <pre><code class="hljs language-maxi">${highlightMaxi(e.requestBody, e.meta)}</code></pre>`;
  }
  inner += `
    <div class="wire-entry-label res" style="${e.requestBody ? 'margin-top:.5rem' : ''}">
      ${e.requestBody ? '' : `<span class="method-badge ${methodCls}">${e.method}</span>
      <span class="url-text">${esc(e.url ?? '')}</span>`}
      <span class="status-badge ${statusCls}">HTTP ${e.status}</span>
    </div>
    <pre><code class="hljs language-maxi">${highlightMaxi(e.responseBody, e.meta)}</code></pre>`;
  return `<div class="wire-entry">${inner}</div>`;
}

async function loadAll() {
  const btn    = document.getElementById('load-btn');
  const status = document.getElementById('status-bar');
  const reload = document.getElementById('reload-btn');

  btn.disabled = true;
  status.className = '';
  status.textContent = 'Fetching data…';
  Object.keys(schemaCache).forEach(k => delete schemaCache[k]);

  try {
    const [players, teams, games, transfers] = await Promise.all([
      fetchMaxi('/players'),
      fetchMaxi('/teams'),
      fetchMaxi('/games'),
      fetchMaxi('/transfers'),
    ]);

    const html =
      buildPlayers(players) +
      buildTeams(teams) +
      buildGames(games) +
      buildTransfers(transfers);

    document.getElementById('sections').innerHTML = html;
    wirePlayers();

    status.className = 'ok';
    status.textContent = `✓ Loaded from ${BASE()} — ${new Date().toLocaleTimeString()}`;
    btn.style.display = 'none';
    reload.style.display = '';
  } catch (err) {
    status.className = 'err';
    status.textContent = `✗ ${err.message}`;
    btn.disabled = false;
  }
}

const POSITIONS = ['forward', 'midfielder', 'defender', 'goalkeeper'];

function playerFormHtml(id, { name = '', position = 'forward', birthYear = '', teamId = '' } = {}, mode = 'create') {
  const posOptions = POSITIONS.map(p =>
    `<option value="${p}" ${p === position ? 'selected' : ''}>${p}</option>`).join('');
  return `
    <tr class="form-row-tr" data-form-id="${id}">
      <td colspan="6" style="padding:0">
        <div class="form-row">
          ${mode === 'edit' ? `<input class="w-id" value="${id}" disabled title="ID (assigned by server)" />` : ''}
          <input  class="w-name"  placeholder="Name"       value="${esc(name)}"      data-field="name" />
          <select class="w-pos"   data-field="position">${posOptions}</select>
          <input  class="w-year"  placeholder="Birth year" value="${esc(birthYear)}" data-field="birthYear" type="number" />
          <input  class="w-year"  placeholder="Team ID"    value="${esc(teamId)}"    data-field="teamId"    type="number" />
          <button class="btn-save  btn-${mode}" data-action="${mode}" data-id="${id}">
            ${mode === 'create' ? '＋ Create' : '✓ Save'}
          </button>
          <button class="btn-cancel btn-cancel-form" data-id="${id}">✕</button>
        </div>
        <div class="maxi-preview" id="preview-${id}"></div>
      </td>
    </tr>`;
}

function wirePlayers() {
  const card = document.getElementById('card-players');
  if (!card) return;

  card.addEventListener('input', e => {
    const row = e.target.closest('.form-row-tr');
    if (!row) return;
    updatePreview(row);
  });

  document.getElementById('create-player-btn')?.addEventListener('click', () => {
    const tbody = document.getElementById('players-tbody');
    if (tbody.querySelector('[data-form-id="new"]')) return;
    tbody.insertAdjacentHTML('beforeend', playerFormHtml('new', {}, 'create'));
    updatePreview(tbody.querySelector('[data-form-id="new"]'));
  });

  card.addEventListener('click', async e => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === 'delete') {
      const id = btn.dataset.id;
      if (!confirm(`Delete player #${id}?`)) return;
      btn.disabled = true;
      try {
        await deletePlayer(id);
        card.querySelector(`tr[data-player-id="${id}"]`)?.remove();
        updateCount();
        setStatus(`✓ Player #${id} deleted`, 'ok');
        appendWireEntry({ method: 'DELETE', url: `${BASE()}/players/${id}`, status: 204, responseBody: '(204 No Content)' });
      } catch (err) {
        setStatus(`✗ ${err.message}`, 'err');
        btn.disabled = false;
      }
      return;
    }

    if (action === 'edit-open') {
      const id = btn.dataset.id;
      card.querySelectorAll('.form-row-tr').forEach(r => r.remove());
      const playerRow = card.querySelector(`tr[data-player-id="${id}"]`);
      if (!playerRow) return;
      playerRow.insertAdjacentHTML('afterend', playerFormHtml(id, {
        name:      btn.dataset.name,
        position:  btn.dataset.position,
        birthYear: btn.dataset.birthYear,
        teamId:    btn.dataset.teamId,
      }, 'edit'));
      updatePreview(card.querySelector(`[data-form-id="${id}"]`));
      return;
    }

    if (action === 'cancel' || btn.classList.contains('btn-cancel-form')) {
      btn.closest('.form-row-tr')?.remove();
      return;
    }

    if (action === 'create') {
      const formRow = btn.closest('.form-row-tr');
      const data    = collectFormData(formRow);
      btn.disabled  = true; btn.textContent = '…';
      try {
        const meta = await getFieldMeta();
        const { values: vals, requestBody, responseBody, status } = await createPlayer({ id: 0, ...data });
        formRow.remove();
        appendPlayerRow(vals);
        setStatus(`✓ Player "${vals[1]}" created (id ${vals[0]})`, 'ok');
        appendWireEntry({ method: 'POST', url: `${BASE()}/players`, status, requestBody, responseBody, meta });
      } catch (err) {
        setStatus(`✗ ${err.message}`, 'err');
        btn.disabled = false; btn.textContent = '＋ Create';
      }
      return;
    }

    if (action === 'edit') {
      const id      = btn.dataset.id;
      const formRow = btn.closest('.form-row-tr');
      const data    = collectFormData(formRow);
      btn.disabled  = true; btn.textContent = '…';
      try {
        const meta = await getFieldMeta();
        const { values: vals, requestBody, responseBody, status } = await updatePlayer(id, data);
        formRow.remove();
        refreshPlayerRow(id, vals);
        setStatus(`✓ Player "${vals[1]}" updated`, 'ok');
        appendWireEntry({ method: 'PUT', url: `${BASE()}/players/${id}`, status, requestBody, responseBody, meta });
      } catch (err) {
        setStatus(`✗ ${err.message}`, 'err');
        btn.disabled = false; btn.textContent = '✓ Save';
      }
    }
  });
}

function appendWireEntry(e) {
  const entries = document.getElementById('players-wire-entries');
  const details = document.getElementById('players-wire-details');
  const countEl = document.getElementById('players-wire-count');
  if (!entries) return;
  entries.insertAdjacentHTML('beforeend', buildWireEntry(e));
  details.open = true;
  const n = entries.querySelectorAll('.wire-entry').length;
  if (countEl) countEl.textContent = `${n} exchange${n > 1 ? 's' : ''}`;
}

function collectFormData(formRow) {
  const get = f => formRow.querySelector(`[data-field="${f}"]`)?.value ?? '';
  return {
    name:      get('name'),
    position:  get('position'),
    birthYear: Number(get('birthYear')) || 0,
    team:      Number(get('teamId'))    || 0,
  };
}

function updatePreview(formRow) {
  const previewId = formRow.dataset.formId;
  const preview   = document.getElementById(`preview-${previewId}`);
  if (!preview) return;
  try {
    const data  = collectFormData(formRow);
    const maxi  = buildPlayerMaxi({ id: previewId === 'new' ? 0 : Number(previewId), ...data });
    preview.textContent = maxi.split('\n').slice(-2).join('\n');
  } catch { preview.textContent = ''; }
}

function appendPlayerRow(vals) {
  const [id, name, pos, year, team] = vals;
  const teamName = team?.name ?? String(team ?? '');
  const teamId   = team?.id   ?? team;
  const tbody = document.getElementById('players-tbody');
  tbody.insertAdjacentHTML('beforeend', `<tr data-player-id="${id}">
    <td>${esc(String(id))}</td>
    <td>${esc(name)}</td>
    <td>${pill(pos, POSITION_MAP)}</td>
    <td>${esc(String(year))}</td>
    <td>${esc(teamName)}</td>
    <td><button class="btn-edit" data-action="edit-open"
        data-id="${id}" data-name="${esc(name)}" data-position="${esc(pos)}"
        data-birth-year="${esc(String(year))}" data-team-id="${esc(String(teamId))}">Edit</button>
        <button class="btn-delete" data-action="delete" data-id="${id}">✕</button></td>
  </tr>`);
  updateCount();
}

function refreshPlayerRow(id, vals) {
  const [, name, pos, year, team] = vals;
  const teamName = team?.name ?? String(team ?? '');
  const teamId   = team?.id   ?? team;
  const row = document.querySelector(`tr[data-player-id="${id}"]`);
  if (!row) return;
  row.cells[1].textContent = name;
  row.cells[2].innerHTML   = pill(pos, POSITION_MAP);
  row.cells[3].textContent = year;
  row.cells[4].textContent = teamName;
  const editBtn = row.cells[5].querySelector('button');
  if (editBtn) {
    editBtn.dataset.name      = name;
    editBtn.dataset.position  = pos;
    editBtn.dataset.birthYear = year;
    editBtn.dataset.teamId    = String(teamId);
  }
}

function updateCount() {
  const tbody = document.getElementById('players-tbody');
  const n = tbody ? tbody.querySelectorAll('tr[data-player-id]').length : 0;
  const el = document.getElementById('players-count');
  if (el) el.textContent = `${n} record${n !== 1 ? 's' : ''}`;
}

function setStatus(msg, cls) {
  const el = document.getElementById('status-bar');
  el.className = cls;
  el.textContent = msg;
}

document.getElementById('load-btn').addEventListener('click', loadAll);
document.getElementById('reload-btn').addEventListener('click', loadAll);
