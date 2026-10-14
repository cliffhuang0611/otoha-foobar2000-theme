/* otoha/data/art.js -- album art: async fetch queue, masks, covers, mosaics, card bitmaps
   Part of Otoha, a local music theme for foobar2000. Loaded by main.js;
   every module shares one global scope, so load order is set there. */

/* ---- album art: async cache keyed by album. A miss draws the placeholder and requests the
   art off the paint thread; arrival caches it and repaints (coalesced). warmArt() pre-requests. */
var artCache={}, albKeyCache={}, thumbCache={}, artPending={}, artRepaintPending=false;

function albKey(h){ if(!h) return ''; var p=h.Path; if(albKeyCache.hasOwnProperty(p)) return albKeyCache[p]; var k=TF.albkey.EvalWithMetadb(h); albKeyCache[p]=k; return k; }
/* Art arrival used to trigger a full repaintAll every 60ms. With cold caches a full paint costs
   30-90ms, so one queued every 60ms leaves the single script thread with nothing spare -- the app
   drew its content and then sat unresponsive until the art finished. Two changes: repaint only
   the panels art can affect (never the title bar, and skipping the full-window canvas clear), and
   back the interval right off while a bulk warm is still draining. */
function artWarmRepaint(){
  if(artRepaintPending) return;
  artRepaintPending=true;
  var busy=(artGateQueue.length+artQueue.length+artWarmQueue.length+artInFlight)>16;
  window.SetTimeout(function(){
    artRepaintPending=false;
    if(!R.main||!R.navTop||!R.queue){ repaintAll(); return; }   // art can resolve before layout() has run
    repaintMain(); repaintNavAll(); repaintQueue();             // repaintMain also covers the bar
  },busy?260:60);
}
/* Requests are queued rather than all fired at once. Each resolution resizes a full-size cover on
   the script thread, so hundreds landing together serialise into one long stall. On-demand
   requests (a card being drawn now) jump the queue ahead of bulk warm-up work, so what's on
   screen fills in first instead of behind several hundred off-screen covers. */
/* ART_DOWNSCALE is the quality mode for the on-arrival downscale. It was 2 (HighQuality), which on
   a 3000px cover costs tens of milliseconds -- and that runs inside the promise callback, which
   cannot yield. Across a few hundred artists it is seconds of solid thread time with nothing able
   to paint: the "drawn, then frozen" freeze. Mode 1 is several times cheaper and the result is
   downscaled again to card size before it is ever shown, so the difference is not visible.
   Fewer in flight also means fewer callbacks landing back to back. */
/* Background (warm-up) requests live in a queue of their own and only reach the drive when it is
   otherwise IDLE, one at a time. They used to share the on-screen queue, merely placed at the back
   of it -- which kept the order right but not the contention: Home queued every artist and opening
   a playlist queued every album in it, so the in-flight slots stayed full of reads nobody was
   looking at, and on a spinning disk each of those slows every other read. Measured on a 4,144-track
   library on a USB hard drive: 832 covers dispatched in the first minute, typically 147 ms each,
   with a playlist view waiting 14 s for the 24 covers it actually showed. */
/* Three tiers, served strictly in order:
     gate   -- a section holding its reveal back behind a skeleton. Nothing in it is usable until
               these arrive, so they go before anything else. Without this tier a gated section lost
               to ungated content drawn after it: the newest request goes first, and the artist grid
               paints its cards after the shelf gate asks, so the shelf's 12 covers waited behind a
               hundred others (revealed at 6.0 s against 1.1 s).
     demand -- on screen and already interactive, drawn with a placeholder meanwhile. Newest first,
               so what was just scrolled to beats what was scrolled past.
     warm   -- background pre-loading, only on an idle drive (above). */
