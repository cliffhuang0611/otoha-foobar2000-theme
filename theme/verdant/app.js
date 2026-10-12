/* verdant/app.js -- panel state, layout, paint dispatch, input, and foobar callbacks
   Part of Verdant, a Spotify-style theme for foobar2000. Loaded by main.js;
   every module shares one global scope, so load order is set there. */

/* ------------------------- state ------------------------- */
var W=window.Width, H=window.Height, R={}, NP=null, npTitleStr='', npArtistStr='';
// Repaint scope flags. dirtyAll (sticky) forces a full paint; partial flags accumulate.
// A full window.Repaint() MUST set dirtyAll (use repaintAll) so a paint serviced while a
// partial flag is pending can't blank the rest of the window.
var dirtyAll=true, dirtyBar=false, dirtyQueue=false, dirtySearch=false, dirtyMain=false, dirtyNav=false, dirtyTitle=false, dirtyViz=false;
function clearDirty(){ dirtyAll=dirtyBar=dirtyQueue=dirtySearch=dirtyMain=dirtyNav=dirtyTitle=dirtyViz=false; }
/* When the oldest pending partial flag was raised. A RepaintRect is serviced within a frame or two,
   so a flag still pending long after it went up means its paint was DEFERRED -- the window was
   minimised, and a minimised window gets no WM_PAINT. The paint that finally arrives on restore is
   the OS repainting the whole window onto a fresh surface, not the region we asked for; taking the
   partial path then drew one panel and left the rest a flat grey until something was hovered. The
   1 Hz clock guarantees a pending flag whenever the window is minimised mid-song, and the mouse
   leaving for the taskbar raises one even when paused. Every partial setter calls markDirty() FIRST,
   so the clock records the oldest flag rather than being reset by each new one. */
var dirtySince=0, DIRTY_STALE_MS=250;
function anyDirty(){ return dirtyBar||dirtyQueue||dirtySearch||dirtyMain||dirtyNav||dirtyTitle||dirtyViz; }
function markDirty(){ if(!anyDirty()) dirtySince=Date.now(); }
function repaintAll(){ dirtyAll=true; window.Repaint(); }
/* Main's views draw the row/card straddling their crop line at full height and mask only the
   10px gutter below it (see the FillSolidRect(r.x,cropY,...) in each), so the remainder lands on
   the player bar. drawBar runs after main in the partial path, so pairing them covers it -- and
   it is far cheaper than the full-window repaint that used to hide this. */
function repaintMain(){ markDirty(); dirtyMain=true; window.RepaintRect(R.main.x,R.main.y,R.main.w,R.main.h); repaintBar(); }
function repaintNav(){ markDirty(); dirtyNav=true; window.RepaintRect(R.navLib.x,R.navLib.y,R.navLib.w,R.navLib.h); }
// drawNav paints both nav cards, so a hover crossing between them must invalidate their union
function repaintNavAll(){ markDirty(); dirtyNav=true; window.RepaintRect(R.navTop.x,R.navTop.y,R.navTop.w,(R.navLib.y+R.navLib.h)-R.navTop.y); }
function repaintQueue(){
  // Windows clips drawing to the invalidated rectangle, even when on_paint takes
  // the full render path. A floating drag card can cross any panel boundary.
  if((mainQueueDrag&&mainQueueDrag.moved)||(queueDrag&&queueDrag.moved)){repaintAll();return;}
  if(!R.queue||!R.queue.w)return;
  markDirty();dirtyQueue=true;window.RepaintRect(R.queue.x,R.queue.y,R.queue.w,R.queue.h);
}
// the visualizer's own band, 30 times a second -- see the fullscreen branch of on_paint
function repaintViz(){ markDirty(); dirtyViz=true; window.RepaintRect(0,VIZ_TOP,W,Math.max(0,(H-172)-VIZ_TOP)); }
function repaintTitle(){ markDirty(); dirtyTitle=true; window.RepaintRect(0,0,W,TBH); }
/* A hover only changes one panel's appearance, so repaint that panel rather than the whole
   window. Hitbox ownership is cleanly panel-aligned (HB_PL/HB_HOME/SBN -> nav, HB_CARD/HB_TR/
   SB/SBH -> main, HB_Q/HB_TABS -> queue, HB_CTRL -> bar, HB_MENU/HB_CAP -> title), so the
   cursor position alone picks the right one. */
function hoverZone(x,y){
  if(y<TBH) return 'title';
  if(R.barY!==undefined && y>=R.barY) return 'bar';
  if(HB_QUEUE_TOGGLE && inRect(x,y,HB_QUEUE_TOGGLE)) return 'main';
  if(R.queue && R.queue.w>0 && x>=R.queue.x) return 'queue';
  if(R.main && x>=R.main.x) return 'main';
  return 'nav';
}
function repaintZone(z){
  if(z==='main') repaintMain();
  else if(z==='nav') repaintNavAll();
  else if(z==='queue') repaintQueue();
  else if(z==='bar') repaintBar();
  else if(z==='title') repaintTitle();
}
var firstRow=0, hoverKey='', scrollKey='', hoverZoneKey='', mx=-1, my=-1, drag=null, dragFrac=0;   // WHEEL_PX: core/props.js
// eased scrolling: animate each rendered position toward its target, repainting only the moving region
var firstRowT=0, navScrollT=0, homeScrollT=0, PL_MAXPX=0, scrollTimer=null;
function scrollTick(){
  var mm=false, nm=false, d1=firstRowT-firstRow, d2=navScrollT-navScroll, d3=homeScrollT-homeScroll, d4=songsScrollT-songsScroll, d5=searchScrollT-searchScroll, d6=plScrollT-plScroll;
  if(Math.abs(d1)>=0.5){ firstRow+=d1*0.25; mm=true; } else firstRow=firstRowT;
  if(Math.abs(d3)>=0.5){ homeScroll+=d3*0.25; mm=true; } else homeScroll=homeScrollT;
  if(Math.abs(d4)>=0.5){ songsScroll+=d4*0.25; mm=true; } else songsScroll=songsScrollT;
  if(Math.abs(d5)>=0.5){ searchScroll+=d5*0.25; mm=true; } else searchScroll=searchScrollT;
  if(Math.abs(d6)>=0.5){ plScroll+=d6*0.25; mm=true; } else plScroll=plScrollT;
  if(Math.abs(d2)>=0.5){ navScroll+=d2*0.25; nm=true; } else navScroll=navScrollT;
  if(mm) repaintMain();
  if(nm) repaintNav();
  // one more frame after the scroll settles, so shimSettle can restart the sweep it suppressed
  if(!mm && !nm){ stopScrollAnim(); if(shimCount>0) repaintMain(); }
}
function startScrollAnim(){ if(!scrollTimer) scrollTimer=window.SetInterval(scrollTick,16); }
function stopScrollAnim(){ if(scrollTimer){ window.ClearInterval(scrollTimer); scrollTimer=null; } }

function hv(x0,y0,x1,y1){ return mx>=x0 && mx<x1 && my>=y0 && my<y1; }
var HB_PL=[], HB_TR=[], HB_CTRL=[], HB_TABS=[], HB_SEEK=null, HB_VOL=null, HB_Q=[];
var HB_CARD=[], HB_HOME=null, HB_CAP=null, HB_MENU=[], SB=null;
var navScroll=0, NAV_MAX=0, SBN=null, HB_ADDPL=null, navDropHover=false;
// deferred "scroll this playlist into view" -- only drawNav knows the row geometry, so it consumes this
var navRevealPl=-1;
function revealPlaylist(i){ navRevealPl=i; }
var plDropHover=false, HB_PLADD_FILES=null, HB_PLADD_FOLDER=null;   // empty-playlist "add songs" zone
// playlist edit: context menu, inline rename, delete confirm
var HB_DOTS=[], ctxMenu=null, CTX_HB=[], renameEdit=null, confirmDel=null, CONF_HB=null, RENAME_HB=null;

/* Windows-style multi-select, independent of foobar's active playlist selection.
   Keys point to actual playlist item positions or library-view rows, not just a file path:
   duplicate tracks can be selected separately. Range selection uses the CURRENT display order. */
var trackSel={context:'',keys:Object.create(null),count:0,anchor:null,cursor:null};
var songsTrackY=null;
function trackContext(){
  if(view==='playlist') return 'pl:'+plman.ActivePlaylist;
  if(view==='artist') return 'artist:'+viewArtist;
  if(view==='album') return 'album:'+(viewAlbum?viewAlbum.key:'');
  if(view==='search') return 'search:'+searchQuery;
  return view;
}
function clearTrackSelection(){ trackSel.context=trackContext(); trackSel.keys=Object.create(null); trackSel.count=0; trackSel.anchor=null; trackSel.cursor=null; }
function syncTrackSelection(){ if(trackSel.context!==trackContext()) clearTrackSelection(); }
function trackId(t){
  if(t.songs) return 'songs:'+t.ti;
  if(t.srch) return 'search:'+t.idx;
  if(t.album) return 'album:'+t.idx;
  if(t.lib) return 'artist:'+t.block+':'+t.idx;
  return 'playlist:'+t.pl+':'+t.item;
}
function isTrackSelected(t){ return trackSel.context===trackContext() && !!trackSel.keys[trackId(t)]; }
function markTrack(t,on){ var k=trackId(t), have=!!trackSel.keys[k]; if(on&&!have){ trackSel.keys[k]=true; trackSel.count++; } else if(!on&&have){ delete trackSel.keys[k]; trackSel.count--; } }
function orderedTrackRows(){
  var out=[],i,j,al,order,pl;
  if(view==='songs'){
    if(songsRows) for(i=0;i<songsRows.length;i++) if(songsRows[i].k==='t') out.push({songs:true,ti:songsRows[i].ti});
  } else if(view==='search'){
    for(i=0;i<searchTrks.length;i++) out.push({srch:true,idx:i});
  } else if(view==='artist'){
    for(i=0;i<artistAlbums.length;i++){
      al=artistAlbums[i]; for(j=0;j<al.tracks.length;j++) out.push({lib:true,block:i,idx:j});
    }
  } else if(view==='album'){
    if(viewAlbum) for(i=0;i<viewAlbum.tracks.length;i++) out.push({album:true,idx:i});
  } else if(view==='playlist'){
    pl=plman.ActivePlaylist; if(pl>=0){ order=getPlVisibleOrder(pl); for(i=0;i<order.length;i++) out.push({pl:pl,item:order[i]}); }
  }
  return out;
}
function selectTrack(t,shift,ctrl){
  syncTrackSelection();
  var id=trackId(t), anchor=trackSel.anchor;
  if(shift && anchor){
    var rows=orderedTrackRows(), a=-1,b=-1,i;
    for(i=0;i<rows.length;i++){
      var k=trackId(rows[i]); if(k===anchor) a=i; if(k===id) b=i;
    }
    if(a>=0 && b>=0){
      if(!ctrl){ trackSel.keys=Object.create(null); trackSel.count=0; }
      for(i=Math.min(a,b);i<=Math.max(a,b);i++) markTrack(rows[i],true);
      trackSel.cursor=id;
      repaintMain(); return;
    }
  }
  if(!ctrl){ trackSel.keys=Object.create(null); trackSel.count=0; markTrack(t,true); }
  else markTrack(t,!isTrackSelected(t));
  trackSel.anchor=id;
  trackSel.cursor=id;
  repaintMain();
}
function trackHandle(t){
  if(t.songs){ var s=songsTracks&&songsTracks[t.ti]; return s?s.h:null; }
  if(t.srch){ var q=searchTrks[t.idx]; return q?q.h:null; }
  if(t.album) return viewAlbum&&viewAlbum.tracks[t.idx]?viewAlbum.tracks[t.idx].h:null;
  if(t.lib){ var a=artistAlbums[t.block]; return a&&a.tracks[t.idx]?a.tracks[t.idx].handle:null; }
  var hs=t.pl>=0?getItems(t.pl):null;
  return hs&&hs.Count>t.item?hs[t.item]:null;
}
function selectedTrackEntries(){
  syncTrackSelection(); var rows=orderedTrackRows(),out=[],i;
  for(i=0;i<rows.length;i++) if(isTrackSelected(rows[i])){
    var h=trackHandle(rows[i]); if(h) out.push({row:rows[i],handle:h});
  }
  return out;
}


/* Ctrl+F: a non-destructive, contextual filter in track lists, or the global search page.
   The query is separate from the global Search query and never changes playlist contents. */
