/* Signel Services — site behaviour. No dependencies. */
(function () {
  'use strict';

  /* ---- mobile nav ---- */
  var burger = document.querySelector('.burger');
  var nav = document.querySelector('.nav');
  if (burger && nav) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* ---- product gallery ---- */
  var gal = document.querySelector('.gallery');
  if (gal) {
    var main = gal.querySelector('.main img');
    gal.querySelectorAll('.thumbs button').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!main) return;
        main.src = b.getAttribute('data-src');
        main.alt = b.querySelector('img').alt;
        gal.querySelectorAll('.thumbs button').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
      });
    });
  }

  /* ---- search (header + category filter) ---- */
  var ROOT = document.documentElement.getAttribute('data-root') || '';
  var index = null, loading = null;
  function loadIndex() {
    if (index) return Promise.resolve(index);
    if (loading) return loading;
    loading = fetch(ROOT + '/search-index.json').then(function (r) { return r.json(); }).then(function (d) { index = d; return d; });
    return loading;
  }
  function norm(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function score(item, q, terms) {
    var name = norm(item.n), sku = norm(item.s), cat = norm(item.c);
    if (sku && sku === q) return 100;
    if (sku && sku.indexOf(q) === 0) return 80;
    var s = 0;
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i];
      if (name.indexOf(t) >= 0) s += 10; else if (sku.indexOf(t) >= 0) s += 8; else if (cat.indexOf(t) >= 0) s += 3; else return 0;
    }
    if (name.indexOf(q) >= 0) s += 15;
    return s;
  }
  function search(q, limit) {
    q = norm(q).trim();
    if (q.length < 2) return [];
    var terms = q.split(/\s+/);
    var out = [];
    for (var i = 0; i < index.length; i++) {
      var sc = score(index[i], q, terms);
      if (sc > 0) out.push([sc, index[i]]);
    }
    out.sort(function (a, b) { return b[0] - a[0] || a[1].n.localeCompare(b[1].n); });
    return out.slice(0, limit).map(function (x) { return x[1]; });
  }
  var box = document.querySelector('.search');
  if (box) {
    var input = box.querySelector('input');
    var results = box.querySelector('.search-results');
    var timer;
    function render(items) {
      if (!items.length) { results.classList.remove('open'); results.innerHTML = ''; return; }
      results.innerHTML = items.map(function (it) {
        var img = it.i ? '<img src="' + ROOT + it.i + '" alt="">' : '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="">';
        return '<a href="' + ROOT + it.u + '">' + img + '<span>' + esc(it.n) + '</span>' + (it.s ? '<span class="sku">' + esc(it.s) + '</span>' : '') + '</a>';
      }).join('');
      results.classList.add('open');
    }
    input.addEventListener('input', function () {
      clearTimeout(timer);
      var q = input.value;
      timer = setTimeout(function () { loadIndex().then(function () { render(search(q, 12)); }); }, 120);
    });
    input.addEventListener('focus', function () { loadIndex(); });
    document.addEventListener('click', function (e) { if (!box.contains(e.target)) results.classList.remove('open'); });
    box.addEventListener('submit', function (e) {
      e.preventDefault();
      location.href = ROOT + '/search/?q=' + encodeURIComponent(input.value);
    });
  }
  /* search results page */
  var page = document.querySelector('[data-search-page]');
  if (page) {
    var q = new URLSearchParams(location.search).get('q') || '';
    var qi = page.querySelector('input[name=q]'); if (qi) qi.value = q;
    var target = page.querySelector('.grid');
    var count = page.querySelector('[data-count]');
    loadIndex().then(function () {
      var items = search(q, 200);
      if (count) count.textContent = items.length + ' result' + (items.length === 1 ? '' : 's') + (q ? ' for "' + q + '"' : '');
      target.innerHTML = items.map(card).join('');
    });
  }
  /* client-side filter inside a category listing */
  var filter = document.querySelector('[data-filter]');
  if (filter) {
    var cards = Array.prototype.slice.call(document.querySelectorAll('.grid .pcard'));
    var empty = document.querySelector('[data-empty]');
    filter.addEventListener('input', function () {
      var q = norm(filter.value).trim();
      var shown = 0;
      cards.forEach(function (c) {
        var hit = !q || norm(c.getAttribute('data-name') + ' ' + c.getAttribute('data-sku')).indexOf(q) >= 0;
        c.style.display = hit ? '' : 'none'; if (hit) shown++;
      });
      if (empty) empty.style.display = shown ? 'none' : '';
    });
  }
  function card(it) {
    var img = it.i ? '<img src="' + ROOT + it.i + '" alt="" loading="lazy">' : '<span>No image</span>';
    return '<a class="pcard" href="' + ROOT + it.u + '"><div class="img' + (it.i ? '' : ' noimg') + '">' + img + '</div><div class="body"><h3>' + esc(it.n) + '</h3>' + (it.s ? '<div class="sku">' + esc(it.s) + '</div>' : '') + '</div></a>';
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---- forms: post JSON to the configured endpoint. Never pretend to succeed. ---- */
  document.querySelectorAll('form[data-form]').forEach(function (f) {
    var endpoint = f.getAttribute('data-endpoint') || document.documentElement.getAttribute('data-form-endpoint') || '';
    var msg = f.querySelector('.msg');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!f.checkValidity()) { f.reportValidity(); return; }
      var data = {}; new FormData(f).forEach(function (v, k) { data[k] = v; });
      data._form = f.getAttribute('data-form'); data._page = location.href;
      if (!endpoint) {
        msg.className = 'msg err';
        msg.textContent = 'This form is not connected yet. Please email ' + (f.getAttribute('data-fallback') || 'us') + ' directly.';
        return;
      }
      var btn = f.querySelector('[type=submit]'); if (btn) btn.disabled = true;
      fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(function (r) { if (!r.ok) throw new Error(r.status); msg.className = 'msg ok'; msg.textContent = 'Thank you — your request has been sent.'; f.reset(); })
        .catch(function () { msg.className = 'msg err'; msg.textContent = 'Sorry, the request could not be sent. Please try again or contact us by phone.'; })
        .then(function () { if (btn) btn.disabled = false; });
    });
  });
})();
