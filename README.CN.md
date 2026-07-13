# 便捷边栏

Chrome / Edge 浏览器侧边栏插件，提供快捷访问、网页嵌入浏览等能力。

## 功能特性

### 快捷访问管理
- 支持添加常用网站到侧边栏工具栏（最多 7 个快捷槽位）和网格视图
- 支持自定义站点图标，可自动抓取站点 favicon 或本地上传
- 支持拖拽排序
- 溢出快捷方式自动收纳至下拉菜单

### 侧边栏嵌入浏览
- 在侧边栏内以 iframe 形式打开网页，无需离开当前页面
- **突破 iframe 检测**：自动移除 `X-Frame-Options`、`Content-Security-Policy` 及 Cookie 同站限制（`SameSite`/`Secure`/`Partitioned`），绕过网站对 iframe 嵌入的拦截
- 支持模拟移动端 User-Agent 访问（Android Chrome）

### 搜索引擎
- 内置 Google、Bing、百度搜索
- 支持自定义搜索 URL 模板

### 加载模式
- **侧边栏加载**：在侧边栏内嵌框架中打开
- **浏览器加载**：在新标签页中打开

### 启动页设置
- 快捷访问主页
- 自定义启动网址

### 工具栏图标
- 亮色图标 / 暗色图标 / 自定义图标（支持上传本地图片）

## 安装

### Chrome
1. 打开 Chrome 浏览器，进入 `chrome://extensions/`
2. 开启 **开发者模式**
3. 点击 **加载已解压的扩展程序**，选择本插件所在目录

### Edge
1. 打开 Edge 浏览器，进入 `edge://extensions/`
2. 开启 **开发人员模式**
3. 点击 **加载解压缩的扩展**，选择本插件所在目录

## 使用

1. 点击工具栏插件图标打开侧边栏
2. 点击工具栏上的 **+** 按钮或快捷访问网格中的 **添加** 按钮，从当前页面快速添加站点
3. 点击快捷方式在侧边栏中打开，或右键在新标签页中打开
4. 在设置页中自定义启动页、搜索引擎、图标主题等

## 项目结构

```
便捷边栏/
├── manifest.json          # 插件清单（Manifest V3）
├── background.js          # Service Worker 后台脚本
├── sidepanel.html         # 侧边栏入口页面
├── sidepanel.js           # 侧边栏主逻辑（快捷访问、嵌入浏览）
├── sidepanel.css          # 侧边栏样式
├── options.html           # 设置页面
├── options.js             # 设置页面逻辑
├── options.css            # 设置页面样式
├── viewer.html            # 独立页面查看器
├── viewer.js              # 查看器逻辑
├── frame-bypass.js        # iframe 嵌入 bypass（UA 模拟、Cookie 处理）
├── embed-rules.js         # declarativeNetRequest 请求头规则
├── icon-theme.js          # 工具栏图标主题管理
├── icon-store.js          # 站点图标抓取与存储
├── sidebar-home.js        # 主页快捷方式处理
├── icons/                 # 图标资源
│   ├── icon16.png
│   ├── icon48.png
│   ├── icon128.png
│   ├── icon-dark16.png
│   ├── icon-dark48.png
│   ├── icon-dark128.png
│   ├── plugin-icon.svg
│   ├── plugin-icon-dark.svg
│   ├── home.svg
│   ├── plus.svg
│   ├── drag.svg
│   ├── down.svg
│   └── ...
└── scripts/
    └── generate-icons.mjs # 图标生成脚本
```

## 技术栈

- **Manifest V3** — 最新扩展标准
- **Service Worker** — 后台常驻脚本
- **declarativeNetRequest** — 声明式网络请求修改（User-Agent、安全头移除）
- **chrome.sidePanel** — 侧边栏 API
- **chrome.storage** — 本地持久化存储
- **Content Script (MAIN world)** — 在 iframe 中注入 UA 模拟与 Cookie 处理

## 作者

- [刘已然](https://cheng.me/)

## 许可

MIT
