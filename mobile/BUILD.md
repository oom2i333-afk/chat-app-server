# WeTalk 移动端构建指南

## 前置要求

### Android (APK)
1. Java 17 JDK
2. Android Studio (或 Android SDK Commandline Tools)
3. Gradle (项目自带 gradlew)

### iOS (IPA)
- macOS + Xcode 15+

---

## 一键构建脚本

### Windows (Android APK)

```powershell
# 1. 安装 Java 17
winget install EclipseAdoptium.Temurin.17.JDK

# 2. 设置 JAVA_HOME 环境变量
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.11.10-hotspot"

# 3. 生成移动端入口页
cd mobile
node build.js

# 4. 同步 Capacitor
npm run sync

# 5. 构建 APK (Release)
npm run android:build
```

APK 文件位置: `mobile/android/app/build/outputs/apk/release/app-release.apk`

### macOS (iOS IPA)

```bash
# 1. 生成移动端入口页
cd mobile
node build.js

# 2. 同步 Capacitor
npm run sync

# 3. 在 Xcode 中打开
npm run ios:open

# 4. 在 Xcode 中:
#    - 选择 Product → Archive
#    - 点击 Distribute App → App Store Connect / Ad Hoc
```

IPA 文件由 Xcode Archive 生成。

---

## 如果没有构建环境

可以直接在浏览器中使用 PWA 安装：

### Android
1. 打开 Chrome → 访问 https://chat-app-server-production-a0da.up.railway.app
2. 点菜单 → "添加到主屏幕" (Add to Home screen)
3. 会以全屏 WebApp 方式运行，接近原生体验

### iOS
1. 打开 Safari → 访问 https://chat-app-server-production-a0da.up.railway.app
2. 点分享按钮 → "添加到主屏幕" (Add to Home Screen)
3. 会以全屏方式运行，支持推送通知