var filterOpen=false,filterQuery='',filterScope='',HB_FILTER_CLOSE=null;
function currentFilterScope(){ return view==='playlist'?'pl:'+plman.ActivePlaylist:view; }
function inlineFilterActive(){ return filterOpen && filterScope===currentFilterScope() && (view==='songs'||view==='playlist'); }
function startContextFind(){
  if(fsMode) return;
  if(view==='songs'||view==='playlist'){
    var scope=currentFilterScope();
    if(!filterOpen || filterScope!==scope){ filterQuery=''; filterOpen=true;filterScope=scope; }
    if(view==='songs' && songsIdx) buildSongsRows();
    if(view==='playlist') plFilteredCache=null;
    songsScroll=songsScrollT=firstRow=firstRowT=0;
    resetEditSelection(filterQuery);
    applyKeyMode(); repaintAll();
    return;
  }
  // In Home and all other views use the full library Search page.
  view='search';searchQ2=null;searchScroll=searchScrollT=0;
  resetEditSelection(searchQuery);
  applyKeyMode();repaintAll();
}
function closeContextFind(){
  if(!filterOpen)return;
  filterOpen=false;filterQuery='';filterScope='';HB_FILTER_CLOSE=null;plFilteredCache=null;
  if(view==='songs' && songsIdx)buildSongsRows();
  songsScroll=songsScrollT=firstRow=firstRowT=0;
  clearTrackSelection();drag=null;applyKeyMode();repaintAll();
}
function filterEdited(){
  if(view==='songs' && songsIdx)buildSongsRows();
  plFilteredCache=null;
  clearTrackSelection();
  songsScroll=songsScrollT=firstRow=firstRowT=0;
}
var rightTab='queue';
var compactQueueOpen=false, HB_QUEUE_TOGGLE=null;
function queueVisible(){ return R.queueW>0; }
function drawQueueToggle(gr){
  HB_QUEUE_TOGGLE=null;
  if(W>=1180 || fsMode) return;
  // Expand sits beside the scrollbar gutter; collapse belongs to the queue.
  var w=32,h=30;
  var x=compactQueueOpen?R.queue.x+R.queue.w-w-8:R.main.x+R.main.w-w-24;
  var y=compactQueueOpen?R.queue.y+(R.queue.w<220?52:14):R.main.y+10;
  HB_QUEUE_TOGGLE={x0:x,y0:y,x1:x+w,y1:y+h};
  gr.FillRoundRect(x,y,w,h,15,15,hv(x,y,x+w,y+h)?COL.hover:COL.elev);
  drawIcon(gr,compactQueueOpen?'panelClose':'panelOpen',COL.text,x,y,w,h,19);
}

var view='home', viewArtist='', artistAlbums=[], homeScroll=0, artScroll=0, artistRowStart=0;
var artistReturnView='home', HB_ARTBACK=null; // return to the view that opened the artist
// Fullscreen "chill" mode + its sub-view (default now-playing / lyrics / visualizer)
var fsMode=false, fsView='default', HB_FS=[], vizTimer=null, vizBars=[];
// Re-asserted every full paint + on_size: JSplitter can reset window.DlgCode on resize/reload.
function applyKeyMode(){ try{ window.DlgCode=DLGC_WANTALLKEYS; }catch(e){} } // Ctrl+F also works from Home and playlists

var searchQuery='', searchScroll=0, searchScrollT=0, searchIdx=null, searchAlbumIdx=null, searchQ2=null, searchArts=[], searchAlbums=[], searchTrks=[], HB_SEARCH=null;
var viewAlbum=null, albumReturnView='search', albumScroll=0, ALBUM_MAXPX=0, HB_ALBBACK=null;
var HOME_MAXROW=0, ART_MAXBLOCK=0, SEARCH_MAXPX=0;
// Home "Your Playlists" horizontal shelf: pixel scroll offset + eased target, max, wheel hit-band, h-scrollbar.
var plScroll=0, plScrollT=0, HOME_PLMAX=0, HOME_SHELF_Y0=0, HOME_SHELF_Y1=0, SBH=null;
// The shelf glides freely but always *targets* a card boundary, so the leftmost card keeps its
// rounded edge instead of being cut mid-body (COL.elev against COL.base reads as a seam).
// HOME_STRIDE is published by drawHome, which is the only place the card pitch is known.
var HOME_STRIDE=0;
function snapShelf(px){ var st=HOME_STRIDE||1; return clampPx(Math.round(px/st)*st,HOME_PLMAX); }


var sidebarWidth=propNum('Sidebar: width',M.navW);
function sidebarResizeHit(x,y){return !fsMode&&R.main&&Math.abs(x-(R.navX+R.navW+M.gap/2))<=4&&y>=R.main.y&&y<R.main.y+R.main.h;}
var playlistNameTooltip=null,playlistNameTooltipText='';
function clearPlaylistNameTooltip(){
  if(playlistNameTooltip)try{playlistNameTooltip.Deactivate();}catch(e){}
  playlistNameTooltipText='';
}
function updatePlaylistNameTooltip(x,y){
  if(drag||ctxMenu||renameEdit||confirmDel||(view==='home'&&hit(HB_HOME_VIEW,x,y))){clearPlaylistNameTooltip();return;}
  var row=hit(HB_PL,x,y),card=hit(HB_CARD,x,y),text='';
  if(row&&row.truncated)text=plName(row.i);
  else if(card&&card.kind==='pl'&&card.truncated)text=plName(card.id);
  if(text===playlistNameTooltipText)return;
  clearPlaylistNameTooltip();
  if(text)try{
    if(!playlistNameTooltip)playlistNameTooltip=window.CreateTooltip();
    playlistNameTooltip.Text=text;playlistNameTooltip.Activate();playlistNameTooltipText=text;
  }catch(e){}
}
function layout(){
  var g=M.gap, top0=TBH+g;   // one uniform gap on every side, incl. below the title bar and above the bar
  R.barY=H-M.barH;
  R.top={x:g,y:top0,bottom:R.barY-g};
  // Responsive canvas: prioritise the playlist over the auxiliary queue.
  // Avoid allocating 240px to an invisible panel in compact FancyZones.
  R.navX=g;
  R.queueW=W>=1180?M.queueW+40:(compactQueueOpen?M.queueW:0);
  var minNav=W<600?64:148,minMain=W<600?180:300;
  R.queueW=Math.min(R.queueW,Math.max(0,W-minNav-minMain-4*g));
  R.navW=Math.max(minNav,Math.min(sidebarWidth,380,W-R.queueW-minMain-4*g));
  R.queueX=W-g-R.queueW;
  R.mainX=R.navX+R.navW+g;
  R.mainW=Math.max(1,R.queueW ? R.queueX-g-R.mainX : W-g-R.mainX);
  if(W<1180 && R.queueW) R.queueX=W-g-R.queueW;
  var topH=R.top.bottom-R.top.y;
  R.navTop={x:R.navX,y:top0,w:R.navW,h:M.navTopH};
  R.navLib={x:R.navX,y:top0+M.navTopH+g*2,w:R.navW,h:topH-M.navTopH-g*2};   // wider gap to the library card
  R.main={x:R.mainX,y:top0,w:R.mainW,h:topH};
  R.queue={x:R.queueX,y:top0,w:R.queueW,h:topH};
  // frameless; the title-bar strip minus our 3 buttons becomes an OS caption (drag/dbl-click)
  if(UIWizard){ try{ UIWizard.FrameStyle=3; UIWizard.MoveStyle=0; UIWizard.DisableWindowSizing=false; }catch(e){} }
  capW=-1; applyCaption();
  applyKeyMode();
}
// bitmaps are keyed by geometry; and the panel's surface is rebuilt, so the next paint must be full
function on_size(w,h){ clearPlaylistNameTooltip(); W=w; H=h; layout(); plCardCache={}; artCardCache={}; artCardN=0; skelImgs={}; dirtyAll=true; }

// name/count come from the per-playlist caches, not fresh interop: this runs on every paint of the playlist view
function activePl(){ var i=plman.ActivePlaylist; return {i:i, name:i>=0?plName(i):'', count:i>=0?plCount(i):0}; }
function updateNP(){
  queueViewportCache=null;
  var m=(fb.IsPlaying||fb.IsPaused)?fb.GetNowPlaying():stoppedTrack();
  NP=m;
  npTitleStr=m?TF.npTitle.EvalWithMetadb(m):'';
  npArtistStr=m?TF.npArtist.EvalWithMetadb(m):'';
}
function repaintBar(){ if(fsMode){ repaintAll(); return; } markDirty(); dirtyBar=true; window.RepaintRect(0,R.barY,W,M.barH); }

/* Only frames that actually redraw main may settle the shimmer -- a bar-only repaint (the 1Hz
   clock) would otherwise count zero skeletons and stop the animation while one is on screen. */
function drawMainCounted(gr){
  if(view!=='artist') HB_ARTBACK=null;
  shimCount=0; gateWaiting=0;
  drawMain(gr); roundTop(gr,R.main.x,R.main.y,R.main.w);
  shimSettle();
}
function on_paint(gr){
  visPlCache=null;   // one playlist scan per frame, shared by drawNav and drawHome
  gr.SetSmoothingMode(2);
  gr.SetInterpolationMode(5);   // NearestNeighbor: every DrawImage here is 1:1, so filtering is pure cost
  // Never hand negative/zero geometry to JSplitter when FancyZones creates a tiny window.
  // This is a safe compact fallback, not a forced Windows minimum size.
  if(W < 520 || H < 300){
    clearDirty();
    HB_ARTBACK=null; HB_HOME=null; HB_SEARCH=null;
    HB_CARD=[]; HB_TR=[]; HB_PL=[]; HB_Q=[];
    gr.FillSolidRect(0,0,Math.max(1,W),Math.max(1,H),COL.black);
    if(W > 120 && H > 110){
      tC(gr,'Expand window to view library',FONT.pl,COL.text2,8,Math.max(TBH+8,Math.floor(H/2)-12),Math.max(1,W-16),26);
    }
    return;
  }
  var stale=anyDirty() && (Date.now()-dirtySince)>DIRTY_STALE_MS;   // see markDirty
  if(fsMode){
    /* A visualizer frame changes only the bars. Redrawing the cover, the title, the seek bar and
       the whole transport underneath them 30 times a second was most of the frame's cost, so a
       frame flagged ONLY by the viz repaints just that band. Any other flag (or a paint we did not
       ask for) still takes the full path, so nothing can be left stale behind the bars. */
    var vizOnly=dirtyViz && !stale && fsView==='viz' && !vizMenuOpen && !dirtyAll && !dirtyBar && !dirtyMain
                && !dirtyNav && !dirtyQueue && !dirtySearch && !dirtyTitle;
    clearDirty();
    if(vizOnly){ drawVizBand(gr); return; }
    HB_DOTS=[]; drawFullscreen(gr);if(lyDialog||(ctxMenu&&ctxMenu.kind==='lyrics')||(confirmDel&&confirmDel.kind==='lyricsdelete'))drawOverlays(gr); return;
  }
  var anyPartial=dirtyBar||dirtyQueue||dirtySearch||dirtyMain||dirtyNav||dirtyTitle;
  // A partial paint skips drawOverlays, so a modal's dim backdrop would not be reapplied over the
  // region it redraws (the bar's 1 Hz repaint would flash back to full brightness). While an
  // overlay owns the screen, every paint takes the full path.
  var modal=(mainQueueDrag&&mainQueueDrag.moved)||(queueDrag&&queueDrag.moved)||lyDialog||renameEdit||ctxMenu||confirmDel||dupPrompt||rgPrompt||audioPopup||plSortMenuOpen||sgMenuOpen||rgTipShown;
  if(dirtyAll || !anyPartial || modal || stale){ // full paint, or an OS/stale paint we can't scope
    clearDirty();
    HB_DOTS=[];
    gr.FillSolidRect(0,0,W,H,COL.black);   // black canvas -> panels read as separated cards (Spotify look)
    drawTitleBar(gr);
    // main before nav: the home shelf's leftmost card is drawn partly outside the panel
    // (continuous scroll), so nav must repaint over that bleed -- same reason queue follows main
    drawMainCounted(gr);
    drawNav(gr);
    if(R.queueW) drawQueue(gr);
    drawQueueToggle(gr);
    drawBar(gr);
    drawOverlays(gr);
    drawPlaylistDropHighlight(gr);
    drawQueueDragPreview(gr);
    return;
  }
  // partial composite: only the regions actually flagged (each drawn over live content)
  if(dirtyTitle){ dirtyTitle=false; drawTitleBar(gr); }
  if(dirtyMain||dirtyNav) HB_DOTS=[];   // these rebuild their hover targets
  if(dirtyMain){ dirtyMain=false; drawMainCounted(gr); if(R.queueW && W<1180) drawQueue(gr); drawQueueToggle(gr); }
  if(dirtyNav){ dirtyNav=false; drawNav(gr); }
  if(dirtyQueue){ dirtyQueue=false; if(R.queueW) drawQueue(gr); drawQueueToggle(gr); }
  if(dirtySearch){ dirtySearch=false; if(editInputActive()) drawSearchBox(gr,R.main,inlineFilterActive()); }
  if(dirtyBar){ dirtyBar=false; drawBar(gr); }
}

