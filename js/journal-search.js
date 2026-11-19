(() => {
  'use strict';

  const dialog = document.querySelector('.search-dialog');
  if (!dialog) return;
  const trigger = document.querySelector('.search-trigger');
  const input = dialog.querySelector('input');
  const status = dialog.querySelector('.search-status');
  const results = dialog.querySelector('.search-results');
  const suggestions = dialog.querySelector('.search-suggestions');
  let index;
  let pending;
  let timer;
  let opener;

  async function loadIndex() {
    const response = await fetch(dialog.dataset.index);
    if (!response.ok) throw new Error('Index unavailable');
    const xml = new DOMParser().parseFromString(await response.text(), 'application/xml');
    if (xml.querySelector('parsererror')) throw new Error('Invalid index');
    const decoder = document.createElement('textarea');
    return [...xml.querySelectorAll('entry')].map(entry => {
      const title = entry.querySelector('title').textContent.trim();
      const terms = [...entry.querySelectorAll('tag,category')].map(tag => tag.textContent.toLowerCase());
      const plain = entry.querySelector('content')?.textContent || '';
      decoder.innerHTML = plain.replace(/</g, '&lt;');
      const body = decoder.value.replace(/\s+/g, ' ').trim();
      return {title, heading: title.toLowerCase(), terms, body, text: body.toLowerCase(), url: entry.querySelector('url').textContent};
    });
  }

  function highlight(element, value, words) {
    const lower = value.toLowerCase();
    let from = 0;
    while (from < value.length) {
      let start = value.length, match = '';
      for (const word of words) {
        const pos = lower.indexOf(word, from);
        if (pos !== -1 && pos < start) { start = pos; match = word; }
      }
      element.append(document.createTextNode(value.slice(from, start)));
      if (!match) break;
      const mark = document.createElement('mark');
      mark.textContent = value.slice(start, start + match.length);
      element.append(mark);
      from = start + match.length;
    }
  }

  async function search() {
    const query = input.value.trim().toLowerCase();
    suggestions.hidden = Boolean(query);
    results.replaceChildren();
    status.textContent = '';
    if (!query) return;
    if (!index) {
      status.textContent = '正在加载搜索索引…';
      try {
        pending = pending || loadIndex();
        index = await pending;
      } catch {
        pending = undefined;
        if (input.value.trim().toLowerCase() === query) {
          status.textContent = '搜索索引加载失败。';
          const retry = document.createElement('button');
          retry.className = 'text-link';
          retry.textContent = '重新加载';
          retry.addEventListener('click', search);
          status.append(retry);
        }
        return;
      }
    }
    if (!dialog.open || input.value.trim().toLowerCase() !== query) return;
    const words = [...new Set(query.split(/\s+/))];
    const matches = [];
    for (const entry of index) {
      let score = 0;
      for (const word of words) {
        if (entry.heading.includes(word)) score += 8;
        else if (entry.terms.some(term => term.includes(word))) score += 4;
        else if (entry.text.includes(word)) score++;
        else { score = 0; break; }
      }
      if (score) matches.push({entry, score});
    }
    matches.sort((a, b) => b.score - a.score);
    status.textContent = matches.length ? '找到 ' + matches.length + ' 篇笔记' : '没有找到相关笔记，试试其他关键词。';
    const list = document.createDocumentFragment();
    for (const {entry} of matches) {
      const row = document.createElement('li');
      const link = document.createElement('a');
      link.href = entry.url;
      const title = document.createElement('strong');
      highlight(title, entry.title, words);
      link.append(title);
      if (entry.body) {
        const hit = words.map(word => entry.text.indexOf(word)).filter(pos => pos >= 0).sort((a,b) => a-b)[0] || 0;
        const start = Math.max(0, hit - 20);
        const excerpt = document.createElement('p');
        highlight(excerpt, (start ? '…' : '') + entry.body.slice(start, start + 85) + (entry.body.length > start + 85 ? '…' : ''), words);
        link.append(excerpt);
      }
      row.append(link);
      list.append(row);
    }
    results.replaceChildren(list);
  }

  function openSearch() {
    if (dialog.open) return;
    opener = document.activeElement;
    dialog.showModal();
    input.focus();
    input.select();
    search();
  }
  trigger.addEventListener('click', openSearch);
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !event.isComposing) {
      event.preventDefault();
      event.stopPropagation();
      dialog.close();
    }
  });
  dialog.addEventListener('close', () => {
    if (opener instanceof HTMLElement && opener !== document.body) opener.focus();
    else trigger.focus();
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
  document.addEventListener('keydown', event => {
    const editable = event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);
    if (event.key === '/' && !editable && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      openSearch();
    }
  });
  suggestions.addEventListener('click', event => {
    const button = event.target.closest('[data-query]');
    if (!button) return;
    input.value = button.dataset.query;
    input.focus();
    search();
  });
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(search, 80);
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' && results.firstElementChild) {
      event.preventDefault();
      results.querySelector('a').focus();
    }
  });
})();
