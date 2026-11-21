// "Tüm yazıları gör" button: shows/hides the hidden posts.
(function () {
  var btn = document.getElementById('morebtn'), list = document.getElementById('posts-list');
  if (!btn || !list) return;
  var rest = btn.getAttribute('data-rest');
  btn.addEventListener('click', function () {
    var open = btn.getAttribute('aria-expanded') === 'true';
    list.querySelectorAll('.more').forEach(function (li) { li.hidden = open; });
    btn.setAttribute('aria-expanded', open ? 'false' : 'true');
    btn.innerHTML = open ? '<span class="hv">Tüm yazıları gör</span> <span class="count">' + rest + ' yazı daha</span>' : '<span class="hv">Daha az göster</span>';
  });
})();

// Latest videos: clicking a thumbnail plays it on the page instead of going to YouTube (youtube-nocookie.com).
// Without JavaScript the thumbnail link goes to YouTube.
[].forEach.call(document.querySelectorAll('.vid[data-id]'), function (box) {
  var thumb = box.querySelector('.thumb');
  thumb.addEventListener('click', function (e) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // do not interfere with open-in-new-tab
    e.preventDefault();
    var f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(box.getAttribute('data-id')) + '?autoplay=1&rel=0&playsinline=1';
    f.title = box.getAttribute('data-title') || 'Video';
    f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    f.setAttribute('allowfullscreen', '');
    f.referrerPolicy = 'strict-origin-when-cross-origin';
    var holder = document.createElement('div');
    holder.className = 'thumb playing';
    holder.appendChild(f);
    thumb.replaceWith(holder);
  });
});
// The diagram on the home page: pieces can be dragged and played according to the rules.
// The shrink/grow transition (on scroll) is in the page script below, shared by all pages; this block only provides
// window.__siteBoardResize so the board can be re-measured.
(function () {
  'use strict';
  var el = document.getElementById('home-board');
  if (!el || !window.Chessboard || !window.Chess) return;
  var chess = new window.Chess();
  var btn = document.getElementById('board-reset');

  var box = el.parentNode, lastMove = null, card = document.getElementById('board-link');
  // Hidden "passwords" (index.md front matter, `secrets:`): moves played in this order show a card with a link
  var secretsEl = document.getElementById('board-secrets');
  var secrets = (secretsEl ? JSON.parse(secretsEl.textContent) : []).map(function (x) {
    x.list = String(x.moves).replace(/\d+\.+/g, ' ').split(/\s+/).filter(Boolean);
    return x;
  });

  function update() {
    var h = chess.history();
    if (btn) btn.hidden = h.length === 0;
    // On a secret position the board turns grey and the card appears; it goes away when the game continues or is reset
    var hit = secrets.filter(function (x) { return x.list.length === h.length && x.list.every(function (m, i) { return m === h[i]; }); })[0];
    box.classList.toggle('board-gray', !!hit);
    card.hidden = !hit;
    if (hit) {
      card.href = hit.url;
      card.querySelector('.bl-title').textContent = hit.title;
      card.querySelector('.bl-text').innerHTML = hit.text;
    }
  }

  var board = window.Chessboard(el, {
    position: 'start',
    draggable: true,
    pieceTheme: (el.getAttribute('data-pieces') || 'https://chessboardjs.com/img/chesspieces/wikipedia/') + '{piece}.png',
    onDragStart: function (source, piece) {
      if (previewing || chess.game_over()) return false;
      if ((chess.turn() === 'w' && piece.charAt(0) === 'b') || (chess.turn() === 'b' && piece.charAt(0) === 'w')) return false;
      window.__siteArrow.clear(box);   // the old arrow is removed once a piece is really picked up
    },
    onDrop: function (source, target) {
      var m = chess.move({ from: source, to: target, promotion: 'q' });
      if (m === null) { drawLast(); return 'snapback'; }
      lastMove = [m.from, m.to];
      update();
    },
    onSnapEnd: function () { board.position(chess.fen()); drawLast(); }
  });

  if (btn) btn.addEventListener('click', function () {
    chess.reset();
    lastMove = null; window.__siteArrow.clear(box);
    board.start(true);
    update();
  });

  function drawLast() { if (lastMove) window.__siteArrow.draw(box, el, lastMove[0], lastMove[1]); }

  // Hovering (or focusing) a post link that has a game shows that game's start diagram on the board; leaving puts the played position back
  var previewing = false, shownFen = null;
  function preview(fen) {
    previewing = true; shownFen = fen;
    window.__siteArrow.clear(box);
    board.position(fen, true);
  }
  function unpreview() {
    if (!previewing) return;
    previewing = false; shownFen = null;
    board.position(chess.fen(), true);
    drawLast();
  }
  // The post row at the middle of the board (as the page scrolls) shows its diagram on the board, as long as the reader has not made a
  // move on it. Pointing at a row shows that row's diagram too, but the pointer events a scroll itself causes are ignored: scrolling wins.
  var lastScroll = 0, scrollRaf = 0;
  function syncScroll() {
    var r = box.getBoundingClientRect(), y = Math.min(window.innerHeight * 0.9, Math.max(window.innerHeight * 0.1, r.top + r.height / 2)), fen = null;
    [].forEach.call(document.querySelectorAll('#posts-list li:not([hidden])'), function (li) {
      var a = li.querySelector('a[data-fen]'), q = li.getBoundingClientRect();
      if (a && q.top <= y && q.bottom >= y) fen = a.getAttribute('data-fen');
    });
    if (fen && chess.history().length === 0) { if (fen !== shownFen) preview(fen); }
    else unpreview();
  }
  function schedule() { if (!scrollRaf) scrollRaf = requestAnimationFrame(function () { scrollRaf = 0; syncScroll(); }); }
  window.addEventListener('scroll', function () { lastScroll = Date.now(); schedule(); }, { passive: true });
  window.addEventListener('resize', schedule);
  [].forEach.call(document.querySelectorAll('#posts-list a[data-fen]'), function (a) {
    var fen = a.getAttribute('data-fen');
    function on() { if (Date.now() - lastScroll > 500) preview(fen); }
    function off() { if (Date.now() - lastScroll > 500) syncScroll(); }
    a.addEventListener('mouseenter', on);
    a.addEventListener('mouseleave', off);
    a.addEventListener('focus', on);
    a.addEventListener('blur', off);
  });
  schedule();
  window.__siteBoardResize = function () { board.resize(); drawLast(); };
  new ResizeObserver(function () { board.resize(); drawLast(); }).observe(el);
})();
// Shared page script. On game posts: the board on the left, the text and clickable moves on the right;
// clicking a move shows the position after that move on the board. On every page: the scroll transition and the baseline alignment.
(function () {
  'use strict';
  // Shared by all boards: a faint grey arrow showing the last move (box: .site-board-box, host: the chessboard.js container)
  window.__siteArrow = {
    clear: function (box) { var e = box.querySelector('.site-arrow'); if (e) e.parentNode.removeChild(e); },
    draw: function (box, host, from, to) {
      window.__siteArrow.clear(box);
      if (!from || !to) return;
      var a = host.querySelector('.square-' + from), b = host.querySelector('.square-' + to);
      if (!a || !b) return;
      // layout metrics (not getBoundingClientRect): they ignore the scale/translate transform that runs on the box while it resizes
      var k = { width: box.offsetWidth, height: box.offsetHeight }, s = a.offsetWidth;
      var ax = a.offsetLeft + s / 2, ay = a.offsetTop + s / 2, bx = b.offsetLeft + s / 2, by = b.offsetTop + s / 2;
      var dx = bx - ax, dy = by - ay, L = Math.sqrt(dx * dx + dy * dy);
      if (!L) return;
      var ux = dx / L, uy = dy / L, px = -uy, py = ux, headLen = s * .5, shaft = s * .12, tip = s * .38;
      bx -= ux * s * .08; by -= uy * s * .08;
      var P = function (x, y) { return x.toFixed(1) + ',' + y.toFixed(1); };
      var pts = [
        P(ax + px * shaft, ay + py * shaft), P(bx - ux * headLen + px * shaft, by - uy * headLen + py * shaft), P(bx - ux * headLen + px * tip, by - uy * headLen + py * tip),
        P(bx, by),
        P(bx - ux * headLen - px * tip, by - uy * headLen - py * tip), P(bx - ux * headLen - px * shaft, by - uy * headLen - py * shaft), P(ax - px * shaft, ay - py * shaft)
      ].join(' ');
      var ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('class', 'site-arrow');
      svg.setAttribute('width', k.width); svg.setAttribute('height', k.height);
      svg.setAttribute('aria-hidden', 'true');
      var poly = document.createElementNS(ns, 'polygon');
      poly.setAttribute('points', pts);
      svg.appendChild(poly);
      box.appendChild(svg);
    }
  };
  var root = document.querySelector('.site');
  var CP = window.ChessPublica;
  if (!root || !CP || !window.Chess) return;

  var boxEl = root.querySelector('.site-board-box');
  var interactive = root.getAttribute('data-board') === 'interactive'; // home page: it has its own (playable) board
  var single = root.classList.contains('site-single');                    // private pages: one centred column, no sticky/shrinking left column
  // The game record (PGN) is written in the post body as <pgn>…</pgn> (base.html turns the tag into an inert script block so that
  // ChessPublica does not render it); it is replaced by the move list at the same place
  var pgnBlocks = [].slice.call(document.querySelectorAll('.post-body script[type="text/x-pgn"]'));   // an article can hold several games
  var pgnBlock = pgnBlocks[0] || null;
  var pgnText = pgnBlock ? pgnBlock.textContent : '';
  var listEls = pgnBlocks.map(function (b, i) {
    var el = document.createElement('section');
    el.className = 'game-section';
    el.id = 'game-section' + (i ? '-' + (i + 1) : '');
    el.setAttribute('aria-label', 'Oyun ve hamleler' + (pgnBlocks.length > 1 ? ' ' + (i + 1) : ''));   // unique name when an article holds several games
    b.parentNode.insertBefore(el, b);
    return el;
  });
  var listEl = listEls[0] || null;
  var EMPTY = '8/8/8/8/8/8/8/8 w - - 0 1';
  var fenTag = pgnText.match(/\[FEN\s+"([^"]+)"\]/);
  var START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  var startFen = fenTag ? fenTag[1] : (pgnBlock ? START : EMPTY);   // a game without a [FEN] tag starts from the usual position
  var MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  // Numeric annotation glyphs ($n) of the PGN standard; a NAG without a symbol here is shown as its code ($n), never dropped.
  var NAG = { $1: '!', $2: '?', $3: '!!', $4: '??', $5: '!?', $6: '?!', $7: '□', $8: '□', $9: '??', $10: '=', $11: '=', $12: '=', $13: '∞', $14: '⩲', $15: '⩱', $16: '±', $17: '∓', $18: '+−', $19: '−+', $20: '+−−', $21: '−−+',
    $22: '⨀', $23: '⨀', $24: '○', $25: '○', $26: '○', $27: '○', $28: '○', $29: '○', $30: '⟳', $31: '⟳', $32: '⟳', $33: '⟳', $34: '⟳', $35: '⟳', $36: '↑', $37: '↑', $38: '↑', $39: '↑', $40: '→', $41: '→', $42: '→', $43: '→',
    $44: '=∞', $45: '=∞', $46: '=∞', $47: '=∞', $48: '=∞', $49: '=∞', $132: '⇆', $133: '⇆', $134: '⇆', $135: '⇆', $136: '⇆', $137: '⇆', $138: '⊕', $139: '⊕', $140: '∆', $141: '∇', $142: '⌓', $143: '≤', $144: '≥', $145: 'RR', $146: 'N' };
  function nagText(n) { return NAG[n] || n; }
  var NBSP = ' ';

  var lines = {};      // line number -> [move buttons]
  var state = { line: null, idx: -1 };
  var lineNo = 0;
  var mainLine = null;

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fig(san) { try { return CP.toFigurine(san); } catch (e) { return san; } }

  /* ---- Board: our own chessboard.js instance; clicking a move animates the pieces ---- */
  var board = null, curArrow = null, arrowTimer = 0;
  var boardEl = document.getElementById('site-board-host');
  if (!interactive && boardEl && window.Chessboard) {
    board = window.Chessboard(boardEl, {
      position: pgnBlock ? startFen : {},
      pieceTheme: (window.__pieceBase || 'https://chessboardjs.com/img/chesspieces/wikipedia/') + '{piece}.png',
      moveSpeed: 260,
      appearSpeed: 160,
      showNotation: true
    });
    // A page with players: the left board starts with the pieces set up (usual start position) and switches to the first player's
    // position as soon as the player has parsed its PGN (a moment after the page loads).
    if (!pgnBlock && document.querySelector('pgn-player')) {
      var pl0 = document.querySelector('pgn-player'), tries = 0;
      var hdr0 = function () { var h = pl0._engine && pl0._engine.state && pl0._engine.state.headers; return h && h.FEN; };
      board.position(hdr0() || START, false);
      if (!hdr0()) {
        var wait = setInterval(function () {
          if (hdr0()) { clearInterval(wait); board.position(hdr0(), false); } else if (++tries > 60) clearInterval(wait);
        }, 50);
      }
    }
    window.__siteBoardResize = function () { board.resize(); drawArrow(); };
    new ResizeObserver(function () { board.resize(); drawArrow(); }).observe(boardEl);
  }

  function clearArrow() { clearTimeout(arrowTimer); window.__siteArrow.clear(boxEl); }
  function drawArrow() { if (curArrow && boardEl) window.__siteArrow.draw(boxEl, boardEl, curArrow[0], curArrow[1]); else clearArrow(); }

  function setBoard(fen, from, to) {
    curArrow = from && to ? [from, to] : null;
    if (!board) return;
    clearArrow();
    board.position(fen, true);              // the pieces slide to the new position
    if (curArrow) arrowTimer = setTimeout(drawArrow, 280);
  }

  /* ---- Move buttons ---- */
  function moveBtn(label, san, fen, pfen, from, to, line, idx, nags) {
    // Move-quality NAGs ($1–$9: ! ? !! ?? !? ?!) stick to the move; position-evaluation NAGs ($10 and up: = ± ∞ ...) get one space before them
    var q = [], ev = [];
    (nags || []).forEach(function (n) { (/^\$[1-9]$/.test(n) ? q : ev).push(nagText(n)); });
    var g = q.join('') + (ev.length ? NBSP + ev.join(' ') : '');
    return '<button type="button" class="mv" data-fen="' + esc(fen) + '" data-pfen="' + esc(pfen) + '" data-from="' + from + '" data-to="' + to +
      '" data-line="' + line + '" data-i="' + idx + '">' + esc(label + fig(san) + g) + '</button>';
  }
  function label(n, forceNum) {
    if (n.color === 'w') return n.moveNumber + '.' + NBSP;
    return forceNum ? n.moveNumber + '…' + NBSP : '';
  }
  /* ---- Diagrams inside the text ([#] or [D] in a comment): a small static board in the text column ---- */
  var DG = '\uE000', PARA = '\uE001';
  function diagramHtml(fen) { return '<div class="dg" data-fen="' + esc(fen) + '"></div>'; }
  // The boards are drawn when they come near the screen (a long article can hold dozens; the box already reserves its square)
  var dgObserver = null;
  function drawDiagram(el) {
    if (el.getAttribute('data-ready')) return;
    el.setAttribute('data-ready', '1');
    var b = window.Chessboard(el, { position: el.getAttribute('data-fen'), draggable: false, showNotation: true,
      pieceTheme: (window.__pieceBase || 'https://chessboardjs.com/img/chesspieces/wikipedia/') + '{piece}.png' });
    if (window.ResizeObserver) new ResizeObserver(function () { b.resize(); }).observe(el);
  }
  function initDiagrams(scope) {
    if (!window.Chessboard) return;
    var list = scope.querySelectorAll('.dg:not([data-ready]):not([data-lazy])');
    if (!list.length) return;
    if (!('IntersectionObserver' in window)) { [].forEach.call(list, drawDiagram); return; }
    if (!dgObserver) dgObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { dgObserver.unobserve(e.target); drawDiagram(e.target); } });
    }, { rootMargin: '900px 0px' });
    [].forEach.call(list, function (el) { el.setAttribute('data-lazy', '1'); dgObserver.observe(el); });
  }

  // **bold**, *italic* and ***both*** inside a comment (the text is already escaped)
  function inline(h) {
    return h.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
  }
  // A comment is paragraphs of text (blank line = new paragraph); a paragraph that is only ### Title or #### Title is a heading
  function commentHtml(seg) {
    var html = '';
    seg.split(PARA).forEach(function (chunk) {
      chunk = chunk.replace(/\s+/g, ' ').trim();
      if (!chunk) return;
      var m = chunk.match(/^(#{3,4})\s+(.+)$/);
      html += m ? '<h' + m[1].length + ' class="cm-h">' + esc(m[2]) + '</h' + m[1].length + '>' : '<p class="cm">' + inline(linkify(esc(chunk))) + '</p>';
    });
    return html;
  }
  // [text](https://...) in a comment is a link (the text is already escaped)
  function linkify(h) {
    return h.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }
  function commentText(n) {
    return (n.parts || []).filter(function (p) { return p.type === 'text' && p.value; }).map(function (p) { return p.value.trim(); }).join(' ');
  }

  function renderLine(first, beforeFen, nested) {
    var id = ++lineNo, idx = 0, html = '', para = '', prev = beforeFen, n = first, force = true;
    if (!nested && mainLine === null) mainLine = id;
    function flush() {
      if (para) { html += '<p class="' + (nested ? 'line-var' : 'line-main') + '">' + para + '</p>'; para = ''; }
    }
    while (n) {
      para += (para ? ' ' : '') + moveBtn(label(n, force), n.san, n.fen, prev, n.from, n.to, id, idx++, n.nags);
      force = false;
      var cm = commentText(n), vars = n.variations || [];
      if (cm || vars.length) {
        flush();
        if (cm) cm.split(DG).forEach(function (seg, i) {
          if (i > 0) html += diagramHtml(n.fen);
          seg = seg.trim();
          if (seg) html += commentHtml(seg);
        });
        vars.forEach(function (v) { html += '<div class="var">' + renderLine(v, prev, true) + '</div>'; });
        force = true;
      }
      prev = n.fen;
      n = n.next;
    }
    flush();
    return html;
  }

  /* ---- Move lines inside the text (.move-line) ---- */
  function enhanceInline(el) {
    var fen = el.getAttribute('data-fen') || startFen;
    var g = new window.Chess();
    if (!g.load(fen)) return;
    var id = ++lineNo, idx = 0, out = [], pending = '', prev = fen;
    el.textContent.trim().split(/\s+/).forEach(function (tok) {
      if (/^\{?\[(?:#|D)\]\}?$/.test(tok)) { out.push(diagramHtml(g.fen())); return; }   // {[D]}: a diagram of the position reached so far
      var num = tok.match(/^(\d+)\.(\.\.)?$/) || tok.match(/^(\d+)…$/);
      if (num) { pending = num[1] + (tok.indexOf('..') > -1 || tok.indexOf('…') > -1 ? '…' : '.') + NBSP; return; }
      var m = g.move(tok, { sloppy: true });
      if (m) {
        out.push(moveBtn(pending, m.san, g.fen(), prev, m.from, m.to, id, idx++, []));
        prev = g.fen(); pending = '';
      } else { out.push(esc(tok)); }
    });
    el.innerHTML = out.join(' ');
    initDiagrams(el);
  }

  /* ---- Selection and stepping ---- */
  function collect() {
    lines = {};
    [].forEach.call(root.querySelectorAll('.mv'), function (b) {
      var l = b.getAttribute('data-line');
      (lines[l] = lines[l] || []).push(b);
    });
    Object.keys(lines).forEach(function (l) {
      lines[l].sort(function (a, b) { return +a.getAttribute('data-i') - +b.getAttribute('data-i'); });
    });
  }
  var followPause = 0;   // set when a move is chosen by hand: the scroll that brings it into view must not undo the choice
  function go(line, idx) {
    var arr = lines[line];
    if (!arr) return;
    followPause = Date.now() + 1200;
    var cur = root.querySelector('.mv.on');
    if (cur) cur.classList.remove('on');
    if (document.activeElement && document.activeElement.classList.contains('mv')) document.activeElement.blur(); // a clicked move must not stay highlighted by focus
    state = { line: line, idx: idx };
    if (idx < 0) {
      setBoard(arr[0].getAttribute('data-pfen'));
      return;
    }
    var b = arr[Math.min(idx, arr.length - 1)];
    b.classList.add('on');
    setBoard(b.getAttribute('data-fen'), b.getAttribute('data-from'), b.getAttribute('data-to'));
    var r = b.getBoundingClientRect();
    if (r.top < 80 || r.bottom > window.innerHeight - 40) b.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  function reset() {
    var cur = root.querySelector('.mv.on');
    if (cur) cur.classList.remove('on');
    if (document.activeElement && document.activeElement.classList.contains('mv')) document.activeElement.blur();
    state = { line: mainLine, idx: -1 };
    setBoard(startFen);
  }
  function step(d) {
    if (state.line === null || !lines[state.line]) return;
    var n = state.idx + d;
    if (n < -1 || n >= lines[state.line].length) return;
    go(state.line, n);
  }

  root.addEventListener('click', function (e) {
    var b = e.target.closest('.mv');
    if (b) go(b.getAttribute('data-line'), +b.getAttribute('data-i'));
  });
  document.addEventListener('keydown', function (e) {
    if (interactive) return;
    if (e.altKey || e.ctrlKey || e.metaKey || /input|textarea|select/i.test((e.target || {}).tagName || '')) return;
    if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'Home') reset();
    else return;
    e.preventDefault();
    root.classList.add('kbd-nav');   // the pointer may still rest on a move: its hover highlight stays off until the mouse really moves
  });
  document.addEventListener('mousemove', function (e) { if (e.movementX || e.movementY) root.classList.remove('kbd-nav'); }, { passive: true });

  /* ---- Scrolling: the page itself scrolls (the left column is sticky), so the wheel works natively everywhere ---- */
  var sc = root.querySelector('.site-scroll');
  var se = document.scrollingElement || document.documentElement;

  /* ---- On scroll the brand shrinks and the board grows ---- */
  var raf = 0;
  var compact = false;
  function shrink() {
    raf = 0;
    var wide = window.innerWidth >= 1024 && !interactive && !single, y = se.scrollTop; // no shrinking/growing on the home page
    var next = wide && y > 40;
    if (next === compact) return;
    compact = next;
    var boardBox = boxEl, br = root.querySelector('.site-brand .brand');
    var content = boardBox.firstElementChild, oldContent = content ? content.getBoundingClientRect() : null, oldBox = boardBox.getBoundingClientRect();
    var boardClone = null;
    if (content && oldContent.width) {
      // the old board stays visible in place until the new one is drawn
      boardClone = content.cloneNode(true);
      boardClone.style.cssText = 'position:fixed;margin:0;pointer-events:none;z-index:39;left:' + oldContent.left + 'px;top:' + oldContent.top + 'px;width:' + oldContent.width + 'px;height:' + oldContent.height + 'px';
      document.body.appendChild(boardClone);
    }
    var oldBrand = br ? br.getBoundingClientRect() : null;
    var oldClone = null, wrapper = root.querySelector('.site-brand');
    if (br && oldBrand && oldBrand.width && wrapper) {
      // the .site-brand wrapper is cloned: the font size depends on the container width (cqw)
      var wrapperRect = wrapper.getBoundingClientRect();
      // the old state's class (site-compact) is given to the clone too; otherwise it would be drawn at the wrong (large) size
      oldClone = document.createElement('div');
      oldClone.className = (compact ? '' : 'site-compact') + ' brand-clone';   // brand-clone: the desktop brand rules apply to the clone, which sits outside .site
      oldClone.setAttribute('aria-hidden', 'true');
      oldClone.appendChild(wrapper.cloneNode(true));
      oldClone.style.cssText = 'position:fixed;margin:0;pointer-events:none;z-index:40;background:var(--bg);opacity:1;left:' + wrapperRect.left + 'px;top:' + wrapperRect.top + 'px;width:' + wrapperRect.width + 'px;transform-origin:100% ' + (oldBrand.top - wrapperRect.top) + 'px';
      // the clone is outside .site, so the top padding variable is copied too (otherwise the clone is drawn 40 px too high)
      oldClone.style.setProperty('--site-pad', getComputedStyle(root).getPropertyValue('--site-pad'));
    }
    root.classList.toggle('site-compact', compact);
    if (window.__siteBoardResize) window.__siteBoardResize(); // the board is re-measured to the new size at once
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !oldContent || !oldContent.width) return;
    // Brand and board go from the old size to the new one together with the same easing (FLIP)
    var EASE = 'cubic-bezier(.2,.7,.2,1)';
    function crossfade(el, e, n, clone) {
      var grow = !compact;
      // growing: the old small brand and the new large brand grow together from the top-right corner at the same width and
      // cross-fade; shrinking: the old brand fades while shrinking, the new brand settles into place from the old brand's corner
      var k = grow ? Math.min(1, e.width / n.width) : Math.min(1, n.height / e.height);
      document.body.appendChild(clone);
      void clone.offsetWidth;
      clone.style.transition = grow ? 'transform .5s ' + EASE + ', opacity .22s linear' : 'transform .45s cubic-bezier(.3,.6,.2,1), opacity .25s ease';
      clone.style.transform = grow ? 'translate(0px,0px) scale(' + (1 / k) + ')' : 'translate(' + (n.right - e.right) + 'px,' + (n.top - e.top) + 'px) scale(' + k + ')';
      clone.style.opacity = '0';
      setTimeout(function () { if (clone.parentNode) clone.parentNode.removeChild(clone); }, 600);
      el.style.transition = 'none';
      el.style.transformOrigin = '100% 0';
      el.style.opacity = '0';
      el.style.transform = 'translate(' + (e.right - n.right) + 'px,' + (e.top - n.top) + 'px) scale(' + (grow ? k : Math.min(1, Math.max(.4, e.height / n.height))) + ')';
      void el.offsetWidth;
      el.style.transition = (grow ? 'opacity .26s linear, ' : 'opacity .3s ease .2s, ') + 'transform .5s ' + EASE;
      el.style.opacity = '';
      el.style.transform = '';
    }
    // the board is drawn at the new size (measured synchronously) and transitions from the old size to the new one (FLIP)
    var k = boardBox.getBoundingClientRect();
    boardBox.style.transition = 'none';
    boardBox.style.transformOrigin = '0 0';
    boardBox.style.transform = 'translate(' + (oldBox.left - k.left) + 'px,' + (oldBox.top - k.top) + 'px) scale(' + (oldBox.width / k.width) + ')';
    boardBox.style.opacity = '1';
    if (boardClone && boardClone.parentNode) boardClone.parentNode.removeChild(boardClone);
    void boardBox.offsetWidth;
    boardBox.style.transition = 'transform .5s ' + EASE;
    boardBox.style.transform = '';
    if (br && oldBrand) { var newBrand = br.getBoundingClientRect(); if (newBrand.width) crossfade(br, oldBrand, newBrand, oldClone); }
  }
  if (sc) {
    window.addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(shrink); }, { passive: true });
    window.addEventListener('resize', function () { if (!raf) raf = requestAnimationFrame(shrink); });
  }

  /* ---- The first line of the right column sits on the same baseline as the left "Chess" line ---- */
  function alignBaselines() {
    if (!sc) return;
    var firstHeading = sc.querySelector('.post-header h1, .site-home h2');
    var chessLine = root.querySelector('.site-brand .mark .lt > span[aria-hidden]'); // the "Chess" line
    if (!firstHeading || !chessLine) return;
    if (window.innerWidth < 1024 || single) { sc.style.paddingTop = ''; sc.style.paddingBottom = ''; return; }
    var was = root.classList.contains('site-compact');
    if (was) root.classList.remove('site-compact');
    function baselineOf(el) {
      var p = document.createElement('span');
      p.className = 'baseline-probe';
      el.appendChild(p);
      var y = p.getBoundingClientRect().bottom;
      el.removeChild(p);
      return y;
    }
    sc.style.paddingTop = '';
    // baselines inside the column are measured as if it were scrolled to the top (the column may already be scrolled
    // when this runs on load/resize, e.g. after scroll restoration)
    var st = se.scrollTop;
    var d = baselineOf(chessLine) - (baselineOf(firstHeading) + st);
    var pad = parseFloat(getComputedStyle(sc).paddingTop) || 0;
    sc.style.paddingTop = Math.max(0, pad + d) + 'px';
    // home page: the gap between "Yayınlar" and the first publication equals the one between "Yazılar" and the first post;
    // so that the first publication title stays on the same baseline as the name on the left, the column is moved up by the difference
    var nameEl = root.querySelector('.brand .who'), firstTitle = sc.querySelector('.list li .pt, .site-home > ul > li > a');
    if (nameEl && firstTitle && sc.classList.contains('site-home')) {
      var pad2 = parseFloat(getComputedStyle(sc).paddingTop) || 0;
      sc.style.paddingTop = Math.max(0, pad2 + baselineOf(nameEl) - (baselineOf(firstTitle) + st)) + 'px';
    }
    // when the right column is scrolled to the end, the baseline of the last line sits at the bottom edge of the board; it cannot scroll further
    var lastEl = sc.querySelector('.foot-copy, .site-home > p:last-child');
    sc.style.paddingBottom = '';
    if (lastEl && se.scrollHeight > window.innerHeight) {
      if (!interactive) root.classList.add('site-compact');            // on post pages the board is in this (larger/raised) state after scrolling
      var kr = boxEl.getBoundingClientRect(), B = kr.top + kr.width;
      var savedTop = se.scrollTop;
      window.scrollTo({ top: se.scrollHeight, behavior: 'instant' });
      var lastBaseline = baselineOf(lastEl);
      window.scrollTo({ top: savedTop, behavior: 'instant' });
      if (!interactive) root.classList.remove('site-compact');
      var P = parseFloat(getComputedStyle(sc).paddingBottom) || 0;
      sc.style.paddingBottom = Math.max(0, P + lastBaseline - B) + 'px';
    }
    if (was) root.classList.add('site-compact');
  }
  // the right column stays hidden until the fonts are loaded and the alignment is done (so the downward shift is not visible on load)
  function ready() { root.classList.add('site-ready'); }
  alignBaselines();
  // only the two text fonts gate the reveal (the chess figurine fonts load later, when the move lists are drawn, and must not hold the text back)
  var TR = 'abcşğıİÖÜÇ';
  Promise.all([document.fonts.load('400 1em "Instrument Sans"', TR), document.fonts.load('800 1em "Bricolage Grotesque"', TR)])
    .catch(function () {}).then(function () { alignBaselines(); ready(); });
  document.fonts.ready.then(alignBaselines);   // realign once everything (figurines too) has arrived, without hiding anything
  setTimeout(ready, 2500);
  window.addEventListener('resize', alignBaselines);
  window.addEventListener('load', alignBaselines);

  /* ---- Load the game ---- */
  function nm(s) {
    var p = s.split(',');
    return p.length === 2 ? p[1].trim() + ' ' + p[0].trim() : s;
  }
  // PGN uses "?" (and "-", "????.??.??") for unknown values: they are not shown
  function known(v) { return !!v && !/^[?\-\s.]*$/.test(v); }
  function formatDate(s) {
    var m = (s || '').match(/^(\d{4})\.(\d\d|\?\?)\.(\d\d|\?\?)$/);
    if (!m) return '';
    if (m[2] === '??') return m[1];
    return (m[3] === '??' ? '' : (+m[3]) + ' ') + MONTHS[+m[2] - 1] + ' ' + m[1];
  }
  function build(text, target) {
    // [#] / [D] in a comment is a diagram: it survives the parser as a private character (DG) in the comment text; one at the very
    // start of the movetext (before the first move, where the parser would drop the comment) is remembered separately
    text = text.replace(/^﻿/, '');
    var leadDiagram = false;
    text = text.replace(/(^|\n[ \t]*\n)[ \t]*\{\s*\[(?:#|D)\]\s*\}/, function (m, pre) { leadDiagram = true; return pre; });
    text = text.replace(/\)\{:[^{}]*\}/g, ')');   // a kramdown attribute list after a link inside a comment would end the comment at its brace: drop it (links open in a new tab anyway)
    text = text.replace(/\[(?:#|D)\]/g, DG);
    text = text.replace(/\{[^}]*\}/g, function (c) { return c.replace(/\n[ \t]*\n/g, PARA); });   // a blank line inside a comment is a paragraph break (the parser would flatten it)
    var h = CP.parseHeaders(text);
    var tree = CP.buildMoveTree(text);
    var fen = h.FEN && h.SetUp !== '0' ? h.FEN : START;   // each game has its own start position
    var head = '';
    if (known(h.White) && known(h.Black)) {
      var elo = (known(h.WhiteElo) && known(h.BlackElo)) ? ' <span class="elo">' + esc(h.WhiteElo) + ' · ' + esc(h.BlackElo) + '</span>' : '';
      var sub = [known(h.Event) ? h.Event : '', formatDate(h.Date), known(h.Round) ? h.Round + '. tur' : ''].filter(Boolean).join(' · ');
      head = '<header class="game-header"><h2><span class="gn">' + esc(nm(h.White)) + ' – ' + esc(nm(h.Black)) + '</span>' + elo + '</h2>' +
        (sub ? '<p>' + esc(sub) + '</p>' : '') + '</header>';
    }
    target._fen = fen; target._main = lineNo + 1;   // the start position and the main line id of this game (used when scrolling between games)
    target.innerHTML = head + '<div class="game-moves">' + (leadDiagram ? diagramHtml(fen) : '') + renderLine(tree, fen, false) + '</div>';
    initDiagrams(target);
  }

  [].forEach.call(root.querySelectorAll('.move-line'), enhanceInline);
  collect();
  state = { line: lines[Object.keys(lines)[0]] ? Object.keys(lines)[0] : null, idx: -1 };

  if (pgnBlock && listEl) {
    pgnBlocks.forEach(function (b, i) {
      try { build(b.textContent, listEls[i]); } catch (e) { listEls[i].innerHTML = '<p class="cm">Oyun okunamadı.</p>'; }
    });
    collect();
    // on first load "forward" follows the main line of the (first) game
    if (mainLine) state = { line: String(mainLine), idx: -1 };
  }

  // Scrolling an article with games: the board follows the main line of the game being read. The last main-line move that has reached the
  // middle of the board (the line the board is level with; on phones the middle of the screen below the board) is shown on the board; before the first move of a game the board shows its
  // start position. A move chosen by hand (click, arrow keys) stays on the board until the page is scrolled to another main-line move.
  if (pgnBlocks.length) {
    var followKey = '', followRaf = 0;
    var follow = function () {
      followRaf = 0;
      if (Date.now() < followPause) return;     // the scroll was caused by a click / arrow key (a move scrolled into view)
      var box = document.querySelector('.site-board-box'), y = window.innerHeight * 0.4;
      if (box && !single) {
        var r = box.getBoundingClientRect();
        // wide screens: the line the board is level with; phones/tablets (board above the text): the middle of the screen below the board
        y = window.innerWidth >= 1024 ? Math.min(window.innerHeight * 0.9, Math.max(window.innerHeight * 0.1, r.top + r.height / 2))
          : Math.min(window.innerHeight * 0.95, Math.max(r.bottom + 40, (r.bottom + window.innerHeight) / 2));
      }
      var g = -1;
      listEls.forEach(function (el, i) { var q = el.getBoundingClientRect(); if (q.top <= y && q.bottom >= y) g = i; });
      if (g < 0) return;
      var el = listEls[g], arr = lines[String(el._main)] || [], hit = -1;
      for (var i = 0; i < arr.length; i++) { if (arr[i].getBoundingClientRect().top <= y) hit = i; else break; }
      var key = g + ':' + hit;
      if (key === followKey) return;
      followKey = key;
      var cur = root.querySelector('.mv.on');
      if (cur) cur.classList.remove('on');
      state = { line: String(el._main), idx: hit };
      if (hit < 0) { if (el._fen) setBoard(el._fen); return; }
      var b = arr[hit];
      b.classList.add('on');
      setBoard(b.getAttribute('data-fen'), b.getAttribute('data-from'), b.getAttribute('data-to'));
    };
    var scheduleFollow = function () { if (!followRaf) followRaf = requestAnimationFrame(follow); };
    window.addEventListener('scroll', scheduleFollow, { passive: true });
    window.addEventListener('resize', scheduleFollow);
  }
})();

// Light / dark toggle (the saved choice is applied early by the script in <head>)
(function () {
  var b = document.getElementById('theme-toggle'), h = document.documentElement;
  if (!b) return;
  function isDark() {
    var t = h.getAttribute('data-theme');
    return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  b.addEventListener('click', function () {
    var next = isDark() ? 'light' : 'dark';
    h.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
  });
})();

// Accessibility fixes for the ChessPublica player's markup (it is third-party code): the big play button gets a role and keyboard
// support, and the scrolling move list can be reached with the keyboard.
(function () {
  function fix(root) {
    root.querySelectorAll('.play[aria-label]:not([role])').forEach(function (el) {
      el.setAttribute('role', 'button'); el.tabIndex = 0;
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } });
    });
    root.querySelectorAll('.video-moves:not([tabindex])').forEach(function (el) {
      el.tabIndex = 0; el.setAttribute('role', 'group'); el.setAttribute('aria-label', 'Hamle listesi');
    });
  }
  if (!document.querySelector('pgn-player')) return;
  fix(document);
  new MutationObserver(function () { fix(document); }).observe(document.body, { childList: true, subtree: true });
})();

// Wide screens: the boards of the <pgn-player>s live in the left column. The player's title, comments and variations stay in the right
// column; its board (.player-container) and move list (.video-moves) are placed (position: fixed) over the left column, and only the
// board of the player that has scrolled into view is shown, so the board takes the next player's position as the reader scrolls down.
(function () {
  var site = document.querySelector('.site');
  var host = document.querySelector('.site-left .site-board-wrap');
  if (!site || site.classList.contains('site-single') || !host || !document.querySelector('pgn-player')) return;
  var mq = window.matchMedia('(min-width: 64rem)'), raf = 0, lastSize = 0, lastActive = null;
  function players() { return [].slice.call(document.querySelectorAll('pgn-player')); }
  // Play / pause toggle right of the settings gear (the comment's own round play button is hidden in this layout)
  var SVG = {
    play: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
    pause: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/></svg>' };
  function isPlaying(p) { var e = p._engine; return !!(e && ((e.state && e.state.playing) || (e._variation && e._variation.playing))); }
  function syncToggle(b, p) {
    var on = isPlaying(p) ? 'pause' : 'play';
    if (b.getAttribute('data-state') === on) return;
    b.setAttribute('data-state', on); b.innerHTML = SVG[on]; b.setAttribute('aria-label', on === 'pause' ? 'Duraklat' : 'Oynat'); b.title = b.getAttribute('aria-label');
  }
  function toggleBtn(p, c, want) {
    var tb = c.querySelector('.board-toolbar'), b = tb && tb.querySelector('.pp-toggle');
    if (!want) { if (b) b.remove(); return; }
    if (!tb) return;
    if (!b) {
      b = document.createElement('button'); b.type = 'button'; b.className = 'settings-btn pp-toggle';
      b.addEventListener('click', function (e) { e.stopPropagation(); var e2 = p._engine, v = e2 && e2._variation;
        if (v && !v.playing && v.index >= (v.maxIndex == null ? v.fens.length - 1 : v.maxIndex)) {   // a variation has finished: go back to the game and carry on from there
          var t = v.mainStateIndex; e2.exitVariation(); e2.goTo(t + 1); e2.play();
        } else if (e2) e2.togglePlay();
        syncToggle(b, p); });
      tb.insertBefore(b, tb.firstChild);   // the toolbar is row-reverse: first child = rightmost
    }
    syncToggle(b, p);
  }
  setInterval(function () { if (!mq.matches) return; players().forEach(function (p) { var b = p.querySelector('.pp-toggle'); if (b) syncToggle(b, p); }); }, 250);
  function update() {
    raf = 0;
    var split = mq.matches, root = document.documentElement;
    root.classList.toggle('pp-split', split);
    var ps = players(), vh = window.innerHeight, active = null;
    if (split) ps.forEach(function (p) { if (p.getBoundingClientRect().top <= vh * 0.5) active = p; });
    root.classList.toggle('pp-active', !!active);
    if (active !== lastActive) {   // the arrow keys steer the engine that was last hovered/clicked: make it the one whose board is shown
      lastActive = active;
      if (active && active._engine && active._engine._activate) active._engine._activate();
    }
    var hr = host.getBoundingClientRect(), moves = 84;   // room under the board: settings row + move list
    // One board size for the plain diagram and the players, independent of the (animated) brand height, so nothing resizes when a player
    // takes over: the column width, but short enough for board + hint row + settings row + move list to fit under the compact brand.
    var s = Math.max(200, Math.floor(Math.min(hr.width - 3, vh - 232)));
    root.style.setProperty('--pp-size', s + 'px');
    ps.forEach(function (p) {
      var c = p.querySelector('.player-container'), m = p.querySelector('.video-moves');
      if (!c) return;
      if (!split) {
        toggleBtn(p, c, false);
        p.classList.remove('pp-current');
        c.classList.remove('pp-on'); c.style.cssText = ''; if (m) { m.classList.remove('pp-on'); m.style.cssText = ''; }
        return;
      }
      toggleBtn(p, c, true);
      p.classList.toggle('pp-current', p === active);   // frames the player whose board is in the left column
      c.style.setProperty('--board-size', s + 'px');
      c.style.left = Math.round(hr.right - s) + 'px'; c.style.top = Math.round(hr.top) + 'px';
      c.classList.toggle('pp-on', p === active);
      if (m) {
        m.style.left = Math.round(hr.right - s) + 'px'; m.style.top = Math.round(c.getBoundingClientRect().bottom + (c.classList.contains('puzzle-active') ? 8 : 52)) + 'px'; m.style.width = s + 'px';   // under the board, its puzzle hint row (if any) and the settings row
        m.classList.toggle('pp-on', p === active);
      }
    });
    if (split && s !== lastSize) { lastSize = s; window.dispatchEvent(new Event('resize')); }   // chessboard.js re-measures its width
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(update); }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  if (mq.addEventListener) mq.addEventListener('change', schedule);
  if (window.ResizeObserver) new ResizeObserver(schedule).observe(host);
  new MutationObserver(schedule).observe(document.querySelector('.site-scroll'), { childList: true, subtree: true });
  schedule();
})();

// The ChessPublica player writes its UI strings in English; show them in Turkish (the hint text of puzzles, tooltips and aria labels).
(function () {
  if (!document.querySelector('pgn-player')) return;
  var TR = { 'Show solution move': 'Çözüm hamlesini göster', 'Play': 'Oynat', 'Pause': 'Duraklat', 'pause': 'Duraklat', 'Replay': 'Yeniden oynat',
    'Play variation': 'Varyantı oynat', 'Pause variation': 'Varyantı duraklat', 'Flip board': 'Tahtayı çevir', 'Download PGN': 'PGN indir',
    'Playback speed': 'Oynatma hızı', 'Settings': 'Ayarlar' };
  var raf = 0;
  function run() {
    raf = 0;
    [].forEach.call(document.querySelectorAll('pgn-player .puzzle-hint-text'), function (el) {
      var m = el.textContent.match(/^Find the best move for (White|Black)\.$/);
      if (m) el.textContent = (m[1] === 'White' ? 'Beyaz' : 'Siyah') + ' için en iyi hamleyi bulun.';
    });
    [].forEach.call(document.querySelectorAll('pgn-player [aria-label], pgn-player [title]'), function (el) {
      ['aria-label', 'title'].forEach(function (a) { var v = el.getAttribute(a); if (v && TR[v]) el.setAttribute(a, TR[v]); });
    });
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(run); }
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'title'] });
  schedule();
})();

// Typography: a left single quote used as an apostrophe ("İtalyan Açılışı‘nda", "Nakamura‘nın") is turned into the right single
// quote (’). Only a ‘ that sits between a letter/digit and a letter is changed, so a real opening quote (‘word’) is left alone.
// The letter before it may be in the previous text node (**Negi**‘nin: the bold text ends before the quote).
(function () {
  var raf = 0, LEFT = /[\p{L}\p{N}]/u, RIGHT = /\p{L}/u;
  function fix(root) {
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) { return /^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentNode && n.parentNode.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
    }), nodes = [], n;
    while ((n = w.nextNode())) nodes.push(n);
    nodes.forEach(function (t, i) {
      var s = t.nodeValue;
      if (s.indexOf('\u2018') < 0) return;
      var before = i > 0 ? nodes[i - 1].nodeValue.slice(-1) : '', after = i + 1 < nodes.length ? nodes[i + 1].nodeValue.charAt(0) : '';
      var out = s.replace(/\u2018/g, function (m, k) {
        var l = k > 0 ? s.charAt(k - 1) : before, r = k + 1 < s.length ? s.charAt(k + 1) : after;
        return LEFT.test(l) && RIGHT.test(r) ? '\u2019' : m;
      });
      if (out !== s) t.nodeValue = out;
    });
  }
  // Moves written in the text with English piece letters (Qh5, 33.Rxg7, 32...Qf7) are shown with figurines (♕h5), like the move buttons.
  // Not inside the move buttons, headers or <pgn-player> (which does this itself).
  var SAN = /(?<![\p{L}\p{N}])([KQRBN])([a-h1-8]?x?[a-h][1-8])(?![\p{L}\p{N}])/gu;
  function figurines(root) {
    var CP = window.ChessPublica;
    var scope = root.querySelector('.post-body');
    if (!CP || !CP.toFigurine || !scope) return;   // article pages only
    var w = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!/[KQRBN][a-h1-8x]/.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
        for (var e = n.parentNode; e && e !== scope; e = e.parentNode) if (/^(SCRIPT|STYLE|TEXTAREA|PGN-PLAYER|PGN-STUDY|CODE|BUTTON)$/.test(e.nodeName) || (e.classList && (e.classList.contains('mv') || e.classList.contains('game-header') || e.classList.contains('dg')))) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }), list = [], n;
    while ((n = w.nextNode())) list.push(n);
    list.forEach(function (t) { var o = t.nodeValue.replace(SAN, function (m) { try { return CP.toFigurine(m); } catch (e) { return m; } }); if (o !== t.nodeValue) t.nodeValue = o; });
  }
  // Smileys (🙂 ☺ 😊 :) :-)) are replaced by the site logo (the small hatched square of the brand), in the article text.
  var SMILEY = /\u{1F642}|\u{1F60A}|\u263A\uFE0F?|:-?\)/gu;
  function logos(root) {
    var scope = root.querySelector('.post-body'), src = document.querySelector('.mark-dot svg');
    if (!scope || !src) return;
    var w = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        SMILEY.lastIndex = 0;
        if (!SMILEY.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
        return /^(SCRIPT|STYLE|TEXTAREA|PGN-PLAYER|PGN-STUDY|CODE)$/.test(n.parentNode.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    }), list = [], n;
    while ((n = w.nextNode())) list.push(n);
    list.forEach(function (t) {
      var parts = t.nodeValue.split(SMILEY), frag = document.createDocumentFragment();
      parts.forEach(function (part, i) {
        if (i > 0) { var g = src.cloneNode(true); g.setAttribute('class', 'smiley-logo'); frag.appendChild(g); }
        if (part) frag.appendChild(document.createTextNode(part));
      });
      t.parentNode.replaceChild(frag, t);
    });
  }
  // Bare Lichess game addresses in game comments ("…, 2000, https://lichess.org/0TvGJrHd") become the site's link: "…, 2000. Lichess →".
  // Not inside <pgn-player> (its comments stay plain text on purpose) and not where the address is already a link.
  var LICHESS = /\s*,?\s*(https:\/\/lichess\.org\/[A-Za-z0-9\/#_-]+)/;
  function lichessLinks(root) {
    var scope = root.querySelector('.post-body');
    if (!scope) return;
    var w = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (n.nodeValue.indexOf('https://lichess.org/') < 0) return NodeFilter.FILTER_REJECT;
        for (var e = n.parentNode; e && e !== scope; e = e.parentNode) if (/^(SCRIPT|STYLE|TEXTAREA|PGN-PLAYER|PGN-STUDY|A|CODE)$/.test(e.nodeName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }), list = [], n;
    while ((n = w.nextNode())) list.push(n);
    list.forEach(function (t) {
      var m = t.nodeValue.match(LICHESS);
      if (!m) return;
      var before = t.nodeValue.slice(0, m.index), after = t.nodeValue.slice(m.index + m[0].length);
      var lead = /,\s*$/.test(m[0].slice(0, m[0].indexOf('http'))) || /^\s*,/.test(m[0]) ? '.' : '';
      var a = document.createElement('a');
      a.href = m[1]; a.textContent = 'Lichess →'; a.target = '_blank'; a.rel = 'noopener';
      var frag = document.createDocumentFragment();
      frag.appendChild(document.createTextNode(before + lead + ' '));
      frag.appendChild(a);
      if (after) frag.appendChild(document.createTextNode(after));
      t.parentNode.replaceChild(frag, t);
    });
  }
  // Links to other sites (article text and home page) open in a new tab.
  function externals(root) {
    var scopes = root.querySelectorAll('.post-body, .site-home');   // article text and the home page
    if (!scopes.length) return;
    [].forEach.call(root.querySelectorAll('.post-body a[href], .site-home a[href]'), function (a) {
      if (a.target || !/^https?:/i.test(a.href) || a.hostname === location.hostname) return;
      a.target = '_blank';
      a.rel = ((a.rel || '') + ' noopener').trim();
    });
  }
  // Wide tables scroll sideways (overflow-x): make them reachable with the keyboard.
  function tables(root) { [].forEach.call(root.querySelectorAll('.post-body table:not([tabindex])'), function (t) { t.tabIndex = 0; }); }
  function run() { raf = 0; tables(document.body); fix(document.body); figurines(document.body); logos(document.body); lichessLinks(document.body); externals(document.body); }
  function schedule() { if (!raf) raf = requestAnimationFrame(run); }
  run();                                                           // the games above are built synchronously, so their text is already in the page
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });   // players and other late content
})();
