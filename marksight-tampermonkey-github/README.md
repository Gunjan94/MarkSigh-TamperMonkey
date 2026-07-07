# MarkSight TamperMonkey — See Markdown Clearly

A TamperMonkey/Greasemonkey userscript that renders `.md` files with beautiful formatting in any browser.

## Features

- **Beautiful rendering** — GitHub-style headings, tables, code blocks, lists
- **Table of Contents** — sidebar with scroll tracking
- **Syntax highlighting** — 190+ languages via highlight.js
- **Live editor** — split-pane with instant preview
- **Export** — PDF (print), Word (.doc), HTML
- **Dark mode** — toggle with one click
- **Search** — in-page with match highlighting
- **Keyboard shortcuts** — Ctrl+E, Ctrl+S, Ctrl+F, Ctrl+P
- **Universal** — works on any `.md` URL (local files, GitHub raw, Slack files, any server)

## Install (One Click)

### Prerequisites
1. Install [TamperMonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) in Chrome

### Install Script
Click this link with TamperMonkey installed:

👉 **[Install MarkSight](https://github.com/Gunjan94/MarkSight-TamperMonkey/raw/main/marksight-tampermonkey.user.js)**

Or via Axzile (Amazon internal):
👉 [Install from Axzile](https://axzile.corp.amazon.com/-/carthamus/download_script/mark-sight-%E2%80%94-markdown-viewer.user.js)

### Enable File Access
For local `.md` files:
1. Go to `chrome://extensions`
2. Find TamperMonkey → **Details**
3. Enable **"Allow access to file URLs"**

## Usage

1. Open any `.md` file in Chrome (drag & drop, File → Open, or click a link)
2. The script renders it automatically
3. Use the toolbar for theme, editing, search, and export

## Supported URLs

| Source | Example |
|--------|---------|
| Local files | `file:///path/to/doc.md` |
| GitHub raw | `https://raw.githubusercontent.com/...` |
| Gists | `https://gist.githubusercontent.com/...` |
| Slack files | `https://files.slack.com/files-pri/.../file.md` |
| Any server | `https://example.com/docs/readme.md` |

The script activates on any URL ending in `.md`, `.markdown`, `.mdown`, or `.mkd` — as long as the page shows raw text (won't interfere with pages that already render markdown).

## Privacy

- No data leaves your browser
- No external API calls
- Libraries loaded from CDN (jsdelivr) at install time only
- Works offline after first load

## License

MIT