function drawMain(gr){
  navObserveView();
  HB_CARD=[]; HB_TR=[]; SB=null; SBH=null;   // clear stale click targets from the previous view
  if(view!=='songs'){ HB_SG=null; SG_HB=[]; HB_RGNORM=null; }
  if(view!=='playlist'){ HB_PLSORT=null; HB_PLSORTDIR=null; PL_SORT_HB=[]; }
  if(!inlineFilterActive()) HB_FILTER_CLOSE=null;

  applyKeyMode();
  syncTrackSelection();
  if(view==='search'||inlineFilterActive()) startCaret(); else stopCaret();
  var r=R.main; panelBg(gr,r,COL.base);
  if(view==='home'){ drawHome(gr,r); return; }
  if(view==='search'){ drawSearch(gr,r); return; }
  if(view==='artist'){ drawArtist(gr,r); return; }
  if(view==='album'){ drawAlbum(gr,r); return; }
  if(view==='songs'){ drawSongs(gr,r); return; }
  drawPlaylist(gr,r);
}

/* ------------------------- input ------------------------- */
function seekFrac(x){ return HB_SEEK?clamp01((x-HB_SEEK.x)/HB_SEEK.w):0; }
function applyVol(x){ if(HB_VOL){ fb.Volume=pos2vol(clamp01((x-HB_VOL.x)/HB_VOL.w)); repaintBar(); } }
function dismissTransientMenus(){
  clearPlaylistNameTooltip();
  ctxMenu=null;CTX_HB=[];
  sgMenuOpen=false;plSortMenuOpen=false;vizMenuOpen=false;
  audioClose();rgTipClear();
  repaintAll();
}
function on_focus(is_focused){
  if(!is_focused&&mainQueueDrag)cancelMainQueueDrag();
  if(!is_focused)pointerDown=false;
  if(!is_focused){stopQueueEdgeScroll();if(queueDrag){queueDrag=null;if(drag==='queue')drag=null;}dismissTransientMenus();}
}
var trackClickModifiers=null;
function mouseSelectionModifiers(mask){
  var shift=!!(mask&4),ctrl=!!(mask&8);
  try{shift=shift||utils.IsKeyPressed(0x10);ctrl=ctrl||utils.IsKeyPressed(0x11);}catch(e){}
  return {shift:shift,ctrl:ctrl};
}
function on_mouse_lbtn_down(x,y,mask){
  pointerDown=true;repaintAll();
  if(lyDialog)return;
  trackClickModifiers=mouseSelectionModifiers(mask);
  if(ctxMenu||confirmDel||renameEdit||sgMenuOpen||plSortMenuOpen||vizMenuOpen||dupPrompt||rgPrompt||audioPopup) return;   // overlays are modal; dismissal/actions handled on button-up
  queueKeyboardFocus=queuePaneHit(x,y);
  if(queueKeyboardFocus&&!hit(HB_Q,x,y)){
    queueSelection=null;
    if(HB_QUEUE_NP&&inRect(x,y,HB_QUEUE_NP)){var ready=queueCurrentIndex(playOrderEntries());if(ready>=0)selectQueueRow({upIndex:ready,handle:HB_QUEUE_NP.handle});}
  }
  if(sidebarResizeHit(x,y)){clearPlaylistNameTooltip();drag='sidebar';return;}

  if(editInputActive() && searchTextHit && searchBoxContains(x,y)){
    var shift=false; try{shift=utils.IsKeyPressed(0x10);}catch(e){}
    var pos=searchHitCursor(x);
    if(!shift) searchAnchor=pos;
    searchCursor=pos;drag='search';caretOn=true;repaintAll();return;
  }
  if(HB_SEEK && inRect(x,y,HB_SEEK)){ drag='seek'; dragFrac=seekFrac(x); repaintBar(); return; }
  if(HB_VOL && inRect(x,y,HB_VOL)){ drag='vol'; applyVol(x); return; }
  if(rightTab==='queue'&&queueVisible()&&SBQ&&inRect(x,y,SBQ)){drag='scrollq';setQueueScroll(y);return;}
  var queueRow=!fsMode&&queueVisible()&&rightTab==='queue'&&x>=R.queue.x&&x<R.queue.x+R.queue.w&&hit(HB_Q,x,y);
  if(queueRow){beginQueueDrag(queueRow,x,y);return;}
  if(queueKeyboardFocus)return;
  if(W<1180 && compactQueueOpen && R.queueW && x>=R.queue.x && y>=R.queue.y && y<R.queue.y+R.queue.h) return;
  if(SBH && inRect(x,y,SBH)){ drag='scrollh'; setScrollH(x); return; }
  if(SBN && inRect(x,y,SBN)){ drag='scrolln'; setScrollN(y); return; }
  if(SB && inRect(x,y,SB)){ drag='scroll'; setScroll(y); return; }
  var mainRow=hit(HB_TR,x,y);if(mainRow)beginMainQueueDrag(mainRow,x,y,mask);
}
function on_mouse_rbtn_up(x,y){
  rgTipClear();
  if(lyDialog)return true;
  if(ctxMenu){
    if(!hit(CTX_HB,x,y))dismissTransientMenus();
    return true;
  }
  if(ctxMenu||confirmDel||renameEdit||dupPrompt||rgPrompt||audioPopup) return true;   // a modal is open: swallow
  queueKeyboardFocus=queuePaneHit(x,y);
  if((fsMode&&fsView==='lyrics'&&y<H-172)||(!fsMode&&queueVisible()&&rightTab==='lyrics'&&inRect(x,y,{x0:R.queue.x,y0:R.queue.y+50,x1:R.queue.x+R.queue.w,y1:R.queue.y+R.queue.h}))){
    lyricPanelMenu(x,y);return true;
  }
  if(!fsMode&&queueVisible()&&rightTab==='queue'&&inRect(x,y,{x0:R.queue.x,y0:R.queue.y,x1:R.queue.x+R.queue.w,y1:R.queue.y+R.queue.h})){
    openQueueMenu(x,y);return true;
  }
  var i;
  // Right-click inside a selection keeps every selected row. Outside it, select the clicked
  // row alone, just like Explorer; the menu then operates on the whole selection.
  for(i=0;i<HB_TR.length;i++){ if(inRect(x,y,HB_TR[i])){
    var row=HB_TR[i], handle=trackHandle(row);
    if(handle){
      syncTrackSelection();
      if(!isTrackSelected(row)) selectTrack(row,false,false);
      openSongMenu(handle,x,y,row.pl,row.item,selectedTrackEntries());
      return true;
    }
  } }
  for(i=0;i<HB_PL.length;i++){ if(inRect(x,y,HB_PL[i])){ openPlaylistMenu(HB_PL[i].i,x,y); return true; } }
  for(i=0;i<HB_CARD.length;i++){ if(inRect(x,y,HB_CARD[i]) && HB_CARD[i].kind==='pl'){ openPlaylistMenu(HB_CARD[i].id,x,y); return true; } }
  if(view==='playlist' && R.main && x>=R.main.x && x<R.main.x+R.main.w && y>=R.main.y && y<R.main.y+R.main.h){
    var pl=plman.ActivePlaylist;
    if(pl>=0){openPlaylistMenu(pl,x,y);return true;}
  }
  return false;   // elsewhere: let JSplitter's own panel menu through (Reload / Configure / Properties)
}
function playHandleList(handles,idx){
  playOrderPreview=null;
  clearArtistQueueOrder();
  clearStoppedPlayback();
  restoreUpNextStop();
  clearShuffleHandoff();
  var arr=[]; for(var i=0;i<handles.length;i++) arr.push(handles[i]);
  var start=arr[idx];
  if(pbShuffle){ shuffleArr(arr); var ci=indexOfHandle(arr,start); if(ci>=0) arr.splice(ci,1); arr.unshift(start); shufSrcName=ROUTE; idx=0; }
  var hl=fb.CreateHandleList();
  for(i=0;i<arr.length;i++) hl.Add(arr[i]);
  var pi=plman.FindOrCreatePlaylist(ROUTE,true);
  try{ plman.ClearPlaylist(pi); }catch(e){}
  plman.InsertPlaylistItems(pi,0,hl,false);
  plman.ActivePlaylist=pi; invalidateItems();
  plman.ExecutePlaylistDefaultAction(pi,idx);
}
function playArtistTrack(block,idx){
  var al=artistAlbums[block]; if(!al) return;
  var hs=[]; for(var i=0;i<al.tracks.length;i++) hs.push(al.tracks[i].handle);
  playHandleList(hs,idx);
}
function getSearchIdx(){
  if(searchIdx) return searchIdx;
  var lib=libItems();
  var out=[];
  if(lib && lib.Count){
    var t=libTF('title'), a=libTF('artist'), al=libTF('album'), l=libTF('len'),
        aa=libTF('artistName'), yr=libTF('year'), tn=libTF('trackno'), dn=libTF('discno');
    for(var i=0;i<t.length;i++) out.push({h:lib[i],title:t[i],artist:a[i],album:al[i],len:l[i],aartist:aa[i],year:yr[i],trackNo:parseTagNumber(tn[i]),discNo:parseTagNumber(dn[i]),ordinal:i,key:(t[i]+' '+a[i]+' '+al[i]).toLowerCase()});
  }
  searchIdx=out; return out;
}
/* Album index is built once per library snapshot, not during every search keystroke. */
function getSearchAlbumIdx(){
  if(searchAlbumIdx) return searchAlbumIdx;
  var idx=getSearchIdx(), byKey=Object.create(null), arr=[],i,t,key,entry;
  for(i=0;i<idx.length;i++){
    t=idx[i]; if(!t.album) continue;
    key=(t.aartist||t.artist||'')+'\u0001'+t.album;
    entry=byKey[key];
    if(!entry){ entry={key:key,album:t.album,artist:t.aartist||t.artist,year:t.year,handle:t.h,tracks:[]}; byKey[key]=entry; arr.push(entry); }
    entry.tracks.push(t);
  }
  arr.sort(function(a,b){ return cmpStr(a.album,b.album)||cmpStr(a.artist,b.artist); });
  searchAlbumIdx=arr; return arr;
}
/* Track/disc numbers are metadata, not a generated ordinal. Missing tags sort last.
   Handles tags like '01' or '01/02' without inventing a number for missing tags. */
function parseTagNumber(value){
  var m=/^\s*(\d+)(?:\s*\/\s*\d+)?\s*$/.exec(String(value||''));
  return m?parseInt(m[1],10)||0:0;
}
function albumTrackCompare(a,b){
  var da=a.discNo||2147483647,db=b.discNo||2147483647;
  if(da!==db) return da-db;
  var ta=a.trackNo||2147483647,tb=b.trackNo||2147483647;
  return ta-tb || a.ordinal-b.ordinal;
}
/* A layout row is either a disc divider or a real track. Selection/playback
   indices always refer to the sorted a.tracks array, never the divider rows. */
function albumDisplayRows(tracks){
  var seen=Object.create(null),discCount=0,taggedDiscCount=0,i,key;
  for(i=0;i<tracks.length;i++){
    key=String(tracks[i].discNo||0);
    if(!seen[key]){seen[key]=true;discCount++;if(tracks[i].discNo)taggedDiscCount++;}
  }
  var useHeaders=discCount>1,rows=[],prev=null,y=0;
  for(i=0;i<tracks.length;i++){
    key=String(tracks[i].discNo||0);
    if(useHeaders && key!==prev){
      rows.push({kind:'disc',discNo:tracks[i].discNo||0,y:y,h:34});y+=34;
    }
    rows.push({kind:'track',idx:i,y:y,h:44});y+=44;
    prev=key;
  }
  return {rows:rows,height:y,discCount:discCount,taggedDiscCount:taggedDiscCount,hasDiscHeaders:useHeaders};
}
function loadAlbum(a){
  if(!a) return;
  viewAlbum={key:a.key,album:a.album,artist:a.artist,year:a.year,handle:a.handle,
             tracks:a.tracks.slice().sort(albumTrackCompare)};
  viewAlbum.display=albumDisplayRows(viewAlbum.tracks);
  albumScroll=0;
}
function computeSearch(){
  var q=searchQuery.trim().toLowerCase();
  if(q===searchQ2 && searchIdx && searchAlbumIdx) return;
  searchQ2=q; searchArts=[]; searchAlbums=[]; searchTrks=[];
  if(!q) return;
  var arts=getArtistList(), i,albums=getSearchAlbumIdx();
  for(i=0;i<arts.length && searchArts.length<24;i++){
    if(fuzzyTrackMatch(q,[arts[i].name])) searchArts.push(arts[i]);
  }
  for(i=0;i<albums.length && searchAlbums.length<32;i++){
    if(fuzzyTrackMatch(q,[albums[i].album,albums[i].artist])) searchAlbums.push(albums[i]);
  }
  var idx=getSearchIdx(), cnt=0;
  for(i=0;i<idx.length && cnt<150;i++){
    if(fuzzyTrackMatch(q,[idx[i].title,idx[i].artist,idx[i].aartist,idx[i].album])){
      searchTrks.push(idx[i]); cnt++;
    }
  }
}
/* The back button restarts the current track once it is past the first moment of it, and only
   steps back when pressed at the very start -- the rule every streaming player uses, because a
   mis-hit mid-song should not lose your place in the queue. Paused counts too: it rewinds and
   stays paused. Stopped has no position to rewind, so it steps back.
   NOTE: media keys and foobar's own menu call fb.Prev() directly and cannot be intercepted from
   a panel, so those still always step back. */
