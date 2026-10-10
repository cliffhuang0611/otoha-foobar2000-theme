/* verdant/data/library.js -- library + playlist data: handles, title-format passes, indices, sort order
   Part of Verdant, a Spotify-style theme for foobar2000. Loaded by main.js;
   every module shares one global scope, so load order is set there. */

/* Playlist name/count are read once per playlist instead of once per card per frame -- these
   are interop calls into foobar, and the draw loops ran dozens of them every paint. Cleared by
   invalidateItems(), which every callback that can change a playlist's name or contents goes
   through -- switching between playlists is not one of them and deliberately keeps the caches. */
var plNameCache={}, plCountCache={};
function plName(pi){ if(!plNameCache.hasOwnProperty(pi)) plNameCache[pi]=plman.GetPlaylistName(pi); return plNameCache[pi]; }
function plCount(pi){ if(!plCountCache.hasOwnProperty(pi)) plCountCache[pi]=plman.PlaylistItemCount(pi); return plCountCache[pi]; }
// memoised per paint: drawNav and drawHome both call this, so it ran twice on every frame
var visPlCache=null;
function visiblePlaylists(){
  if(visPlCache) return visPlCache;
  var a=[]; for(var i=0;i<plman.PlaylistCount;i++) if(!isHiddenPl(plName(i))) a.push(i);
  visPlCache=a; return a;
}

/* The library handle list was fetched separately by getArtistList, getSongsIdx, getSearchIdx,
   loadArtist, libCovers and libCount, and the same title-formatting fields were evaluated across
   the whole library by two or three of them independently. Both are now fetched once and shared;
   invalidateLibrary() clears them alongside everything else derived from the library. */
var libItems_=null, libTFCache={};
function libItems(){
  if(libItems_===null){ try{ libItems_=fb.GetLibraryItems(); }catch(e){ libItems_=null; } }
  return libItems_;
}
function libTF(field){
  if(libTFCache.hasOwnProperty(field)) return libTFCache[field];
  var lib=libItems(), out=[];
  if(lib && lib.Count){ try{ out=TF[field].EvalWithMetadbs(lib); }catch(e){ out=[]; } }
  libTFCache[field]=out; return out;
}

/* ------------------------- library-backed artist list ------------------------- */
var artistList=null, artistTracksMap=null, artistCandCache={};
function getArtistList(){
  if(artistList) return artistList;
  var lib=libItems();
  var out=[]; artistTracksMap={};
  if(lib && lib.Count){
    var names=libTF('artistName'), seen={};
    for(var i=0;i<names.length;i++){
      var nm=names[i]; if(!nm) continue;
      if(!artistTracksMap[nm]) artistTracksMap[nm]=[];
      artistTracksMap[nm].push(lib[i]);
      if(!seen[nm]){ seen[nm]=1; out.push({name:nm, handle:lib[i]}); }
    }
    out.sort(function(a,b){ var an=a.name.toLowerCase(), bn=b.name.toLowerCase(); return an<bn?-1:(an>bn?1:0); });
  }
  artistList=out; return out;
}
/* artist avatar = the first of the artist's albums that actually HAS art, not simply their first
   track -- one untagged opener used to leave the whole artist on a placeholder. The candidates are
   one track per album (scan capped like plCovers, since a prolific artist's list can be long);
   coverPick settles on the first with art as they resolve, and the fallback stands in meanwhile. */
