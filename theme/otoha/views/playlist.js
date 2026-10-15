/* otoha/views/playlist.js -- playlist view, empty state, and the file drop zone
   Part of Otoha, a local music theme for foobar2000. Loaded by main.js;
   every module shares one global scope, so load order is set there. */

function drawPlaylist(gr,r){
  HB_TR=[]; HB_PLADD_FILES=null; HB_PLADD_FOLDER=null;
  var p=activePl();
  // the header reads meta too (track count, total duration), so the whole view waits on it, and
  // then on the artwork the reveal will actually show
  var metaOk=ensureBuilt('meta'+p.i,function(){ return metaReady(p.i); },function(){ return metaSteps(p.i); });
  if(!metaOk || !gateReady('plart'+p.i,rowHandlesPl(p.i),0,ROW_GATE_MS)){   // 0 = the default cap
    if(metaOk || skelVisible('meta'+p.i)) drawViewSkeleton(gr,r);
    return;
  }
  var compact = r.w < 950;
  var headH = compact ? 156 : M.headH;
  gr.FillGradRect(r.x,r.y,r.w,headH,90,blend(artHue(plChoice(p.i).single,p.name),COL.base,0.42),COL.base,1.0);
  var ax=r.x+M.cpad, ay=r.y+(compact?18:44), art=compact?112:M.artSz;
  drawPlCover(gr,ax,ay,art,8,p.i,p.name);
  var rx0=r.x+r.w-M.cpad, sortDirW=38, sortGap=8;
  // On compact layouts the queue overlays the right edge of the main panel.
  // Keep the sort controls clickable to the LEFT of the expanded queue.
  if(W<1180 && compactQueueOpen && R.queueW)
    rx0=Math.min(rx0,R.queue.x-M.gap-M.cpad);
  var sortPillW=compact?Math.min(160,Math.max(90,rx0-r.x-180)):200;
  // Always reserve space for direction so selecting Default never shifts the sort pill.
  var sortTotalW=sortPillW+sortGap+sortDirW;
  var tx=ax+art+(compact?16:24);
  var sortX=compact?Math.max(r.x+M.cpad,rx0-sortTotalW):Math.max(tx,rx0-sortTotalW);
  // Compact header controls need clear breathing room above the track-list boundary.
  var sortY=compact?(r.y+headH-38-22):ay+142;
  var tw=compact?Math.max(50,rx0-tx):Math.max(120,sortX-12-tx);
  tL(gr,'PLAYLIST',FONT.eyebrow,COL.text,tx,ay+(compact?0:6),tw,18);
  tL(gr,p.name,fitHeaderFont(gr,p.name,tw),COL.text,tx,ay+(compact?22:28),tw,compact?38:84);
  var meta0=getMeta(p.i);
  if(!compact) tL(gr,p.count+' songs'+(meta0.totalSec>0?(' '+CH_DOT+' '+fmtDur(meta0.totalSec)):''),FONT.meta,COL.text2,tx,ay+150,tw,22);
  HB_PLSORT=drawDropPill(gr,sortX,sortY,sortPillW,38,'Sort: '+labelOf(PL_SORTS,plSort,'Default'),plSortMenuOpen);
  drawSortDirBtn(gr,sortX+sortPillW+sortGap,sortY,sortDirW,38,plSort!=='none');

  // track list
  var lx=r.x+M.cpad, rx=r.x+r.w-M.cpad;
  var listTop=r.y+headH+8;
  if(inlineFilterActive())listTop+=62;
  var numW=30, durW=64, cgap=16;
  var showAlbum = (r.w>=620);
  var albumW=showAlbum?Math.max(85,Math.round((rx-lx-numW-durW-cgap*3)*0.34)):0;
  var titleX=lx+numW+cgap;
  var titleW=rx-lx-numW-durW-albumW-cgap*(showAlbum?3:2);
  var albumX=titleX+titleW+cgap;
  var rowsTop=listTop+34, rh=M.rowH, cropY=r.y+r.h, viewH=cropY-rowsTop;
  var order=getPlVisibleOrder(p.i); // display position -> original playlist item index
  var visibleCount=order.length;
  var contentH=visibleCount*rh, maxPx=Math.max(0,contentH-viewH);   // firstRow is a PIXEL offset
  PL_MAXPX=maxPx;
  playlistDropView={pl:p.i,x0:lx-8,x1:rx+6,y0:rowsTop,y1:cropY,rh:rh,count:visibleCount};
  firstRow=clampPx(firstRow,maxPx); firstRowT=clampPx(firstRowT,maxPx);
  var loc=playingLoc();
  var items=getItems(p.i), meta=getMeta(p.i), shufHere=npIsShuffleOf(p.name);
  warmOnce('pl'+p.i,items);
  for(var d=Math.floor(firstRow/rh); d<visibleCount; d++){
    var ry=rowsTop+d*rh-firstRow; if(ry>=cropY) break;
    var j=order[d]; var h=items[j]; if(!h){ continue; }
    var isPlaying=(loc && loc.IsValid && loc.PlaylistIndex===p.i && loc.PlaylistItemIndex===j)
                  || (shufHere && sameHandle(h,NP));   // playing from this playlist's hidden shuffle copy
    // the row whose context menu is open stays lit (brighter than hover)
    var isMenuRow=!!(ctxMenu && ctxMenu.kind==='track' && ctxMenu.pl===p.i && ctxMenu.item===j);
    var isHover=hv(r.x,ry,r.x+r.w,ry+rh)||isMenuRow;
    if(isTrackSelected({pl:p.i,item:j}) || isMenuRow) gr.FillRoundRect(lx-8,ry,rx-lx+16,rh,4,4,COL.rowActive);
    else if(isHover) gr.FillRoundRect(lx-8,ry,rx-lx+16,rh,4,4,COL.rowHover);
    var titleCol=isPlaying?COL.accent:COL.text;
    if(isHover) drawIcon(gr,'play',COL.text,lx,ry,numW,rh,14);
    else tL(gr,String(d+1),FONT.rowNum,isPlaying?COL.accent:COL.text2,lx,ry,numW,rh);
    var cs=40, cy=ry+(rh-cs)/2, alb=meta.album[j];
    drawCover(gr,titleX,cy,cs,3,h,alb||String(j),meta.artkey[j]);
    var ttx=titleX+cs+12, ttw=titleW-cs-12;
    tL(gr,meta.title[j],FONT.rowTitle,titleCol,ttx,ry+8,ttw,20);
    tL(gr,meta.artist[j],FONT.rowArtist,COL.text2,ttx,ry+30,ttw,16);
    if(showAlbum) tL(gr,alb,FONT.rowCell,COL.text2,albumX,ry,albumW,rh);
    tR(gr,meta.len[j],FONT.rowCell,COL.text2,rx-durW,ry,durW,rh);
    HB_TR.push({x0:lx-8,y0:ry,x1:rx+8,y1:ry+rh,pl:p.i,item:j,pgx0:lx,pgx1:lx+numW});
  }
  // crop the partial rows top & bottom, then draw the sticky column header on top
  gr.FillSolidRect(r.x,rowsTop-rh,r.w,rh,COL.base);
  gr.FillSolidRect(r.x,cropY,r.w,M.pad+2,COL.black);   // gutter below the panel
  if(p.count===0 && !inlineFilterActive()){ drawPlEmpty(gr,r,rowsTop-rh,cropY); return; }
  if(visibleCount===0 && inlineFilterActive()){
    drawInlineFilterBox(gr,r);
    tC(gr,'No matching tracks',FONT.sect,COL.text2,r.x,rowsTop+44,r.w,28);
    return;
  }   // no column headings over a void
  tL(gr,'#',FONT.head,COL.text2,lx,listTop,numW,20);
  tL(gr,'TITLE',FONT.head,COL.text2,titleX,listTop,titleW,20);
  if(showAlbum) tL(gr,'ALBUM',FONT.head,COL.text2,albumX,listTop,albumW,20);
  drawIcon(gr,'clock',COL.text2,rx-16,listTop,16,20,15);
  gr.DrawLine(lx,listTop+26,rx,listTop+26,1,COL.line);
  drawScrollbar(gr,rx+8,rowsTop,viewH,firstRow,maxPx,viewH,contentH,hv(r.x,r.y,r.x+r.w,cropY)||drag==='scroll');
  // the empty-state zone isn't on screen here, so outline the list itself as the target
  if(plDropHover){
    var iy=rowsTop-rh, ih=cropY-iy, ix=lx-12, iw=rx-lx+24, ir=Math.min(12,iw/2,ih/2);
    gr.FillRoundRect(ix,iy,iw,ih,ir,ir,colorAlpha(COL.accent,20));
    strokeRound(gr,ix,iy,iw,ih,ir,2,COL.accent);
    var lh=34, ly=iy+ih-lh-18, lw=Math.min(iw-32,pillW(gr,'Drop to add to this playlist'));
    if(lw>=lh && ih>lh+36){                                  // radius is lh/2, so lw must clear it
      gr.FillRoundRect(cxOf(ix,iw,lw),ly,lw,lh,lh/2,lh/2,COL.accent);
      tC(gr,'Drop to add to this playlist',FONT.pl,COL.black,cxOf(ix,iw,lw),ly,lw,lh);
    }
  }
  if(inlineFilterActive())drawInlineFilterBox(gr,r); // after sticky list-header mask
}
// zero-track playlist: centred badge/headline/buttons, or one big drop cue while files are
// dragged over it. Degrades from the top down as the panel gets shorter.
function drawPlEmpty(gr,r,top,bottom){
  var availH=bottom-top, availW=r.w-M.cpad*2;
  if(availW<220 || availH<110) return;
  var cx=r.x+Math.round(r.w/2);
  if(plDropHover){ drawDropZone(gr,cx,top,availW,availH); return; }

  var badge=availH>=250, sub=availH>=170;
  var blockH=(badge?86:0)+40+(sub?24:0)+24+PILL_H;
  var y=top+Math.round((availH-blockH)/2);
  if(badge){
    var bs=64, bx=cx-bs/2;
    gr.FillEllipse(bx,y,bs,bs,RGBA(255,255,255,16));
    drawIcon(gr,'add',COL.text2,bx,y,bs,bs,26);
    y+=86;
  }
  tC(gr,"Let's add some songs",FONT.sect2,COL.text,r.x,y,r.w,40); y+=40;
  if(sub){ tC(gr,'Drag files here, or browse your computer.',FONT.meta,COL.text2,r.x,y,r.w,24); y+=24; }
  y+=24;
  // the pair hugs its labels and centres as a group, so widths stay balanced at any UISCALE
  var w1=pillW(gr,'Browse files'), w2=pillW(gr,'Browse folder'), gap=12;
  var px=cx-Math.round((w1+w2+gap)/2);
  HB_PLADD_FILES=drawPill(gr,px,y,w1,'Browse files',true);
  HB_PLADD_FOLDER=drawPill(gr,px+w1+gap,y,w2,'Browse folder',false);
}
// accent wash + rounded outline + label: the shape the cursor is aiming at
function drawDropZone(gr,cx,top,availW,availH){
  var bw=Math.min(560,availW), bh=Math.min(260,availH-24);
  var bx=cx-Math.round(bw/2), by=top+Math.round((availH-bh)/2), rad=Math.min(14,bw/2,bh/2);
  gr.FillRoundRect(bx,by,bw,bh,rad,rad,colorAlpha(COL.accent,26));
  strokeRound(gr,bx,by,bw,bh,rad,2,COL.accent);
  var iy=by+Math.round(bh/2)-40;
  drawIcon(gr,'add',COL.accent,bx,iy,bw,34,34);
  tC(gr,'Drop to add to this playlist',FONT.sect,COL.accent,bx,iy+44,bw,26);
}
/* Pill buttons: primary uses the accent with contrasting text, secondary is outlined. Both
   nudge outward on hover (no transforms here, so "scale" is a 2px grow) inside a padded hitbox. */
var PILL_H=42;
function pillW(gr,label){ return Math.max(140,gr.CalcTextWidth(label,FONT.pl)+48); }
function drawPill(gr,x,y,w,label,primary){
  var hb={x0:x-3,y0:y-3,x1:x+w+3,y1:y+PILL_H+3};
  var g=hv(hb.x0,hb.y0,hb.x1,hb.y1)?2:0;
  var bx=x-g, by=y-g, bw=w+g*2, bh=PILL_H+g*2, rad=bh/2;
  if(primary) gr.FillRoundRect(bx,by,bw,bh,rad,rad,accentState(!!g));
  else strokeRound(gr,bx,by,bw,bh,rad,g?2:1,g?COL.text:COL.text2);
  tC(gr,label,FONT.pl,primary?COL.onAccent:COL.text,bx,by,bw,bh);
  return hb;
}
