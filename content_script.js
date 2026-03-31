(() => {
  if (window.__memoOnChromeContentScriptLoaded) {
    return;
  }
  window.__memoOnChromeContentScriptLoaded = true;

  const url = window.location.href;
  let memosData = []; // ページ上のメモデータを保持する配列

  // ストレージ内のデータを更新するヘルパー関数
  function updateStorage() {
    chrome.storage.sync.set({ [url]: memosData });
  }

  function findMemoIndex(memoId) {
    return memosData.findIndex((item) => item.id === memoId);
  }

  function updateMemoData(memoId, updates) {
    const memoIndex = findMemoIndex(memoId);
    if (memoIndex === -1) {
      return;
    }

    memosData[memoIndex] = { ...memosData[memoIndex], ...updates };
    updateStorage();
  }

  function clampMemoPosition(container, top, left) {
    const margin = 8;
    const maxTop = Math.max(margin, window.innerHeight - container.offsetHeight - margin);
    const maxLeft = Math.max(margin, window.innerWidth - container.offsetWidth - margin);
    const clampedTop = Math.min(Math.max(top, margin), maxTop);
    const clampedLeft = Math.min(Math.max(left, margin), maxLeft);

    return {
      top: clampedTop,
      left: clampedLeft
    };
  }

  function renderMemo(memo) {
    const existingMemo = document.querySelector(`[data.memo-id="${memo.id}"]`);
    if (existingMemo) {
      existingMemo.remove();
    }

    const container = document.createElement('div');
    container.className = 'memo-container';
    container.style.top = memo.top;
    container.style.left = memo.left;
    container.dataset.memoId = memo.id;

    const icon = document.createElement('div');
    icon.className = 'memo-icon';
    icon.textContent = '!';

    const content = document.createElement('div');
    content.className = 'memo-content';

    const header = document.createElement('div');
    header.className = 'memo-header';

    const collapseBtn = document.createElement('button');
    collapseBtn.textContent = '−';
    collapseBtn.title = '折りたたむ';

    const editBtn = document.createElement('button');
    editBtn.textContent = '編集';
    editBtn.title = '編集';

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '×';
    deleteBtn.title = '削除';

    header.appendChild(collapseBtn);
    header.appendChild(editBtn);
    header.appendChild(deleteBtn);

    const text = document.createElement('div');
    text.className = 'memo-text';
    text.textContent = memo.text;

    const editor = document.createElement('textarea');
    editor.className = 'memo-editor';
    editor.value = memo.text;

    const editorActions = document.createElement('div');
    editorActions.className = 'memo-editor-actions';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = '保存';
    saveBtn.title = '保存';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'キャンセル';
    cancelBtn.title = 'キャンセル';

    editorActions.appendChild(saveBtn);
    editorActions.appendChild(cancelBtn);

    content.appendChild(header);
    content.appendChild(text);
    content.appendChild(editor);
    content.appendChild(editorActions);

    container.appendChild(icon);
    container.appendChild(content);
    document.body.appendChild(container);

    const initialPosition = clampMemoPosition(
      container,
      parseInt(memo.top, 10) || 10,
      parseInt(memo.left, 10) || 10
    );
    container.style.top = initialPosition.top + 'px';
    container.style.left = initialPosition.left + 'px';

    if (container.style.top !== memo.top || container.style.left !== memo.left) {
      memo.top = container.style.top;
      memo.left = container.style.left;
      updateMemoData(memo.id, {
        top: memo.top,
        left: memo.left
      });
    }

    let isEditing = false;
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    function toggleMemoView(isCollapsed) {
      icon.style.display = isCollapsed ? 'flex' : 'none';
      content.style.display = isCollapsed ? 'none' : 'block';
      memo.collapsed = isCollapsed;
      updateMemoData(memo.id, { collapsed: isCollapsed });
    }

    function toggleEditMode(nextEditing) {
      isEditing = nextEditing;
      text.style.display = nextEditing ? 'none' : 'block';
      editor.style.display = nextEditing ? 'block' : 'none';
      editorActions.style.display = nextEditing ? 'flex' : 'none';
      editBtn.style.display = nextEditing ? 'none' : 'inline-block';
      collapseBtn.disabled = nextEditing;
      deleteBtn.disabled = nextEditing;

      if (nextEditing) {
        editor.value = memo.text;
        editor.focus();
        editor.setSelectionRange(editor.value.length, editor.value.length);
      }
    }

    toggleMemoView(memo.collapsed);
    toggleEditMode(false);

    icon.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMemoView(false);
    });

    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMemoView(true);
    });

    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleEditMode(true);
    });

    saveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nextText = editor.value.trim();

      if (!nextText) {
        editor.value = memo.text;
        return;
      }

      memo.text = nextText;
      text.textContent = nextText;
      updateMemoData(memo.id, { text: nextText });
      toggleEditMode(false);
    });

    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      editor.value = memo.text;
      toggleEditMode(false);
    });

    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      container.remove();
      memosData = memosData.filter((item) => item.id !== memo.id);
      updateStorage();
    });

    container.addEventListener('mousedown', (e) => {
      if (isEditing) return;
      if (e.target !== container && e.target !== icon) return;
      isDragging = true;
      offsetX = e.clientX - container.getBoundingClientRect().left;
      offsetY = e.clientY - container.getBoundingClientRect().top;
      container.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const nextPosition = clampMemoPosition(
        container,
        e.clientY - offsetY,
        e.clientX - offsetX
      );
      container.style.left = nextPosition.left + 'px';
      container.style.top = nextPosition.top + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      container.style.cursor = 'grab';
      memo.top = container.style.top;
      memo.left = container.style.left;
      updateMemoData(memo.id, {
        top: memo.top,
        left: memo.left
      });
    });
  }

  function renderAllMemos() {
    document.querySelectorAll('.memo-container').forEach((memoElement) => {
      memoElement.remove();
    });
    memosData.forEach((memo) => renderMemo(memo));
  }

  function init() {
    chrome.storage.sync.get([url], (result) => {
      if (result[url]) {
        memosData = result[url];
        renderAllMemos();
      }
    });
  }

  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'add_memo') {
      const existingIndex = findMemoIndex(request.data.id);
      if (existingIndex === -1) {
        memosData.push(request.data);
      } else {
        memosData[existingIndex] = request.data;
      }
      renderMemo(request.data);
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync' || !changes[url]) {
      return;
    }

    memosData = changes[url].newValue || [];
    renderAllMemos();
  });

  init();
})();
