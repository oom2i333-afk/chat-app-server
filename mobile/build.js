/**
 * Chat App - 移动端构建脚本
 * 用法: node build.js [server-url]
 * 默认: https://chat-app-server.up.railway.app
 */
const fs = require('fs');
const path = require('path');

const serverUrl = process.argv[2] || 'https://chat-app-server-production-a0da.up.railway.app';
const srcDir = path.join(__dirname, 'src');

// 生成 index.html
const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<title>Chat App</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:100%; height:100%; overflow:hidden; background:#2e2e2e; }
  #loading {
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    height:100%; background:linear-gradient(135deg,#1aad19,#06b025); color:#fff;
    font-family:-apple-system,BlinkMacSystemFont,sans-serif;
  }
  .spinner {
    width:40px; height:40px; border:3px solid rgba(255,255,255,.2);
    border-top-color:#fff; border-radius:50%; animation:spin .8s linear infinite;
    margin-bottom:1rem;
  }
  @keyframes spin { to{transform:rotate(360deg)} }
  .loading-text { font-size:1rem; opacity:.9; }
  iframe {
    position:fixed; top:0; left:0; width:100%; height:100%; border:none;
  }
  .offline-banner {
    position:fixed; bottom:0; left:0; right:0; background:#e74c3c; color:#fff;
    text-align:center; padding:.4rem; font-size:.8rem; font-family:sans-serif;
    z-index:999; display:none;
  }
</style>
</head>
<body>
  <div id="loading">
    <div class="spinner"></div>
    <div class="loading-text">Chat App 加载中...</div>
  </div>
  <div id="offlineBanner" class="offline-banner">⚠️ 网络连接断开，请检查网络后重试</div>
  <script>
    const SERVER_URL = ${JSON.stringify(serverUrl)};
    const loading = document.getElementById('loading');
    const offlineBanner = document.getElementById('offlineBanner');

    // 创建 iframe 加载服务器
    const iframe = document.createElement('iframe');
    iframe.src = SERVER_URL;
    iframe.onload = () => { loading.style.display = 'none'; };

    // 在线状态检测
    window.addEventListener('online', () => { offlineBanner.style.display = 'none'; iframe.src = iframe.src; });
    window.addEventListener('offline', () => { offlineBanner.style.display = 'block'; });

    // 加载失败提示
    iframe.onerror = () => {
      loading.innerHTML = \`
        <div style="text-align:center">
          <div style="font-size:3rem;margin-bottom:.5rem">📡</div>
          <p style="font-size:.9rem;opacity:.8">无法连接到服务器</p>
          <p style="font-size:.75rem;opacity:.6;margin-top:.3rem">\${SERVER_URL}</p>
          <button onclick="location.reload()" style="margin-top:1rem;padding:.5rem 1.5rem;border:2px solid #fff;border-radius:8px;background:transparent;color:#fff;font-size:.9rem;cursor:pointer">重试</button>
        </div>
      \`;
    };

    document.body.prepend(iframe);
    document.body.appendChild(offlineBanner);
  </script>
</body>
</html>`;

fs.writeFileSync(path.join(srcDir, 'index.html'), html);
console.log('✅ 移动端入口已生成');
console.log('📡 服务器地址:', serverUrl);
console.log('');
console.log('下一步:');
console.log('  cd mobile');
console.log('  npm run sync     # 同步到 Android/iOS 项目');
console.log('  npm run android:open  # 在 Android Studio 中打开');
console.log('  npm run ios:open      # 在 Xcode 中打开 (需 macOS)');
