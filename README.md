<div align="center">

# Verdant

### A personal fork of the Spotify-style theme for foobar2000

*A foobar2000 skin that turns the world's most configurable audio player into something
that looks like a modern streaming app.*

[![Release](https://img.shields.io/github/v/release/superziper/verdant-foobar2000-theme?color=1DB954&label=release)](https://github.com/superziper/verdant-foobar2000-theme/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/superziper/verdant-foobar2000-theme/total?color=1DB954)](https://github.com/superziper/verdant-foobar2000-theme/releases)
![foobar2000](https://img.shields.io/badge/foobar2000-v2%20·%2064--bit-1DB954)
![Windows](https://img.shields.io/badge/Windows-10%20%7C%2011-1DB954)

**Personal customizations live on `personal`; `master` retains the upstream theme.**

<img src="docs/images/home.png" alt="Verdant home view: playlist shelf, artist grid and queue" width="900">

</div>

---

**Verdant** is a modern **foobar2000 theme** — a complete visual skin that restyles your **local**
music library and playlists into a clean, dark, Spotify-inspired interface.

Everything on screen is custom-drawn in a [JSplitter](https://hydrogenaud.io/) panel running under
[Columns UI](https://github.com/reupen/columns_ui) — sidebar, home, playlist and All Songs views,
search, queue and lyrics pane, player bar, fullscreen mode, even the window title bar. No stock
foobar2000 widgets are involved, which is why it looks nothing like default foobar2000.

It does **not** connect to Spotify's service and plays nothing you don't already own — it's a
look, not a client.

---

## Personal fork: changes from `master`

This fork builds on [superziper/verdant-foobar2000-theme](https://github.com/superziper/verdant-foobar2000-theme).
The features below describe the current `personal` branch compared with the local `master` branch.
The release badges, release downloads, and screenshots in this README belong to upstream; those downloads
and images do not include these personal changes. Original features such as shuffle, fullscreen,
visualizers, cover mosaics, and ReplayGain remain available.

### Home and responsive layout

- **Artist Grid/List toggle** beside **Artists in your library**. The heading and controls scroll
  with the section, then stick to the top. The view choice is saved in panel properties.
- **Your Playlists always stays a horizontal card shelf**, regardless of the artist display mode.
  The shelf reserves the vertical scrollbar gutter, including its click targets.
- **One shared vertical scroll offset** across Grid/List: toggling retains the visible pixel position,
  clamped to the new layout's maximum. The playlist shelf keeps its horizontal position too.
- **Resizable playlist sidebar**: drag its right-hand gap. The saved width is limited to leave room
  for the main content. Truncated playlist names show full-name hover tooltips in the sidebar and Home.
- **Compact queue controls**: narrow windows can expand/collapse the queue. The expanded queue
  occupies its own layout space so it cannot cover main scrollbars. Expand is near the main panel's
  right edge; Collapse is inside the queue, below the tabs when space is especially tight.
- Responsive headings, search/filter fields, sorting/grouping controls, and menus accommodate
  smaller windows. Custom flyouts paint above other content; track menus close on outside clicks,
  Escape, or focus loss. Clicking the top menu bar also dismisses an open context menu.

### Playlists and track selection

- **Default sorting preserves foobar2000's stored playlist order**, including imported M3U8 order.
  Title/Artist/Album sorting changes the display only. The direction button keeps its space but is
  disabled for Default; the previous direction is remembered for named sorts.
- **Windows-style track selection**: Ctrl-click toggles individual tracks; Shift-click selects ranges;
  Ctrl+Shift-click adds ranges. Arrow-key selection uses the current displayed order. Duplicate
  entries can be selected independently. Modified double-clicks do not start playback.
- **Track clipboard**: Ctrl+C copies selected tracks from playlists, All Songs, artist, album, and
  Search views in displayed order, preserving duplicates. Ctrl+X cuts only from editable playlists,
  after a successful clipboard copy. Ctrl+V appends to the open editable playlist. Audio files are
  unchanged by cut/paste. The clipboard uses foobar2000's native track format.
- Track right-click menus provide Add to playlist (existing or new), Add to playback queue,
  Open containing folder, Properties, Delete files, and playlist removal where applicable.
  **Show more options** opens foobar2000's full native track menu, including installed File Operations
  and Converter commands/presets for the selected tracks.
- **One Up next list** combines explicitly queued tracks and the remaining playlist sequence
  in playback order. Internal handoff entries are not displayed twice. With repeat off, the list
  does not wrap or fall back to an unrelated active playlist when playback ends.
- Drag any visible Up next track before/after another, including across tracks originally queued
  manually or supplied by the playlist. Reordering uses hidden playback copies, preserving the
  saved source playlist and the current playing track's position. Queued additions take priority.
- Single-click selects; double-click starts the selected track and continues with the rest of
  Up next. Escape cancels dragging; playback or list changes invalidate a stale drop.
- Right-click the Queue panel for **Clear Up next**: the current track continues, then playback
  stops. Starting a new track or adding a new queue restores normal continuation.
- Reordered playback and internal handoff identification survive JSplitter reloads through hidden
  playlists and saved panel properties. Shuffle toggles do not restart or seek the current track.
- **Stop button** beside Next ends playback immediately and retains the stopped track and Up next
  order, including across panel reloads. Play restarts that track at 0:00; Pause resumes at its
  existing position. Starting another track replaces the retained sequence. Repeat sits beside
  Shuffle, keeping Play/Pause centered.
- **Playlist context menu** on sidebar/Home playlist cards and the playlist heading or empty area,
  grouped in this order:

  ```text
  Add files…
  Add folder…
  Paste tracks
  ────────────────────
  Remove duplicates
  Remove missing files
  ────────────────────
  Save playlist…
  Duplicate playlist
  ────────────────────
  Rename…
  Clear playlist…
  Delete playlist…
  ```

  Remove duplicates keeps the first occurrence of each file/subsong in stored playlist order;
  it does not match by title or artist. Remove missing files checks local paths and skips streams.
  Cleanup reports the number removed and creates a playlist undo backup. Clear requires confirmation
  and keeps the playlist; Delete requires confirmation and removes the playlist. Neither deletes
  audio files. Editing actions are disabled for locked/automatic playlists; Paste is disabled when
  no supported clipboard content is available.
- **Save playlist** uses foobar2000's native export dialog. Display sorting does not change the
  exported sequence. Exporting does not establish an automatic link to overwrite an imported M3U8.
- Playlist creation and rename shortcuts, plus caret/selection/clipboard editing in the rename dialog.
- **Confirmed file deletion** is distinct from playlist removal. Library Delete, playlist Shift+Delete,
  and the track menu's Delete files action ask before invoking foobar2000's File Operations command.
  After files disappear, Verdant refreshes its cached library, Search, artist, and album views.
  Foobar2000's underlying library still relies on folder monitoring or a native rescan.

### Search, metadata, lyrics, and audio controls

- Search includes **artists, albums, and tracks**, with an album detail page.
- Multi-token track matching across title, artist, album artist, and album, including partial words
  and limited typo tolerance. Ctrl+F filters All Songs and playlists without modifying their contents;
  in other views it opens global Search.
- Search/filter fields support mouse caret placement, text selection, word movement, and clipboard
  editing. Selected text takes priority for Ctrl+C; otherwise selected tracks can be copied.
- Artist and album tracks use **DISCNUMBER then TRACKNUMBER** order; missing numbers display blank.
- Lyrics support adjacent `.lrc` / `.txt` files and embedded lyrics fields, including synchronized
  highlighting and scrolling; plain lyrics can be scrolled in the queue pane.
- One icon beside volume opens **output-device and saved DSP-preset** selectors, with active choices,
  scrolling flyouts, and explicit switching. Unsupported host APIs are handled with a message.
- ReplayGain status is a **hover tooltip** instead of a permanent heading line. It reports tagged
  tracks and remaining unscanned tracks, rather than live scanner progress. Tiny progress values
  use safe drawing geometry for JSplitter 3.8.12.

### Keyboard shortcuts

These shortcuts work when Verdant has keyboard focus, unless a foobar2000 shortcut intercepts them.

| Shortcut | Action |
|---|---|
| Up / Down | Select previous/next displayed track and reveal it |
| Shift+Up/Down | Extend or shrink the anchored selection |
| Ctrl+Up/Down | Add the previous/next track to the selection |
| Ctrl+Shift+Up/Down | Extend a range while keeping other selected tracks |
| Ctrl+A / Ctrl+Shift+A | Select all visible tracks / clear selection |
| Enter | Play first selected track and queue the rest in displayed order |
| Shift+Enter | Queue selected tracks without starting playback |
| Ctrl+C / Ctrl+X / Ctrl+V | Copy tracks / cut playlist entries / append clipboard tracks |
| Delete | Remove selected playlist entries; with none selected, confirm deleting the open playlist. On selected library tracks, confirm file deletion |
| Shift+Delete | Confirm file deletion for selected tracks, including playlist tracks |
| Ctrl+N | Create and open a playlist |
| F2 | Rename the open playlist |
| Page Up / Page Down | Scroll the current page |
| Home / End | Scroll to the top / bottom |
| Alt+Left / Alt+Right | Navigate page history |
| Ctrl+L | Open global Search |
| Ctrl+F | Filter the current playlist/All Songs, or open Search |
| Escape | Close a menu/filter, return from Search, or clear track selection |
| F5 | Refresh cached view data; does not rescan folders or reload scripts |
| Ctrl+F5 | Reload JSplitter scripts |
| Ctrl+R | Reserved for a native library rescan hotkey that you assign in foobar2000 |

Text fields retain their editing shortcuts. Selected track results take priority for Delete;
selected Search/filter text takes priority for Ctrl+C. Rename remains a modal text editor.
See [keyboard reference](theme/verdant/KEYBOARD_SHORTCUTS.txt) for additional details.

### Compatibility and known limitations

- The personal setup uses **foobar2000 v2 (64-bit), Columns UI, and JSplitter 3.8.12**.
  Native file operations and conversion options depend on installed foobar2000 components.
- Remove conflicting foobar2000 hotkeys if they intercept panel keys, particularly the native
  Ctrl+F Search assignment. Bind Ctrl+R to your preferred native rescan command yourself.
- Panel keyboard focus at startup is host-dependent; click Verdant if shortcuts are not received.
  Optional `Verdant: …` menu commands register only when the host supports that API; assigning
  application-wide shortcuts is manual.
- Japanese input works in the inline fields, but Windows IME composition/candidates may appear
  near the primary monitor's top-left corner. This fork keeps inline editing rather than adding
  a separate input dialog or native panel.
- Mouse Back/Forward buttons are not remapped by this theme. No AutoHotkey helper is included.

---

## Screenshots

<table>
<tr>
<td width="50%"><img src="docs/images/playlist.png" alt="Playlist view"><br><sub><b>Playlist</b></sub></td>
<td width="50%"><img src="docs/images/all-songs.png" alt="All Songs view"><br><sub><b>All Songs</b></sub></td>
</tr>
<tr>
<td><img src="docs/images/search.png" alt="Search"><br><sub><b>Search</b></sub></td>
<td><img src="docs/images/artist.png" alt="Artist page"><br><sub><b>Artist</b></sub></td>
</tr>
<tr>
<td><img src="docs/images/fullscreen.png" alt="Fullscreen now playing"><br><sub><b>Fullscreen</b></sub></td>
<td><img src="docs/images/fullscreen-lyrics.png" alt="Fullscreen synced lyrics"><br><sub><b>Lyrics</b></sub></td>
</tr>
<tr>
<td><img src="docs/images/fullscreen-visualizer.png" alt="Fullscreen visualizer"><br><sub><b>Visualizer</b></sub></td>
<td><img src="docs/images/playlist-empty-rename.png" alt="Empty playlist and rename dialog"><br><sub><b>Editing</b></sub></td>
</tr>
</table>

---

## Features

- **Home** — a horizontal playlist card shelf above a grid or list of library artists, with a sticky
  artist heading and display controls.
- **Playlist view** — gradient header tinted from the cover art, sortable by title / artist / album,
  inline rename, delete, and drag-and-drop import **with duplicate detection**.
- **All Songs** — your entire library in one virtualised list, optionally grouped by artist, album,
  or both. Handles thousands of tracks without stuttering.
- **Search** — artists, albums, and tracks, with album pages and multi-token/fuzzy track matching.
- **Queue / Lyrics pane** — one Up next list showing the upcoming playback sequence,
  or synced `.lrc` / plain `.txt` lyrics that roll with the track. Double-click a queue row to play it.
- **Fullscreen mode** — big now-playing art, rolling lyrics, or an FFT audio visualizer fed from
  real PCM. Four visualizer styles.
- **Normalize volume** — one button that levels your whole library so you stop reaching for the
  volume knob between albums. [How it works ↓](#normalize-volume)
- **Shuffle that tells the truth** — shuffle plays from a hidden shuffled copy of the playlist, so
  the "next up" list is the *actual* upcoming order, not a guess.
- **Custom title bar** — frameless window with real File / Library / Help menus and window controls.

---

## Install

### Use this personal fork

Upstream release ZIPs install the original theme. To use these customizations, first set up an
upstream Verdant installation using the instructions below, then use the `personal` branch of this
repository and copy **the contents of `theme/verdant/`** into your existing `<profile>\verdant\`
directory. Back up that directory first. Update theme source files only; keep your existing
foobar2000 profile settings and layout configuration.

For a standard install the destination is `%APPDATA%\foobar2000-v2\verdant\`; for a portable
install it is `<foobar2000 root>\profile\verdant\`. Reload JSplitter with Ctrl+F5 after copying.
No npm build, bundler, or DLL compilation is required for ordinary theme changes.

### Upstream base installation

1. Install foobar2000 as **portable** from the [official website](https://www.foobar2000.org/download).
2. Download **`Verdant-vX.Y.Z.zip`** from the
   **[latest release](https://github.com/superziper/verdant-foobar2000-theme/releases/latest)**.
3. Extract the **`profile`** folder from the zip into foobar2000's **root folder** (the one containing
   `foobar2000.exe`).
4. Start foobar2000 and enjoy.

That's it. Columns UI, JSplitter and UI Wizard are bundled — nothing to install separately. And
**no fonts to install**: Verdant uses Segoe UI and Segoe MDL2 Assets, both of which ship with
Windows 10 and 11.

> For a **standard (non-portable)** install, extract the *contents* of `profile` into
> `%APPDATA%\foobar2000-v2` instead, then start foobar2000.

### Already have a foobar2000 you've set up?

**Don't extract over it** — `profile` carries a layout and core settings that would replace your own.
Close foobar2000, double-click **`install.bat`**, start foobar2000.

The installer checks before it writes. It adds only the components you're missing, and if you already
use Columns UI it replaces **only the panel layout** — your colours, fonts, playlist columns and
filters survive, because it uses Columns UI's own layout import rather than overwriting its config.
It backs up whatever it touches and writes an `uninstall.ps1` beside the backup in
`<profile>\verdant-backup\<date>\`.

<details>
<summary>Prefer to import the layout yourself?</summary>

`extras\verdant-layout.fcl` is the layout on its own. Copy `profile\verdant\` into your profile, then
Preferences → Display → Columns UI → **Import**, ticking **Main Layout** and **Toolbar Layout**.
</details>

### Uninstall

Run `uninstall.ps1` from `<profile>\verdant-backup\<date>\`, then delete `<profile>\verdant\`.

---

## First run

> **Home and All Songs look empty?** Verdant reads foobar's **Media Library**, not your playlists. A
> fresh foobar has an empty library, so add a music folder under Preferences → **Media Library**.
> That's expected, not a broken install.

Lyrics are read from a `.lrc` (synced) or `.txt` (plain) file next to the audio file with the
same name, or from supported embedded lyrics fields.

---

## Tuning

Right-click an empty area outside the playlist view → **Panel properties** (the JSplitter menu):

| Property | Default | What it does |
|---|---|---|
| `Display: UI scale (0 = auto)` | `0` | Scales every font and the title bar. `0` follows your display scaling; set `1.0` for a compact look, higher for a large or 4K screen. |
| `Sidebar: width` | `190` | Preferred sidebar width in pixels; updated when you drag its right-hand gap and constrained by window size. |
| `Home: view (grid \| list)` | `grid` | Artist display mode; updated by the buttons beside Artists in your library. Playlists always remain cards. |
| `Scrolling: wheel step (px)` | `180` | How far one wheel notch scrolls the lists. |

Manual property edits take effect on panel reload (**Ctrl+F5** or JSplitter → **Reload**).
Dragging the sidebar or using the artist display buttons applies and saves those settings immediately.
Queue width and the default sidebar width remain in
[`theme/verdant/core/tokens.js`](theme/verdant/core/tokens.js).

---

## Normalize volume

**All Songs → Normalize volume** makes every track in your library play back at the same loudness.

Under the hood this is **ReplayGain**, which is two separate things — and the button owns both:

1. **A loudness measurement per track**, stored as a `REPLAYGAIN_TRACK_GAIN` tag in the file.
2. **Playback applying that measurement** (foobar's ReplayGain source mode).

The pill turns **green only when both are true**, so it can never claim to be on while doing nothing.
Hover the button to see the tagged-track count and remaining unscanned tracks. This status is not
a live progress report from the native scanner.

| State | Clicking it |
|---|---|
| Some tracks unscanned | Asks first, then scans them and switches normalizing on |
| All scanned, normalizing off | Switches it on — instant, no rescan |
| Normalizing on (green) | Switches it off. Tags are left alone, so switching back on is instant |

**The scan writes tags into your audio files**, which is why it asks first. The scan itself is
foobar's own — its progress window, its *update file tags* confirmation — so you can cancel there and
nothing is written. Only unscanned tracks are ever handed to it. A large library takes a while the
first time, but it's a one-off.

Nothing here is destructive: no audio is re-encoded, no tag is removed. To undo it completely, use
foobar's own *ReplayGain → Remove ReplayGain information from files*.

---

## Requirements

- **foobar2000 v2, 64-bit** (developed and tested on 2.25)
- **Windows 10 or 11**
- Bundled and installed for you: **Columns UI**, **JSplitter** (`foo_uie_jsplitter`),
  **UI Wizard** (`foo_ui_wizard`, optional — without it you keep the normal Windows title bar)

---

## FAQ

**Is this a theme or a skin?** Both words get used for the same thing in the foobar2000 world.
Verdant is a full visual replacement — layout, colours, fonts, every control — not a colour tweak.

**Will it change how my music sounds?** No. Verdant is purely visual. The one exception is
*Normalize volume*, which you have to switch on yourself and which uses foobar2000's own ReplayGain.

**Does it work with foobar2000 v1.x?** No — v2, 64-bit only.

**Can I still use the Default UI / my old Columns UI layout?** Yes. Columns UI keeps layout presets,
so you can switch back at Preferences → Display → Columns UI → Layout. If you installed with
`install.bat`, your previous layout is also backed up and restorable.

**What actions affect audio files?** Playlist cleanup, clearing, deletion, and cut/paste affect
playlist entries only. File deletion explicitly asks for confirmation and delegates to foobar2000.
Normalize volume writes ReplayGain tags after confirmation. Commands under Show more options
can rename, move, convert, or otherwise modify files through foobar2000’s native tools.

**It looks huge / tiny on my screen.** Set `Display: UI scale` in the panel properties — see
[Tuning](#tuning).

---

## For developers

```
theme/verdant/        the theme — copied verbatim into <profile>\verdant\
  main.js             entry point: declares the panel, sets the module load order
  core/               props, tokens, utils, title formats, memory caps, job scheduler
  data/               art, library, playback, lyrics, replaygain, dedupe, playlist edit
  ui/                 skeletons + shimmer, window chrome and shared widgets
  views/              nav, playlist, home, artist, songs, search, queue, bar, fullscreen
  app.js              panel state, layout, paint dispatch, input, foobar callbacks
components/           the three foobar components, bundled for the installer
dist-config/          layout + core config harvested from a clean-room foobar
tools/
  deploy.ps1          dev sync into the foobar profile ( -Watch to auto-sync )
  install.ps1/.bat    the shipped installer
  harvest.ps1         pull configuration out of the clean-room rig
  make-release.ps1    build Verdant-vX.Y.Z.zip
```

Every module is evaluated into **one shared global scope**, so any module can call into any other.
`main.js` fixes the load order because a few things are computed at load time (fonts from `UISCALE`,
the reveal-gate ceiling from `ART_CAP`).

The whole theme runs on **one thread shared with the UI**, which is why the code caches aggressively,
slices long builds across timer ticks, and scopes repaints to the one panel that changed.

```powershell
setx VERDANT_PROFILE D:\foobar2000\profile     # once, so deploy knows where to put it
.\tools\deploy.ps1 -Watch                      # mirrors theme\verdant into the profile on every save
```

`deploy.ps1` auto-detects a standard install; for a portable one, set `VERDANT_PROFILE` as above or
pass `-FoobarProfile`.

Then reload the panel (right-click → Reload). `console.log` goes to foobar's console (View → Console).
Deploy copies the same folder to the same place the installer does, so there's no separate build and
no second code path.

### Personal branch workflow in WSL

Work on `personal` and keep `master` as the upstream reference. Source changes are loaded directly
by JSplitter. Before deploying:

```bash
git status --short
find theme/verdant -name '*.js' -print0 | xargs -0 -n1 node --check
git diff --check
```

If your checkout has the optional local WSL helpers, `./tools/local/deploy.sh --backup` backs up
and copies the theme into your configured foobar2000 profile. Later deployments can use
`./tools/local/deploy.sh`. These helpers may be ignored/local-only and are not required; copying
the source directory or using the upstream PowerShell deployment script also works.

Reload with **Ctrl+F5** and test in Windows foobar2000. Node syntax checks do not validate JSplitter
APIs, GDI rendering, focus handling, or IME behavior. **F5** refreshes view data only and does not
load edited script files.

---

## Credits

Built by **[superziper](https://github.com/superziper)**.

Standing on: [Columns UI](https://github.com/reupen/columns_ui) by Reupen Shah, **JSplitter** by LUR,
and [UI Wizard](https://github.com/The-Wizardium/UI-Wizard) by The Wizardium.

## Licence

Verdant is [MIT licensed](LICENSE) — its own code is everything under `theme/`, `tools/`,
`dist-config/` and `docs/`.

The three foobar2000 components bundled for the one-step install are **not** Verdant's work and keep
their own licences (Columns UI is LGPL-3.0, UI Wizard is MIT). See
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

Not affiliated with or endorsed by Spotify. "Spotify" is a trademark of Spotify AB; this is a
fan-made visual theme for a local music player.
