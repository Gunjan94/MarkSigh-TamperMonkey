// ==UserScript==
// @name         MarkSight — Markdown Viewer
// @namespace    https://marksight.app
// @version      2.3.0
// @description  Renders .md files beautifully with TOC, syntax highlighting, dark mode, editor, and export to PDF/Word/HTML
// @author       MarkSight
// @match        file:///*/*.md
// @match        file:///*/*.markdown
// @match        file:///*/*.mdown
// @match        file:///*/*.mkd
// @match        https://*/*.md
// @match        https://*/*.markdown
// @match        https://*/*.mdown
// @match        https://*/*.mkd
// @match        http://*/*.md
// @match        http://*/*.markdown
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @run-at       document-end
// @require      https://cdn.jsdelivr.net/npm/marked@12.0.1/marked.min.js
// @require      https://cdn.jsdelivr.net/npm/dompurify@3.0.9/dist/purify.min.js
// @require      https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js
// ==/UserScript==

(function () {
  'use strict';

  // Only activate on markdown files (any URL ending in .md/.markdown/.mdown/.mkd)
  var url = window.location.href.split('?')[0].split('#')[0]; // strip query/hash
  if (!/\.(md|markdown|mdown|mkd)$/i.test(url)) return;

  // Don't activate if page already has rich HTML rendering (not raw text)
  var bodyChildren = document.body.children;
  if (bodyChildren.length > 3) return; // Already rendered page — skip

  var rawMarkdown = document.body.innerText || document.body.textContent;
  if (!rawMarkdown.trim()) return;

  // State
  var currentMarkdown = rawMarkdown;
  var isEditMode = false;
  var isDarkMode = false;
  var isTocOpen = true;
  var isSearchOpen = false;
  var searchMatches = [];
  var searchIndex = 0;
  var debounceTimer = null;

  // Inject styles
  GM_addStyle(`
    :root {
      --bg-primary: #ffffff; --bg-secondary: #f6f8fa; --bg-toolbar: rgba(255,255,255,0.82);
      --bg-sidebar: rgba(246,248,250,0.95); --text-primary: #24292f; --text-secondary: #57606a;
      --text-muted: #8b949e; --border: #d0d7de; --border-light: #e8ecf0;
      --accent: #6366f1; --accent-hover: #4f46e5; --accent-bg: #eef2ff;
      --code-bg: #f6f8fa; --font-body: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
      --toolbar-h: 56px; --sidebar-w: 260px; --ease: 0.2s cubic-bezier(0.4,0,0.2,1);
    }
    .ms-dark {
      --bg-primary: #0d1117; --bg-secondary: #161b22; --bg-toolbar: rgba(13,17,23,0.85);
      --bg-sidebar: rgba(22,27,34,0.95); --text-primary: #e6edf3; --text-secondary: #8b949e;
      --text-muted: #6e7681; --border: #30363d; --border-light: #21262d;
      --accent: #818cf8; --accent-hover: #a5b4fc; --accent-bg: #1e1b4b; --code-bg: #161b22;
    }
    body.ms-active { margin:0; padding:0; background:var(--bg-secondary); font-family:var(--font-body); color:var(--text-primary); line-height:1.6; }
    .ms-toolbar { position:fixed; top:0; left:0; right:0; height:var(--toolbar-h); background:var(--bg-toolbar); backdrop-filter:blur(12px); border-bottom:1px solid var(--border-light); display:flex; align-items:center; padding:0 20px; gap:10px; z-index:10000; }
    .ms-toolbar-title { font-size:14px; font-weight:600; margin-right:auto; display:flex; align-items:center; gap:10px; }
    .ms-toolbar-logo { width:28px; height:28px; background:linear-gradient(135deg,#6366f1,#8b5cf6); border-radius:4px; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; font-size:12px; }
    .ms-btn { padding:7px 14px; border-radius:6px; border:1px solid var(--border); background:var(--bg-primary); color:var(--text-primary); font-size:12.5px; font-weight:500; cursor:pointer; display:flex; align-items:center; gap:6px; transition:all var(--ease); font-family:var(--font-body); }
    .ms-btn:hover { border-color:var(--accent); color:var(--accent); }
    .ms-btn.active { background:var(--accent); color:#fff; border-color:var(--accent); }
    .ms-btn.primary { background:var(--accent); color:#fff; border-color:var(--accent); }
    .ms-toc { position:fixed; top:var(--toolbar-h); left:0; width:var(--sidebar-w); height:calc(100vh - var(--toolbar-h)); background:var(--bg-sidebar); border-right:1px solid var(--border-light); overflow-y:auto; padding:20px 0; z-index:9000; transition:transform var(--ease); }
    .ms-toc.collapsed { transform:translateX(-100%); }
    .ms-toc-title { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.6px; color:var(--text-muted); padding:0 20px 12px; }
    .ms-toc-item { display:block; padding:6px 20px; font-size:13px; color:var(--text-secondary); cursor:pointer; border-left:3px solid transparent; transition:all var(--ease); text-decoration:none; }
    .ms-toc-item:hover { color:var(--accent); background:var(--accent-bg); }
    .ms-toc-item.active { color:var(--accent); border-left-color:var(--accent); background:var(--accent-bg); }
    .ms-toc-item[data-level="2"] { padding-left:32px; }
    .ms-toc-item[data-level="3"] { padding-left:44px; font-size:12px; }
    .ms-toc-item[data-level="4"] { padding-left:56px; font-size:12px; }
    .ms-wrapper { margin-top:var(--toolbar-h); min-height:calc(100vh - var(--toolbar-h)); display:flex; transition:margin-left var(--ease); }
    .ms-wrapper.has-toc { margin-left:var(--sidebar-w); }
    .ms-wrapper.toc-collapsed { margin-left:0; }
    .ms-rendered { max-width:880px; width:100%; margin:0 auto; padding:48px 64px; background:var(--bg-primary); min-height:calc(100vh - var(--toolbar-h)); box-shadow:0 1px 2px rgba(0,0,0,0.06); }
    .ms-wrapper.edit-mode .ms-rendered { max-width:none; width:50%; margin:0; padding:40px; overflow-y:auto; height:calc(100vh - var(--toolbar-h)); border-left:1px solid var(--border); }
    .ms-rendered h1 { font-size:2em; font-weight:700; margin:0 0 16px; padding-bottom:12px; border-bottom:1px solid var(--border-light); }
    .ms-rendered h2 { font-size:1.5em; font-weight:600; margin:32px 0 16px; padding-bottom:8px; border-bottom:1px solid var(--border-light); }
    .ms-rendered h3 { font-size:1.25em; font-weight:600; margin:28px 0 12px; }
    .ms-rendered p { margin:0 0 16px; }
    .ms-rendered a { color:var(--accent); text-decoration:none; }
    .ms-rendered code { font-family:var(--font-mono); font-size:85%; background:var(--code-bg); padding:2px 7px; border-radius:4px; border:1px solid var(--border-light); }
    .ms-rendered pre { background:var(--code-bg); border:1px solid var(--border); border-radius:6px; padding:16px 20px; overflow-x:auto; margin:0 0 16px; position:relative; }
    .ms-rendered pre code { background:none; border:none; padding:0; font-size:13px; line-height:1.55; }
    .ms-rendered table { border-collapse:collapse; width:100%; margin:0 0 16px; }
    .ms-rendered th, .ms-rendered td { border:1px solid var(--border); padding:8px 14px; text-align:left; }
    .ms-rendered th { background:var(--bg-secondary); font-weight:600; }
    .ms-rendered blockquote { border-left:4px solid var(--accent); margin:0 0 16px; padding:10px 20px; color:var(--text-secondary); background:var(--bg-secondary); border-radius:0 6px 6px 0; }
    .ms-rendered img { max-width:100%; border-radius:6px; }
    .ms-rendered hr { border:none; border-top:2px solid var(--border-light); margin:28px 0; }
    .ms-rendered ul, .ms-rendered ol { margin:0 0 16px; padding-left:2em; }
    .ms-rendered li { margin:4px 0; }
    .ms-code-copy { position:absolute; top:8px; right:8px; padding:4px 10px; font-size:11px; background:var(--bg-primary); border:1px solid var(--border); border-radius:4px; cursor:pointer; opacity:0; transition:opacity var(--ease); }
    .ms-rendered pre:hover .ms-code-copy { opacity:1; }
    .ms-editor { display:none; width:50%; height:calc(100vh - var(--toolbar-h)); flex-direction:column; background:var(--bg-primary); }
    .ms-wrapper.edit-mode .ms-editor { display:flex; }
    .ms-editor textarea { flex:1; padding:20px 24px; border:none; resize:none; font-family:var(--font-mono); font-size:13px; line-height:1.6; color:var(--text-primary); background:var(--bg-primary); outline:none; }
    .ms-editor-status { height:28px; background:var(--bg-secondary); border-top:1px solid var(--border-light); display:flex; align-items:center; padding:0 16px; font-size:11px; color:var(--text-muted); gap:16px; }
    .ms-search { position:fixed; top:var(--toolbar-h); left:50%; transform:translateX(-50%) translateY(-100%); width:420px; background:var(--bg-primary); border:1px solid var(--border); border-top:none; border-radius:0 0 12px 12px; box-shadow:0 12px 28px rgba(0,0,0,0.12); padding:12px 16px; display:flex; align-items:center; gap:10px; z-index:11000; opacity:0; transition:transform 0.25s, opacity 0.2s; }
    .ms-search.visible { transform:translateX(-50%) translateY(0); opacity:1; }
    .ms-search input { flex:1; padding:8px 12px; border:1px solid var(--border); border-radius:4px; font-size:13px; background:var(--bg-secondary); color:var(--text-primary); outline:none; }
    .ms-search input:focus { border-color:var(--accent); }
    .ms-search-count { font-size:12px; color:var(--text-muted); min-width:40px; text-align:center; }
    .ms-search button { width:28px; height:28px; border:1px solid var(--border); border-radius:4px; background:var(--bg-primary); cursor:pointer; font-size:14px; }
    .ms-highlight { background:#fff3b0; border-radius:2px; }
    .ms-dark .ms-highlight { background:#5c4b00; }
    .ms-highlight.current { background:#ffad33; }
    .ms-modal { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:20000; align-items:center; justify-content:center; }
    .ms-modal.visible { display:flex; }
    .ms-modal-dialog { background:var(--bg-primary); border-radius:12px; padding:32px; width:380px; box-shadow:0 12px 28px rgba(0,0,0,0.12); }
    .ms-modal-dialog h3 { margin:0 0 20px; font-size:18px; }
    .ms-export-opt { display:flex; align-items:center; padding:16px; border:1px solid var(--border); border-radius:6px; margin-bottom:12px; cursor:pointer; gap:14px; transition:all var(--ease); }
    .ms-export-opt:hover { border-color:var(--accent); background:var(--accent-bg); }
    .ms-export-opt-icon { font-size:28px; width:40px; text-align:center; }
    .ms-export-opt-label { font-weight:600; font-size:14px; }
    .ms-export-opt-desc { font-size:12px; color:var(--text-secondary); }
    .ms-toast { position:fixed; bottom:24px; right:24px; padding:12px 20px; background:var(--text-primary); color:var(--bg-primary); border-radius:6px; font-size:13px; font-weight:500; z-index:30000; opacity:0; transform:translateY(16px); transition:all 0.3s; }
    .ms-toast.visible { opacity:1; transform:translateY(0); }
    @media print { .ms-toolbar, .ms-toc, .ms-editor, .ms-search, .ms-modal, .ms-toast, .ms-code-copy { display:none !important; } .ms-wrapper { margin:0 !important; } .ms-rendered { max-width:100% !important; padding:0 !important; box-shadow:none !important; } }
  `);

  // Build UI
  function buildUI() {
    document.body.textContent = '';
    document.body.className = 'ms-active' + (isDarkMode ? ' ms-dark' : '');
    document.title = getFileName() + ' \u2014 MarkSight';

    // Toolbar
    var toolbar = el('div', 'ms-toolbar');
    toolbar.innerHTML = '<div class="ms-toolbar-title"><div class="ms-toolbar-logo">M</div><span></span></div>';
    toolbar.querySelector('span').textContent = getFileName();

    var btns = [
      { id: 'search', text: '\uD83D\uDD0D', title: 'Search (Ctrl+F)' },
      { id: 'theme', text: '\uD83C\uDF19', title: 'Dark mode' },
      { id: 'toc', text: '\uD83D\uDCD1', title: 'TOC' },
      { id: 'raw', text: '\uD83D\uDCC4 Raw', title: 'Raw view' },
      { id: 'edit', text: '\u270F\uFE0F Edit', title: 'Editor (Ctrl+E)' },
      { id: 'save', text: '\uD83D\uDCBE Save', title: 'Save (Ctrl+S)', hide: true },
      { id: 'export', text: '\uD83D\uDCE4 Export', title: 'Export', primary: true }
    ];

    btns.forEach(function(b) {
      var btn = el('button', 'ms-btn' + (b.primary ? ' primary' : ''));
      btn.id = 'ms-' + b.id;
      btn.textContent = b.text;
      btn.title = b.title || '';
      if (b.hide) btn.style.display = 'none';
      toolbar.appendChild(btn);
    });
    document.body.appendChild(toolbar);

    // TOC
    var toc = el('div', 'ms-toc');
    var tocTitle = el('div', 'ms-toc-title');
    tocTitle.textContent = 'Table of Contents';
    toc.appendChild(tocTitle);
    toc.appendChild(el('nav', 'ms-toc-list'));
    document.body.appendChild(toc);

    // Wrapper
    var wrapper = el('div', 'ms-wrapper has-toc');
    wrapper.id = 'ms-wrapper';

    // Editor
    var editor = el('div', 'ms-editor');
    var textarea = el('textarea');
    textarea.id = 'ms-textarea';
    textarea.spellcheck = false;
    editor.appendChild(textarea);
    var status = el('div', 'ms-editor-status');
    status.innerHTML = '<span id="ms-lines">Lines: 0</span><span id="ms-words">Words: 0</span><span id="ms-chars">Chars: 0</span>';
    editor.appendChild(status);
    wrapper.appendChild(editor);

    // Rendered
    var rendered = el('div', 'ms-rendered');
    rendered.id = 'ms-rendered';
    wrapper.appendChild(rendered);
    document.body.appendChild(wrapper);

    // Search
    var search = el('div', 'ms-search');
    search.innerHTML = '<input id="ms-search-input" placeholder="Search..."><span class="ms-search-count" id="ms-search-count">0/0</span><button id="ms-search-prev">\u25B2</button><button id="ms-search-next">\u25BC</button><button id="ms-search-close">\u2715</button>';
    document.body.appendChild(search);

    // Export modal
    var modal = el('div', 'ms-modal');
    modal.innerHTML = '<div class="ms-modal-dialog"><h3>Export Document</h3><div class="ms-export-opt" id="ms-exp-pdf"><div class="ms-export-opt-icon">\uD83D\uDCD5</div><div><div class="ms-export-opt-label">Export as PDF</div><div class="ms-export-opt-desc">Print to PDF</div></div></div><div class="ms-export-opt" id="ms-exp-word"><div class="ms-export-opt-icon">\uD83D\uDCD8</div><div><div class="ms-export-opt-label">Export as Word</div><div class="ms-export-opt-desc">Formatted .doc file</div></div></div><div class="ms-export-opt" id="ms-exp-html"><div class="ms-export-opt-icon">\uD83C\uDF10</div><div><div class="ms-export-opt-label">Export as HTML</div><div class="ms-export-opt-desc">Standalone file</div></div></div></div>';
    document.body.appendChild(modal);

    // Events
    qs('#ms-search').addEventListener('click', function() { toggleSearch(true); });
    qs('#ms-theme').addEventListener('click', toggleTheme);
    qs('#ms-toc').addEventListener('click', toggleToc);
    qs('#ms-raw').addEventListener('click', toggleRaw);
    qs('#ms-edit').addEventListener('click', toggleEdit);
    qs('#ms-save').addEventListener('click', saveFile);
    qs('#ms-export').addEventListener('click', function() { toggleModal(true); });
    qs('#ms-search-input').addEventListener('input', performSearch);
    qs('#ms-search-prev').addEventListener('click', function() { navSearch(-1); });
    qs('#ms-search-next').addEventListener('click', function() { navSearch(1); });
    qs('#ms-search-close').addEventListener('click', function() { toggleSearch(false); });
    modal.addEventListener('click', function(e) { if (e.target === modal) toggleModal(false); });
    qs('#ms-exp-pdf').addEventListener('click', function() { exportPDF(); toggleModal(false); });
    qs('#ms-exp-word').addEventListener('click', function() { exportWord(); toggleModal(false); });
    qs('#ms-exp-html').addEventListener('click', function() { exportHTML(); toggleModal(false); });
    qs('#ms-textarea').addEventListener('input', onInput);
    qs('#ms-textarea').addEventListener('keydown', function(e) {
      if (e.key === 'Tab') { e.preventDefault(); var s = e.target.selectionStart; e.target.value = e.target.value.slice(0,s) + '  ' + e.target.value.slice(e.target.selectionEnd); e.target.selectionStart = e.target.selectionEnd = s + 2; e.target.dispatchEvent(new Event('input')); }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
      if (e.ctrlKey && e.key === 'e') { e.preventDefault(); toggleEdit(); }
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveFile(); }
      if (e.ctrlKey && e.key === 'f') { e.preventDefault(); toggleSearch(true); }
      if (e.ctrlKey && e.key === 'p') { e.preventDefault(); toggleModal(true); }
      if (e.key === 'Escape') { toggleSearch(false); toggleModal(false); }
      if (isSearchOpen && e.key === 'Enter') { e.preventDefault(); navSearch(e.shiftKey ? -1 : 1); }
    });

    updateRendered();
  }

  // Rendering
  function updateRendered() {
    var r = qs('#ms-rendered');
    try {
      r.innerHTML = renderMd(currentMarkdown);
      postProcess(r);
      generateToc(r);
    } catch(e) {
      r.textContent = currentMarkdown;
    }
  }

  function renderMd(md) {
    if (typeof marked !== 'undefined') {
      marked.setOptions({ gfm: true, breaks: true });
      var html = marked.parse(md);
      if (typeof DOMPurify !== 'undefined') html = DOMPurify.sanitize(html);
      return html;
    }
    return '<pre>' + esc(md) + '</pre>';
  }

  function postProcess(container) {
    container.querySelectorAll('pre code').forEach(function(block) {
      if (block.className.indexOf('language-mermaid') !== -1) return;
      try { if (typeof hljs !== 'undefined') hljs.highlightElement(block); } catch(e) {}
    });
    container.querySelectorAll('pre').forEach(function(pre) {
      if (pre.querySelector('.ms-code-copy')) return;
      var btn = el('button', 'ms-code-copy');
      btn.textContent = 'Copy';
      btn.addEventListener('click', function() {
        var text = pre.querySelector('code') ? pre.querySelector('code').textContent : pre.textContent;
        GM_setClipboard(text);
        btn.textContent = '\u2713';
        setTimeout(function() { btn.textContent = 'Copy'; }, 2000);
      });
      pre.appendChild(btn);
    });
    container.querySelectorAll('input[type="checkbox"]').forEach(function(cb) { cb.removeAttribute('disabled'); });
  }

  function generateToc(container) {
    var list = qs('.ms-toc-list');
    list.textContent = '';
    container.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(function(h, i) {
      h.id = h.id || ('h-' + i);
      var a = el('a', 'ms-toc-item');
      a.textContent = h.textContent;
      a.dataset.level = h.tagName[1];
      a.href = '#' + h.id;
      a.addEventListener('click', function(e) { e.preventDefault(); h.scrollIntoView({ behavior: 'smooth' }); });
      list.appendChild(a);
    });
  }

  // Toggles
  function toggleTheme() {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('ms-dark', isDarkMode);
    qs('#ms-theme').textContent = isDarkMode ? '\u2600\uFE0F' : '\uD83C\uDF19';
  }

  function toggleToc() {
    isTocOpen = !isTocOpen;
    qs('.ms-toc').classList.toggle('collapsed', !isTocOpen);
    qs('#ms-wrapper').classList.toggle('toc-collapsed', !isTocOpen);
  }

  function toggleRaw() {
    var btn = qs('#ms-raw');
    var r = qs('#ms-rendered');
    var isRaw = btn.classList.toggle('active');
    if (isRaw) { r.textContent = ''; var pre = el('pre'); pre.style.cssText = 'white-space:pre-wrap;font-family:monospace;font-size:13px;padding:20px;'; pre.textContent = currentMarkdown; r.appendChild(pre); }
    else updateRendered();
  }

  function toggleEdit() {
    isEditMode = !isEditMode;
    qs('#ms-wrapper').classList.toggle('edit-mode', isEditMode);
    qs('#ms-edit').classList.toggle('active', isEditMode);
    qs('#ms-save').style.display = isEditMode ? 'flex' : 'none';
    qs('#ms-raw').style.display = isEditMode ? 'none' : 'flex';
    if (isEditMode) { qs('#ms-textarea').value = currentMarkdown; updateStatus(); qs('#ms-textarea').focus(); }
    else updateRendered();
  }

  function toggleSearch(show) {
    isSearchOpen = show;
    qs('.ms-search').classList.toggle('visible', show);
    if (show) qs('#ms-search-input').focus();
    else { clearHL(); qs('#ms-search-input').value = ''; qs('#ms-search-count').textContent = '0/0'; }
  }

  function toggleModal(show) { qs('.ms-modal').classList.toggle('visible', show); }

  // Editor
  function onInput() {
    currentMarkdown = qs('#ms-textarea').value;
    updateStatus();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function() {
      try { qs('#ms-rendered').innerHTML = renderMd(currentMarkdown); postProcess(qs('#ms-rendered')); } catch(e) {}
    }, 200);
  }

  function updateStatus() {
    var t = currentMarkdown;
    qs('#ms-lines').textContent = 'Lines: ' + t.split('\n').length;
    qs('#ms-words').textContent = 'Words: ' + (t.trim() ? t.trim().split(/\s+/).length : 0);
    qs('#ms-chars').textContent = 'Chars: ' + t.length;
  }

  // Search
  function performSearch() {
    clearHL();
    var q = qs('#ms-search-input').value.trim();
    if (!q) { qs('#ms-search-count').textContent = '0/0'; searchMatches = []; return; }
    var r = qs('#ms-rendered');
    var walker = document.createTreeWalker(r, NodeFilter.SHOW_TEXT);
    searchMatches = [];
    var regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    var nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    var count = 0;
    nodes.forEach(function(node) {
      if (count >= 500) return;
      var matches = []; var m;
      while ((m = regex.exec(node.textContent)) !== null) matches.push(m);
      regex.lastIndex = 0;
      if (!matches.length) return;
      var frag = document.createDocumentFragment(); var last = 0;
      matches.forEach(function(match) {
        if (count >= 500) return;
        frag.appendChild(document.createTextNode(node.textContent.slice(last, match.index)));
        var mark = el('mark', 'ms-highlight');
        mark.textContent = match[0]; frag.appendChild(mark);
        searchMatches.push(mark); last = match.index + match[0].length; count++;
      });
      frag.appendChild(document.createTextNode(node.textContent.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });
    searchIndex = 0; updateSearchHL();
  }

  function navSearch(dir) {
    if (!searchMatches.length) return;
    searchIndex = (searchIndex + dir + searchMatches.length) % searchMatches.length;
    updateSearchHL();
  }

  function updateSearchHL() {
    searchMatches.forEach(function(m, i) { m.classList.toggle('current', i === searchIndex); });
    if (searchMatches[searchIndex]) searchMatches[searchIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
    qs('#ms-search-count').textContent = searchMatches.length ? (searchIndex + 1) + '/' + searchMatches.length : '0/0';
  }

  function clearHL() {
    document.querySelectorAll('.ms-highlight').forEach(function(m) {
      if (m.parentNode) { m.parentNode.replaceChild(document.createTextNode(m.textContent), m); m.parentNode.normalize(); }
    });
    searchMatches = [];
  }

  // Save & Export
  function saveFile() { dlFile(currentMarkdown, getFileName(), 'text/markdown'); toast('Saved to Downloads'); }

  function exportPDF() { window.print(); toast('Use Print dialog to save as PDF'); }

  function exportWord() {
    var html = renderMd(currentMarkdown);
    html = html.replace(/<strong>/g, '<b>').replace(/<\/strong>/g, '</b>');
    html = html.replace(/<em>/g, '<i>').replace(/<\/em>/g, '</i>');
    var doc = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>body{font-family:Calibri,sans-serif;font-size:11pt;line-height:1.6}h1{font-size:20pt;font-weight:bold;border-bottom:1pt solid #ccc;padding-bottom:6pt}h2{font-size:16pt;font-weight:bold}h3{font-size:13pt;font-weight:bold}b{font-weight:bold}i{font-style:italic}code{font-family:Consolas,monospace;font-size:10pt;background:#f5f5f5}pre{font-family:Consolas,monospace;font-size:10pt;background:#f5f5f5;padding:10pt;border:1pt solid #ddd}table{border-collapse:collapse;width:100%}th,td{border:1pt solid #999;padding:6pt 10pt}th{background:#f0f0f0;font-weight:bold}blockquote{border-left:3pt solid #6366f1;padding-left:12pt;color:#555;font-style:italic}</style></head><body>' + html + '</body></html>';
    dlBlob(new Blob(['\ufeff' + doc], { type: 'application/msword' }), getFileName().replace(/\.md$/i, '.doc'));
    toast('Word exported!');
  }

  function exportHTML() {
    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + esc(getFileName()) + '</title><style>body{font-family:-apple-system,sans-serif;font-size:16px;line-height:1.6;max-width:860px;margin:40px auto;padding:0 24px;color:#24292f}h1{font-size:2em;border-bottom:1px solid #d0d7de;padding-bottom:10px}h2{font-size:1.5em;border-bottom:1px solid #d0d7de;padding-bottom:8px}code{background:#f6f8fa;padding:2px 6px;border-radius:4px;font-size:85%}pre{background:#f6f8fa;padding:16px;border-radius:6px;border:1px solid #d0d7de}table{border-collapse:collapse;width:100%}th,td{border:1px solid #d0d7de;padding:8px 12px}th{background:#f6f8fa}blockquote{border-left:4px solid #6366f1;padding:8px 16px;color:#57606a;background:#f6f8fa}</style></head><body>' + renderMd(currentMarkdown) + '</body></html>';
    dlBlob(new Blob([html], { type: 'text/html' }), getFileName().replace(/\.md$/i, '.html'));
    toast('HTML exported!');
  }

  // Utilities
  function getFileName() { return decodeURIComponent(window.location.pathname.split('/').pop()) || 'document.md'; }
  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function qs(s) { return document.querySelector(s); }
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function dlFile(c, name, type) { dlBlob(new Blob([c], { type: type }), name); }
  function dlBlob(blob, name) { var u = URL.createObjectURL(blob); var a = document.createElement('a'); a.href = u; a.download = name; a.click(); setTimeout(function() { URL.revokeObjectURL(u); }, 1000); }
  function toast(msg) {
    var t = qs('.ms-toast');
    if (!t) { t = el('div', 'ms-toast'); document.body.appendChild(t); }
    t.textContent = msg;
    requestAnimationFrame(function() { t.classList.add('visible'); });
    setTimeout(function() { t.classList.remove('visible'); }, 3500);
  }

  buildUI();
})();
