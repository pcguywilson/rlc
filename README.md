# RLC (Reddit Live Comments)

A locally hosted alternative to [reddit-stream.com](https://reddit-stream.com/). RLC turns any Reddit thread into a live, auto-updating comment feed, right in Chrome. No subscription, no server, no third-party extension, no Reddit API app. It's a tiny unpacked Chrome extension that runs entirely in your browser using your own Reddit login.

Built for UFC live discussion threads, works on any thread.

![RLC Teal theme](screenshots/teal.png)

<table>
  <tr>
    <td><img src="screenshots/dark.png" alt="Dark theme"><br><sub>Dark</sub></td>
    <td><img src="screenshots/black.png" alt="Black theme"><br><sub>Black</sub></td>
  </tr>
</table>

## Features

- **Live feed.** Polls the thread every 3/5/8/15s, newest comments at the bottom, new ones briefly highlighted.
- **Smart scrolling.** Sticks to the bottom while you're there. Scroll up to read and it holds your place with a "▼ N new" pill.
- **Replies included.** Collapsed "load more replies" stubs are expanded automatically, and each reply shows the comment it's answering.
- **Vote and reply inline.** ▲/▼ voting, inline reply box (Ctrl+Enter to send, Esc to cancel), and "reply to post" at the bottom.
- **Themes.** Teal (reddit-stream look), Dark, Black, Light.
- **Text size.** S / M / L / XL.
- **Filter.** Live filter by author or text.
- **One-click live thread.** On a subreddit, "⚡ Live thread" finds the stickied live discussion and opens it in stream mode.
- Settings (theme, size, refresh rate) are remembered.

## Install

1. Clone or download this repo somewhere permanent:
   ```
   git clone https://github.com/pcguywilson/rlc.git
   ```
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the `rlc` folder.

To update: `git pull`, then hit the reload icon on the RLC card in `chrome://extensions` and refresh any open Reddit tabs.

## Usage

You need to be logged into Reddit in Chrome.

- **On a thread:** click the **⚡ Stream** button (bottom right).
- **On a subreddit** (e.g. r/MMA on fight night): click **⚡ Live thread** to jump straight into the stickied live discussion.
- **Exit** returns to the normal thread.

<table>
  <tr>
    <td><img src="screenshots/live-thread-button.png" alt="Live thread button on a subreddit"><br><sub>⚡ Live thread on a subreddit</sub></td>
    <td><img src="screenshots/stream-button.png" alt="Stream button on a thread"><br><sub>⚡ Stream on a thread</sub></td>
  </tr>
</table>

Works from both new and old Reddit. On new Reddit the button hands off to `old.reddit.com`, where RLC takes over the page.

## Android

Chrome on Android doesn't support extensions, so `android/` is a minimal standalone app: a full-screen WebView that injects the same `content.js` used by the Chrome extension. One script, two platforms.

- Opens r/MMA on launch. Tap **⚡ Live thread** or open any thread and tap **⚡ Stream**.
- Share a Reddit thread link to **RLC** from any app and it opens straight into stream mode.
- Screen stays on while the app is open.
- Log in once inside the app (Reddit username/password; Google sign-in is blocked in WebViews by Google). The session persists.
- No dependencies beyond the Android SDK.

**Build:** open the `android/` folder in Android Studio, let it sync, then Run on your phone (or Build > Build APK(s) and sideload). The build copies `../content.js` into the app's assets automatically, so changes to the script land in the next build.

## How it works

- Polls `old.reddit.com/comments/<id>.json?sort=new` with your existing session (same-origin, so no CORS, proxy, or API key).
- Expands collapsed reply stubs via `/api/morechildren`.
- Votes and replies go through Reddit's own `/api/vote` and `/api/comment` endpoints using your session's CSRF token, exactly as old Reddit's UI does.
- Backs off automatically on errors or rate limiting.

Everything is two files: `manifest.json` and `content.js`. No build step, no dependencies.

## Permissions

RLC requests no extension permissions. It only runs as a content script on `www.reddit.com` and `old.reddit.com`, and talks only to Reddit.