var PREV_RESTART_SEC=1;
function doPrev(){
  var t=0; try{ t=fb.PlaybackTime; }catch(e){ t=0; }
  if((fb.IsPlaying||fb.IsPaused) && t>PREV_RESTART_SEC){ try{ fb.PlaybackTime=0; return; }catch(e){} }
  fb.Prev();
}
function doCtrl(act){
  if(act==='play')playOrPauseRetainingQueue();
  else if(act==='stop')stopPlaybackRetainingQueue();
  else if(act==='next') fb.Next();
  else if(act==='prev') doPrev();
  else if(act==='shuffle') toggleShuffle();
  else if(act==='repeat') cycleRepeat();
  else if(act==='fullscreen'){ enterFullscreen(); return; }
  repaintAll();
}
function on_mouse_lbtn_up(x,y,mask){
  pointerDown=false;repaintAll();
  if(lyDialogDoubleClickUp){lyDialogDoubleClickUp=false;trackClickModifiers=null;return;}
  if(lyDialog){lyricDialogClick(x,y);return;}
  if(mainQueueDrag&&finishMainQueueDrag(x,y))return;
  var clickModifiers=trackClickModifiers||mouseSelectionModifiers(mask);
  trackClickModifiers=null;
  if(queueDrag){updateQueueDrag(x,y);finishQueueDrag();return;}
  rgTipClear();
  var t;
  if(drag==='sidebar'){
    drag=null;sidebarWidth=R.navW;
    try{window.SetProperty('Sidebar: width',sidebarWidth);}catch(e){}
    repaintAll();return;
  }
  // Let a title/menu-bar click dismiss the track menu and continue to its target.
  if(ctxMenu && y<TBH){ctxMenu=null;CTX_HB=[];repaintAll();}
  // ---- modal overlays first ----
  if(dupPrompt){
    if(DUP_HB && inRect(x,y,DUP_HB.skip)) dupSkip(); else dupKeep();   // "Add anyway"/outside: leave as-is
    return;
  }
  if(rgPrompt){
    if(RG_HB && inRect(x,y,RG_HB.scan)){ rgConfirmScan(); return; }
    rgPrompt=null; repaintAll(); return;      // cancel / click outside
  }
  if(confirmDel){
    if(CONF_HB && inRect(x,y,CONF_HB.del)){ commitDeletePrompt(); return; }
    confirmDel=null; repaintAll(); return;   // cancel / click outside
  }
  if(ctxMenu){
    t=hit(CTX_HB,x,y);
    if(t){
      var act=t.act, pl=ctxMenu.pl, nm=ctxMenu.name, itm=ctxMenu.item;
      if(t.disabled)return;
      if(ctxMenu.kind==='lyrics'){handleLyricsMenuAction(act,ctxMenu);return;}
      if(ctxMenu.kind==='queue'){ctxMenu=null;if(act==='clearqueue')promptClearUpNext();return;}
      if(ctxMenu.kind==='pl'){handlePlaylistMenuAction(act,ctxMenu);return;}
      if(ctxMenu.kind==='song'){
        if(act==='destinations'){ ctxMenu.subOpen=true; repaintAll(); return; }
        handleSongMenuAction(act,ctxMenu); return;
      }
      if(act==='trkremove'){ ctxMenu=null; removeTrackFromPl(pl,itm); return; }
      if(act==='save'){ ctxMenu=null; savePlaylistToFile(pl); return; }
      // navigate to the target first, so the tracks land somewhere the user can see
      if(act==='addfiles'||act==='addfolder'){
        ctxMenu=null; firstRow=firstRowT=0; view='playlist'; repaintAll();
        if(act==='addfiles') addFilesToPl(pl); else addFolderToPl(pl);
      }
      else if(act==='rename'){ startRename(pl); }
      else { confirmDel={pl:pl,name:nm}; ctxMenu=null; repaintAll(); }
      return;
    }
    ctxMenu=null; repaintAll(); return;      // click outside menu -> close
  }
  if(renameEdit){
    if(RENAME_HB){
      if(RENAME_HB.input && inRect(x,y,RENAME_HB.input)){
        var keepAnchor=false;
        try{keepAnchor=utils.IsKeyPressed(0x10);}catch(e){}
        var cursor=renameHitCursor(x);
        if(!keepAnchor)renameEdit.anchor=cursor;
        renameEdit.cursor=cursor;caretOn=true;repaintAll();return;
      }
      if(inRect(x,y,RENAME_HB.save)){ if(RENAME_HB.canSave) commitRename(); return; }
      if(inRect(x,y,RENAME_HB.cancel)){ cancelRename(); return; }
      if(inRect(x,y,RENAME_HB.panel)) return;     // click inside the dialog: keep it open
    }
    cancelRename(); return;                        // click on backdrop: dismiss
  }
  if(audioPopup){
    t=hit(AUDIO_ROW_HB,x,y);
    if(t){ audioApply(t); return; }
    audioClose();return; // clicking the button again or outside dismisses
  }
  if((t=hit(HB_DOTS,x,y))){ openPlaylistMenu(t.pl,t.mx,t.my); return; }
  if(drag==='search'){ drag=null; return; }
  if(drag==='seek'){ if(fb.PlaybackLength>0) fb.PlaybackTime=fb.PlaybackLength*dragFrac; drag=null; repaintAll(); return; }
  if(drag==='vol'){ drag=null; return; }
  if(drag==='scrollq'){drag=null;repaintQueue();return;}
  if(drag==='scroll'||drag==='scrollh'||drag==='scrolln'){
    var wasH=(drag==='scrollh'); drag=null;
    if(wasH){ plScrollT=snapShelf(plScroll); startScrollAnim(); }   // release the thumb -> settle on a boundary
    repaintAll(); return;
  }
  // an open dropdown is modal-ish: any click either picks an item or closes it
  if(sgMenuOpen){
    if((t=hit(SG_HB,x,y))){ setSongsGroup(t.v); return; }
    sgMenuOpen=false; repaintAll(); return;
  }
  if(HB_SG && inRect(x,y,HB_SG)){ sgMenuOpen=true; repaintAll(); return; }
  if(HB_RGNORM && inRect(x,y,HB_RGNORM)){ rgToggle(); return; }
  if(plSortMenuOpen){
    if((t=hit(PL_SORT_HB,x,y))){ setPlSort(t.v); return; }
    plSortMenuOpen=false; repaintAll(); return;
  }
  if(HB_PLSORT && inRect(x,y,HB_PLSORT)){ plSortMenuOpen=true; repaintAll(); return; }
  if(HB_PLSORTDIR && inRect(x,y,HB_PLSORTDIR)){ togglePlSortDir(); return; }
  if(((fsMode&&fsView==='lyrics')||(!fsMode&&queueVisible()&&rightTab==='lyrics'))&&lyricActionClick(x,y))return;
  if(fsMode){
    if(vizMenuOpen){                                  // the style list is modal while it is open
      if((t=hit(VIZ_HB,x,y))){ setVizStyle(t.v); return; }
      vizMenuOpen=false; repaintAll(); return;
    }
    if(HB_VIZ && fsView==='viz' && inRect(x,y,HB_VIZ)){ vizMenuOpen=true; repaintAll(); return; }
    if((t=hit(HB_FS,x,y))){ doFsAct(t.act); return; }
    if((t=hit(HB_CTRL,x,y))){ doCtrl(t.act); return; }
    return;
  }
  if(y<TBH){
    if((t=hit(HB_MENU,x,y))){ openMenu(t.root,t.mx,TBH); return; }
    if(HB_CAP){
      if(x>=HB_CAP.closeX){ fb.Exit(); return; }
      if(x>=HB_CAP.maxX){ if(UIWizard){ try{ UIWizard.ToggleMaximize(); }catch(e){} } repaintAll(); return; }
      if(x>=HB_CAP.minX){ if(UIWizard){ try{ UIWizard.WindowMinimize(); }catch(e){} } return; }
    }
    return;
  }

  if(inlineFilterActive() && HB_FILTER_CLOSE && inRect(x,y,HB_FILTER_CLOSE)){ closeContextFind(); return; }
  if(rightTab==='queue'&&queueVisible()&&HB_QUEUE_CLEAR&&inRect(x,y,HB_QUEUE_CLEAR)){
    if(!HB_QUEUE_CLEAR.disabled)promptClearUpNext();return;
  }
  if(HB_QUEUE_TOGGLE && inRect(x,y,HB_QUEUE_TOGGLE)){ compactQueueOpen=!compactQueueOpen; layout(); repaintAll(); return; }
  if(view==='home' && (t=hit(HB_HOME_VIEW,x,y))){setHomeViewMode(t.mode);return;}
  if(W<1180 && compactQueueOpen && R.queueW && x>=R.queue.x && y>=R.queue.y && y<R.queue.y+R.queue.h){
    if((t=hit(HB_TABS,x,y))){ rightTab=t.tab; if(rightTab==='lyrics'){loadLyrics();lySnap=true;} else stopLyAnim(); repaintAll(); return; }
    if((t=hit(HB_Q,x,y)))selectQueueRow(t);
    return;
  }
  if(view==='artist' && HB_ARTBACK && inRect(x,y,HB_ARTBACK)){ view=artistReturnView; HB_ARTBACK=null; repaintAll(); return; }
  if(view==='artist'&&HB_ARTQUEUE&&inRect(x,y,HB_ARTQUEUE)){enqueueArtistHandles(artistQueueHandles());return;}
  if(view==='album' && HB_ALBBACK && inRect(x,y,HB_ALBBACK)){ view=albumReturnView; viewAlbum=null; HB_ALBBACK=null; repaintAll(); return; }
  if((t=hit(HB_TABS,x,y))){ rightTab=t.tab; if(rightTab==='lyrics'){ loadLyrics(); lySnap=true; } else stopLyAnim(); repaintAll(); return; }
  if((t=hit(HB_AUDIO,x,y))){ audioOpen(); return; }
  if((t=hit(HB_CTRL,x,y))){ doCtrl(t.act); return; }
  if(HB_HOME && inRect(x,y,HB_HOME)){ view='home'; repaintAll(); return; }
  if(HB_SEARCH && inRect(x,y,HB_SEARCH)){ view='search'; repaintAll(); return; }
  if(HB_ALLSONGS && inRect(x,y,HB_ALLSONGS)){ if(view!=='songs'){ view='songs'; songsScroll=songsScrollT=0; if(songsIdx)buildSongsRows(); } repaintAll(); return; }
  if(HB_ADDPL && inRect(x,y,HB_ADDPL)){ keyboardCreatePlaylist(); return; }
  if(HB_PLADD_FILES && inRect(x,y,HB_PLADD_FILES)){ addFilesToPl(plman.ActivePlaylist); return; }
  if(HB_PLADD_FOLDER && inRect(x,y,HB_PLADD_FOLDER)){ addFolderToPl(plman.ActivePlaylist); return; }
  if((t=hit(HB_CARD,x,y))){
    if(t.kind==='pl'){ clearTrackSelection(); plman.ActivePlaylist=t.id; firstRow=firstRowT=0; view='playlist'; }
    else if(t.kind==='album'){ albumReturnView=view; loadAlbum(t.album); view='album'; }
    else { artistReturnView=view; loadArtist(t.id); view='artist'; }
    repaintAll(); return;
  }
  if((t=hit(HB_PL,x,y))){ clearTrackSelection(); plman.ActivePlaylist=t.i; firstRow=firstRowT=0; view='playlist'; repaintAll(); return; }
  if((t=hit(HB_Q,x,y))){selectQueueRow(t);return;}
  /* Rows play on DOUBLE click -- see on_mouse_lbtn_dblclk. The exception is the play glyph that
     replaces the track number on the hovered row: that is a button, and a button takes one click.
     Rows that draw no glyph (search results, the artist page) carry no pg band and so ignore this. */
  if((t=hit(HB_TR,x,y))){
    var shift=clickModifiers.shift,ctrl=clickModifiers.ctrl;
    // On normal click the play glyph still plays immediately. Modifiers always select.
    if(!shift && !ctrl && t.pgx1!==undefined && x>=t.pgx0 && x<t.pgx1){ playRow(t); return; }
    selectTrack(t,shift,ctrl); return;
  }
  // Click the empty list area to clear selection, not a control/header.
  if(R.main && x>=R.main.x && x<R.main.x+R.main.w && y>=R.main.y && y<R.main.y+R.main.h
     && (view==='songs'||view==='playlist'||view==='artist'||view==='album'||view==='search') && trackSel.count){
    clearTrackSelection(); repaintMain();
  }
}
function playRow(t){
  if(t.srch){ var hs=[], m; for(m=0;m<searchTrks.length;m++) hs.push(searchTrks[m].h); playHandleList(hs,t.idx); }
  else if(t.album && viewAlbum){ var ah=[]; for(var a=0;a<viewAlbum.tracks.length;a++) ah.push(viewAlbum.tracks[a].h); playHandleList(ah,t.idx); }
  else if(t.songs) playSongsRow(t.ti);
  else if(t.lib) playArtistTrack(t.block,t.idx);
  else playPlaylistItem(t.pl,t.item);
  repaintAll();
}
// A single click on a list this dense is too easy to fire by accident, and it is the convention
// every desktop player follows -- including the one this theme is modelled on.
function on_mouse_lbtn_dblclk(x,y,mask){
  if(lyDialog){lyricDialogDoubleClick(x,y);return;}
  mainQueueDrag=null;
  var modifiers=mouseSelectionModifiers(mask);
  if(modifiers.shift||modifiers.ctrl)return;

  if(editInputActive() && searchTextHit && searchBoxContains(x,y)){ searchSelectWord(searchHitCursor(x)); drag=null; return; }
  if(ctxMenu||confirmDel||renameEdit||sgMenuOpen||plSortMenuOpen||vizMenuOpen||dupPrompt||rgPrompt||audioPopup) return;
  if(!fsMode&&queueVisible()&&rightTab==='queue'&&x>=R.queue.x&&x<R.queue.x+R.queue.w){
    var queued=hit(HB_Q,x,y);
    if(queued){queueDrag=null;if(drag==='queue')drag=null;queueSelection=null;
      playUpNextRow(queued);
      return;
    }
  }
  if(W<1180 && compactQueueOpen && R.queueW && x>=R.queue.x && y>=R.queue.y && y<R.queue.y+R.queue.h) return;
  var t=hit(HB_TR,x,y);
  if(t) playRow(t);
}
function hoverSig(x,y){
  var i;
  if(fsMode){
    if(vizMenuOpen){ i=hitIdx(VIZ_HB,x,y); return (i<0)?'vz':('vz'+i); }
    if(HB_VIZ && inRect(x,y,HB_VIZ)) return 'vzb';
    if((i=hitIdx(HB_FS,x,y))>=0) return 'f'+i;      // fullscreen icons: hover feedback, same as anywhere
  }
  if(dupPrompt){ if(DUP_HB){ if(inRect(x,y,DUP_HB.skip)) return 'dps'; if(inRect(x,y,DUP_HB.keep)) return 'dpk'; } return 'dp'; }
  if(renameEdit){ if(RENAME_HB){ if(inRect(x,y,RENAME_HB.save)) return 'rns'; if(inRect(x,y,RENAME_HB.cancel)) return 'rnc'; } return 'rn'; }
  if(rgPrompt){ if(RG_HB){ if(inRect(x,y,RG_HB.scan)) return 'rgs'; if(inRect(x,y,RG_HB.cancel)) return 'rgc'; } return 'rg'; }
  if(confirmDel){ if(CONF_HB && inRect(x,y,CONF_HB.del)) return 'cfd'; if(CONF_HB && inRect(x,y,CONF_HB.cancel)) return 'cfc'; return 'cf'; }
  if(audioPopup){i=hitIdx(AUDIO_ROW_HB,x,y);return (i<0)?'audioMenu':('audio'+i);}
  if(ctxMenu){ i=hitIdx(CTX_HB,x,y); return (i<0)?'cx':('cx'+i); }
  if(sgMenuOpen){ i=hitIdx(SG_HB,x,y); return (i<0)?'sg':('sg'+i); }
  if(plSortMenuOpen){ i=hitIdx(PL_SORT_HB,x,y); return (i<0)?'ps':('ps'+i); }
  if((i=hitIdx(HB_DOTS,x,y))>=0) return 'd'+i;
  if(y<TBH){
    if((i=hitIdx(HB_MENU,x,y))>=0) return 'mnu'+i;
    if(HB_CAP && x>=HB_CAP.minX) return 'cap'+(((x-HB_CAP.minX)/HB_CAP.bw)|0);
    return '';
  }
  if(inlineFilterActive() && HB_FILTER_CLOSE && inRect(x,y,HB_FILTER_CLOSE)) return 'filterClose';
  if(HB_QUEUE_TOGGLE && inRect(x,y,HB_QUEUE_TOGGLE)) return 'queueToggle';
  if(rightTab==='queue'&&queueVisible()){
    if(SBQ&&inRect(x,y,SBQ))return 'queueScrollbar';
    if(HB_QUEUE_CLEAR&&inRect(x,y,HB_QUEUE_CLEAR))return 'clearQueue';
  }
  if(view==='home' && (i=hitIdx(HB_HOME_VIEW,x,y))>=0)return 'homeView'+i;
  if(W<1180 && compactQueueOpen && R.queueW && x>=R.queue.x && y>=R.queue.y && y<R.queue.y+R.queue.h){
    if((i=hitIdx(HB_TABS,x,y))>=0) return 't'+i;
    if((i=hitIdx(HB_Q,x,y))>=0) return 'q'+i;
    return 'queueOverlay';
  }
  if(SBH && inRect(x,y,SBH)) return 'sbh';
  if(SBN && inRect(x,y,SBN)) return 'sbn';
  if(HB_ADDPL && inRect(x,y,HB_ADDPL)) return 'addpl';
  if(HB_PLADD_FILES && inRect(x,y,HB_PLADD_FILES)) return 'pladdf';
  if(HB_PLADD_FOLDER && inRect(x,y,HB_PLADD_FOLDER)) return 'pladdd';
  if(HB_ALLSONGS && inRect(x,y,HB_ALLSONGS)) return 'als';
  if(HB_SG && inRect(x,y,HB_SG)) return 'sgb';
  if(HB_RGNORM && inRect(x,y,HB_RGNORM)) return 'nzb';
  if(HB_PLSORT && inRect(x,y,HB_PLSORT)) return 'psb';
  if(HB_PLSORTDIR && inRect(x,y,HB_PLSORTDIR)) return 'psd';
  if(SB && inRect(x,y,SB)) return 'sb';
  if((i=hitIdx(HB_AUDIO,x,y))>=0) return 'audioBtn'+i;
  if((i=hitIdx(HB_CTRL,x,y))>=0) return 'c'+i;
  if((i=hitIdx(HB_TABS,x,y))>=0) return 't'+i;
  if(HB_HOME && inRect(x,y,HB_HOME)) return 'h';
  if(HB_SEARCH && inRect(x,y,HB_SEARCH)) return 's';
  if(view==='artist' && HB_ARTBACK && inRect(x,y,HB_ARTBACK)) return 'artistBack';
  if(view==='artist'&&HB_ARTQUEUE&&inRect(x,y,HB_ARTQUEUE))return 'artistQueueAll';
  if(view==='album' && HB_ALBBACK && inRect(x,y,HB_ALBBACK)) return 'albumBack';
  if((i=hitIdx(HB_CARD,x,y))>=0) return 'k'+i;
  if((i=hitIdx(HB_PL,x,y))>=0) return 'p'+HB_PL[i].i;
  if((i=hitIdx(HB_Q,x,y))>=0) return 'q'+i;
  if((i=hitIdx(HB_TR,x,y))>=0) return 'r'+i;
  return '';
}
function on_mouse_move(x,y){
  mx=x; my=y;
  if(lyDialog){clearPlaylistNameTooltip();repaintAll();return;}
  if(mainQueueDrag){updateMainQueueDrag(x,y);if(mainQueueDrag.moved)return;}
  if(drag==='scrollq'){setQueueScroll(y);return;}
  if(queueDrag){updateQueueDrag(x,y);return;}
  if(drag==='sidebar'){
    sidebarWidth=Math.max(64,Math.min(380,x-R.navX-M.gap/2));
    on_size(W,H);repaintAll();return;
  }
  updatePlaylistNameTooltip(x,y);
  try{window.SetCursor(sidebarResizeHit(x,y)?32644:32512);}catch(e){}
  rgTipTrack(x,y);
  if(drag==='search'){
    searchCursor=searchHitCursor(x);caretOn=true;repaintAll();return;
  }
  if(audioPopup){
    var sec=audioHitSection(x,y);
    if(sec) audioFocus(sec); // hover to reveal the child menu, same as desktop flyouts
  }
  if(ctxMenu && ctxMenu.kind==='song'){
    var mi=hit(CTX_HB,x,y);
    // Explorer-style hover opens the flyout; moving onto another parent action closes it.
    if(mi && mi.act==='destinations' && !ctxMenu.subOpen){ ctxMenu.subOpen=true; repaintAll(); }
    else if(mi && mi.menu==='root' && mi.act!=='destinations' && ctxMenu.subOpen){ ctxMenu.subOpen=false; repaintAll(); }
  }
  if(drag==='seek'){ dragFrac=seekFrac(x); repaintBar(); return; }
  if(drag==='vol'){ applyVol(x); return; }
  if(drag==='scroll'){ setScroll(y); return; }
  if(drag==='scrollh'){ setScrollH(x); return; }
  if(drag==='scrolln'){ setScrollN(y); return; }
  var sig=hoverSig(x,y), sk=scrollSection(x,y), z=hoverZone(x,y);
  if(sig!==hoverKey || sk!==scrollKey){   // sk change reveals/hides the section scrollbar
    hoverKey=sig; scrollKey=sk;
    // an overlay owns the whole screen and on_paint forces a full paint while one is open
    if(renameEdit||ctxMenu||confirmDel||dupPrompt||rgPrompt||sgMenuOpen||plSortMenuOpen||audioPopup) repaintAll();
    else { repaintZone(hoverZoneKey); if(z!==hoverZoneKey) repaintZone(z); }   // clear the old highlight, then draw the new
  }
  hoverZoneKey=z;
}
// which scrollable section the cursor is over (so entering/leaving reveals the hover scrollbar even over gaps)
function scrollSection(x,y){
  if(R.navLib && x>=R.navLib.x && x<R.navLib.x+R.navLib.w && y>=R.navLib.y && y<R.navLib.y+R.navLib.h) return 'nav';
  if(R.main && x>=R.main.x && x<R.main.x+R.main.w+16 && y>=R.main.y && y<R.main.y+R.main.h){
    if(view==='home') return 'home';
    if(view==='playlist') return 'pl';
    if(view==='songs') return 'songs';
    if(view==='search') return 'srch';
  }
  return '';
}
function on_mouse_leave(){
  if(queueDrag&&queueDrag.moved)repaintAll();
  if(mainQueueDrag)cancelMainQueueDrag();
  pointerDown=false;
  stopQueueEdgeScroll();
  clearPlaylistNameTooltip();
  var rgWasVisible=rgTipShown;
  rgTipClear();
  mx=-1; my=-1;
  if(rgWasVisible) repaintAll();
  if(hoverKey!==''||scrollKey!==''){
    hoverKey=''; scrollKey='';
    if(renameEdit||ctxMenu||confirmDel||dupPrompt||rgPrompt||sgMenuOpen||plSortMenuOpen||audioPopup) repaintAll();
    else repaintZone(hoverZoneKey);
  }
  hoverZoneKey='';
}
function on_char(code){
  if(lyDialog)return;
  // A Ctrl+N/Ctrl+A key can emit WM_CHAR after its WM_KEYDOWN on some hosts.
  // Never insert a stray character into either custom-drawn text editor.
  var ctrl=false,alt=false;
  try{ctrl=utils.IsKeyPressed(0x11);alt=utils.IsKeyPressed(0x12);}catch(e){}
  if(renameEdit){
    if(!ctrl&&!alt&&code>=32&&code!==127)renameReplace(String.fromCharCode(code));
    return;
  }
  if(!editInputActive() || ctxMenu||confirmDel||dupPrompt||rgPrompt||audioPopup) return;
  // Backspace / Delete and navigation are handled on_key_down exactly once.
  if(!ctrl&&!alt&&code>=32&&code!==127) searchReplace(String.fromCharCode(code));
}
/* ---- Windows-style keyboard navigation and playback actions -----------------
   Foobar and the panel are two separate Windows keyboard focus targets. These
   handlers work when the panel is focused; optional foobar main-menu command
   registration below supports app-wide bindings even when the panel is not. */