var artGateQueue=[], artQueue=[], artWarmQueue=[], artInFlight=0, ART_MAX_INFLIGHT=3, ART_DOWNSCALE=1, ART_MAXPX=500;
var ART_TIER={warm:0, demand:1, gate:2};
function artTierQueue(t){ return t==='gate'?artGateQueue:(t==='warm'?artWarmQueue:artQueue); }
// while a section is holding back its reveal there is nothing interactive inside it, so it is
// worth fetching harder; normal browsing drops back to ART_MAX_INFLIGHT
var ART_GATE_INFLIGHT=6, artsGating=false;
// gated sections fetch harder, because nothing in them is interactive until they reveal
function artInflightCap(){ return artsGating?ART_GATE_INFLIGHT:ART_MAX_INFLIGHT; }
/* tier: 'gate', 'demand' (the default) or 'warm'; `true` still means warm, for the existing callers.
   artPending[key] records the tier an entry is queued at, so it can be told apart and promoted. */
function requestArt(h,key,tier){
  if(tier===true) tier='warm'; else if(!tier) tier='demand';
  if(!h || artCache.hasOwnProperty(key)) return;
  var p=artPending[key];
  if(p){
    // wanted more urgently than it was queued: move it up a tier, or it would wait behind work that
    // matters less. If it is not in its queue it is already in flight -- leave it be, since
    // re-queueing would fetch it twice.
    if(ART_TIER[tier]>ART_TIER[p]){
      var q=artTierQueue(p);
      for(var i=0;i<q.length;i++){
        if(q[i][1]===key){ q.splice(i,1); artPending[key]=tier; artTierQueue(tier).unshift([h,key]); pumpArt(); break; }
      }
    }
    return;
  }
  artPending[key]=tier;
  if(tier==='warm') artWarmQueue.push([h,key]); else artTierQueue(tier).unshift([h,key]);
  pumpArt();
}
function pumpArt(){
  while(artInFlight<artInflightCap() && (artGateQueue.length || artQueue.length)){
    var it=artGateQueue.length?artGateQueue.shift():artQueue.shift();
    artInFlight++;
    startArt(it[0],it[1]);
  }
  // background work only on an idle drive, and never more than one read of it at a time
  if(artInFlight===0 && !artGateQueue.length && !artQueue.length && artWarmQueue.length){
    var w=artWarmQueue.shift();
    artInFlight++;
    startArt(w[0],w[1]);
  }
}

function artDone(key,img){
  capPut(artCache,artOrder,ART_CAP,key,img||null);
  delete artPending[key];
  artInFlight--; pumpArt();
}
function startArt(h,key){
  try{
    utils.GetAlbumArtAsyncV2(0,h,0,false,false,false).then(function(res){
      var img=res?res.image:null;
      if(img && img.Width>ART_MAXPX){
        try{ img=img.Resize(ART_MAXPX,Math.round(img.Height*ART_MAXPX/img.Width),ART_DOWNSCALE); }catch(e){}
      }
      artDone(key,img); artWarmRepaint();
    }, function(){ artDone(key,null); });
  }catch(e){ artDone(key,null); }
}
function getArtK(h,key){                        // cached image, or null (not-loaded -> request async)
  if(!h) return null;
  if(artCache.hasOwnProperty(key)) return artCache[key];
  requestArt(h,key);
  return null;
}
function artLoaded(key){ return artCache.hasOwnProperty(key); }   // vs. still-loading (don't cache derivatives yet)
function getArt(h){ return h?getArtK(h,albKey(h)):null; }
var warmed={};   // guards one-time warm passes per view; reset when items change
// bulk warm-up is low priority: it must not push what's currently on screen to the back of the queue
function warmArt(handles){ if(!handles) return; var n=(handles.length!==undefined)?handles.length:handles.Count; for(var i=0;i<n;i++){ var h=handles[i]; if(h) requestArt(h,albKey(h),true); } }
function warmOnce(tag,handles){ if(warmed[tag]) return; warmed[tag]=1; warmArt(handles); }
/* The home warm pass used to touch every artist and every playlist in a single go, inside a paint
   -- and plCovers() materialises a playlist's whole item list, so it scaled with the library, not
   the screen. It now runs in slices on timer ticks. Requests are queued low-priority, so nothing
   here can delay art for what is actually on screen. */