var ARTIST_CAND_SCAN=24;                 // albKey() is an interop call: bound the scan, cache the result
function artistCands(name,fallback){
  if(artistCandCache.hasOwnProperty(name)) return artistCandCache[name];
  var list=artistTracksMap?artistTracksMap[name]:null, out=[], seen={}, i, h, k;
  if(!list) return fallback?[fallback]:[];   // map not built yet -> guess, but don't cache the guess
  var cap=Math.min(list.length,ARTIST_CAND_SCAN);
  for(i=0;i<cap && out.length<COVER_CANDS;i++){
    h=list[i]; if(!h) continue; k=albKey(h); if(seen[k]) continue;
    seen[k]=1; out.push(h);
  }
  if(!out.length && fallback) out.push(fallback);
  artistCandCache[name]=out; return out;
}
// the bulk warm pass's cheap guess -- no candidate scan, no album dedupe
function artistFirst(name,fallback){ var l=artistTracksMap?artistTracksMap[name]:null; return (l&&l.length)?l[0]:fallback; }
function artistCover(name,fallback){
  var c=artistCands(name,fallback), p=coverPick('ar|'+name,c,1);
  if(p.list.length) return p.list[0];
  return c.length?c[0]:(fallback||null);          // still choosing -> the old first-track guess
}
// false while the scan can still move the choice: baking a card now would freeze its placeholder
function artistCoverReady(name,fallback){ return coverPick('ar|'+name,artistCands(name,fallback),1).done; }
function loadArtist(name){
  viewArtist=name; artScroll=0; artistRowStart=0; artistAlbums=[];
  var lib=libItems();
  if(!lib || !lib.Count) return;
  var arts=libTF('artistName'), albs=libTF('album'),
      titles=libTF('title'), lens=libTF('len'), yrs=libTF('year'), nums=libTF('trackno'), discs=libTF('discno');
  var map={}, order=[];
  for(var i=0;i<arts.length;i++){
    if(arts[i]!==name) continue;
    var al=albs[i]||'Unknown Album';
    if(!map[al]){ map[al]={album:al, handle:lib[i], year:yrs[i], tracks:[]}; order.push(al); }
    map[al].tracks.push({title:titles[i], dur:lens[i], handle:lib[i], trackNo:parseTagNumber(nums[i]), discNo:parseTagNumber(discs[i]), ordinal:i});
  }
  for(var j=0;j<order.length;j++){
    var album=map[order[j]];
    album.tracks.sort(albumTrackCompare);
    album.display=albumDisplayRows(album.tracks);
    artistAlbums.push(album);
  }
}

/* ---- "All Songs" library view: one index of every library track (built once, invalidated by
   the library callbacks), expanded into a flat ROW list of headers + tracks in display order,
   each carrying its own height + precomputed y. Grouping only re-sorts the index, never re-reads
   the library. Rows: {k:'g1'|'g2'|'t'}; headers also carry kind:'artist'|'album'. */
var songsIdx=null, songsRows=null, songsTracks=null, songsContentH=0, songsTotalSec=0;
var songsGroup='none', songsScroll=0, songsScrollT=0, SONGS_MAXPX=0;
var sgMenuOpen=false, SG_HB=[], HB_SG=null, HB_ALLSONGS=null, HB_RGNORM=null;
var SONGS_GROUPS=[['No grouping','none'],['By artist','artist'],['By album','album'],['By artist & album','both']];
/* ---- group-list metrics: one indent step per nesting level (SG_IND) and one shared vertical
   rhythm per header -- GAP above (the divider sits at its top), artwork, PADB below. Header
   heights are DERIVED from those parts so every tier lands on the same grid. SG_H1B is the
   artist banner (same block in a slab). SG_CROP is the over-paint band hiding the top partial
   row (no clip API); it must exceed the tallest thing a row paints above its own top edge. */
var SG_IND=32, SG_GAP1=24, SG_GAP2=14, SG_PADB1=12, SG_PADB2=10;
var SG_ART1=56, SG_ART2=44, SG_TGAP=18, SG_SLABP=10;
var SG_H1=SG_GAP1+SG_ART1+SG_PADB1;                  // 92  top-level header
var SG_H1B=SG_GAP1+SG_SLABP*2+SG_ART1+SG_PADB1;      // 112 artist banner (slab around artwork)
var SG_H2=SG_GAP2+SG_ART2+SG_PADB2;                  // 68  nested header
var SG_TRH=44, SHEAD=312, SG_CROP=96;
function getSongsIdx(){
  if(songsIdx) return songsIdx;
  var lib=libItems();
  var out=[]; songsTotalSec=0;
  if(lib && lib.Count){
    var ti=libTF('title'), ar=libTF('artist'), aa=libTF('artistName'),
        al=libTF('album'), ln=libTF('len'), ls=libTF('lensec'),
        ak=libTF('albkey'), tn=libTF('trackno'), dn=libTF('discno'), yr=libTF('year');
    for(var i=0;i<ti.length;i++){
      songsTotalSec+=parseInt(ls[i],10)||0;
      var eT=ti[i]||'', eR=ar[i]||'', eA=aa[i]||'Unknown Artist', eL=al[i]||'Unknown Album';
      // sort keys are lowercased once here instead of on every comparison inside cmpStr; a sort
      // does n*log(n) comparisons, so doing it per-comparison scales as badly as the sort itself
      out.push({h:lib[i], title:eT, artist:eR, aartist:eA,
                album:eL, len:ln[i], artkey:ak[i], year:yr[i]||'', tn:parseTagNumber(tn[i]),dn:parseTagNumber(dn[i]),
                kT:eT.toLowerCase(), kR:eR.toLowerCase(), kA:eA.toLowerCase(), kL:eL.toLowerCase()});
    }
  }
  songsIdx=out; return out;
}
/* Build steps for the All Songs view. The nine title-formatting passes are the bulk of the work
   and each is atomic, so they run one per tick rather than back to back; libTF memoises them, so
   getSongsIdx then finds everything cached and only has to assemble. */
