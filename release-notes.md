# base6-techo v0.1.0

首个公开版本：在本地把整本手帐配置排成印刷级 PDF。

## 包含内容

- 桌面端：Linux（.deb / AppImage）、Windows（.msi / NSIS 安装程序）、macOS（Apple Silicon / Intel 的 .dmg）。
- Android：arm64-v8a APK，最低 Android 7.0。
- 所有安装包均附带 `.sha256` 校验文件。

## 功能

- 八种页心：空白、横线、点阵、方格、方眼罫、八分周视图、月历、月打卡。
- 纸张预设 A4 / A5 / B5 / A6 / B6 / Letter，以及 30–1000 mm 的自定义尺寸。
- 单页、骑马订、锁线分帖三种拼版；按帖自动补白与配页。
- Tectonic 与宏包缓存内嵌在应用里，编译过程不需要联网。
- 内嵌 PDF 预览；整本配置可导入 / 导出。
- 界面支持简体中文与 English。

## 安装说明

- **macOS**：构建未签名、未公证。首次打开若被 Gatekeeper 拦截，请在 Finder 中右键应用 → “打开”，或到“系统设置 → 隐私与安全性”中允许。
- **Windows**：安装包未做代码签名，SmartScreen 可能提示“未知发布者”；选择“更多信息 → 仍要运行”。
- **Linux**：AppImage 需要 FUSE；也可以直接安装 `.deb`。
- **Android**：仅提供 arm64-v8a，需要允许浏览器安装未知来源应用。

## 校验

```bash
sha256sum -c base6-techo_0.1.0_linux_x86_64.AppImage.sha256
```

Windows PowerShell：

```powershell
Get-FileHash .\base6-techo_0.1.0_windows_x64.exe -Algorithm SHA256
```

## 已知限制

- 暂不提供应用内自动更新；新版本请从 Releases 页面下载。
- macOS 与 Windows 安装包当前没有代码签名。
- Android 仅支持 64 位 arm64 设备。