var warmJob=null, WARM_SLICE=25;
function startWarmHome(arts,pls){ warmJob={arts:arts,pls:pls,ai:0,pi:0}; warmStep(); }
function warmStep(){
  if(!warmJob) return;
  var j=warmJob, n=0, h;
  while(n<WARM_SLICE && j.ai<j.arts.length){
    h=artistFirst(j.arts[j.ai].name,j.arts[j.ai].handle);   // NOT artistCover: choosing a cover is
    if(h) requestArt(h,albKey(h),true);                     // on-demand work at on-screen priority
    j.ai++; n++;
  }
  while(n<WARM_SLICE && j.pi<j.pls.length){
    h=plCovers(j.pls[j.pi]).single;
    if(h) requestArt(h,albKey(h),true);
    j.pi++; n++;
  }
  if(j.ai>=j.arts.length && j.pi>=j.pls.length){ warmJob=null; return; }
  window.SetTimeout(warmStep,30);
}
/* ---- cover choice: the first candidate that actually HAS art ----------------
   An artist's or a playlist's cover used to be simply its first track, so one untagged opener left
   the card on a flat placeholder even when every other album in the set had artwork. These pick
   the first candidate whose art resolves to a real image, and only fall back to the placeholder
   colour when nothing in the set has any.
   Art is async, so the scan resolves progressively: it walks the candidates in order and stops at
   the first one not yet loaded -- requesting it, plus a short lookahead so the next round is
   already in flight -- which is what keeps the choice from ever moving backwards. The answer is
   cached once it can no longer change; an unsettled scan is cheap, but it does run per paint. */
var COVER_CANDS=10, COVER_LOOKAHEAD=2, coverPickCache={};
function coverPick(key,cands,want){
  if(coverPickCache.hasOwnProperty(key)) return coverPickCache[key];
  var out=[], done=true, i, j, h, k;
  if(cands) for(i=0;i<cands.length && out.length<want;i++){
    h=cands[i]; if(!h) continue;
    k=albKey(h);
    if(!artLoaded(k)){
      requestArt(h,k);                                   // wanted on screen now: ahead of bulk warm-up
      for(j=1;j<=COVER_LOOKAHEAD && i+j<cands.length;j++) if(cands[i+j]) requestArt(cands[i+j],albKey(cands[i+j]),true);
      done=false; break;
    }
    if(artCache[k]) out.push(h);
  }
  var res={list:out, done:done};
  if(done && cands && cands.length) coverPickCache[key]=res;   // empty = data not built yet, retry
  return res;
}
/* What a multi-track cover (playlist, All Songs) actually draws: the 2x2 mosaic once four
   candidates have art, else the first single cover there is. While the scan is unsettled it holds
   the old first-track cover, so nothing flickers between two real covers. */
function coverChoice(key,cov){
  var p=coverPick(key,cov.cands,4);
  if(!p.done) return {wait:true, list:[], single:cov.single};
  if(p.list.length>=4) return {wait:false, list:p.list, single:p.list[0]};
  return {wait:false, list:[], single:p.list.length?p.list[0]:cov.single};
}
/* The thumb is checked BEFORE its source, and deliberately outlives it. artCache is the tightest
   cache in the theme -- a ~500px bitmap per entry against a 40px thumb -- so on a large playlist it
   evicts albums whose thumbs are still resident. Asking it first threw away a perfectly good thumb,
   drew the placeholder, and refetched the full image from disk: that is what made row artwork
   visibly "reload" on returning to a big playlist. An evicted source can only ever cost a reload,
   never a wrong pixel, so the derivative is the better authority here. */
