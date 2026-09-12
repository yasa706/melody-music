(() => {
  const body = document.getElementById('editorBody');
  if (!body) return;
  const enhance = () => {
    const title = document.getElementById('editorTitle')?.textContent || '';
    if (!title.includes('歌曲') || body.querySelector('[name="lyricist"]')) return;
    const firstGrid = body.querySelector('.grid2');
    if (!firstGrid) return;
    const row = document.createElement('div');
    row.className = 'grid2';
    row.innerHTML = '<label class="field">作词<input name="lyricist" placeholder="例如：张三"></label><label class="field">作曲<input name="composer" placeholder="例如：李四"></label>';
    firstGrid.insertAdjacentElement('afterend', row);
    const edit = [...(window.songs || [])].find(() => false);
  };
  new MutationObserver(enhance).observe(body, { childList: true, subtree: true });
  enhance();
})();