var SONGS_FIELDS=['title','artist','artistName','album','len','lensec','albkey','trackno','discno','year'];
function songsSteps(){
  var steps=[], i;
  for(i=0;i<SONGS_FIELDS.length;i++) steps.push((function(f){ return function(){ libTF(f); }; })(SONGS_FIELDS[i]));
  steps.push(function(){ getSongsIdx(); });      // assembly only -- every field is cached by now
  steps.push(function(){ buildSongsRows(); });   // sort (atomic) + row layout
  steps.push(function(){ if(!rgStat) rgCompute(); });   // ReplayGain status for the Normalize pill
  return steps;
}
function songsReady(){ return !!songsRows; }
function cmpStr(a,b){ a=String(a).toLowerCase(); b=String(b).toLowerCase(); return a<b?-1:(a>b?1:0); }
function cmpK(a,b){ return a<b?-1:(a>b?1:0); }   // operands already lowercased once at index time
function cmpTrk(a,b){
  var ad=a.dn||2147483647,bd=b.dn||2147483647,at=a.tn||2147483647,bt=b.tn||2147483647;
  return (ad-bd)||(at-bt)||cmpStr(a.title,b.title);
}   // within an album: DISCNUMBER, TRACKNUMBER, then title
function buildSongsRows(){
  var idx=getSongsIdx().slice(0), g=songsGroup, rows=[], tracks=[], i;
  if(inlineFilterActive() && filterQuery.trim()) idx=idx.filter(function(t){return fuzzyTrackMatch(filterQuery,[t.title,t.artist,t.aartist,t.album]);});
  // compares the lowercase keys precomputed in getSongsIdx -- identical ordering to cmpStr, but
  // without re-lowercasing both operands on every one of the n*log(n) comparisons
  if(g==='artist')     idx.sort(function(a,b){ return cmpK(a.kA,b.kA)||cmpK(a.kL,b.kL)||cmpTrk(a,b); });
  else if(g==='album') idx.sort(function(a,b){ return cmpK(a.kL,b.kL)||cmpK(a.kA,b.kA)||cmpTrk(a,b); });
  else if(g==='both')  idx.sort(function(a,b){ return cmpK(a.kA,b.kA)||cmpK(a.kL,b.kL)||cmpTrk(a,b); });
  else                 idx.sort(function(a,b){ return cmpK(a.kT,b.kT)||cmpK(a.kR,b.kR); });
  var curA=null, curAl=null, ref1=null, ref2=null, n=0, trH=(g==='none')?M.rowH:SG_TRH;
  var h1=(g==='both')?SG_H1B:SG_H1;
  for(i=0;i<idx.length;i++){
    var t=idx[i];
    if(g==='artist'){
      if(t.aartist!==curA){ curA=t.aartist; n=0; ref1={k:'g1',kind:'artist',label:t.aartist,sub:'',h:h1,handle:t.h,seed:t.aartist,count:0,albums:0,cands:[],ckey:''}; rows.push(ref1); }
    } else if(g==='album'){
      if(t.artkey!==curAl){ curAl=t.artkey; n=0; ref1={k:'g1',kind:'album',label:t.album,sub:t.aartist+(t.year?(' '+CH_DOT+' '+t.year):''),h:h1,handle:t.h,seed:t.artkey,count:0,albums:0}; rows.push(ref1); }
    } else if(g==='both'){
      if(t.aartist!==curA){ curA=t.aartist; curAl=null; ref2=null; ref1={k:'g1',kind:'artist',label:t.aartist,sub:'',h:h1,handle:t.h,seed:t.aartist,count:0,albums:0,cands:[],ckey:''}; rows.push(ref1); }
      if(t.artkey!==curAl){ curAl=t.artkey; n=0; ref2={k:'g2',kind:'album',label:t.album,sub:t.year||'',h:SG_H2,handle:t.h,seed:t.artkey,count:0}; rows.push(ref2); if(ref1) ref1.albums++; }
    }
    n++; tracks.push(t);
    // one candidate per album for the artist header's avatar -- the first with art wins (rowCover)
    if(ref1 && ref1.cands && ref1.ckey!==t.artkey && ref1.cands.length<COVER_CANDS){ ref1.ckey=t.artkey; ref1.cands.push(t.h); }
    rows.push({k:'t',t:t,n:(g==='none'?tracks.length:n),ti:tracks.length-1,h:trH});
    if(ref1) ref1.count++;
    if(ref2) ref2.count++;
  }
  var yy=0, songPositions=[];
  for(i=0;i<rows.length;i++){
    rows[i].y=yy;
    if(rows[i].k==='t')songPositions[rows[i].ti]=yy;
    yy+=rows[i].h;
  }
  songsTrackY=songPositions;
  // link each row to its top-level header + record where the group ends, so the connector
  // rail still draws once the header itself has scrolled off the top
  var last=-1;
  for(i=0;i<rows.length;i++){
    if(rows[i].k==='g1'){ if(last>=0) rows[last].y1=rows[i].y; last=i; }
    else if(last>=0) rows[i].g1i=last;
  }
  if(last>=0) rows[last].y1=yy;
  songsRows=rows; songsTracks=tracks; songsContentH=yy+24;
}
// first row whose bottom is below the scroll position (binary search: thousands of rows)
function songsFirstAt(py){
  var lo=0, hi=songsRows.length-1, res=songsRows.length;
  while(lo<=hi){ var m=(lo+hi)>>1; if(songsRows[m].y+songsRows[m].h>py){ res=m; hi=m-1; } else lo=m+1; }
  return res;
}
function setSongsGroup(g){
  if(g!==songsGroup){ clearTrackSelection(); songsGroup=g; songsRows=null; songsScroll=songsScrollT=0; }
  sgMenuOpen=false; repaintAll();
}
function playSongsRow(ti){
  if(!songsTracks) return;
  var hs=[]; for(var i=0;i<songsTracks.length;i++) hs.push(songsTracks[i].h);
  playHandleList(hs,ti);
}