function keyboardSelectAllTracks(){
  var rows=orderedTrackRows();
  if(!rows.length) return false;
  syncTrackSelection();
  trackSel.keys=Object.create(null);trackSel.count=0;
  for(var i=0;i<rows.length;i++) markTrack(rows[i],true);
  trackSel.anchor=trackId(rows[0]);trackSel.cursor=trackId(rows[0]);repaintMain();return true;
}
function keyboardClearTrackSelection(){
  if(!trackSel.count)return false;
  clearTrackSelection();repaintMain();return true;
}
function keyboardSelectedFirst(){
  var entries=selectedTrackEntries();
  return entries.length?entries[0]:null;
}
function keyboardPlaySelected(){
  // Capture the whole selection BEFORE starting playback. Playing a library track
  // can rebuild foobar's temporary playback playlist and invalidate selection.
  // Play the first selected track in DISPLAY order, then enqueue the rest in
  // that same order (including deliberately selected duplicate entries).
  var entries=selectedTrackEntries();
  if(!entries.length)return false;
  playRow(entries[0].row);
  for(var i=1;i<entries.length;i++){
    try{plman.AddItemToPlaybackQueue(entries[i].handle);}catch(e){}
  }
  if(entries.length>1)repaintQueue();
  return true;
}
function keyboardQueueSelected(){
  var entries=selectedTrackEntries();
  if(!entries.length)return false;
  for(var i=0;i<entries.length;i++){
    try{plman.AddItemToPlaybackQueue(entries[i].handle);}catch(e){}
  }
  repaintQueue();return true;
}
/* Arrow-key navigation uses the CURRENT visible order, not the playlist's
   underlying item indices. Ctrl+Arrow adds one row without discarding the
   existing selection; Shift+Arrow builds a contiguous anchored range. */