function getThumb(h,key,size){
  var tk=key+'|'+size;
  if(thumbCache.hasOwnProperty(tk)) return thumbCache[tk];
  var img=getArtK(h,key);
  if(!artLoaded(key)) return null;             // still loading -> placeholder, don't cache
  var r=null; if(img){ try{ r=img.Resize(size,size,2); }catch(e){ r=null; } }
  capPut(thumbCache,thumbOrder,THUMB_CAP,tk,r); return r;
}

// All Songs group header: rows carry their own candidates (built with the rows, free of interop)
function rowCover(row){
  var p=coverPick('sg|'+row.seed,row.cands,1);
  return p.list.length?p.list[0]:row.handle;
}
function drawCover(gr,x,y,sz,rad,h,seed,key){
  if(!isFinite(sz) || sz<1) return;
  sz=Math.floor(sz); rad=Math.max(0,Math.min(Math.floor(Number(rad))||0,Math.floor(sz/2)));
  var img=h?getThumb(h,key||albKey(h),sz):null;
  if(img){ gr.DrawImage(img,x,y,sz,sz,0,0,img.Width,img.Height,0,255); }
  else if(rad>0){ gr.FillRoundRect(x,y,sz,sz,rad,rad,coverCol(seed)); }
  else { gr.FillSolidRect(x,y,sz,sz,coverCol(seed)); }
}
/* dominant colour of an album's art, for header gradients (cached; falls back to placeholder) */
var hueCache={};
function artHue(h,seed){
  if(!h) return coverCol(seed);
  var k=albKey(h);
  if(hueCache.hasOwnProperty(k)) return hueCache[k];
  var img=getArt(h);
  if(!artLoaded(k)) return coverCol(seed);   // still loading -> fallback, don't cache (recompute when it arrives)
  var col=coverCol(seed);
  if(img){ try{ var s=img.GetColourScheme(1); if(s && s.length) col=s[0]; }catch(e){} }
  hueCache[k]=col; return col;
}
/* masked art: circular (artists) / rounded (large covers). Masks + results are cached;
   ApplyMask mutates, so it runs on a resized COPY, never the shared original. */
var maskCache={}, cArtCache={};
function circleMask(size){
  var k='c'+size; if(maskCache[k]) return maskCache[k];
  var m=gdi.CreateImage(size,size), g=m.GetGraphics();
  g.FillSolidRect(0,0,size,size,RGB(255,255,255)); g.SetSmoothingMode(2); g.FillEllipse(0,0,size,size,RGB(0,0,0));
  m.ReleaseGraphics(g); maskCache[k]=m; return m;
}
function roundMask(size,rad){
  // GDI+ rejects rounded-rect arcs larger than the available bitmap.
  size=Math.floor(Number(size));
  if(!isFinite(size) || size<1) return null;
  rad=Math.max(0,Math.min(Math.floor(Number(rad))||0,Math.floor(size/2)));
  var k='r'+size+'_'+rad; if(maskCache[k]) return maskCache[k];
  var m=gdi.CreateImage(size,size), g=m.GetGraphics();
  g.FillSolidRect(0,0,size,size,RGB(255,255,255)); g.SetSmoothingMode(2);
  if(rad>0) g.FillRoundRect(0,0,size,size,rad,rad,RGB(0,0,0));
  else g.FillSolidRect(0,0,size,size,RGB(0,0,0));
  m.ReleaseGraphics(g); maskCache[k]=m; return m;
}
function maskedArt(h,seed,size,mask,tag){
  if(!mask || !isFinite(size) || size<1) return null;
  var k=(h?albKey(h):(seed||''))+'|'+size+'|'+tag;   // keyed by album, not the seed label ('np' is constant -> stale art)
  if(cArtCache.hasOwnProperty(k)) return cArtCache[k];
  var art=h?getArt(h):null;
  if(h && !artLoaded(albKey(h))) return null;   // still loading -> placeholder, don't cache
  var res=null;
  if(art){ try{ var img=art.Resize(size,size); img.ApplyMask(mask); res=img; }catch(e){ res=null; } }
  capPut(cArtCache,cArtOrder,CART_CAP,k,res); return res;
}
function drawCircle(gr,x,y,size,h,seed){
  if(!isFinite(size) || size<1) return;
  size=Math.floor(size);
  var ci=maskedArt(h,seed,size,circleMask(size),'c');
  if(ci) gr.DrawImage(ci,x,y,size,size,0,0,ci.Width,ci.Height,0,255);
  else gr.FillEllipse(x,y,size,size,coverCol(seed));
}
function drawRounded(gr,x,y,size,rad,h,seed){
  if(!isFinite(size) || size<1) return;
  size=Math.floor(size);
  rad=Math.max(0,Math.min(Math.floor(Number(rad))||0,Math.floor(size/2)));
  var ri=maskedArt(h,seed,size,roundMask(size,rad),'r'+rad);
  if(ri) gr.DrawImage(ri,x,y,size,size,0,0,ri.Width,ri.Height,0,255);
  else if(rad>0) gr.FillRoundRect(x,y,size,size,rad,rad,coverCol(seed));
  else gr.FillSolidRect(x,y,size,size,coverCol(seed));
}
/* playlist cover: up to COVER_CANDS DISTINCT albums to choose from -- four of them WITH art make
   the 2x2 mosaic, otherwise the first one with art is shown alone. list/single stay what they
   always were (the first four, the first one), because the reveal gates wait on those: a section
   reveals as soon as its opening covers are in and coverPick refines the choice after. */