var plCacheMap={}, plMetaMap={};
function getItems(pi){ if(!plCacheMap[pi]){ plCacheMap[pi]=plman.GetPlaylistItems(pi); } return plCacheMap[pi]; }
function getMeta(pi){
  if(!plMetaMap[pi]){
    var list=getItems(pi), secs=TF.lensec.EvalWithMetadbs(list), tot=0;
    for(var i=0;i<secs.length;i++) tot+=parseInt(secs[i],10)||0;
    plMetaMap[pi]={ title:TF.title.EvalWithMetadbs(list), artist:TF.artist.EvalWithMetadbs(list),
                    album:TF.album.EvalWithMetadbs(list), albumArtist:TF.artistName.EvalWithMetadbs(list), len:TF.len.EvalWithMetadbs(list), artkey:TF.albkey.EvalWithMetadbs(list),
                    totalSec:tot, keys:null };
  }
  return plMetaMap[pi];
}
/* Build steps for a playlist. getItems materialises the whole item list and each TF pass runs
   over it, so on a large playlist doing these back to back is exactly the stall being avoided --
   one per tick instead. plMetaMap is only published once every field is in, so a synchronous
   getMeta() elsewhere still sees either nothing or a complete record, never a half-built one. */
function metaSteps(pi){
  var list=null, m={title:null,artist:null,album:null,albumArtist:null,len:null,artkey:null,totalSec:0,keys:null};
  return [
    function(){ list=getItems(pi); },
    function(){ m.title=TF.title.EvalWithMetadbs(list); },
    function(){ m.artist=TF.artist.EvalWithMetadbs(list); },
    function(){ m.album=TF.album.EvalWithMetadbs(list); },
    function(){ m.albumArtist=TF.artistName.EvalWithMetadbs(list); },
    function(){ m.len=TF.len.EvalWithMetadbs(list); },
    function(){ m.artkey=TF.albkey.EvalWithMetadbs(list); },
    function(){ var s=TF.lensec.EvalWithMetadbs(list), t=0, i; for(i=0;i<s.length;i++) t+=parseInt(s[i],10)||0; m.totalSec=t; },
    function(){ if(!plMetaMap[pi]) plMetaMap[pi]=m; }   // a sync getMeta() may have won the race
  ];
}
function metaReady(pi){ return !!plMetaMap[pi]; }

