const url = window.location.href;
let memosData = []; // ページ上のメモデータを保持する配列

// ストレージ内のデータを更新するヘルパー関数
function updateStorage() {
  chrome.storage.sync.set({ [url]: memosData });
}

// メモをレンダリング（表示）する関数
function renderMemo(memo) {
  // --- DOM要素の作成 ---
  const container = document.createElement('div');
  container.className = 'memo-container';
  container.style.top = memo.top;
  container.style.left = memo.left;
  container.dataset.memoId = memo.id;

  // アイコン部分
  const icon = document.createElement('div');
  icon.className = 'memo-icon';
  icon.textContent = '!';

  // 展開後のコンテンツ部分
  const content = document.createElement('div');
  content.className = 'memo-content';
  
  const header = document.createElement('div');
  header.className = 'memo-header';
  
  const collapseBtn = document.createElement('button');
  collapseBtn.textContent = '−';
  collapseBtn.title = '折りたたむ';
  
  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = '×';
  deleteBtn.title = '削除';
  
  header.appendChild(collapseBtn);
  header.appendChild(deleteBtn);
  
  const text = document.createElement('div');
  text.className = 'memo-text';
  text.textContent = memo.text;
  
  content.appendChild(header);
  content.appendChild(text);
  
  container.appendChild(icon);
  container.appendChild(content);
  document.body.appendChild(container);

  // --- 表示状態の切り替え ---
  function toggleMemoView(isCollapsed) {
    icon.style.display = isCollapsed ? 'flex' : 'none';
    content.style.display = isCollapsed ? 'none' : 'block';
    memo.collapsed = isCollapsed;
    // collapsed状態をストレージに保存
    const memoIndex = memosData.findIndex(m => m.id === memo.id);
    if (memoIndex > -1) {
      memosData[memoIndex].collapsed = isCollapsed;
      updateStorage();
    }
  }
  toggleMemoView(memo.collapsed);

  // --- イベントリスナー ---
  // アイコンクリックで展開
  icon.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMemoView(false);
  });

  // 折りたたみボタンでアイコン化
  collapseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMemoView(true);
  });

  // 削除ボタンの処理
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    container.remove();
    memosData = memosData.filter(m => m.id !== memo.id);
    updateStorage();
  });

  // ドラッグ＆ドロップ機能
  let isDragging = false;
  let offsetX, offsetY;

  container.addEventListener('mousedown', (e) => {
    // ボタンや展開後のメモ自体をクリックした場合はドラッグを開始しない
    if (e.target !== container && e.target !== icon) return;
    isDragging = true;
    offsetX = e.clientX - container.getBoundingClientRect().left;
    offsetY = e.clientY - container.getBoundingClientRect().top;
    container.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    container.style.left = e.clientX - offsetX + 'px';
    container.style.top = e.clientY - offsetY + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    container.style.cursor = 'grab';
    
    // 位置を更新してストレージに保存
    const memoIndex = memosData.findIndex(m => m.id === memo.id);
    if (memoIndex > -1) {
      memosData[memoIndex].top = container.style.top;
      memosData[memoIndex].left = container.style.left;
      updateStorage();
    }
  });
}

// 初期化処理：ページ上のすべてのメモを読み込んで表示
function init() {
  chrome.storage.sync.get([url], (result) => {
    if (result[url]) {
      memosData = result[url];
      memosData.forEach(memo => renderMemo(memo));
    }
  });
}

// ポップアップからのメッセージを受信
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "add_memo") {
    memosData.push(request.data);
    renderMemo(request.data);
    // ストレージはpopup.js側で更新済み
  }
});

init();
