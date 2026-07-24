> [简体中文](https://github.com/CM-idea/Convenient-Sidebar/blob/main/README.CN.md)

# Convenient Sidebar

A Chrome / Edge browser side panel extension that provides quick access shortcuts and in-sidebar web page embedding.

## Features

### Quick Access Management
- Add frequently used websites to the sidebar toolbar (up to 7 slots) and grid view
- Custom site icons — auto-fetch favicon or upload locally
- Drag-and-drop reordering
- Overflow shortcuts are automatically tucked into a dropdown menu

### In-Sidebar Browsing
- Open web pages inside the sidebar via iframe without leaving the current page
- **Bypass iframe detection**: Automatically strips `X-Frame-Options`, `Content-Security-Policy`, and cookie same-site restrictions (`SameSite`/`Secure`/`Partitioned`) to circumvent iframe blocking
- Optional mobile User-Agent simulation (Android Chrome)

### Search Engine
- Built-in Google, Bing, and Baidu search
- Custom search URL template support

### Load Mode
- **Sidebar mode**: Open pages in an embedded iframe within the sidebar
- **Browser mode**: Open pages in a new tab

### Startup Page
- Quick access home view
- Custom startup URL

### Toolbar Icon
- Light / Dark / Custom icon (upload your own image)

## Installation

### Chrome
1. Navigate to `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the extension directory

### Edge

Available on the Edge Add-ons Store: <a href="https://microsoftedge.microsoft.com/addons/detail/%E4%BE%BF%E6%8D%B7%E8%BE%B9%E6%A0%8F/ljdhdniijekhmmanmpbipnbogolilcdo" target="_blank">Convenient Sidebar - Edge Add-ons</a>

## Usage

1. Click the extension toolbar icon to open the side panel
2. Click the **+** button on the toolbar or the **Add** button in the grid to quickly add the current page
3. Click a shortcut to open it in the sidebar
4. Customize startup page, search engine, icon theme, etc. in the settings page

## Project Structure

```
convenient-sidebar/
├── manifest.json          # Extension manifest (Manifest V3)
├── background.js          # Service Worker background script
├── sidepanel.html         # Side panel entry page
├── sidepanel.js           # Side panel main logic (quick access, embedded browsing)
├── sidepanel.css          # Side panel styles
├── options.html           # Settings page
├── options.js             # Settings page logic
├── options.css            # Settings page styles
├── viewer.html            # Standalone page viewer
├── viewer.js              # Viewer logic
├── frame-bypass.js        # iframe embedding bypass (UA spoofing, cookie handling)
├── embed-rules.js         # declarativeNetRequest header modification rules
├── icon-theme.js          # Toolbar icon theme management
├── icon-store.js          # Site icon fetching and storage
├── sidebar-home.js        # Home shortcut handling
├── icons/                 # Icon assets
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
    └── generate-icons.mjs # Icon generation script
```

## Tech Stack

- **Manifest V3** — Latest extension specification
- **Service Worker** — Background event-driven script
- **declarativeNetRequest** — Declarative network request modification (User-Agent, security header removal)
- **chrome.sidePanel** — Side panel API
- **chrome.storage** — Local persistent storage
- **Content Script (MAIN world)** — UA spoofing and cookie handling injected into iframes

## Author

- [Liu Yiran](https://cheng.me/)

## License

GPL