var plCoverCache={}, mosaicCache={};
function plCovers(pi){
  if(plCoverCache.hasOwnProperty(pi)) return plCoverCache[pi];
  var it=getItems(pi), res={list:[], single:null, cands:[]};
  if(it && it.Count){
    var seenAlb={}, cap=Math.min(it.Count,60);
    for(var i=0;i<cap && res.cands.length<COVER_CANDS;i++){
      var h=it[i]; if(!h) continue; var k=albKey(h); if(seenAlb[k]) continue;
      seenAlb[k]=1; res.cands.push(h); if(res.list.length<4) res.list.push(h);
    }
    res.single=res.cands.length?res.cands[0]:it[0];
  }
  plCoverCache[pi]=res; return res;
}
function plChoice(pi){ return coverChoice('pl|'+pi,plCovers(pi)); }
function mosaicImg(handles,seed,size,rad){
  if(!isFinite(size) || size<4) return null;
  var key=(seed||'')+'|'+size+'|m'+rad;
  if(mosaicCache.hasOwnProperty(key)) return mosaicCache[key];
  var i, ready=true;
  for(i=0;i<4;i++){ getArt(handles[i]); if(!artLoaded(albKey(handles[i]))) ready=false; }   // request all; wait for all
  if(!ready) return null;                     // still loading -> placeholder single cover; don't cache a half mosaic
  var res=null;
  try{
    var cv=gdi.CreateImage(size,size), g=cv.GetGraphics();
    var h1=Math.floor(size/2), h2=size-h1;
    var cells=[[0,0,h1,h1],[h1,0,h2,h1],[0,h1,h1,h2],[h1,h1,h2,h2]];
    for(i=0;i<4;i++){
      var art=getArt(handles[i]), c=cells[i];
      if(art){ var rz=art.Resize(c[2],c[3]); g.DrawImage(rz,c[0],c[1],c[2],c[3],0,0,rz.Width,rz.Height); }
      else g.FillSolidRect(c[0],c[1],c[2],c[3],coverCol((seed||'')+i));
    }
    cv.ReleaseGraphics(g);
    if(rad>0) cv.ApplyMask(roundMask(size,rad));
    res=cv;
  }catch(e){ res=null; }
  mosaicCache[key]=res; return res;
}
function drawPlCover(gr,x,y,size,rad,pi,seed){
  var c=plChoice(pi);
  if(c.list.length>=4){ var mi=mosaicImg(c.list,seed,size,rad); if(mi){ gr.DrawImage(mi,x,y,size,size,0,0,mi.Width,mi.Height,0,255); return; } }
  drawRounded(gr,x,y,size,rad,c.single,seed);
}
/* Playlist cards are identical between playlist changes, so each is rendered once into a bitmap
   and blitted thereafter -- that removes the rounded rects, cover blits and text layout from
   every frame. Only the resting variant is cached: exactly one card is hovered at a time, so
   that one is painted live rather than doubling the cache.
   Art arrives asynchronously, so a card is not cached until its cover is ready -- the same guard
   maskedArt and mosaicImg use, without which a card would keep its placeholder forever. */