function keyboardTrackNavigate(delta,shift,ctrl){
  if(view!=='songs'&&view!=='playlist'&&view!=='artist'&&view!=='album'&&view!=='search')return false;
  if(view==='search')computeSearch();
  syncTrackSelection();
  var rows=orderedTrackRows();
  if(!rows.length)return false;
  var cursor=trackSel.cursor, at=-1, i;
  if(cursor){for(i=0;i<rows.length;i++)if(trackId(rows[i])===cursor){at=i;break;}}
  // After Ctrl+A or an external change, find the most recent valid selected row.
  if(at<0 && trackSel.count){
    if(delta>0){for(i=rows.length-1;i>=0;i--)if(isTrackSelected(rows[i])){at=i;break;}}
    else {for(i=0;i<rows.length;i++)if(isTrackSelected(rows[i])){at=i;break;}}
  }
  var next=at<0?(delta>0?0:rows.length-1):Math.max(0,Math.min(rows.length-1,at+delta));
  var row=rows[next],id=trackId(row);
  if(shift){
    var anchor=trackSel.anchor,anchorIdx=-1;
    if(anchor)for(i=0;i<rows.length;i++)if(trackId(rows[i])===anchor){anchorIdx=i;break;}
    if(anchorIdx<0){
      anchorIdx=(at>=0?at:next);trackSel.anchor=trackId(rows[anchorIdx]);
    }
    // Standard shift selection can also SHRINK when direction is reversed.
    // Ctrl+Shift adds the new range while preserving other selected rows.
    if(!ctrl){trackSel.keys=Object.create(null);trackSel.count=0;}
    for(i=Math.min(anchorIdx,next);i<=Math.max(anchorIdx,next);i++)markTrack(rows[i],true);
  }else if(ctrl){
    markTrack(row,true); // additive, not a toggle, so traversing back is predictable
    trackSel.anchor=id;
  }else{
    trackSel.keys=Object.create(null);trackSel.count=0;markTrack(row,true);
    trackSel.anchor=id;
  }
  trackSel.cursor=id;
  keyboardRevealTrack(row,next);
  repaintMain();
  return true;
}
function keyboardRevealTrack(row,ordinal){
  if(!R.main)return;
  var r=R.main, top=0, bottom=0, pos=0, height=0, max=0, target=0;
  if(view==='playlist'){
    top=r.y+(r.w<950?156:M.headH)+8+(inlineFilterActive()?62:0)+34;
    bottom=r.y+r.h;
    pos=ordinal*M.rowH;height=M.rowH;max=PL_MAXPX;target=firstRowT;
    if(pos<target)firstRowT=clampPx(pos,max);
    else if(pos+height>target+bottom-top)firstRowT=clampPx(pos+height-(bottom-top),max);
    startScrollAnim();return;
  }
  if(view==='songs'){
    if(!songsRows)return;
    top=r.y+SHEAD+8+(inlineFilterActive()?62:0)+34;
    bottom=r.y+r.h;max=SONGS_MAXPX;target=songsScrollT;
    if(songsTrackY && songsTrackY[row.ti]!==undefined)pos=songsTrackY[row.ti];
    else {for(var j=0;j<songsRows.length;j++)if(songsRows[j].k==='t'&&songsRows[j].ti===row.ti){pos=songsRows[j].y;break;}}
    height=songsGroup==='none'?M.rowH:SG_TRH;
    if(pos<target)songsScrollT=clampPx(pos,max);
    else if(pos+height>target+bottom-top)songsScrollT=clampPx(pos+height-(bottom-top),max);
    startScrollAnim();return;
  }
  if(view==='search'){
    var pad=M.cpad, w=r.w-pad*2, gap=16, cardW=176;
    var cols=Math.max(2,Math.floor((w+gap)/(cardW+gap)));
    cardW=Math.floor((w-gap*(cols-1))/cols);
    var cardH=cardW+56, boxY=r.y+SBOX_TOP;
    top=boxY+SBOX_H+26;bottom=r.y+r.h;
    var artsH=searchArts.length?(42+Math.ceil(searchArts.length/cols)*(cardH+8)+18):0;
    var albumsH=searchAlbums.length?(42+searchAlbums.length*72+14):0;
    pos=artsH+albumsH+38+row.idx*56;height=56;max=SEARCH_MAXPX;target=searchScrollT;
    if(pos<target)searchScrollT=clampPx(pos,max);
    else if(pos+height>target+bottom-top)searchScrollT=clampPx(pos+height-(bottom-top),max);
    startScrollAnim();return;
  }
  if(view==='album'&&viewAlbum){
    top=r.y+226;bottom=r.y+r.h-10;
    var display=viewAlbum.display||albumDisplayRows(viewAlbum.tracks);
    for(var k=0;k<display.rows.length;k++){
      var dr=display.rows[k];if(dr.kind==='track'&&dr.idx===row.idx){pos=dr.y;height=dr.h;break;}
    }
    max=ALBUM_MAXPX;target=albumScroll;
    if(pos<target)albumScroll=clampPx(pos,max);
    else if(pos+height>target+bottom-top)albumScroll=clampPx(pos+height-(bottom-top),max);
    return;
  }
  if(view==='artist'&&row.block!==undefined){
    // Artist View normally moves by album blocks. For long albums, slide the
    // starting row inside that album too, so keyboard focus stays on-screen.
    if(row.block!==artScroll){artScroll=clampPx(row.block,ART_MAXBLOCK);artistRowStart=0;}
    var al=artistAlbums[row.block];if(!al)return;
    var drs=al.display?al.display.rows:albumDisplayRows(al.tracks).rows;
    var selectedRi=-1;
    for(var ai=0;ai<drs.length;ai++)if(drs[ai].kind==='track'&&drs[ai].idx===row.idx){selectedRi=ai;break;}
    if(selectedRi<0)return;
    if(selectedRi<artistRowStart)artistRowStart=selectedRi;
    var capacity=Math.max(40,r.h-332),used=0;
    for(ai=artistRowStart;ai<=selectedRi;ai++)used+=drs[ai].kind==='disc'?34:40;
    if(used>capacity){
      used=0;
      for(ai=selectedRi;ai>=0;ai--){
        var h=drs[ai].kind==='disc'?34:40;
        if(used+h>capacity)break;
        used+=h;
      }
      artistRowStart=Math.min(selectedRi,ai+1);
    }
  }
}
function keyboardGlobalSearch(){
  if(fsMode)return false;
  view='search';searchQ2=null;searchScroll=searchScrollT=0;
  resetEditSelection(searchQuery);applyKeyMode();repaintAll();return true;
}
/* A page history, separate from the artist/album breadcrumb back button.
   Observe on main paint so navigation by clicking, search and sidebar changes
   are all captured in one place. Store references only for already-loaded album
   and artist data; don't traverse the entire library on each paint. */
var navPages=[],navPos=-1,navLimit=48;
function navKey(){
  if(view==='playlist')return 'playlist:'+plman.ActivePlaylist;
  if(view==='artist')return 'artist:'+viewArtist;
  if(view==='album')return 'album:'+(viewAlbum?viewAlbum.key:'');
  return view;
}
function navSnapshot(){
  return {key:navKey(),view:view,pl:plman.ActivePlaylist,
    artist:viewArtist,artistData:artistAlbums,artistFrom:artistReturnView,
    album:viewAlbum,albumFrom:albumReturnView,query:searchQuery,
    homeMode:homeViewMode,homeX:plScroll,homeY:homeScroll,songsY:songsScrollT,searchY:searchScrollT,
    playlistY:firstRowT,artistY:artScroll,artistRowStart:artistRowStart,albumY:albumScroll};
}
function navObserveView(){
  var snap=navSnapshot();
  if(navPos>=0 && navPages[navPos].key===snap.key){
    navPages[navPos]=snap;return;
  }
  if(navPos<navPages.length-1)navPages=navPages.slice(0,navPos+1);
  navPages.push(snap);
  if(navPages.length>navLimit)navPages.shift();
  navPos=navPages.length-1;
}
function navRestore(s){
  view=s.view;
  if(s.view==='playlist' && s.pl>=0 && s.pl<plman.PlaylistCount){
    plman.ActivePlaylist=s.pl;
  }
  if(s.view==='artist'){
    viewArtist=s.artist;artistAlbums=s.artistData||[];artistReturnView=s.artistFrom;
  }
  if(s.view==='album'){
    viewAlbum=s.album;albumReturnView=s.albumFrom;
  }
  if(s.view==='search')searchQuery=s.query;
  // Other pages carry incidental Home offsets; they must not overwrite its
  // active mode's position when traversing history.
  if(s.view==='home'){
    setHomeViewMode(s.homeMode||'grid');
    homeScroll=homeScrollT=s.homeY;
    plScroll=plScrollT=s.homeX||0;
  }
  songsScroll=songsScrollT=s.songsY;
  searchScroll=searchScrollT=s.searchY;
  firstRow=firstRowT=s.playlistY;
  artScroll=s.artistY;artistRowStart=s.artistRowStart||0;albumScroll=s.albumY;
  clearTrackSelection();
  applyKeyMode();repaintAll();
}
function navTravel(delta){
  // A currently pending navigation may not yet have painted. Capture it first.
  navObserveView();
  var next=navPos+delta;
  if(next<0 || next>=navPages.length)return false;
  navPos=next;navRestore(navPages[navPos]);return true;
}
/* Search Escape should behave like navigating back, not erase the query.
   The history can be empty if Verdant opened directly into Search; in that case
   go Home. No automatic fallback when a previous view exists. */
function keyboardLeaveSearch(){
  if(view!=='search')return false;
  if(navTravel(-1))return true;
  view='home';
  homeScroll=homeScrollT=0;
  clearTrackSelection();
  applyKeyMode();repaintAll();return true;
}
function keyboardRefreshView(){
  // Clear cached library / playlist metadata and rebuild on demand without
  // modifying playlists, changing playback, or clearing the user's search text.
  var artist=view==='artist'?viewArtist:null;
  var albumKey=view==='album'&&viewAlbum?viewAlbum.key:null;
  invalidateItems();invalidateLibrary();
  if(artist!==null) loadArtist(artist);
  if(albumKey!==null){
    var albumList=getSearchAlbumIdx(),match=null;
    for(var i=0;i<albumList.length;i++)if(albumList[i].key===albumKey){match=albumList[i];break;}
    if(match)loadAlbum(match);
  }
  clearTrackSelection();rgTipClear();repaintAll();return true;
}
/* Keyboard page navigation is intentionally limited to the main scrollable view.
   Text editors get first refusal in on_key_down, retaining normal caret behavior. */