// jobs={} cancels any build in flight: jobStep finds no entry for its key and simply stops, so a
// job that started against the old data can never publish it
function invalidateItems(){ plFilteredCache=null; plCacheMap={}; plMetaMap={}; plCoverCache={}; coverPickCache={}; mosaicCache={}; warmed={}; plOrderMap={}; plNameCache={}; plCountCache={}; plCardCache={}; qMetaCache={}; visPlCache=null; warmJob=null; jobs={}; gates={}; rowGate={}; shelfHandles=null; }

/* ---- Playlist view sort: only reorders how rows are DISPLAYED. Native item indices (playback,
   row menu, drag targets) are untouched, so order[displayRow] maps to the real item index. */
var plSort='none', plSortDir='asc', plSortMenuOpen=false, PL_SORT_HB=[], HB_PLSORT=null, HB_PLSORTDIR=null;
var PL_SORTS=[['Default','none'],['Title','title'],['Artist','artist'],['Album','album']];
var plOrderMap={};
// Lowercase sort keys built once per playlist and reused across re-sorts, for the same reason as
// the All Songs index: cmpStr would otherwise lowercase both operands on every comparison.
function plKeys(pi){
  var meta=getMeta(pi);
  if(!meta.keys){
    var n=meta.title.length, t=[], a=[], l=[], i;
    for(i=0;i<n;i++){ t.push(String(meta.title[i]).toLowerCase()); a.push(String(meta.artist[i]).toLowerCase()); l.push(String(meta.album[i]).toLowerCase()); }
    meta.keys={t:t,a:a,l:l};
  }
  return meta.keys;
}
function buildPlOrder(pi){
  var meta=getMeta(pi), n=meta.title.length, order=[], i;
  for(i=0;i<n;i++) order.push(i);
  // Original order is the exact foobar playlist item order (including imported M3U8 order).
  // Do not reverse it merely because the last explicit sort used Descending.
  if(plSort==='none') return order;
  var k=plKeys(pi);
  if(plSort==='title') order.sort(function(a,b){ return cmpK(k.t[a],k.t[b])||cmpK(k.a[a],k.a[b]); });
  else if(plSort==='album') order.sort(function(a,b){ return cmpK(k.l[a],k.l[b])||cmpK(k.a[a],k.a[b])||cmpK(k.t[a],k.t[b]); });
  else order.sort(function(a,b){ return cmpK(k.a[a],k.a[b])||cmpK(k.l[a],k.l[b])||cmpK(k.t[a],k.t[b]); });
  if(plSortDir==='desc') order.reverse();
  return order;
}
function getPlOrder(pi){
  var meta=getMeta(pi), n=meta.title.length, c=plOrderMap[pi];
  if(!c || c.sort!==plSort || c.dir!==plSortDir || c.n!==n){ c={sort:plSort,dir:plSortDir,n:n,order:buildPlOrder(pi)}; plOrderMap[pi]=c; }
  return c.order;
}
/* Filter only the visible playlist rows. Original playlist item indices are retained, so
   playing a track, adding to queue, and bulk actions still target the correct file. */
var plFilteredCache=null;
function getPlVisibleOrder(pi){
  var order=getPlOrder(pi);
  if(!inlineFilterActive() || !filterQuery.trim()) return order;
  var q=filterQuery,cache=plFilteredCache;
  if(cache && cache.pi===pi && cache.query===q && cache.sort===plSort && cache.dir===plSortDir && cache.count===order.length) return cache.order;
  var m=getMeta(pi),filtered=[];
  for(var i=0;i<order.length;i++){
    var j=order[i];
    if(fuzzyTrackMatch(q,[m.title[j],m.artist[j],m.albumArtist[j],m.album[j]])) filtered.push(j);
  }
  plFilteredCache={pi:pi,query:q,sort:plSort,dir:plSortDir,count:order.length,order:filtered};
  return filtered;
}
// Entering Default never changes the remembered direction. When returning to a
// named sort, the user's last Ascending/Descending choice is restored.
function setPlSort(s){ plSort=s; plFilteredCache=null; plSortMenuOpen=false; repaintAll(); }
function togglePlSortDir(){ if(plSort==='none') return; plSortDir=(plSortDir==='asc')?'desc':'asc'; plFilteredCache=null; repaintAll(); }
