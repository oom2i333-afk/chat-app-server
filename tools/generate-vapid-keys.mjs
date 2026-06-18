/**
 * WeTalk VAPID 密钥生成器
 *
 * 用法:
 *   1. npm install web-push
 *   2. node tools/generate-vapid-keys.mjs
 *   3. 将输出的密钥添加到环境变量或 .env 文件中
 *
 * 必须添加的环境变量:
 *   VAPID_PUBLIC_KEY=<公钥>
 *   VAPID_PRIVATE_KEY=<私钥>
 *   VAPID_SUBJECT=mailto:admin@wetalk.app
 */

try {
  const webpush = await import('web-push').catch(() => {
    console.error('请先安装 web-push: npm install web-push');
    process.exit(1);
  });

  const vapidKeys = webpush.generateVAPIDKeys();

  console.log('\n=== WeTalk VAPID 密钥 ===\n');
  console.log('请将以下内容添加到环境变量或 .env 文件中：\n');
  console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
  console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
  console.log(`VAPID_SUBJECT=mailto:admin@wetalk.app`);
  console.log('\n==========================\n');
  console.log('公钥需要在前端注册推送订阅时使用。');
  console.log('在 app.js 中调用 Notification API 时传入此公钥。\n');
} catch (err) {
  console.error('生成失败:', err.message);
  process.exit(1);
}