function keyboardPageScroll(vkey){
  var isTop=vkey===36,isBottom=vkey===35,back=vkey===33;
  var pageHeight=R.main?(view==='home'?homeContentRect(R.main).h:R.main.h):500;
  var jump=Math.max(80,Math.floor(pageHeight*0.78));
  var delta=back?-jump:jump;
  if(view==='home'){
    homeScrollT=clampPx(isTop?0:isBottom?HOME_MAXROW:homeScrollT+delta,HOME_MAXROW);
  }else if(view==='songs'){
    songsScrollT=clampPx(isTop?0:isBottom?SONGS_MAXPX:songsScrollT+delta,SONGS_MAXPX);
  }else if(view==='search'){
    searchScrollT=clampPx(isTop?0:isBottom?SEARCH_MAXPX:searchScrollT+delta,SEARCH_MAXPX);
  }else if(view==='playlist'){
    firstRowT=clampPx(isTop?0:isBottom?PL_MAXPX:firstRowT+delta,PL_MAXPX);
  }else if(view==='album'){
    albumScroll=clampPx(isTop?0:isBottom?ALBUM_MAXPX:albumScroll+delta,ALBUM_MAXPX);
    repaintMain();return true;
  }else if(view==='artist'){
    // Artist View currently scrolls one complete album block at a time.
    artScroll=clampPx(isTop?0:isBottom?ART_MAXBLOCK:artScroll+(back?-1:1),ART_MAXBLOCK);
    artistRowStart=0;
    repaintMain();return true;
  }else return false;
  startScrollAnim();return true;
}
/* Reuse the sidebar's playlist creation path so mouse and keyboard match. */
function keyboardCreatePlaylist(){
  if(fsMode || renameEdit || confirmDel || dupPrompt || rgPrompt || ctxMenu || audioPopup)return false;
  var np=createNewPlaylist();
  if(np<0)return false;
  plman.ActivePlaylist=np;
  revealPlaylist(np);
  firstRow=firstRowT=0;
  view='playlist';
  clearTrackSelection();
  repaintAll();
  return true;
}
function keyboardRenamePlaylist(){
  if(view!=='playlist')return false;
  var pl=plman.ActivePlaylist;
  if(pl<0 || pl>=plman.PlaylistCount)return false;
  startRename(pl);return true;
}
function keyboardRemoveSelected(fromDisk){
  var entries=selectedTrackEntries();
  if(fromDisk || view!=='playlist'){
    if(!entries.length)return false;
    var handles=[];
    for(var i=0;i<entries.length;i++){
      handles.push(entries[i].handle);
    }
    if(!handles.length)return false;
    return promptDeleteFiles(handles);
  }
  if(plman.ActivePlaylist<0)return false;
  var pl=plman.ActivePlaylist;
  if(!entries.length){
    confirmDel={pl:pl,name:plman.GetPlaylistName(pl)};
    repaintAll();return true;
  }
  if(!canEditPl(pl)) return true;
  removeSelectedTracksFromPl(pl,entries);return true;
}
/* Shared action dispatcher for focused-panel keys and optional foobar menu keys.
   Keeps editing shortcuts native to the GDI text box; only explicitly invoked
   global actions such as Ctrl+L can move away from an active editor. */
function keyboardAction(action){
  if(renameEdit||ctxMenu||confirmDel||dupPrompt||rgPrompt||audioPopup||fsMode)return false;
  if(action==='newPlaylist')return keyboardCreatePlaylist();
  if(action==='renamePlaylist')return keyboardRenamePlaylist();
  if(action==='globalSearch')return keyboardGlobalSearch();
  if(action==='find'){startContextFind();return true;}
  if(action==='back')return navTravel(-1);
  if(action==='leaveSearch')return view==='search'?keyboardLeaveSearch():navTravel(-1);
  if(action==='forward')return navTravel(1);
  if(action==='refresh')return keyboardRefreshView();
  if(editInputActive() && !(trackSel.count && (action==='playSelection'||action==='queueSelection'||(action==='copyTracks'&&!searchHasSelection()))))return false;
  if(action==='selectAll')return keyboardSelectAllTracks();
  if(action==='deselect')return keyboardClearTrackSelection();
  if(action==='playSelection')return keyboardPlaySelected();
  if(action==='queueSelection')return keyboardQueueSelected();
  if(action==='delete')return keyboardRemoveSelected();
  if(action==='deleteFiles')return keyboardRemoveSelected(true);
  if(action==='copyTracks')return playlistClipboardCopy(false);
  if(action==='cutTracks')return playlistClipboardCopy(true);
  if(action==='pasteTracks')return playlistClipboardPaste();
  if(action==='pageUp')return keyboardPageScroll(33);
  if(action==='pageDown')return keyboardPageScroll(34);
  if(action==='home')return keyboardPageScroll(36);
  if(action==='end')return keyboardPageScroll(35);
  return false;
}
function on_key_down(vkey){
  if(vkey===27&&mainQueueDrag){cancelMainQueueDrag();return;}
  if(vkey===27&&queueDrag){stopQueueEdgeScroll();queueDrag=null;if(drag==='queue')drag=null;repaintAll();return;}
  var ctrl=false,shift=false,alt=false;
  try{ctrl=utils.IsKeyPressed(0x11);shift=utils.IsKeyPressed(0x10);alt=utils.IsKeyPressed(0x12);}catch(e){}
  if(ctrl && !alt && !shift && vkey===116){
    try{window.Reload();}catch(e){fb.ShowPopupMessage('Could not reload JSplitter: '+String(e),'Verdant');}
    return;
  }
  // Ctrl+R is reserved for the user's foobar2000 rescan shortcut.
  if(ctrl && !alt && !shift && vkey===82)return;
  if(lyDialog){
    if(vkey===27)closeLyricDialog();
    else if(vkey===13&&!ctrl&&!alt)applyLyricDialog();
    else if(vkey===38||vkey===40)selectLyricResult(lyDialog.selected+(vkey===38?-1:1));
    return;
  }
  if(audioPopup){ if(vkey===27)audioClose();return; }
  if(renameEdit){renameKeyDown(vkey,ctrl,shift,alt);return;}
  if(confirmDel){
    if(vkey===27){confirmDel=null;repaintAll();}
    else if(vkey===13 && !ctrl && !alt && !shift)commitDeletePrompt();
    return;
  }
  if(ctxMenu){if(vkey===27)dismissTransientMenus();return;}
  if(dupPrompt || rgPrompt || fsMode)return;
  if(queueKeyboardFocus&&queueVisible()&&rightTab==='queue'){
    if(vkey===46){if(!ctrl&&!alt&&queueSelection)removeQueueOccurrence(queueSelection.index,queueSelection.handle);return;}
    if(ctrl&&!alt&&!shift&&vkey===86){pasteQueueTracks();return;}
  }
  if(ctrl && !alt && !shift && vkey===78){keyboardAction('newPlaylist');return;} // Ctrl+N
  if(!ctrl && !alt && !shift && vkey===113){keyboardAction('renamePlaylist');return;} // F2
  if(!alt && ctrl && vkey===70){keyboardAction('find');return;}
  if(!alt && ctrl && vkey===76){keyboardAction('globalSearch');return;}
  if(alt && !ctrl && !shift && (vkey===37||vkey===39)){
    keyboardAction(vkey===37?'back':'forward');return;
  }
  if(!ctrl && !alt && vkey===116){keyboardAction('refresh');return;} // F5
  if(!alt && (vkey===38||vkey===40)){
    // These are single-line search editors, so vertical arrows do not move
    // their caret. Give them to results/list navigation instead.
    if(keyboardTrackNavigate(vkey===38?-1:1,shift,ctrl))return;
  }
  if(!ctrl && !alt && vkey===27){
    if(inlineFilterActive()){closeContextFind();return;}
    if(view==='search'){keyboardLeaveSearch();return;}
    if(trackSel.count){keyboardClearTrackSelection();return;}
    return;
  }
  // The Search and Ctrl+F editors are single-line controls. After selecting
  // results with Up/Down, Enter should play them (Shift+Enter only queues).
  if(!alt && !ctrl && vkey===13 && trackSel.count){
    if(keyboardAction(shift?'queueSelection':'playSelection'))return;
  }
  // Search is always considered an editor, even after a result was selected.
  // Selected tracks take priority for Delete; otherwise keep normal text editing.
  if(!alt && !ctrl && vkey===46 && trackSel.count){keyboardRemoveSelected(shift);return;}
  if(ctrl && !alt && !shift && vkey===67 && trackSel.count
     && (!editInputActive() || !searchHasSelection())){
    keyboardAction('copyTracks');return;
  }
  if(!editInputActive()){
    if(alt)return;
    if(ctrl){
      if(vkey===65){keyboardAction(shift?'deselect':'selectAll');return;}
      if(!shift && vkey===67){keyboardAction('copyTracks');return;}
      if(!shift && vkey===88){keyboardAction('cutTracks');return;}
      if(!shift && vkey===86){keyboardAction('pasteTracks');return;}
      return;
    }
    if(vkey===13){keyboardAction(shift?'queueSelection':'playSelection');return;}
    if(vkey===33||vkey===34||vkey===36||vkey===35){keyboardPageScroll(vkey);return;}
    if(vkey===46){keyboardRemoveSelected(shift);return;}
    return;
  }
  if(alt)return;
  // In active text inputs, page keys are not track-list commands.
  if(vkey===33 || vkey===34)return;
  if(ctrl){
    if(vkey===65){searchAnchor=0;searchCursor=editText().length;caretOn=true;repaintAll();return;}
    if(vkey===67){searchClipboardCopy();return;}
    if(vkey===88){searchClipboardCopy();if(searchHasSelection())searchReplace('');return;}
    if(vkey===86){searchClipboardPaste();return;}
  }
  if(vkey===37 || vkey===39){
    var to;
    if(!shift&&!ctrl&&searchHasSelection())to=vkey===37?searchSelection()[0]:searchSelection()[1];
    else if(ctrl)to=vkey===37?searchWordLeft(searchCursor):searchWordRight(searchCursor);
    else to=searchCursor+(vkey===37?-1:1);
    searchMove(to,shift);return;
  }
  if(vkey===36){searchMove(0,shift);return;}
  if(vkey===35){searchMove(editText().length,shift);return;}
  if(vkey===8){searchDeleteBack(ctrl);return;}
  if(vkey===46){searchDeleteForward(ctrl);return;}
}
/* Optional application-wide foobar shortcuts. JSplitter v3 exposes Spider
   Monkey-compatible dynamic menu commands on builds that support them.
   Registration does NOT assign hotkeys: users can bind only the commands they
   want via File > Preferences > Keyboard Shortcuts. In older hosts the panel
   shortcuts continue to work without these menu commands. */
