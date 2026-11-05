/* Conexión a Supabase con la misma forma de uso que tenía la app en Claude:
   DB.collection('x').onSnapshot(...), .doc(id).set/update/delete, .add(...)
   Todo se guarda en la tabla public.docs (coleccion, id, data). */
(function () {
  const cfg = window.APP_CONFIG || {};
  const listeners = {};          // coleccion -> Set(fn)
  const cache = {};              // coleccion -> Map(id -> data)
  const loading = {};            // coleccion -> Promise
  let sb = null, channel = null;

  const err = (code, message) => Object.assign(new Error(message || code), { code });
  const newId = () => {
    const a = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let s = ''; const r = crypto.getRandomValues(new Uint8Array(20));
    for (const x of r) s += a[x % a.length]; return s;
  };
  const snapDoc = (id, data) => ({ id, exists: data !== undefined, data: () => data, metadata: { fromCache: false, hasPendingWrites: false } });
  function emit(col) {
    const m = cache[col] || new Map();
    const docs = [...m.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([id, d]) => snapDoc(id, d));
    const snap = { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } };
    (listeners[col] || new Set()).forEach(fn => { try { fn(snap) } catch (e) { console.error(e) } });
  }
  async function load(col) {
    if (loading[col]) return loading[col];
    loading[col] = (async () => {
      const m = new Map(); let from = 0; const page = 1000;
      for (;;) {
        const { data, error } = await sb.from('docs').select('id,data').eq('coleccion', col).range(from, from + page - 1);
        if (error) throw err('unavailable', error.message);
        data.forEach(r => m.set(r.id, r.data));
        if (data.length < page) break; from += page;
      }
      cache[col] = m; emit(col);
    })();
    try { await loading[col] } catch (e) { loading[col] = null; throw e }
  }
  function startRealtime() {
    if (channel) return;
    channel = sb.channel('docs-cambios')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'docs' }, p => {
        const row = (p.eventType === 'DELETE' ? p.old : p.new) || {};
        const col = row.coleccion; if (!col || !cache[col]) return;
        if (p.eventType === 'DELETE') cache[col].delete(row.id); else cache[col].set(row.id, row.data);
        emit(col);
      })
      .subscribe();
    // si la conexión en vivo se corta, refrescar al volver a la app
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') Object.keys(cache).forEach(c => { loading[c] = null; load(c).catch(() => {}) });
    });
  }
  async function write(col, id, data) {
    const prev = cache[col] && cache[col].get(id);
    if (cache[col]) { cache[col].set(id, data); emit(col) }
    const { error } = await sb.from('docs').upsert({ coleccion: col, id, data }, { onConflict: 'coleccion,id' });
    if (error) {
      if (cache[col]) { prev === undefined ? cache[col].delete(id) : cache[col].set(id, prev); emit(col) }
      throw err(/row-level|permission/i.test(error.message) ? 'invalid_argument' : 'unavailable', error.message);
    }
  }
  function docRef(col, id) {
    return {
      id, path: col + '/' + id,
      async get() { if (!cache[col]) await load(col); return snapDoc(id, cache[col].get(id)) },
      set(data) { return write(col, id, JSON.parse(JSON.stringify(data))) },
      async update(data) {
        if (!cache[col]) await load(col);
        const cur = cache[col].get(id);
        if (cur === undefined) throw err('invalid_argument', 'El documento no existe');
        return write(col, id, { ...cur, ...JSON.parse(JSON.stringify(data)) });
      },
      async delete() {
        const prev = cache[col] && cache[col].get(id);
        if (cache[col]) { cache[col].delete(id); emit(col) }
        const { error } = await sb.from('docs').delete().eq('coleccion', col).eq('id', id);
        if (error) { if (cache[col] && prev !== undefined) { cache[col].set(id, prev); emit(col) } throw err('unavailable', error.message) }
      },
      onSnapshot(next, onError) {
        return collRef(col).onSnapshot(s => next(snapDoc(id, cache[col].get(id))), onError);
      }
    };
  }
  function collRef(col) {
    return {
      path: col,
      doc(id) { return docRef(col, id || newId()) },
      async add(data) { const id = newId(); await write(col, id, JSON.parse(JSON.stringify(data))); return docRef(col, id) },
      async get() { if (!cache[col]) await load(col); const docs = [...cache[col].entries()].map(([i, d]) => snapDoc(i, d)); return { docs, size: docs.length, empty: !docs.length } },
      onSnapshot(next, onError) {
        (listeners[col] = listeners[col] || new Set()).add(next);
        if (cache[col]) setTimeout(() => next({ docs: [...cache[col].entries()].map(([i, d]) => snapDoc(i, d)), size: cache[col].size, empty: !cache[col].size, docChanges: () => [], metadata: {} }), 0);
        else load(col).catch(e => onError && onError(e));
        return () => listeners[col].delete(next);
      }
    };
  }
  const DB = {
    collection: c => collRef(c),
    doc: path => { const [c, id] = path.split('/'); return docRef(c, id) }
  };

  // ---------- inicio de sesión ----------
  window.DBReady = new Promise(resolve => {
    function fail(msg) { const b = document.getElementById('login-msg'); if (b) { b.textContent = msg; b.hidden = false } }
    if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || /PEGAR/.test(cfg.SUPABASE_URL)) {
      document.getElementById('login').hidden = false; window.splashOff && window.splashOff();
      fail('Falta configurar config.js con la URL y la clave de Supabase (ver la guía).');
      return;
    }
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
    window.SB = sb;
    const login = document.getElementById('login');
    async function enter(session) {
      // verificar que el usuario sea administrador
      const { data, error } = await sb.from('app_admins').select('email').limit(1);
      if (error || !data || !data.length) {
        await sb.auth.signOut();
        login.hidden = false; window.splashOff && window.splashOff();
        fail('Este usuario no tiene permiso. Cargá tu mail en 03_tu_usuario.sql (ver la guía).');
        return;
      }
      login.hidden = true; document.getElementById('app').hidden = false;
      document.getElementById('user-mail').textContent = session.user.email || '';
      startRealtime(); resolve(DB);
    }
    sb.auth.getSession().then(({ data }) => {
      if (data.session) enter(data.session); else login.hidden = false; window.splashOff && window.splashOff();
    });
    document.getElementById('login-form').addEventListener('submit', async ev => {
      ev.preventDefault();
      const btn = ev.target.querySelector('button'); btn.disabled = true;
      const { data, error } = await sb.auth.signInWithPassword({ email: document.getElementById('login-email').value.trim(), password: document.getElementById('login-pass').value });
      btn.disabled = false;
      if (error) { fail('Mail o contraseña incorrectos.'); return }
      enter(data.session);
    });
    document.getElementById('logout').addEventListener('click', async () => { await sb.auth.signOut(); location.reload() });
  });
})();
