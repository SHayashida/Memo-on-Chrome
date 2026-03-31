// 現在アクティブなタブの情報を取得
async function getCurrentTab() {
  let queryOptions = { active: true, currentWindow: true };
  let [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}

function canInjectIntoTab(tab) {
  return tab?.id && tab?.url && /^https?:/.test(tab.url);
}

async function ensureContentScriptReady(tabId) {
  await chrome.scripting.insertCSS({
    target: { tabId },
    files: ['memo.css']
  });

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content_script.js']
  });
}

async function sendAddMemoMessage(tab, newMemo) {
  if (!canInjectIntoTab(tab)) {
    throw new Error('This tab does not allow memo injection.');
  }

  await ensureContentScriptReady(tab.id);
  await chrome.tabs.sendMessage(tab.id, { action: 'add_memo', data: newMemo });
}

// ポップアップが読み込まれたときの処理
document.addEventListener('DOMContentLoaded', () => {
  const memoText = document.getElementById('memo-text');
  const addButton = document.getElementById('add-button');

  // 追加ボタンの処理
  addButton.addEventListener('click', async () => {
    const text = memoText.value;
    if (!text) {
      return; // テキストが空の場合は何もしない
    }

    const tab = await getCurrentTab();
    const url = tab.url;

    // 新しいメモオブジェクトを作成
    const newMemo = {
      id: Date.now(), // ユニークIDとしてタイムスタンプを使用
      text: text,
      top: '10px',
      left: '10px',
      collapsed: true // 初期状態は折りたたみ
    };

    // 既存のメモ配列を取得し、新しいメモを追加して保存
    chrome.storage.sync.get([url], (result) => {
      const memos = result[url] || [];
      memos.push(newMemo);
      chrome.storage.sync.set({ [url]: memos }, async () => {
        console.log('New memo added for ' + url);
        // content_scriptにメッセージを送信して新しいメモを即時表示
        try {
          await sendAddMemoMessage(tab, newMemo);
        } catch (error) {
          console.error('Failed to render memo immediately:', error);
        }
        window.close(); // ポップアップを閉じる
      });
    });
  });
});