var verdantShortcuts=[
  [4701,'Scroll page up','pageUp'],[4702,'Scroll page down','pageDown'],
  [4703,'Scroll to top','home'],[4704,'Scroll to bottom','end'],
  [4705,'Delete selection','delete'],[4706,'Find in current view','find'],
  [4707,'Select visible tracks','selectAll'],[4708,'Clear track selection','deselect'],
  [4709,'Play and queue selected tracks','playSelection'],[4710,'Queue selected tracks','queueSelection'],
  [4711,'Go back','back'],[4712,'Go forward','forward'],
  [4713,'Focus global search','globalSearch'],[4714,'Refresh Verdant view','refresh'],
  [4715,'Leave Search / Back','leaveSearch'],
  [4716,'New playlist','newPlaylist'],[4717,'Rename active playlist','renamePlaylist']
];
var verdantRegistered=[];
function registerVerdantShortcuts(){
  if(typeof fb.RegisterMainMenuCommand!=='function')return;
  for(var i=0;i<verdantShortcuts.length;i++){
    var v=verdantShortcuts[i];
    try{fb.RegisterMainMenuCommand(v[0],'Verdant: '+v[1]);verdantRegistered.push(v[0]);}catch(e){}
  }
}
function on_main_menu_dynamic(commandId){
  for(var i=0;i<verdantShortcuts.length;i++){
    if(verdantShortcuts[i][0]===commandId){keyboardAction(verdantShortcuts[i][2]);return;}
  }
}
function on_mouse_wheel(step){
  if(lyDialog){lyricDialogWheel(step);return;}
  if(confirmDel||renameEdit||dupPrompt||rgPrompt)return;
  if(audioPopup){audioListWheel(step);return;}
  if(ctxMenu){
    if(ctxMenu.kind==='song' && ctxMenu.subOpen && ctxMenu.subRect && inRect(mx,my,ctxMenu.subRect)){
      var maxFirst=Math.max(0,ctxMenu.destinations.length-ctxMenu.subPage);
      ctxMenu.subFirst=clampPx(ctxMenu.subFirst-(step>0?1:-1)*Math.max(1,Math.abs(step)*2),maxFirst);
      repaintAll();
    }
    return;
  }
  if(fsMode){
    // lyrics with no timestamps don't roll themselves, so here the wheel scrolls them; with nothing
    // to scroll (synced, short enough to fit, or another view) it stays the volume control
    if(fsView==='lyrics' && lyStWheel(step)){ repaintAll(); return; }
    fb.Volume=pos2vol(clamp01(vol2pos(fb.Volume)+step*0.04)); repaintAll(); return;
  }
  // right pane: same deal on the Lyrics tab. Consume the wheel either way -- it belongs to this
  // panel, and falling through would scroll the playlist behind the pointer.
  if(R.queue && R.queue.w>0 && mx>=R.queue.x && mx<R.queue.x+R.queue.w && my>=R.queue.y && my<R.queue.y+R.queue.h){
    if(rightTab==='lyrics' && lyStWheel(step)) repaintQueue();
    else if(rightTab==='queue'){
      queueScroll=clampPx(queueScroll-step*WHEEL_PX,QUEUE_MAXPX);repaintQueue();
    }
    return;
  }
  if(R.navLib && mx>=R.navLib.x && mx<R.navLib.x+R.navLib.w && my>=R.navLib.y && my<R.navLib.y+R.navLib.h){
    navScrollT=clampPx(navScrollT-step*WHEEL_PX,NAV_MAX); startScrollAnim(); return;
  }
  if(mx<R.main.x || mx>=R.main.x+R.main.w) return;
  if(view==='home'){
    homeScrollT=clampPx(homeScrollT-step*Math.round(WHEEL_PX*1.7),HOME_MAXROW); startScrollAnim();
    return;
  }
  else if(view==='songs'){ songsScrollT=clampPx(songsScrollT-step*WHEEL_PX,SONGS_MAXPX); startScrollAnim(); return; }
  else if(view==='search'){ searchScrollT=clampPx(searchScrollT-step*WHEEL_PX,SEARCH_MAXPX); startScrollAnim(); return; }
  else if(view==='artist'){ artScroll=clampPx(artScroll-step,ART_MAXBLOCK); repaintAll(); return; }
  else if(view==='album'){ albumScroll=clampPx(albumScroll-step*WHEEL_PX,ALBUM_MAXPX); repaintAll(); return; }
  firstRowT=clampPx(firstRowT-step*WHEEL_PX,PL_MAXPX); startScrollAnim();
}
/* ---- drag & drop external files: two targets, the library section (-> new playlist) and the
   playlist view body (-> appends to it); everywhere else denies. We never see the dropped paths
   (DropTargetAction is write-only), so we name a destination and the component does the insert. */
function overLib(x,y){ return !!R.navLib && x>=R.navLib.x && x<R.navLib.x+R.navLib.w && y>=R.navLib.y && y<R.navLib.y+R.navLib.h; }
// body of the playlist view -> index of the playlist to append to, or -1 if that's not a valid target
function plDropTarget(x,y){
  if(fsMode || view!=='playlist' || !R.main) return -1;
  if(x<R.main.x || x>=R.main.x+R.main.w || y<R.main.y || y>=R.main.y+R.main.h) return -1;
  var i=plman.ActivePlaylist;
  if(i<0 || plman.IsPlaylistLocked(i)) return -1;   // autoplaylists etc. can't take manual inserts
  return i;
}
function dragUpdate(action,x,y){
  if(lyDialog){action.Effect=0;setDropHover(false,false);return;}
  var ext=!action.IsInternal;                        // ignore drags started inside the skin
  var onLib=ext && overLib(x,y), onPl=!onLib && ext && plDropTarget(x,y)>=0;
  if(onLib||onPl) action.Effect=(action.Effect&1)?1:((action.Effect&4)?4:0);  // prefer copy, else link
  else action.Effect=0;                                                        // deny elsewhere
  setDropHover(onLib,onPl);
}
// repaint only the section whose cue changed -- drag-over fires on every mouse move
function setDropHover(onLib,onPl){
  if(onLib!==navDropHover){ navDropHover=onLib; repaintNav(); }
  if(onPl!==plDropHover){ plDropHover=onPl; repaintMain(); }
}
function on_drag_enter(action,x,y,mask){ dragUpdate(action,x,y); }
function on_drag_over(action,x,y,mask){ dragUpdate(action,x,y); }
function on_drag_leave(){ setDropHover(false,false); }
function on_drag_drop(action,x,y,mask){
  if(lyDialog){action.Effect=0;return;}
  var ext=!action.IsInternal, hit=ext&&(action.Effect&5), pi=hit?plDropTarget(x,y):-1;   // 5 = copy|link
  if(hit && overLib(x,y)){
    var np=createNewPlaylist();
    action.Playlist=np; action.Base=0; action.ToSelect=true;            // component drops the files into it
    action.Effect=(action.Effect&1)?1:4;
    plman.ActivePlaylist=np; revealPlaylist(np); firstRow=firstRowT=0; view='playlist';
  } else if(pi>=0){
    plman.UndoBackup(pi);                                              // so ctrl+Z undoes the import
    armDupWatch(pi);                                                   // snapshot before the component inserts
    action.Playlist=pi; action.Base=plman.PlaylistItemCount(pi); action.ToSelect=true;   // append at end
    action.Effect=(action.Effect&1)?1:4;
  } else action.Effect=0;
  navDropHover=false; plDropHover=false; repaintAll();
}
function on_script_unload(){
  if(mainQueueDrag)cancelMainQueueDrag();
  if(retainedOrderTimer!==null){window.ClearTimeout(retainedOrderTimer);retainedOrderTimer=null;}
  persistQueueState();
  stopLyricRequest();
  stopPlayOrderSync();
  stopQueueEdgeScroll();
  clearPlaylistNameTooltip();
  if(fileOperationTimer!==null)window.ClearTimeout(fileOperationTimer);
  if(typeof fb.UnregisterMainMenuCommand==='function')for(var i=0;i<verdantRegistered.length;i++)try{fb.UnregisterMainMenuCommand(verdantRegistered[i]);}catch(e){}
  rgTipClear();
  audioPopup=null;stopLyAnim(); stopCaret(); stopViz(); stopScrollAnim(); stopShimAnim(); stopMemWatch();
  if(dupWatch && dupWatch.timer) window.ClearTimeout(dupWatch.timer);
}
function invalidateLibrary(){
  artistList=null; artistTracksMap=null; artistCandCache={}; coverPickCache={}; warmed={}; searchIdx=null; searchAlbumIdx=null; searchQ2=null;
  plFilteredCache=null; songsIdx=null; songsRows=null; songsTracks=null; libCovCache=null; libCount_=-1;
  libItems_=null; libTFCache={};   // everything above is derived from these
  rgStat=null; rgScanFailed=false;
  warmJob=null; jobs={};           // anything in flight refers to the old library
  gates={}; rowGate={}; shelfHandles=null; artsGating=false;   // every section re-gates
}
function libChanged(){
  var artist=view==='artist'?viewArtist:null;
  var albumKey=view==='album'&&viewAlbum?viewAlbum.key:null;
  clearTrackSelection(); invalidateLibrary(); artCardCache={}; artCardN=0;
  if(artist!==null)loadArtist(artist);
  if(albumKey!==null){
    var albums=getSearchAlbumIdx(),match=null;
    for(var i=0;i<albums.length;i++)if(albums[i].key===albumKey){match=albums[i];break;}
    if(match)loadAlbum(match);
    else{viewAlbum=null;view='songs';}
  }
  repaintAll();
}
function on_library_items_added(){ libChanged(); }
function on_library_items_removed(){ libChanged(); }
function on_library_items_changed(){ libChanged(); }

/* ------------------------- playback callbacks ------------------------- */
function on_playback_new_track(){
  playOrderPreview=null;queueRevealPending=true;
  if(stoppedPlayback)clearStoppedPlayback();
  restoreUpNextStop();
  updateNP();
  if(shuffleHandoff){
    var nextLoc=playingLoc();
    if(nextLoc&&nextLoc.IsValid&&nextLoc.PlaylistIndex===shuffleHandoff.pl&&nextLoc.PlaylistItemIndex===shuffleHandoff.item){shuffleHandoff=null;persistQueueState();}
  }
  // Repeat traverses the same finite order; wrapping does not reshuffle it.
  if(pbShuffle){
    var loc=playingLoc();
    var sp=playlistOfName(SHUF), idx=(loc&&loc.IsValid&&loc.PlaylistIndex===sp)?loc.PlaylistItemIndex:-1;
    if(sp>=0 && idx>=0){
      var cnt=plman.PlaylistItemCount(sp);
      lastShufIdx=idx;
    } else lastShufIdx=-1;
  } else lastShufIdx=-1;
  persistQueueState();repaintAll();
}
function npChanged(){ updateNP(); repaintAll(); }
function on_playback_dynamic_info_track(){ npChanged(); }
function on_playback_stop(reason){
  if(reason!==2){
    stopPlayOrderSync();
    try{var state=JSON.parse(propStr('Playback: Up next state','{}'));restoreRetainedPlayOrder(state.resume);}catch(e){}
    upNextMutation++;
    try{playOrderPreview=null;clearShuffleHandoff();if(stoppedTrack())plman.FlushPlaybackQueue();restoreUpNextStop();}
    finally{upNextMutation--;}
    persistQueueState();
  }
  npChanged();
}
function on_playback_pause(){ npChanged(); }
function on_playback_time(){
  repaintBar();
  var lyricsShown=(rightTab==='lyrics')||(fsMode&&fsView==='lyrics');
  if(lyricsShown && lyrics && lyrics!=='none' && lyrics.synced){ var c=currentLyricLine(); if(c!==lyCur){ lyCur=c; startLyAnim(); } }
}
function on_playback_seek(){ repaintAll(); }
function on_playback_order_changed(){syncOrderFromFb();queueViewportCache=null;repaintAll();}
function on_playback_queue_changed(){normalizeQueueHandoff();schedulePlayOrderSync();queueViewportCache=null;queueSelection=null;if(!upNextMutation)persistQueueState();repaintAll();}
function on_volume_change(){ repaintBar(); }
function on_output_device_changed(){audioChanged('output');}
function on_dsp_preset_changed(){audioChanged('dsp');}
// ReplayGain can also be switched from foobar's own Playback menu -- keep the pill honest
function on_replaygain_mode_changed(){ repaintMain(); }
// rgStat included: a ReplayGain scan lands as a tag write, so this is how the pill learns it finished
function on_metadb_changed(handles,fromhook){ if(fromhook) return; clearTrackSelection(); invalidateItems(); invalidateLibrary(); albKeyCache={}; hueCache={}; artistCandCache={}; coverPickCache={}; lyricsFor=null; rgStat=null; updateNP(); repaintAll(); }
/* A switch changes which playlist is ACTIVE, not what any playlist contains -- and every cache
   invalidateItems() drops is keyed by playlist index, so none of them went stale here. Dropping
   them meant each switch re-derived covers and re-ran the art gates against an artCache that had
   since evicted those albums: the view fell back to its skeleton and the artwork reloaded. The
   caches that genuinely depend on playlist CONTENT are still cleared by the callbacks that mean
   content changed (items added/removed/reordered, playlists changed). */
function on_playlist_switch(){ firstRow=firstRowT=0; repaintAll(); }
function on_playlists_changed(){ invalidateItems(); repaintAll(); }
function on_playlist_items_added(pl){ if(view==='playlist' && pl===plman.ActivePlaylist) clearTrackSelection(); invalidateItems(); if(dupWatch && dupWatch.pl===pl) scheduleDupScan(); repaintAll(); }
function on_playlist_items_removed(){ if(view==='playlist') clearTrackSelection(); invalidateItems(); repaintAll(); }
function on_playlist_items_reordered(){ if(view==='playlist') clearTrackSelection(); invalidateItems(); repaintAll(); }
function on_item_focus_change(){ repaintAll(); }

layout();
registerVerdantShortcuts();
restoreQueueState();
updateNP();
syncOrderFromFb(); applyPlaybackOrder();   // normalize native order (we manage shuffle ourselves)
persistQueueState();   // also snapshot playback already active when this panel loads
capVolume();       // pull a remembered volume back under the slider's ceiling
startMemWatch();   // caches grow into the component's spare memory and back off as it fills
