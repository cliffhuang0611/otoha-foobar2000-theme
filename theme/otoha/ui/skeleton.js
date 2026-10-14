/* otoha/ui/skeleton.js -- loading skeletons, shimmer, and the art reveal gates
   Part of Otoha, a local music theme for foobar2000. Loaded by main.js;
   every module shares one global scope, so load order is set there. */

/* ---- skeleton + shimmer ---- */
var shimTimer=null, shimCount=0;
function shimSettle(){
  artsGating=(gateWaiting>0);   // fetch harder while a section is holding its reveal back
  /* 16fps: a slow sweep reads fine at this rate, and every frame costs a full main repaint at a
     moment when artwork decoding is already competing for the same thread. Suppressed entirely
     while a scroll animation runs -- that already repaints at 60fps, and the sweep is driven off
     the clock, so it keeps moving for free instead of scheduling redundant frames. */
  var want=(shimCount>0 && !scrollTimer);
  if(want && !shimTimer) shimTimer=window.SetInterval(function(){ repaintMain(); },60);
  else if(!want && shimTimer){ window.ClearInterval(shimTimer); shimTimer=null; }
}
function stopShimAnim(){ if(shimTimer){ window.ClearInterval(shimTimer); shimTimer=null; } }
/* One sweep per section rather than one per element: a single fill regardless of how many
   placeholders are showing. Clamped to the section -- RepaintRect does not clip drawing, so a
   band running past the panel edge would be stranded on the neighbouring panel. */
function shimmer(gr,x,y,w,h){
  shimCount++;
  if(w<=0||h<=0) return;
  var bandW=Math.max(80,Math.round(w*0.32)), span=w+bandW;
  var bx=x-bandW+((Date.now()/3)%span);
  var cx0=Math.max(x,bx), cx1=Math.min(x+w,bx+bandW);
  if(cx1<=cx0) return;
  // re-derive the stops for the clamped slice so the highlight doesn't jump as it enters or leaves
  var p0=(cx0-bx)/bandW, p1=(cx1-bx)/bandW, mid=(0.5-p0)/Math.max(0.001,p1-p0);
  var stops=(mid<=0||mid>=1)
    ? [0.0,RGBA(255,255,255,0),1.0,RGBA(255,255,255,0)]
    : [0.0,RGBA(255,255,255,0),mid,RGBA(255,255,255,22),1.0,RGBA(255,255,255,0)];
  try{ gr.FillGradRectV2(cx0,y,cx1-cx0,h,0,stops); }catch(e){}
}
/* Reveal gate. A section holds its skeleton until every handle it needs has resolved artwork,
   then appears complete instead of filling in over placeholders.
   Three things every gate has to do:
   - request the artwork itself. Covers are normally requested by elements as they draw, but
     nothing draws behind a skeleton, so the gate would wait on requests nobody ever made.
   - remember what it has seen resolve. artCache is capped and can evict an entry the gate already
     counted, which would otherwise stall the reveal indefinitely.
   - give up gracefully. More handles than artCache can hold means waiting is pointless (they would
     be evicted before the reveal anyway), and a wall-clock ceiling covers slow or network storage
     at any size. Either way it reveals on data and lets covers fill in, as it did before.
   One-shot per key: once revealed, scrolling never drops back to a skeleton. */
/* GATE_TIMEOUT is the ceiling for a section whose artwork IS the content -- the shelf's cards are
   2x2 mosaics, and half a mosaic reads as broken rather than loading. A row list is different: its
   content is text that is ready in milliseconds, and its covers are 40px thumbnails beside that
   text. Waiting on them buys nothing, so row views pass ROW_GATE_MS instead and let the thumbnails
   arrive late. On a fast library the covers still beat that budget and nothing changes; on a slow
   one the list appears at once instead of sitting behind a skeleton for seconds. */
var gates={}, gateWaiting=0, GATE_BATCH=60, GATE_MAX=ART_CAP-60, GATE_TIMEOUT=12000, ROW_GATE_MS=600;
function gateReady(key,handles,max,budget){
  var g=gates[key];
  if(g && g.done) return true;
  if(!g) g=gates[key]={done:false,seen:{},t:Date.now(),keys:null};
  var n=handles?handles.length:0;
  if(!n || n>(max||GATE_MAX) || (Date.now()-g.t)>(budget||GATE_TIMEOUT)){ g.done=true; return true; }
  // Album keys are derived once. albKey() reads h.Path -- an interop call -- before its own cache
  // check, so re-deriving them on every scan cost hundreds of crossings per frame, and the shimmer
  // scans 25 times a second. That is what starved input while a section was gating.
  if(!g.keys || g.keys.length!==n){
    g.keys=[]; for(var q=0;q<n;q++) g.keys.push(handles[q]?albKey(handles[q]):'');
  }
  var pending=0, queued=0, i, h, k;
  for(i=0;i<n;i++){
    h=handles[i]; if(!h) continue;
    k=g.keys[i]; if(!k) continue;
    if(g.seen[k]) continue;
    if(artLoaded(k)){ g.seen[k]=1; continue; }
    pending++;
    if(queued<GATE_BATCH){ requestArt(h,k,'gate'); queued++; }   // batches, not one burst; ahead of ungated work
  }
  if(pending===0){ g.done=true; return true; }
  gateWaiting++; return false;
}
/* Shelf cover handles. plCovers() materialises a playlist's item list, so collecting these for
   every playlist is exactly the kind of work that must not happen inline -- it runs as a job,
   ten playlists per slice. A card showing a 2x2 mosaic needs all four of its albums. */