var plCardCache={};
function plCoverReady(pi){
  var c=plChoice(pi), i, h;
  if(c.wait) return false;                  // still choosing -> a baked card would keep the placeholder
  for(i=0;i<c.list.length;i++){ h=c.list[i]; if(h && !artLoaded(albKey(h))) return false; }
  h=c.single; return !h || artLoaded(albKey(h));
}
function paintPlCard(gr,x,y,w,pi,hov){
  if(!isFinite(w) || w<1) return;
  w=Math.floor(w);
  var r=Math.min(8,Math.floor(w/2));
  if(r>0) gr.FillRoundRect(x,y,w,w+56,r,r,hov?RGB(40,40,40):COL.elev);
  else gr.FillSolidRect(x,y,w,w+56,hov?RGB(40,40,40):COL.elev);
  if(w<=24) return;
  var cs=w-24;
  drawPlCover(gr,x+12,y+12,cs,6,pi,plName(pi));
  tL(gr,plName(pi),FONT.card,COL.text,x+12,y+cs+18,w-50,20);
  tL(gr,plCount(pi)+' songs',FONT.plSub,COL.text2,x+12,y+cs+40,w-24,16);
}
function renderPlCard(pi,w,hov){
  if(!isFinite(w) || w<25) return null;
  var im=null;
  try{
    im=gdi.CreateImage(w,w+56); var g=im.GetGraphics();
    g.SetSmoothingMode(2);
    g.FillSolidRect(0,0,w,w+56,COL.base);   // the card's rounded corners must reveal the panel bg
    paintPlCard(g,0,0,w,pi,hov);
    im.ReleaseGraphics(g);
  }catch(e){ im=null; }
  return im;
}
function plCardImg(pi,w){
  var key=pi+'|'+w;
  if(plCardCache.hasOwnProperty(key)) return plCardCache[key];
  if(!plCoverReady(pi)) return null;        // not cached yet -> retried next frame
  plCardCache[key]=renderPlCard(pi,w,false); return plCardCache[key];
}
/* "All Songs" cover: distinct albums sampled ACROSS the library, not just the first few; the four
   drawn are the first of them that have art (see coverChoice) */
var libCovCache=null, libCount_=-1;
function libCount(){ if(libCount_<0){ var l=libItems(); libCount_=l?l.Count:0; } return libCount_; }
function libCovers(){
  if(libCovCache) return libCovCache;
  var lib=libItems();
  var res={list:[], single:null, cands:[]};
  if(lib && lib.Count){
    var seen={}, step=Math.max(1,Math.floor(lib.Count/400));
    for(var i=0;i<lib.Count && res.cands.length<COVER_CANDS;i+=step){
      var h=lib[i]; if(!h) continue; var k=albKey(h); if(seen[k]) continue;
      seen[k]=1; res.cands.push(h); if(res.list.length<4) res.list.push(h);
    }
    res.single=res.cands.length?res.cands[0]:lib[0];
  }
  libCovCache=res; return res;
}
function libChoice(){ return coverChoice('__lib__',libCovers()); }
function drawLibCover(gr,x,y,size,rad){
  var c=libChoice();
  if(c.list.length>=4){ var mi=mosaicImg(c.list,'__lib__',size,rad); if(mi){ gr.DrawImage(mi,x,y,size,size,0,0,mi.Width,mi.Height,0,255); return; } }
  drawRounded(gr,x,y,size,rad,c.single,'__lib__');
}
