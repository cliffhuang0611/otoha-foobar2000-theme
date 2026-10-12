<div align="center">

# Verdant

### A personal fork of the Spotify-style theme for foobar2000

*A foobar2000 skin that turns the world's most configurable audio player into something
that looks like a modern streaming app.*

[![Release](https://img.shields.io/github/v/release/superziper/verdant-foobar2000-theme?color=70C4DE&label=release)](https://github.com/superziper/verdant-foobar2000-theme/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/superziper/verdant-foobar2000-theme/total?color=70C4DE)](https://github.com/superziper/verdant-foobar2000-theme/releases)
![foobar2000](https://img.shields.io/badge/foobar2000-v2%20·%2064--bit-70C4DE)
![Windows](https://img.shields.io/badge/Windows-10%20%7C%2011-70C4DE)

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
  **Apply displayed sort to playlist** writes the full displayed sort into the stored playlist
  order, including tracks hidden by a filter, and switches the view back to Default.
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
- **Play order** shows one finite playback sequence with the current occurrence highlighted in
  the accent color, including earlier and upcoming tracks. Repeat all wraps through that same sequence;
  repeat one keeps the current occurrence highlighted rather than adding another copy.
  Deliberately queued duplicate tracks remain separate entries.
- Stop retains the full Play order and highlights the track ready to play, including when using
  foobar2000's native Stop command. The retained order and exact current occurrence survive closing
  and reopening foobar2000. Play starts that retained track at 0:00 and continues the same sequence.
- Tracks changing or repeat wrapping automatically reveals the current row. Manual scrolling
  stays put between track changes; hover and ordinary redraws do not pull you back.
- Drag any visible row to reorder playback without changing the saved playlist or restarting
  the current track. Single-click selects; double-click plays that occurrence in the same full
  sequence. Escape cancels a drag, and playback/list changes invalidate a stale drop.
- The list scrolls independently with a wheel/scrollbar; dragging near its edges scrolls it
  automatically. Tabs, Now playing and the footer stay fixed.
- **Clear upcoming tracks** in the footer or context menu asks for confirmation. It removes
  the remaining sequence and stops after the current track, with empty actions disabled.
- Reordered playback, the current position and hidden handoff identity survive JSplitter reloads.
  With repeat off, playback ends at the final track; repeat does not create an infinite UI list.
- **Stop button** beside Previous ends playback immediately and retains the stopped track and full Play order
  sequence, including across panel reloads. Play restarts that track at 0:00; Pause resumes at its
  existing position. Starting another track replaces the retained sequence. Shuffle and Repeat form a smaller pair on the queue side, keeping Play/Pause centered.
- When no track is loaded, the player uses a neutral music-note placeholder with Nothing playing
  (or Ready to play when queued tracks are available), instead of a colored cover block.
- Artist-track double-click plays within that album. Right-click a track to add its whole album
  or all of the artist's displayed albums to Play order; the artist header also has Queue all albums.
  When Shuffle is on, the entire added batch is shuffled across albums; with Shuffle off,
  tracks retain the displayed album/disc/track order. Existing queued tracks keep their order.
  Turning Shuffle off after adding albums restores the remaining batch's album order without
  dropping other albums or restarting playback; the original batch order survives reloads.
- **Playlist context menu** on sidebar/Home playlist cards and the playlist heading or empty area,
  grouped in this order:

  ```text
  Add files…
  Add folder…
  Paste tracks
  ────────────────────
  Apply displayed sort to playlist
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
- **Save playlist** uses foobar2000's native export dialog. To export a sorted sequence, first use
  **Apply displayed sort to playlist** on the open editable playlist, then save as M3U8 and choose
  the existing file to replace it. Exporting does not automatically overwrite an imported M3U8.
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
  Missing or zero dates are omitted from artist, album, and grouped-library metadata.
- Lyrics support adjacent `.lrc` / `.txt` files and embedded lyrics fields, including synchronized
  highlighting and scrolling; plain lyrics can be scrolled in the queue pane.
  Partially timestamped lyrics keep all lines in the scrollable text view until timing is complete;
  saving `.lrc` or metadata preserves both existing timestamps and unfinished lines.
- When no local lyrics exist, **Search lyrics** manually searches LRCLIB using title and artist,
  including Japanese text. A dialog lists matches by album, duration, and synchronized/plain format,
  with a scrollable lyrics preview. Separate **Use lyrics** and **Edit lyrics** buttons apply the
  selected result or open it in a native multiline editor with Japanese input support.
  Lyrics context menus use Verdant's custom styling. **Add current timestamp** stamps the cursor's line
  using that track's playback position, replaces existing timing, and advances to the next line.
  **F3** performs the same timestamp action while the editor is open.
  **Delete lyrics from metadata** offers quick removal of embedded lyric fields after confirmation;
  adjacent `.lrc` and `.txt` files are kept.
  The editor has playback controls and a seek slider: **F4** pauses/resumes, **F2/F5** seek
  backward/forward five seconds. Controls target the editor's track; **Play this track** starts it
  if playback has moved elsewhere. The native editor remains modal to the main foobar window.
  Right-click the sidebar or fullscreen lyrics area to search or reopen the result dialog.
  Searches are never automatic. Previews are held in memory until panel reload; **Lyrics options**
  offers **Edit lyrics** and a separate confirmed save to `SYNCEDLYRICS` or `LYRICS`.
  The editor can apply a preview, save plain UTF-8 `.txt` or timed `.lrc` beside the audio file,
  or save embedded lyrics. Existing sidecar files and embedded lyrics require confirmation before
  replacement. Editor metadata saves normalize lyric fields to plain `LYRICS` and, when timed,
  `SYNCEDLYRICS`. Sidecars require a local single-track file. Internet access is required;
  no API key is needed. See [LRCLIB's API documentation](https://lrclib.net/docs).
- One icon beside volume opens **output-device and saved DSP-preset** selectors, with active choices,
  scrolling flyouts, and explicit switching. Unsupported host APIs are handled with a message.
- The same menu includes **Scheduler → Stop after current song**, using foobar2000's native setting.
  It can be switched on/off without interrupting the current track; the settings icon uses the accent color
  while enabled. There are no timed stops or extra scheduler components.
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
- **Queue / Lyrics pane** — a finite Play order list highlighting the current track,
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

Theme colors are centralized as hex values in `THEME_COLORS` in
[`theme/verdant/core/palette.js`](theme/verdant/core/palette.js). Role names stay the same when
changing the palette: `main` is the outer background, `surface` the panels, `secondary` raised
surfaces, and `text`, `textSecondary`, and `textMuted` control text. `accent` is the active color,
with `accentHover`, `accentPressed`, `accentDisabled`, and `onAccent` for interaction states and
contrasting button text. `danger` and `dangerHover` control destructive actions. `editor*` values
configure the native lyrics editor's neutral surfaces; its accents use the shared accent roles.

The default accent is Frosted Cyan: **normal `#70C4DE`, hover `#8DD2E6`, pressed `#58AEC8`**.
Changing these values updates tabs, active controls, selected/playing text, drag highlights,
primary buttons, the visualizer, and the lyrics editor after deployment and **Ctrl+F5**.

---

## Normalize volume

**All Songs → Normalize volume** makes every track in your library play back at the same loudness.

Under the hood this is **ReplayGain**, which is two separate things — and the button owns both:

1. **A loudness measurement per track**, stored as a `REPLAYGAIN_TRACK_GAIN` tag in the file.
2. **Playback applying that measurement** (foobar's ReplayGain source mode).

The pill turns **accent-colored only when both are true**, so it can never claim to be on while doing nothing.
Hover the button to see the tagged-track count and remaining unscanned tracks. This status is not
a live progress report from the native scanner.

| State | Clicking it |
|---|---|
| Some tracks unscanned | Asks first, then scans them and switches normalizing on |
| All scanned, normalizing off | Switches it on — instant, no rescan |
| Normalizing on (accent) | Switches it off. Tags are left alone, so switching back on is instant |

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