var shelfHandles=null;
function shelfSteps(pls){
  var out=[], i=0;
  return [function(){
    var end=Math.min(i+10,pls.length), c;
    for(;i<end;i++){
      c=plCovers(pls[i]);
      if(c.list.length>=4) out.push(c.list[0],c.list[1],c.list[2],c.list[3]);
      else if(c.single) out.push(c.single);
    }
    if(i<pls.length) return true;   // more slices needed
    shelfHandles=out;
  }];
}
/* Row views are text-dominant and virtualised, so gating them on every album in a large playlist
   would trade a long skeleton for thumbnails that are mostly off screen. They gate on the header
   artwork plus the albums of roughly the first screenful, which is what the reveal actually shows.
   Distinct by album key, since one album covers many rows. */
var ROW_GATE_N=24, rowGate={};
function rowHandlesPl(pi){
  var ck='p'+pi;
  if(rowGate[ck]) return rowGate[ck];
  var out=[], seen={}, cov=plCovers(pi), i, k;
  if(cov.list.length>=4) out.push(cov.list[0],cov.list[1],cov.list[2],cov.list[3]);
  else if(cov.single) out.push(cov.single);
  var items=getItems(pi), meta=getMeta(pi);
  for(i=0;i<meta.artkey.length && out.length<ROW_GATE_N;i++){
    k=meta.artkey[i]; if(!k || seen[k]) continue; seen[k]=1;
    if(items[i]) out.push(items[i]);
  }
  rowGate[ck]=out; return out;
}
function rowHandlesSongs(){
  if(rowGate.songs) return rowGate.songs;
  var out=[], seen={}, cov=libCovers(), i, r;
  if(cov.list.length>=4) out.push(cov.list[0],cov.list[1],cov.list[2],cov.list[3]);
  else if(cov.single) out.push(cov.single);
  for(i=0;i<songsRows.length && out.length<ROW_GATE_N;i++){
    r=songsRows[i]; if(r.k!=='t') continue;
    var k=r.t.artkey; if(!k || seen[k]) continue; seen[k]=1;
    if(r.t.h) out.push(r.t.h);
  }
  rowGate.songs=out; return out;
}
/* The card skeleton is static -- only the shimmer band moves -- so it is rendered once and blitted
   thereafter. Redrawing ~48 antialiased rounded rects on every shimmer frame was competing with
   the shelf's scroll animation for the same thread. Keyed by geometry; two entries in practice
   (grid and shelf). */
var skelImgs={};
function skelCardsCached(gr,x,y,w,h,cardW,gap){
  if(w<=0||h<=0||cardW<=0||gap<0) return;
  var k=w+'x'+h+'x'+cardW+'x'+gap, im=skelImgs[k];
  if(im===undefined){
    im=null;
    try{
      im=gdi.CreateImage(w,h); var g=im.GetGraphics();
      g.SetSmoothingMode(2);
      g.FillSolidRect(0,0,w,h,COL.base);
      skelCards(g,0,0,w,h,cardW,gap);
      im.ReleaseGraphics(g);
    }catch(e){ im=null; }
    skelImgs[k]=im;
  }
  if(im) gr.DrawImage(im,x,y,w,h,0,0,w,h);
  else skelCards(gr,x,y,w,h,cardW,gap);
}
function skelCards(gr,x,y,w,h,cardW,gap){
  if(w<=0 || h<=0 || cardW<=0 || cardW>10000) return;
  var cardH=cardW+56, cs=cardW-24, cx, cy;
  for(cy=y; cy<y+h; cy+=cardH+8){
    for(cx=x; cx+cardW<=x+w; cx+=cardW+gap){
      var ch=Math.min(cardH,y+h-cy); if(ch<24) break;
      if(cardW>=16 && ch>=16) gr.FillRoundRect(cx,cy,cardW,ch,Math.min(8,cardW/2,ch/2),Math.min(8,cardW/2,ch/2),COL.elev);
      else gr.FillSolidRect(cx,cy,cardW,ch,COL.elev);
      if(cs>=12 && ch>=cs+12) gr.FillRoundRect(cx+12,cy+12,cs,cs,6,6,RGB(34,34,34));
    }
  }
}
function skelRows(gr,x,y,w,h,rowH){
  for(var ry=y; ry<y+h; ry+=rowH){
    var rh=Math.min(rowH-8,y+h-ry); if(rh<14) break;
    gr.FillRoundRect(x,ry,40,Math.min(40,rh),4,4,COL.elev);
    gr.FillRoundRect(x+56,ry+4,Math.round(w*0.30),13,4,4,COL.elev);
    gr.FillRoundRect(x+56,ry+23,Math.round(w*0.19),11,4,4,RGB(30,30,30));
  }
}
// header block (cover + title/meta bars) shared by the playlist and All Songs skeletons
function drawViewSkeleton(gr,r){
  var lx=r.x+M.cpad, w=r.w-M.cpad*2, ay=r.y+44, art=M.artSz;
  gr.FillRoundRect(lx,ay,art,art,8,8,COL.elev);
  var tx=lx+art+24, tw=Math.max(120,w-art-24);
  gr.FillRoundRect(tx,ay+34,Math.min(tw,420),44,6,6,COL.elev);
  gr.FillRoundRect(tx,ay+94,Math.min(tw,260),18,4,4,RGB(30,30,30));
  var rowsTop=r.y+M.headH, cropY=r.y+r.h;
  if(cropY>rowsTop) skelRows(gr,lx,rowsTop,w,cropY-rowsTop,M.rowH);
  shimmer(gr,lx,ay,w,cropY-ay);   // one sweep for the whole view keeps header and rows in phase
}
