/* =========================================================
   REVISI GudangKita: ID otomatis, Riwayat permanen, Notifikasi,
   Riwayat Event, Detail aktivitas dashboard.
   Dimuat SETELAH script.js. Tidak mengubah fitur lama: modul ini
   "mendengarkan" setiap saveDB() lalu mencatat perubahan data.
   ========================================================= */
(function () {
    const COLL = {   // koleksi DB -> prefix ID + label jenis aktivitas
        loans:       { p: 'PMJ', label: 'Peminjaman' },
        consumables: { p: 'ATK', label: 'ATK / Habis Pakai' },
        lost:        { p: 'HLG', label: 'Barang Hilang' },
        damages:     { p: 'RSK', label: 'Barang Rusak / MT' },
        purchases:   { p: 'BRG', label: 'Barang Masuk (Pembelian)' },
        requests:    { p: 'PGJ', label: 'Pengajuan Pembelian' }
    };
    const FINAL = /dikembalikan|selesai/;
    const yr = d => String(d || new Date().toISOString()).slice(0, 4);
    const pad = n => String(n).padStart(4, '0');
    const esc = s => escapeHtml(String(s == null ? '' : s));
    const ROLE_ALL = ['staff', 'admin', 'manajemen'], ROLE_ADM = ['admin', 'manajemen'];

    // ID unik berurutan per prefix+tahun, disimpan di db.counters (tidak pernah direset)
    function nextCode(db, p, year) {
        db.counters = db.counters || {};
        const k = p + '-' + year;
        db.counters[k] = (db.counters[k] || 0) + 1;
        return k + '-' + pad(db.counters[k]);
    }
    function ensure(db) {
        db.activityLog = db.activityLog || [];
        db.notifications = db.notifications || [];
        db.counters = db.counters || {};
        db.eventMeta = db.eventMeta || {};   // evaluasi & tanggal selesai per event
        return db;
    }

    function addLog(db, o) {
        const y = yr(o.date);
        Object.keys(o).forEach(k => { if (o[k] === undefined) delete o[k]; });
        const e = Object.assign({ id: nextCode(db, 'ACT', y), ts: new Date().toISOString(),
            user: (currentUser() || {}).name || 'Sistem' }, o);
        if (isNaN(new Date(e.ts))) e.ts = new Date().toISOString();
        db.activityLog.push(e);
        return e;
    }
    function addNotif(db, text, roles, type, silent) {
        const n = { id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
            ts: new Date().toISOString(), text, roles, type: type || 'info', readBy: [] };
        db.notifications.push(n);
        if (!silent && (currentUser() && roles.includes(currentUser().role))) toast(text, type === 'danger' ? 'danger' : type === 'warning' ? 'warning' : 'success');
    }

    function describe(coll, r) {
        const ev = r.eventName ? ' [Event: ' + r.eventName + ']' : '';
        const who = r.borrower || r.reportedBy || r.requestedBy || '';
        return { coll,
            title: COLL[coll].label + ': ' + (r.itemName || '-') + (r.qty ? ' (' + r.qty + ')' : '') + ev,
            who, event: r.eventName || '', status: r.status || r.level || 'tercatat',
            items: [{ name: r.itemName || '-', qty: r.qty || 0 }],
            note: r.notes || r.note || r.description || r.reason || '' };
    }

    // Bandingkan DB lama vs baru -> beri ID, catat riwayat, buat notifikasi
    function sync(oldDb, db, silent) {
        ensure(db);
        const evCodes = {};
        db.loans.forEach(l => { if (l.eventId && l.eventCode) evCodes[l.eventId] = l.eventCode; });
        Object.keys(COLL).forEach(c => {
            const oldMap = {};
            ((oldDb && oldDb[c]) || []).forEach(r => oldMap[r.id] = r);
            (db[c] || []).forEach(r => {
                const o = oldMap[r.id], date = r.borrowDate || r.date || todayStr();
                if (!r.code) r.code = nextCode(db, COLL[c].p, yr(date));
                if (c === 'loans' && r.eventId && !r.eventCode) {
                    if (!evCodes[r.eventId]) evCodes[r.eventId] = nextCode(db, 'EVT', yr(date));
                    r.eventCode = evCodes[r.eventId];
                }
                if (c === 'loans' && FINAL.test(r.status || '') && !r.returnCode) r.returnCode = nextCode(db, 'PNG', yr(new Date().toISOString()));
                const d = describe(c, r);
                const base = Object.assign({ ref: r.code, recId: r.id, eventCode: r.eventCode || '', date: silent ? date : todayStr() }, d);
                if (!o) {
                    addLog(db, Object.assign(base, { action: 'dibuat', user: silent ? d.who : undefined, ts: silent ? new Date(date).toISOString() : undefined }));
                    if (!silent) {
                        if (c === 'loans') addNotif(db, (r.eventName ? 'Pengajuan event "' + r.eventName + '"' : 'Peminjaman baru') + ': ' + r.itemName + ' oleh ' + r.borrower, ROLE_ADM, 'info');
                        if (c === 'lost') addNotif(db, 'Barang hilang: ' + r.itemName + ' (' + r.qty + '), pelapor ' + r.reportedBy, ROLE_ADM, 'danger');
                        if (c === 'damages') addNotif(db, 'Barang rusak/MT: ' + r.itemName, ROLE_ADM, 'warning');
                        if (c === 'consumables') addNotif(db, 'ATK keluar/habis: ' + r.itemName + ' (' + r.qty + ')', ROLE_ADM, 'info');
                    }
                } else if (o.status !== r.status) {
                    addLog(db, Object.assign(base, { action: 'status: ' + (o.status || '-') + ' → ' + r.status }));
                    if (c === 'loans') {
                        const st = r.status || '';
                        const to = [r.requestedBy ? 'staff' : null, 'admin', 'manajemen'].filter(Boolean);
                        if (st === 'dipinjam') addNotif(db, 'Peminjaman ' + r.itemName + ' (' + r.code + ') DISETUJUI', ROLE_ALL, 'success');
                        else if (st === 'ditolak') addNotif(db, 'Peminjaman ' + r.itemName + ' (' + r.code + ') DITOLAK', ROLE_ALL, 'danger');
                        else if (FINAL.test(st)) addNotif(db, 'Barang dikembalikan: ' + r.itemName + ' (' + r.returnCode + ')', ROLE_ADM, 'success');
                    }
                }
            });
        });
        // Stok ATK/barang menipis (hanya saat baru melewati batas)
        const oldItems = {};
        ((oldDb && oldDb.items) || []).forEach(i => oldItems[i.id] = i);
        if (!silent) (db.items || []).forEach(i => {
            const o = oldItems[i.id];
            if (o && o.stock > o.minStock && i.stock <= i.minStock)
                addNotif(db, 'Stok hampir habis: ' + i.name + ' (sisa ' + i.stock + ')', ROLE_ADM, 'warning');
        });
        // Aktivitas event dikelompokkan lewat eventCode (log sudah membawa eventCode)
    }

    // Jatuh tempo: peringatan sekali per peminjaman (<= 2 hari)
    function checkDue() {
        const db = ensure(getDB()); let ch = false;
        db.loans.filter(l => l.status === 'dipinjam' && l.returnPlan && !l.dueNotified).forEach(l => {
            const days = (new Date(l.returnPlan) - new Date(todayStr())) / 864e5;
            if (days <= 2) {
                l.dueNotified = true; ch = true;
                addNotif(db, (days < 0 ? 'TERLAMBAT' : 'Segera jatuh tempo') + ': ' + l.itemName + ' (' + l.code + ') - ' + fmtDate(l.returnPlan), ROLE_ALL, 'warning');
            }
        });
        if (ch) localStorage.setItem(DB_KEY, JSON.stringify(db));
    }

    // ---- Pasang hook ke saveDB (semua fitur lama otomatis tercatat) ----
    const origSave = saveDB;
    saveDB = function (db) {
        let oldDb = {};
        try { oldDb = JSON.parse(localStorage.getItem(DB_KEY)) || {}; } catch (e) {}
        try { sync(oldDb, db, false); } catch (e) { console.error('sync riwayat gagal', e); }
        const ok = origSave(db);
        refreshBell();
        return ok;
    };
    // Backfill data lama sekali saja (tanpa notifikasi)
    function backfill() {
        const db = getDB();
        if (db.activityLog && db.revisiMigrated) return;
        sync({}, ensure(db), true);
        db.revisiMigrated = true;
        origSave(db);
    }

    // ---- Notification center ----
    function myNotifs() {
        const u = currentUser(); if (!u) return [];
        return ensure(getDB()).notifications.filter(n => n.roles.includes(u.role)).sort((a, b) => b.ts.localeCompare(a.ts));
    }
    function refreshBell() {
        const b = document.getElementById('bell-badge'); if (!b) return;
        const u = currentUser(); if (!u) return;
        const c = myNotifs().filter(n => !n.readBy.includes(u.id)).length;
        b.textContent = c > 99 ? '99+' : c; b.style.display = c ? 'flex' : 'none';
    }
    window.toggleNotifPanel = function () {
        const p = document.getElementById('notif-panel'); p.classList.toggle('hidden');
        if (p.classList.contains('hidden')) return;
        const list = myNotifs().slice(0, 40);
        const u = currentUser();
        p.innerHTML = `<div class="np-head"><b>Notifikasi</b><button class="btn btn-secondary btn-sm" onclick="markAllNotifRead()">Tandai dibaca</button></div>` +
            (list.length ? list.map(n => `<div class="np-item ${n.readBy.includes(u.id) ? '' : 'unread'} np-${n.type}"><div>${esc(n.text)}</div><small>${fmtDateTime(n.ts)}</small></div>`).join('') : '<div class="np-empty">Belum ada notifikasi.</div>') +
            `<div class="np-foot">Pengiriman Email / WhatsApp: struktur siap (lihat NOTIF_CHANNELS di revisi.js).</div>`;
    };
    window.markAllNotifRead = function () {
        const db = getDB(), u = currentUser();
        db.notifications.forEach(n => { if (n.roles.includes(u.role) && !n.readBy.includes(u.id)) n.readBy.push(u.id); });
        origSave(db); refreshBell(); toggleNotifPanel(); toggleNotifPanel();
    };
    // Titik integrasi eksternal: isi endpoint API lalu aktifkan enabled
    window.NOTIF_CHANNELS = { email: { enabled: false, endpoint: '' }, whatsapp: { enabled: false, endpoint: '' } };
    function injectBell() {
        if (document.getElementById('bell-btn')) return;
        const right = document.querySelector('.topbar-right');
        const w = document.createElement('div'); w.className = 'bell-wrap';
        w.innerHTML = `<button id="bell-btn" class="btn-icon" title="Notifikasi" onclick="toggleNotifPanel()"><i data-lucide="bell"></i><span id="bell-badge" class="bell-badge" style="display:none">0</span></button><div id="notif-panel" class="notif-panel hidden"></div>`;
        right.insertBefore(w, document.getElementById('live-clock').nextSibling);
        if (window.lucide) lucide.createIcons();
    }

    // ---- Navigasi & halaman baru ----
    NAV_CONFIG[0].items.splice(1, 0,
        { id: 'history', label: 'Riwayat Aktivitas', icon: 'history', roles: ROLE_ADM },
        { id: 'eventhistory', label: 'Riwayat Event', icon: 'calendar-check', roles: ROLE_ALL });
    PAGE_TITLES.history = 'Riwayat Aktivitas'; PAGE_TITLES.eventhistory = 'Riwayat Event';

    const origRenderPage = renderPage;
    renderPage = function (id) {
        if (id === 'history' || id === 'eventhistory') {
            document.getElementById('content-area').innerHTML = id === 'history' ? histPage() : evPage();
            if (window.lucide) lucide.createIcons();
            return;
        }
        origRenderPage(id);
    };

    // Filter bersama
    const F = { q: '', d: '', m: '', y: '', cat: '' };
    function logRows() {
        const q = F.q.toLowerCase();
        return ensure(getDB()).activityLog.filter(a => {
            if (F.cat && a.coll !== F.cat) return false;
            if (F.d && a.date !== F.d) return false;
            if (F.m && a.date.slice(5, 7) !== F.m) return false;
            if (F.y && a.date.slice(0, 4) !== F.y) return false;
            return !q || [a.id, a.ref, a.eventCode, a.title, a.who, a.user, a.action, a.event].join(' ').toLowerCase().includes(q);
        }).sort((a, b) => b.ts.localeCompare(a.ts));
    }
    function filterBar(extra) {
        const years = [...new Set(getDB().activityLog.map(a => a.date.slice(0, 4)))].sort().reverse();
        const months = ['01','02','03','04','05','06','07','08','09','10','11','12'];
        return `<div class="filter-bar rv-filter">
            <input type="text" placeholder="Cari ID / barang / peminjam / aktivitas" value="${esc(F.q)}" oninput="rvSet('q',this.value)">
            <input type="date" value="${F.d}" onchange="rvSet('d',this.value)">
            <select onchange="rvSet('m',this.value)"><option value="">Semua bulan</option>${months.map(m => `<option value="${m}" ${F.m === m ? 'selected' : ''}>${m}</option>`).join('')}</select>
            <select onchange="rvSet('y',this.value)"><option value="">Semua tahun</option>${years.map(y => `<option ${F.y === y ? 'selected' : ''}>${y}</option>`).join('')}</select>
            ${extra || ''}</div>`;
    }
    window.rvSet = function (k, v) {
        F[k] = v;
        const pos = document.activeElement && document.activeElement.selectionStart;
        renderPage(currentPage);
        const inp = document.querySelector('.rv-filter input[type=text]');
        if (k === 'q' && inp) { inp.focus(); inp.setSelectionRange(pos, pos); }
    };
    window.rvReset = function () { Object.assign(F, { q: '', d: '', m: '', y: '', cat: '' }); renderPage(currentPage); };

    function histPage() {
        const rows = logRows();
        const cats = `<select onchange="rvSet('cat',this.value)"><option value="">Semua jenis</option>${Object.keys(COLL).map(c => `<option value="${c}" ${F.cat === c ? 'selected' : ''}>${COLL[c].label}</option>`).join('')}</select>`;
        return `${filterBar(cats)}
        <div class="table-container"><div class="table-header"><h3>Riwayat Aktivitas (${rows.length}) <small class="text-muted">· permanen, tidak dihapus otomatis</small></h3>
        <div class="rv-actions"><button class="btn btn-secondary btn-sm" onclick="rvReset()">Reset</button>
        <button class="btn btn-secondary btn-sm" onclick="exportLog('csv')"><i data-lucide="file-spreadsheet"></i>Excel</button>
        <button class="btn btn-secondary btn-sm" onclick="exportLog('pdf')"><i data-lucide="printer"></i>PDF</button></div></div>
        <div class="table-scroll"><table class="data-table"><thead><tr><th>ID</th><th>Tanggal</th><th>Pengguna</th><th>Aktivitas</th><th>Status</th><th></th></tr></thead><tbody>
        ${rows.length ? rows.map(a => `<tr class="clickable" onclick="showActivity('${a.id}')"><td>${esc(a.ref)}<br><small class="text-muted">${esc(a.id)}</small></td><td>${fmtDate(a.date)}</td><td>${esc(a.who || a.user)}</td><td>${esc(a.title)}${a.eventCode ? ` <span class="badge badge-info">${esc(a.eventCode)}</span>` : ''}<br><small class="text-muted">${esc(a.action)}</small></td><td><span class="badge badge-muted">${esc(a.status)}</span></td><td><i data-lucide="chevron-right"></i></td></tr>`).join('') : '<tr class="empty-row"><td colspan="6">Tidak ada riwayat.</td></tr>'}
        </tbody></table></div></div>`;
    }

    // ---- Detail aktivitas (dashboard & riwayat) ----
    window.showActivity = function (id) {
        const db = getDB(), a = db.activityLog.find(x => x.id === id); if (!a) return;
        const rec = (db[a.coll] || []).find(r => r.id === a.recId) || {};
        const sameEvent = a.eventCode ? db.loans.filter(l => l.eventCode === a.eventCode) : [];
        const items = sameEvent.length ? sameEvent.map(l => ({ name: l.itemName, qty: l.qty, st: l.status })) : [{ name: a.items[0].name, qty: a.items[0].qty, st: rec.status || a.status }];
        openModal('Detail ' + a.ref, `<div class="detail-grid">
            <div><label>ID Transaksi</label><b>${esc(a.ref)}</b>${rec.returnCode ? ' · ' + esc(rec.returnCode) : ''}</div>
            <div><label>ID Aktivitas</label>${esc(a.id)}</div>
            <div><label>Tanggal</label>${fmtDate(a.date)}</div>
            <div><label>Penanggung jawab</label>${esc(a.who || a.user)}</div>
            <div><label>Jenis</label>${esc(COLL[a.coll].label)}${a.eventCode ? ' <span class="badge badge-info">EVENT</span>' : ''}</div>
            <div><label>Kegiatan / Event</label>${esc(a.event || '-')} ${a.eventCode ? '(' + esc(a.eventCode) + ')' : ''}</div></div>
            <table class="data-table"><thead><tr><th>Barang</th><th>Jumlah</th><th>Status</th></tr></thead><tbody>${items.map(i => `<tr><td>${esc(i.name)}</td><td>${i.qty}</td><td>${esc(i.st)}</td></tr>`).join('')}</tbody></table>
            <p><label>Catatan</label><br>${esc(a.note || rec.notes || rec.note || '-')}</p>
            <p class="text-muted">${esc(a.action)} · dicatat ${fmtDateTime(a.ts)} oleh ${esc(a.user)}</p>
            ${a.eventCode ? `<button class="btn btn-primary" onclick="closeModal();showEvent('${a.eventCode}')">Buka halaman event</button>` : ''}`);
    };

    // Dashboard: ganti tabel "Aktivitas Terbaru" menjadi daftar yang bisa diklik
    const origDash = renderDashboard;
    renderDashboard = function () {
        const html = origDash();
        const rows = ensure(getDB()).activityLog.slice().sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 10);
        const tbl = `<div class="table-container"><div class="table-header"><h3>Aktivitas Terbaru</h3></div><div class="table-scroll"><table class="data-table"><thead><tr><th>ID</th><th>Tanggal</th><th>Pengguna</th><th>Aktivitas</th><th>Status</th></tr></thead><tbody>
        ${rows.length ? rows.map(a => `<tr class="clickable" onclick="showActivity('${a.id}')"><td>${esc(a.ref)}</td><td>${fmtDate(a.date)}</td><td>${esc(a.who || a.user)}</td><td>${esc(a.title)}${a.eventCode ? ` <span class="badge badge-info">Event</span>` : ''}</td><td><span class="badge badge-muted">${esc(a.status)}</span></td></tr>`).join('') : '<tr class="empty-row"><td colspan="5">Belum ada aktivitas.</td></tr>'}</tbody></table></div></div>`;
        return html.replace(/<div class="table-container">[\s\S]*$/, tbl);
    };

    // ---- Riwayat Event ----
    function events() {
        const db = ensure(getDB()), map = {};
        db.loans.filter(l => l.eventCode).forEach(l => {
            const e = map[l.eventCode] = map[l.eventCode] || { code: l.eventCode, name: l.eventName, loc: l.eventLocation, date: l.borrowDate, end: l.returnPlan, pic: l.borrower, used: 0, ret: 0, dmg: 0, lost: 0, loans: [] };
            const iss = Array.isArray(l.issues) ? l.issues : [];
            const sum = t => iss.filter(k => k.type === t).reduce((s, k) => s + (Number(k.qty) || 0), 0);
            e.loans.push(l); e.used += l.qty;
            if (FINAL.test(l.status || '')) { e.dmg += sum('rusak'); e.lost += sum('hilang'); e.ret += Math.max(0, l.qty - sum('rusak') - sum('hilang') - sum('habis')); }
        });
        Object.values(map).forEach(e => {
            const st = e.loans.map(l => l.status);
            e.status = st.every(s => s === 'ditolak') ? 'Ditolak'
                : st.some(s => /menunggu_admin$/.test(s)) ? 'Pengajuan'
                : st.every(s => FINAL.test(s) || s === 'ditolak') ? (e.dmg || e.lost ? 'Bermasalah' : 'Selesai')
                : st.some(s => /pengembalian/.test(s)) ? 'Menunggu pengembalian'
                : e.date > todayStr() ? 'Disetujui' : e.end && e.end < todayStr() ? 'Menunggu pengembalian' : 'Sedang berlangsung';
            e.meta = db.eventMeta[e.code] || {};
        });
        return Object.values(map).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }
    function evFiltered() {
        const q = F.q.toLowerCase();
        return events().filter(e => (!F.y || (e.date || '').slice(0, 4) === F.y) && (!F.m || (e.date || '').slice(5, 7) === F.m) && (!F.d || e.date === F.d) &&
            (!q || [e.code, e.name, e.pic, e.status].join(' ').toLowerCase().includes(q)));
    }
    function evPage() {
        const rows = evFiltered();
        return `${filterBar()}<div class="table-container"><div class="table-header"><h3>Riwayat Event (${rows.length})</h3>
        <div class="rv-actions"><button class="btn btn-secondary btn-sm" onclick="rvReset()">Reset</button>
        <button class="btn btn-secondary btn-sm" onclick="exportEvents('csv')"><i data-lucide="file-spreadsheet"></i>Excel</button>
        <button class="btn btn-secondary btn-sm" onclick="exportEvents('pdf')"><i data-lucide="printer"></i>PDF</button></div></div>
        <div class="table-scroll"><table class="data-table"><thead><tr><th>ID</th><th>Event</th><th>Tanggal</th><th>PJ</th><th>Dipakai</th><th>Kembali</th><th>Rusak</th><th>Hilang</th><th>Status</th><th></th></tr></thead><tbody>
        ${rows.length ? rows.map(e => `<tr><td>${esc(e.code)}</td><td>${esc(e.name)}</td><td>${fmtDate(e.date)}${e.end ? ' – ' + fmtDate(e.end) : ''}</td><td>${esc(e.pic)}</td><td>${e.used}</td><td>${e.ret}</td><td>${e.dmg}</td><td>${e.lost}</td><td><span class="badge badge-info">${esc(e.status)}</span></td><td><button class="btn btn-secondary btn-sm" onclick="showEvent('${e.code}')">Detail</button></td></tr>`).join('') : '<tr class="empty-row"><td colspan="10">Belum ada event.</td></tr>'}
        </tbody></table></div></div>`;
    }
    window.showEvent = function (code) {
        const e = events().find(x => x.code === code); if (!e) return;
        const log = getDB().activityLog.filter(a => a.eventCode === code).sort((a, b) => a.ts.localeCompare(b.ts));
        const can = hasRole('admin', 'manajemen');
        openModal('Event ' + e.code + ' · ' + e.name, `<div class="detail-grid">
            <div><label>Tanggal</label>${fmtDate(e.date)} – ${fmtDate(e.end)}</div><div><label>Lokasi</label>${esc(e.loc || '-')}</div>
            <div><label>Penanggung jawab</label>${esc(e.pic)}</div><div><label>Status</label>${esc(e.status)}</div></div>
            <table class="data-table"><thead><tr><th>ID</th><th>Barang</th><th>Pinjam</th><th>Status</th><th>Kondisi</th></tr></thead><tbody>${e.loans.map(l => `<tr><td>${esc(l.code)}</td><td>${esc(l.itemName)}</td><td>${l.qty}</td><td>${esc(l.status)}</td><td>${(l.issues || []).map(k => esc(k.type) + ' ' + k.qty).join(', ') || '-'}</td></tr>`).join('')}</tbody></table>
            <h4>Riwayat pengembalian & aktivitas</h4><ul class="rv-log">${log.map(a => `<li>${fmtDateTime(a.ts)} · ${esc(a.action)} · ${esc(a.title.split('[')[0])}</li>`).join('') || '<li>-</li>'}</ul>
            <label>Catatan evaluasi setelah event</label>
            <textarea id="ev-eval" rows="3" ${can ? '' : 'disabled'}>${esc(e.meta.evaluation || '')}</textarea>
            <div class="rv-actions" style="margin-top:12px">${can ? `<button class="btn btn-primary" onclick="saveEventEval('${code}')">Simpan evaluasi</button>` : ''}
            <button class="btn btn-secondary" onclick="exportEvents('pdf','${code}')"><i data-lucide="printer"></i>PDF</button>
            <button class="btn btn-secondary" onclick="exportEvents('csv','${code}')"><i data-lucide="file-spreadsheet"></i>Excel</button></div>`);
    };
    window.saveEventEval = function (code) {
        const db = ensure(getDB());
        db.eventMeta[code] = Object.assign(db.eventMeta[code] || {}, { evaluation: document.getElementById('ev-eval').value.trim() });
        const first = db.loans.find(l => l.eventCode === code);
        addLog(db, { ref: code, recId: first.id, coll: 'loans', eventCode: code, event: first.eventName, date: todayStr(), title: 'Evaluasi event: ' + first.eventName, who: currentUser().name, status: 'evaluasi', action: 'catatan evaluasi disimpan', items: [{ name: '-', qty: 0 }], note: db.eventMeta[code].evaluation });
        origSave(db); toast('Evaluasi tersimpan.');
    };

    // ---- Ekspor: CSV (terbuka di Excel) & PDF (cetak ke PDF) ----
    function download(name, rows) {
        const csv = '\ufeff' + rows.map(r => r.map(c => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    function printTable(title, head, rows) {
        const pa = document.getElementById('print-area');
        pa.innerHTML = `<h2>${esc(title)}</h2><p>Dicetak ${fmtDateTime(new Date())}</p><table border="1" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:12px"><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
        window.print();
    }
    window.exportLog = function (t) {
        const head = ['ID Transaksi', 'ID Aktivitas', 'Tanggal', 'Pengguna', 'Aktivitas', 'Aksi', 'Status', 'Catatan'];
        const rows = logRows().map(a => [a.ref, a.id, a.date, a.who || a.user, a.title, a.action, a.status, a.note]);
        t === 'csv' ? download('riwayat-aktivitas.csv', [head, ...rows]) : printTable('Riwayat Aktivitas Gudang', head, rows);
    };
    window.exportEvents = function (t, code) {
        const list = code ? events().filter(e => e.code === code) : evFiltered();
        const head = ['ID Event', 'Nama Event', 'Mulai', 'Selesai', 'Penanggung Jawab', 'Dipakai', 'Kembali', 'Rusak', 'Hilang', 'Status', 'Evaluasi'];
        const rows = list.map(e => [e.code, e.name, e.date, e.end, e.pic, e.used, e.ret, e.dmg, e.lost, e.status, e.meta.evaluation || '']);
        t === 'csv' ? download('riwayat-event.csv', [head, ...rows]) : printTable('Laporan Riwayat Event', head, rows);
    };

    // ---- Inisialisasi ----
    const origEnter = enterApp;
    enterApp = function () {
        backfill(); injectBell(); checkDue();
        origEnter(); refreshBell();
        if (!window._dueTimer) window._dueTimer = setInterval(() => { checkDue(); refreshBell(); }, 60000);
    };
    document.addEventListener('click', e => { const p = document.getElementById('notif-panel'); if (p && !e.target.closest('.bell-wrap')) p.classList.add('hidden'); });
    window.addEventListener('storage', refreshBell);
    // Jika sesi login masih aktif saat halaman dimuat ulang, pasang bell juga
    if (currentUser() && !document.getElementById('app-layout').classList.contains('hidden')) { backfill(); injectBell(); refreshBell(); }
})();
