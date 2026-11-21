// Post panel: makes new posts (private, draft or published) from a PGN (or a Lichess link) and lists / deletes the existing ones.
// Everything is saved to the GitHub repository through the GitHub API with the owner's token; without a token a new page can still be
// made by opening GitHub's "new file" page with everything filled in. Nothing is sent anywhere else; the token stays in this browser
// (the tab's sessionStorage, or localStorage if "remember" is ticked).
(function () {
  'use strict';
  // this script sits in the page body, before the page's chess libraries: start once everything is loaded
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  function start() {
  var root = document.getElementById('wizard');
  var CP = window.ChessPublica;
  if (!root || !CP) return;
  var REPO = root.getAttribute('data-repo'), BASE = root.getAttribute('data-base') || '/', BRANCH = 'main';
  var games = [], chosen = 0, bar, main, side;

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') e.textContent = attrs[k]; else if (k === 'html') e.innerHTML = attrs[k]; else e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { e.appendChild(c); });
    return e;
  }
  function field(label, control, hint) {
    return el('label', { 'class': 'wiz-field' }, [el('span', { text: label }), control].concat(hint ? [el('small', { text: hint })] : []));
  }
  function show(step) { main.innerHTML = ''; main.appendChild(step); }
  function err(msg) { var e = main.querySelector('.wiz-error'); if (!e) { e = el('p', { 'class': 'wiz-error', role: 'alert' }); main.appendChild(e); } e.textContent = msg; }

  /* ---- Token (one for the whole panel) ---- */
  function getToken() { var t = sessionStorage.getItem('wiz-token'); if (!t) { try { t = localStorage.getItem('wiz-token'); } catch (e) {} } return t || ''; }
  function setToken(t, remember) {
    sessionStorage.setItem('wiz-token', t);
    try { remember ? localStorage.setItem('wiz-token', t) : localStorage.removeItem('wiz-token'); } catch (e) {}
  }
  function clearToken() { sessionStorage.removeItem('wiz-token'); try { localStorage.removeItem('wiz-token'); } catch (e) {} }

  /* ---- GitHub API ---- */
  function api(method, path, token, body) {
    var h = { Accept: 'application/vnd.github+json' };
    if (token) h.Authorization = 'Bearer ' + token;
    if (body) h['Content-Type'] = 'application/json';
    return fetch('https://api.github.com/repos/' + REPO + '/' + path, { method: method, headers: h, body: body ? JSON.stringify(body) : undefined }).then(function (r) {
      if (r.status === 401 || r.status === 403 || r.status === 404) throw new Error('GitHub anahtarı kabul edilmedi (' + r.status + '). Anahtarın bu depoda “Contents: Read and write” iznine sahip olduğundan emin olun.');
      if (!r.ok) return r.json().then(function (j) { throw new Error('GitHub hatası: ' + (j.message || r.status)); });
      return r.json();
    });
  }
  function rawFile(path, token) {
    var h = { Accept: 'application/vnd.github.raw+json' }; if (token) h.Authorization = 'Bearer ' + token;
    return fetch('https://api.github.com/repos/' + REPO + '/contents/' + path + '?ref=' + BRANCH, { headers: h }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); });
  }
  function frontMatter(text) {
    var m = text.match(/^---\n([\s\S]*?)\n---/), fm = {};
    if (m) m[1].split('\n').forEach(function (l) { var k = l.match(/^(\w+):\s*(.*)$/); if (k) { var v = k[2].trim(); try { v = JSON.parse(v); } catch (e) {} fm[k[1]] = v; } });
    return fm;
  }

  /* ---- Top bar: connection ---- */
  function renderBar() {
    bar.innerHTML = '';
    var t = getToken();
    if (t) {
      var out = el('button', { type: 'button', 'class': 'wiz-ghost', text: 'Anahtarı sil' });
      out.addEventListener('click', function () { clearToken(); renderBar(); renderSide(); });
      bar.appendChild(el('span', { 'class': 'wiz-ok', text: '✓ GitHub’a bağlı' }));
      bar.appendChild(el('span', { 'class': 'wiz-sum', text: REPO }));
      bar.appendChild(out);
      return;
    }
    var token = el('input', { type: 'password', autocomplete: 'off', placeholder: 'github_pat_… (GitHub anahtarı)' });
    var remember = el('input', { type: 'checkbox' });
    var go = el('button', { type: 'button', text: 'Bağlan' });
    var help = el('details', { 'class': 'wiz-help' }, [el('summary', { text: 'Anahtarı nasıl oluştururum?' }), el('ol', { html:
      '<li><a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub › Settings › Developer settings › Fine-grained tokens › Generate new token</a> sayfasını açın.</li>' +
      '<li><b>Repository access</b>: “Only select repositories” seçip <b>' + REPO + '</b> deposunu seçin.</li>' +
      '<li><b>Permissions › Repository permissions › Contents</b>: <b>Read and write</b> seçin (başka izin gerekmez).</li>' +
      '<li>Bir süre sonu seçin (örneğin 90 gün), “Generate token” deyin ve çıkan <code>github_pat_…</code> değerini yukarıdaki alana yapıştırın.</li>' })]);
    go.addEventListener('click', function () {
      var v = token.value.trim(); if (!v) return;
      go.disabled = true; go.textContent = 'Deneniyor…';
      api('GET', 'contents/_posts/private?ref=' + BRANCH, v).then(function () { setToken(v, remember.checked); renderBar(); renderSide(); }).catch(function (e) {
        go.disabled = false; go.textContent = 'Bağlan'; var p = bar.querySelector('.wiz-error') || bar.appendChild(el('p', { 'class': 'wiz-error', role: 'alert' })); p.textContent = e.message; });
    });
    bar.appendChild(el('div', { 'class': 'wiz-connect' }, [
      el('strong', { text: 'GitHub’a bağlanın' }),
      el('span', { 'class': 'wiz-sum', text: 'Sayfaları listelemek, oluşturmak ve silmek için anahtar gerekir. Anahtar yalnızca api.github.com’a gönderilir.' }),
      el('div', { 'class': 'wiz-connect-row' }, [token, go]),
      el('label', { 'class': 'wiz-check' }, [remember, el('span', { text: ' Bu tarayıcıda hatırla' })]),
      help]));
  }

  /* ---- Side: existing private pages ---- */
  var activeTab = 'ozel';
  var CATS = { ozel: { label: 'Özel', dir: '_posts/private' }, taslak: { label: 'Taslak', dir: '_posts/draft' }, yayin: { label: 'Yayın', dir: '_posts' } };
  function renderSide() {
    side.innerHTML = '';
    var t = getToken();
    var refresh = el('button', { type: 'button', 'class': 'wiz-ghost', text: 'Yenile' });
    refresh.addEventListener('click', renderSide);
    side.appendChild(el('div', { 'class': 'wiz-head' }, [el('h2', { text: 'Mevcut yazılar' })].concat(t ? [refresh] : [])));
    if (!t) { side.appendChild(el('p', { 'class': 'wiz-sum', text: 'Listeyi görmek için yukarıdan GitHub’a bağlanın.' })); return; }
    var list = el('div', { 'class': 'wiz-rows' }, [el('p', { 'class': 'wiz-sum', text: 'Yükleniyor…' })]);
    side.appendChild(list);
    Promise.all(Object.keys(CATS).map(function (k) {
      return api('GET', 'contents/' + CATS[k].dir + '?ref=' + BRANCH, t).then(function (files) {
        files = files.filter(function (f) { return f.type !== 'dir' && /\.md$/.test(f.name); });
        return Promise.all(files.map(function (f) { return rawFile(f.path, t).then(function (text) { return { cat: k, file: f, fm: frontMatter(text), text: text }; }); }));
      }, function (e) { if (k !== 'yayin' && /\(404\)/.test(e.message)) return []; throw e; });   // a folder that does not exist yet is simply empty
    })).then(function (groups) {
      var items = [].concat.apply([], groups).filter(function (it) { return !/id="wizard"/.test(it.text); });   // the panel page itself is not listed
      items.sort(function (a, b) { return String(b.fm.date || '').localeCompare(String(a.fm.date || '')); });
      var note = '';
      function draw() {
        list.innerHTML = '';
        var tabs = el('div', { 'class': 'wiz-tabs', role: 'tablist' });
        Object.keys(CATS).forEach(function (k) {
          var n = items.filter(function (it) { return it.cat === k; }).length;
          var b = el('button', { type: 'button', role: 'tab', 'class': 'wiz-tab', 'aria-selected': k === activeTab ? 'true' : 'false', text: CATS[k].label + ' (' + n + ')' });
          b.addEventListener('click', function () { activeTab = k; note = ''; draw(); });
          tabs.appendChild(b);
        });
        list.appendChild(tabs);
        if (note) list.appendChild(el('p', { 'class': 'wiz-sum', text: note }));
        var shown = items.filter(function (it) { return it.cat === activeTab; });
        if (!shown.length) list.appendChild(el('p', { 'class': 'wiz-sum', text: 'Bu kategoride yazı yok.' }));
        shown.forEach(function (it) {
          list.appendChild(row(it, t, function (msg) { items = items.filter(function (x) { return x !== it; }); note = msg; draw(); }));
        });
      }
      draw();
    }).catch(function (e) { list.innerHTML = ''; list.appendChild(el('p', { 'class': 'wiz-error', role: 'alert', text: e.message })); });
  }
  function row(it, t, onDeleted) {
    var title = it.fm.title || it.file.name;
    var published = it.cat !== 'taslak' && it.fm.published !== false;
    var url = location.origin + BASE + String(it.fm.permalink || '').replace(/^\//, '');
    var type = /<pgn-player/.test(it.text) ? 'oynatıcı' : /<pgn>/.test(it.text) ? 'tahta + hamle listesi' : 'metin';
    var actions = el('div', { 'class': 'wiz-actions' });
    if (published && it.fm.permalink) {
      var copy = el('button', { type: 'button', 'class': 'wiz-ghost', text: 'Kopyala' });
      copy.addEventListener('click', function () { navigator.clipboard.writeText(url).then(function () { copy.textContent = 'Kopyalandı ✓'; setTimeout(function () { copy.textContent = 'Kopyala'; }, 1500); }); });
      actions.appendChild(el('a', { href: url, target: '_blank', rel: 'noopener', 'class': 'wiz-btnlink', text: 'Aç' }));
      actions.appendChild(copy);
    }
    var r = el('div', { 'class': 'wiz-row' }, [
      el('div', {}, [el('strong', { text: title + ' ' }), el('span', { 'class': 'wiz-badge wiz-badge-' + it.cat, text: CATS[it.cat].label }),
        el('div', { 'class': 'wiz-sum', text: String(it.fm.date || '') + ' · ' + type }),
        published && it.fm.permalink ? el('a', { href: url, target: '_blank', rel: 'noopener', text: url.replace(/^https?:\/\//, ''), 'class': 'wiz-url' }) : el('span', { 'class': 'wiz-sum', text: it.file.path })]), actions]);
    var del = el('button', { type: 'button', 'class': 'wiz-ghost wiz-del', text: 'Sil' });
    del.addEventListener('click', function () {
      if (!confirm('“' + title + '” yazısı silinsin mi? Bu işlem geri alınamaz (GitHub geçmişinden dosya kurtarılabilir).')) return;
      del.disabled = true; del.textContent = 'Siliniyor…';
      api('DELETE', 'contents/' + it.file.path, t, { message: 'Yazı silindi: ' + title, sha: it.file.sha, branch: BRANCH })
        .then(function () { onDeleted('✓ Silindi: ' + title + (published ? ' (yayından kalkması 1–2 dakika sürer)' : '')); })
        .catch(function (e) { del.disabled = false; del.textContent = 'Sil'; var p = r.querySelector('.wiz-error') || r.appendChild(el('p', { 'class': 'wiz-error', role: 'alert' })); p.textContent = e.message; });
    });
    actions.appendChild(del);
    return r;
  }

  /* ---- PGN handling ---- */
  function splitGames(text) {
    text = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
    var parts = text.split(/\n\s*\n(?=\[Event\s)/).map(function (g) { return g.trim(); }).filter(Boolean);
    return parts.length ? parts : [text];
  }
  function describe(pgn) {
    var h = CP.parseHeaders(pgn), tree, count = 0, bad = 0;
    try { tree = CP.buildMoveTree(pgn); } catch (e) { tree = null; }
    for (var n = tree; n; n = n.next) { count++; if (n.invalid) bad++; }
    var name = function (s) { s = (s || '').replace(/^\(\w\)\s*/, ''); if (/^[?\-\s]*$/.test(s)) return ''; var p = s.split(','); return p.length === 2 ? p[1].trim() + ' ' + p[0].trim() : s; };
    return { pgn: pgn, headers: h, moves: count, invalid: bad, white: name(h.White), black: name(h.Black) };
  }
  function fetchText(url, accept) {
    return fetch(url, { headers: accept ? { Accept: accept } : {} }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); });
  }
  function fromUrl(url) {
    var m;
    if ((m = url.match(/^https?:\/\/(?:www\.)?lichess\.org\/study\/([A-Za-z0-9]{8})\/([A-Za-z0-9]{8})/)))
      return fetchText('https://lichess.org/api/study/' + m[1] + '/' + m[2] + '.pgn', 'application/x-chess-pgn');
    if ((m = url.match(/^https?:\/\/(?:www\.)?lichess\.org\/study\/([A-Za-z0-9]{8})\/?$/)))
      return fetchText('https://lichess.org/api/study/' + m[1] + '.pgn', 'application/x-chess-pgn');
    if ((m = url.match(/^https?:\/\/(?:www\.)?lichess\.org\/(?:embed\/)?([A-Za-z0-9]{8})(?:[A-Za-z0-9]{4})?(?:[/?#]|$)/)))
      return fetchText('https://lichess.org/game/export/' + m[1] + '?clocks=false&evals=false', 'application/x-chess-pgn');
    return fetchText(url).catch(function () { throw new Error('Bu adres tarayıcıdan okunamadı (site izin vermiyor olabilir). PGN metnini yapıştırın.'); });
  }

  /* ---- Step 1: PGN or link ---- */
  function step1(prefill) {
    var ta = el('textarea', { rows: '10', placeholder: '[Event "…"]\n…\n\n1. e4 e5 2. Nf3 …\n\nya da: https://lichess.org/XXXXXXXX', spellcheck: 'false' });
    if (prefill) ta.value = prefill;
    var go = el('button', { type: 'button', text: 'Devam →' });
    go.addEventListener('click', function () {
      var v = ta.value.trim();
      if (!v) return err('Bir PGN ya da bağlantı yapıştırın.');
      go.disabled = true; go.textContent = 'Okunuyor…';
      var p = /^https?:\/\/\S+$/.test(v) ? fromUrl(v) : Promise.resolve(v);
      p.then(function (text) {
        games = splitGames(text).map(describe).filter(function (g) { return g.moves > 0; });
        if (!games.length) throw new Error('Bu metinde hamle bulunamadı.');
        chosen = 0;
        games.length > 1 ? stepPick() : step2();
      }).catch(function (e) { go.disabled = false; go.textContent = 'Devam →'; err(e.message); });
    });
    show(el('div', { 'class': 'wiz-step' }, [
      el('h2', { text: 'Yeni yazı · 1. Oyun' }),
      el('p', { text: 'PGN metnini yapıştırın ya da bir Lichess oyun / çalışma bağlantısı verin.' }),
      field('PGN ya da bağlantı', ta), go
    ]));
  }

  /* ---- Step 1b: several games ---- */
  function stepPick() {
    var list = el('div', { 'class': 'wiz-list' });
    games.forEach(function (g, i) {
      var r = el('input', { type: 'radio', name: 'game', value: String(i) }); if (i === 0) r.checked = true;
      r.addEventListener('change', function () { chosen = i; });
      list.appendChild(el('label', {}, [r, el('span', { text: ' ' + ([g.white, g.black].filter(Boolean).join(' – ') || 'İsimsiz oyun') + ' (' + Math.ceil(g.moves / 2) + ' hamle)' })]));
    });
    var go = el('button', { type: 'button', text: 'Devam →' }); go.addEventListener('click', step2);
    var back = el('button', { type: 'button', 'class': 'wiz-ghost', text: '← Geri' }); back.addEventListener('click', function () { step1(); });
    show(el('div', { 'class': 'wiz-step' }, [el('h2', { text: 'Yeni yazı · Oyunu seçin' }), el('p', { text: 'Birden çok oyun bulundu. Bir sayfada tek oyun gösterilebilir.' }), list, back, go]));
  }

  /* ---- Step 2: page details ---- */
  function step2() {
    var g = games[chosen];
    var title = el('input', { type: 'text', value: (g.white && g.black) ? g.white + ' – ' + g.black : 'Yeni ders' });
    var date = el('input', { type: 'date', value: new Date().toISOString().slice(0, 10) });
    var note = el('textarea', { rows: '6', placeholder: 'Oyundan önce görünecek yazı (Markdown yazılabilir). Boş bırakılabilir.' });
    var summary = el('input', { type: 'text', placeholder: 'Boş bırakılabilir' });
    var catOzel = el('input', { type: 'radio', name: 'cat', value: 'ozel' }); catOzel.checked = true;
    var catTaslak = el('input', { type: 'radio', name: 'cat', value: 'taslak' });
    var catYayin = el('input', { type: 'radio', name: 'cat', value: 'yayin' });
    var cat = el('div', { 'class': 'wiz-field' }, [el('span', { text: 'Kategori' }),
      el('label', { 'class': 'wiz-check' }, [catOzel, el('span', { text: ' Özel: listelenmez, arama motorlarına kapalı, adresi bilen görür' })]),
      el('label', { 'class': 'wiz-check' }, [catTaslak, el('span', { text: ' Taslak: yayınlanmaz, yalnızca depoda durur' })]),
      el('label', { 'class': 'wiz-check' }, [catYayin, el('span', { text: ' Yayın: herkese açık, ana sayfada listelenir' })])]);
    var viewList = el('input', { type: 'radio', name: 'view', value: 'pgn' }); viewList.checked = true;
    var viewPlayer = el('input', { type: 'radio', name: 'view', value: 'player' });
    var view = el('div', { 'class': 'wiz-field' }, [el('span', { text: 'Görünüm' }),
      el('label', { 'class': 'wiz-check' }, [viewList, el('span', { text: ' Tahta ve hamle listesi (hamleye tıklayınca tahta gider)' })]),
      el('label', { 'class': 'wiz-check' }, [viewPlayer, el('span', { text: ' Oynatıcı (tahta altında oynat / duraklat düğmeleri, yorumlar)' })])]);
    var warn = g.invalid ? el('p', { 'class': 'wiz-error', text: '⚠ Oyunda ' + g.invalid + ' geçersiz hamle var, sayfada bu hamleler görünmez.' }) : null;
    var make = el('button', { type: 'button', text: getToken() ? 'Yazıyı oluştur' : 'Yazıyı oluştur (GitHub’da açılır)' });
    var back = el('button', { type: 'button', 'class': 'wiz-ghost', text: '← Geri' }); back.addEventListener('click', function () { games.length > 1 ? stepPick() : step1(); });
    make.addEventListener('click', function () {
      if (!title.value.trim()) return err('Başlık boş olamaz.');
      var page = buildPage({ title: title.value.trim(), date: date.value, summary: summary.value.trim(), note: note.value.trim(), pgn: g.pgn, view: viewPlayer.checked ? 'pgn-player' : 'pgn', cat: catTaslak.checked ? 'taslak' : catYayin.checked ? 'yayin' : 'ozel' });
      var t = getToken();
      if (t) { make.disabled = true; make.textContent = 'Kaydediliyor…'; save(page, t).catch(function (e) { make.disabled = false; make.textContent = 'Yazıyı oluştur'; err(e.message); }); }
      else openOnGithub(page);
    });
    show(el('div', { 'class': 'wiz-step' }, [
      el('h2', { text: 'Yeni yazı · 2. Bilgiler' }),
      el('p', { 'class': 'wiz-sum', text: [[g.white, g.black].filter(Boolean).join(' – '), (g.headers.Event && !/^[?\-\s]*$/.test(g.headers.Event)) ? g.headers.Event : '', Math.ceil(g.moves / 2) + ' hamle'].filter(Boolean).join(' · ') }),
      warn || el('span'),
      field('Başlık', title), field('Tarih', date, 'Bugünün (UTC) tarihi kullanılır; ileri bir tarih yazarsanız sayfa o güne kadar yayınlanmaz.'),
      cat, view, field('Yazı notu', note), field('Kısa özet', summary, 'Ana sayfadaki listede ve paylaşım önizlemesinde görünür.'),
      getToken() ? el('span') : el('p', { 'class': 'wiz-sum', text: 'GitHub’a bağlı değilsiniz: oluştur deyince GitHub’ın “yeni dosya” sayfası hazır doldurulmuş açılır.' }),
      back, make
    ]));
  }

  /* ---- Page file ---- */
  function randomToken(n) {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789', a = new Uint8Array(n), s = '';
    crypto.getRandomValues(a); for (var i = 0; i < n; i++) s += chars[a[i] % chars.length]; return s;
  }
  function slugify(s) {
    var map = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'Ç': 'c', 'Ğ': 'g', 'İ': 'i', 'I': 'i', 'Ö': 'o', 'Ş': 's', 'Ü': 'u' };
    return s.replace(/[çğıöşüÇĞİIÖŞÜ]/g, function (c) { return map[c]; }).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'ders';
  }
  function buildPage(o) {
    var slug = slugify(o.title), tok = randomToken(8);
    var fm = ['---', 'title: ' + JSON.stringify(o.title), 'date: ' + o.date];
    var path, url = null;
    if (o.cat === 'ozel') {
      fm.push('permalink: /ozel/' + tok + '/', 'private: true');
      path = '_posts/private/' + o.date + '-' + slug + '-' + randomToken(3).toLowerCase() + '.md';
      url = location.origin + BASE + 'ozel/' + tok + '/';
    } else {
      fm.push('permalink: /yazilar/' + slug + '/');
      if (o.cat === 'taslak') fm.push('published: false');
      path = (o.cat === 'taslak' ? '_posts/draft/' : '_posts/') + o.date + '-' + slug + '.md';
      if (o.cat === 'yayin') url = location.origin + BASE + 'yazilar/' + slug + '/';
    }
    if (o.summary) fm.push('summary: ' + JSON.stringify(o.summary));
    fm.push('---', '');
    var body = (o.note ? o.note + '\n\n' : '') + '{% raw %}\n<' + o.view + '>\n' + o.pgn.trim() + '\n</' + o.view + '>\n{% endraw %}\n';
    return { path: path, content: fm.join('\n') + '\n' + body, url: url, title: o.title, cat: o.cat };
  }

  /* ---- Save ---- */
  function utf8b64(s) { return btoa(unescape(encodeURIComponent(s))); }
  function save(page, token) {
    return api('PUT', 'contents/' + page.path, token, { message: 'Yazı eklendi (' + CATS[page.cat].label.toLowerCase() + '): ' + page.title, content: utf8b64(page.content), branch: BRANCH }).then(function () { done(page, true); renderSide(); }, function (e) { throw /sha/.test(e.message) ? new Error('Bu başlıkla bir yazı bugün zaten var; başlığı ya da tarihi değiştirin.') : e; });
  }
  function openOnGithub(page) {
    var u = 'https://github.com/' + REPO + '/new/' + BRANCH + '/' + CATS[page.cat].dir + '?filename=' + encodeURIComponent(page.path.split('/').pop()) + '&value=' + encodeURIComponent(page.content);
    done(page, false, u);
  }

  /* ---- Result ---- */
  function done(page, saved, ghUrl) {
    var kids = [], status = el('p', { 'class': 'wiz-status' });
    var again = el('button', { type: 'button', 'class': 'wiz-ghost', text: 'Yeni bir yazı' }); again.addEventListener('click', function () { step1(); });
    kids.push(el('h2', { text: saved ? '✓ Yazı kaydedildi' : 'GitHub’da kaydedin' }));
    if (!saved) kids.push(el('p', { text: 'Önce GitHub sayfasında “Commit changes…” düğmesine basarak kaydedin:' }), el('p', {}, [el('a', { href: ghUrl, target: '_blank', rel: 'noopener', text: 'GitHub’da aç ve kaydet →', 'class': 'wiz-open' })]));
    if (page.url) {
      var copy = el('button', { type: 'button', text: 'Bağlantıyı kopyala' });
      copy.addEventListener('click', function () { navigator.clipboard.writeText(page.url).then(function () { copy.textContent = 'Kopyalandı ✓'; }); });
      kids.push(el('p', { 'class': 'wiz-sum', text: 'Yazının adresi:' }), el('a', { href: page.url, text: page.url, target: '_blank', rel: 'noopener', 'class': 'wiz-link' }), copy, status);
    } else {
      kids.push(el('p', { 'class': 'wiz-sum', text: 'Taslak olarak kaydedildi (' + page.path + '), yayınlanmaz. Yayınlamak için dosyadaki “published: false” satırını silip dosyayı _posts klasörüne taşıyın.' }));
    }
    kids.push(again);
    show(el('div', { 'class': 'wiz-step' }, kids));
    if (!page.url) return;
    // wait until the page answers (GitHub Pages needs a minute or two to publish it)
    var tries = 0;
    (function poll() {
      status.textContent = 'Yayınlanması bekleniyor… (genellikle 1–2 dakika)';
      fetch(page.url, { cache: 'no-store' }).then(function (r) {
        if (r.ok) { status.textContent = '✓ Sayfa yayında.'; return; }
        if (++tries < 60) setTimeout(poll, 6000); else status.textContent = 'Henüz yayında değil; birkaç dakika sonra bağlantıyı deneyin.';
      }).catch(function () { if (++tries < 60) setTimeout(poll, 6000); });
    })();
  }

  /* ---- Layout: connection bar on top, new page on the left, existing pages on the right ---- */
  root.innerHTML = '';
  bar = el('div', { 'class': 'wiz-bar' });
  main = el('section', { 'class': 'wiz-main' });
  side = el('section', { 'class': 'wiz-side' });
  root.appendChild(bar);
  root.appendChild(el('div', { 'class': 'wiz-grid' }, [main, side]));
  renderBar(); renderSide(); step1();
  }
})();
