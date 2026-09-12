(() => {
  const body = document.getElementById('editorBody');
  if (!body) return;
  let editingCredits = null;

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-edit-song]');
    if (!button) { if (event.target.closest('#primaryAction')) editingCredits = null; return; }
    try {
      const response = await fetch('/api/admin/songs/' + button.dataset.editSong, { credentials: 'same-origin' });
      const payload = await response.json();
      editingCredits = payload.song || null;
    } catch { editingCredits = null; }
  }, true);

  const enhance = () => {
    const title = document.getElementById('editorTitle')?.textContent || '';
    if (!title.includes('歌曲') || body.querySelector('[name="lyricist"]')) return;
    const firstGrid = body.querySelector('.grid2');
    if (!firstGrid) return;
    const row = document.createElement('div');
    row.className = 'grid2';
    const lyricist = String(editingCredits?.lyricist || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
    const composer = String(editingCredits?.composer || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
    row.innerHTML = `<label class="field">作词<input name="lyricist" value="${lyricist}" placeholder="例如：张三"></label><label class="field">作曲<input name="composer" value="${composer}" placeholder="例如：李四"></label>`;
    firstGrid.insertAdjacentElement('afterend', row);
  };
  new MutationObserver(enhance).observe(body, { childList: true, subtree: true });
  enhance();
})();
