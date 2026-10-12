'use strict';

/* ============================================================================
   Verdant -- a Spotify-style theme for foobar2000, drawn from scratch in a
   JSplitter panel (foo_uie_jsplitter, SpiderMonkey + GDI+).

   Everything on screen is custom-drawn: sidebar, home, playlist and All Songs
   views, search, queue/lyrics pane, player bar, fullscreen mode and the window
   title bar. No stock foobar widgets are used.

   This file is the entry point. It declares the panel, then loads the modules
   below. They all share ONE global scope, so any module may call into any
   other -- but anything evaluated at LOAD time has to come after what it
   reads, and that is what fixes the order below. The whole theme also runs on
   ONE thread shared with the UI, which is why so much of it is cached, sliced
   across timer ticks, or scoped to a single panel's repaint.

   Requires foobar2000 v2 (64-bit) + Columns UI + foo_uie_jsplitter.
   Optional: foo_ui_wizard, for the frameless window and custom title bar.
   See README.md for installation.

   Author: superziper
   ============================================================================ */

// the key is `features`, not `options` -- without features.drag_n_drop the panel is never
// registered as an OLE drop target, so no on_drag_* fires
window.DefineScript('Verdant', { author:'superziper', version:'1.2.0', features:{ drag_n_drop:true, grab_focus:true } });
var DLGC_WANTALLKEYS=0x0004;   // capture Ctrl+F and text editing from every view (see applyKeyMode)

/* ---- load order ------------------------------------------------------------
   Only three edges here are load-time rather than call-time, and they are the
   reason this is a list and not an alphabetical glob:
     props  -> tokens   fonts are built from UISCALE the moment tokens loads
     props  -> chrome   the title-bar height is derived from UISCALE too
     memory -> skeleton the reveal gate's ceiling is derived from ART_CAP
   Everything else is functions calling functions, and is order-free.
   Paths are relative to this file: JSplitter resolves include() against the
   including script's own folder. */
include('core/props.js');
include('core/tokens.js');
include('core/util.js');
include('core/tf.js');
include('core/memory.js');
include('core/jobs.js');

include('data/art.js');
include('data/library.js');
include('data/playback.js');
include('data/audio_options.js');
include('data/lyrics.js');
include('data/lyrics_online.js');
include('data/lyrics_editor.js');
include('data/replaygain.js');
include('data/dedupe.js');
include('data/playlist_edit.js');

include('ui/skeleton.js');
include('ui/chrome.js');

include('views/cards.js');
include('views/nav.js');
include('views/playlist.js');
include('views/home.js');
include('views/artist.js');
include('views/album.js');
include('views/songs.js');
include('views/search.js');
include('views/queue.js');
include('views/bar.js');
include('views/fullscreen.js');

// last: owns the panel state the views read, and registers every foobar callback
include('app.js');
