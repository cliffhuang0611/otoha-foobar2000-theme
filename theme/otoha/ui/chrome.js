/* otoha/ui/chrome.js -- window chrome + shared widgets: title bar, scrollbars, panels, overlays, menus
   Part of Otoha, a local music theme for foobar2000. Loaded by main.js;
   every module shares one global scope, so load order is set there. */

/* Custom menu strip beneath the native Windows title bar. */
var TBH = Math.round(32*UISCALE);
var MENUS=[['File','file'],['Library','library'],['Help','help']];
function openMenu(root,x,y){ try{ var mm=fb.CreateMainMenuManager(); mm.Init(root); var m=window.CreatePopupMenu(); mm.BuildMenu(m,1,600); var id=m.TrackPopupMenu(x,y); if(id>0) mm.ExecuteByID(id-1); }catch(e){} }

// small hover "..." button; records a HB_DOTS target that opens the menu just below it
function drawDots(gr,cx,cy,pl){
  if(hv(cx,cy,cx+24,cy+24)) gr.FillEllipse(cx,cy,24,24,RGBA(255,255,255,26));
  drawIcon(gr,'more',COL.text,cx,cy,24,24,18);
  HB_DOTS.push({x0:cx-2,y0:cy-2,x1:cx+26,y1:cy+26,pl:pl,mx:cx,my:cy+26});
}
// Rounded outline. GDI+ rejects an arc bigger than half the side and centres a stroke on the
// path, so inset by the line width first, then clamp the radius to what's left.
function strokeRound(gr,x,y,w,h,rad,lw,col){
  var i=lw/2, sw=w-lw, sh=h-lw;
  if(sw<=0 || sh<=0) return;
  var a=Math.min(rad,sw/2,sh/2);
  gr.DrawRoundRect(x+i,y+i,sw,sh,a,a,lw,col);
}
/* Draggable pixel scrollbar, hidden until its section is hovered. Thumb size comes from
   viewport vs content height, position from scrollPx/maxPx. Each scrollable view calls this
   at the end of its draw; the matching set*() maps a drag/click back to a scroll offset. */
var SB_MAIN={sw:6,min:36,track:20,on:175,off:95,key:'scroll'};
var SB_NAV ={sw:5,min:30,track:16,on:150,off:80,key:'scrolln'};
function drawSBV(gr,sx,top,h,scrollPx,maxPx,viewH,contentH,show,s){
  if(contentH<=viewH || h<=6 || !show) return null;
  gr.FillSolidRect(sx,top,s.sw,h,RGBA(255,255,255,s.track));
  var thumbH=Math.max(s.min,Math.round(h*viewH/contentH)); if(thumbH>h) thumbH=h;
  var ty=top+(maxPx>0?Math.round((h-thumbH)*scrollPx/maxPx):0);
  var on=(drag===s.key)||hv(sx-6,top,sx+s.sw+6,top+h);
  gr.FillSolidRect(sx,ty,s.sw,thumbH,RGBA(255,255,255,on?s.on:s.off));
  return {x0:sx-6,y0:top,x1:sx+s.sw+6,y1:top+h,top:top,h:h,thumbH:thumbH,maxPx:maxPx};
}
function drawScrollbar(gr,sx,top,h,sp,mp,vh,ch,show){ SB=drawSBV(gr,sx,top,h,sp,mp,vh,ch,show,SB_MAIN); }
function drawScrollbarN(gr,sx,top,h,sp,mp,vh,ch,show){ SBN=drawSBV(gr,sx,top,h,sp,mp,vh,ch,show,SB_NAV); }
function sbFrac(v,start,size,thumb){ return clamp01((v-start-thumb/2)/Math.max(1,size-thumb)); }
// scroll + target are set together so the easing animation doesn't fight the drag
function setScroll(y){
  if(!SB) return;
  var px=Math.round(sbFrac(y,SB.top,SB.h,SB.thumbH)*SB.maxPx);
  if(view==='playlist') firstRow=firstRowT=px;
  else if(view==='home') homeScroll=homeScrollT=px;
  else if(view==='songs') songsScroll=songsScrollT=px;
  else if(view==='search') searchScroll=searchScrollT=px;
  else if(view==='album') albumScroll=px;
  repaintMain();
}
function setScrollN(y){ if(!SBN) return; navScroll=navScrollT=Math.round(sbFrac(y,SBN.top,SBN.h,SBN.thumbH)*SBN.maxPx); repaintNav(); }

function drawScrollbarH(gr,sx,top,w,scrollX,maxX,viewW,contentW,show){
  if(contentW<=viewW || w<=6 || !show){ SBH=null; return; }   // hidden until the section is hovered
  var sh=5;
  gr.FillSolidRect(sx,top,w,sh,RGBA(255,255,255,20));
  var thumbW=Math.max(40,Math.round(w*viewW/contentW)); if(thumbW>w) thumbW=w;
  var tx=sx+(maxX>0?Math.round((w-thumbW)*scrollX/maxX):0);
  var on=(drag==='scrollh')||hv(sx,top-6,sx+w,top+sh+6);
  gr.FillSolidRect(tx,top,thumbW,sh,RGBA(255,255,255,on?175:95));
  SBH={x0:sx,y0:top-6,x1:sx+w,y1:top+sh+6,left:sx,w:w,thumbW:thumbW,maxPx:HOME_PLMAX};
}
function setScrollH(x){   // free pixel scrolling; target set with it so the easing doesn't fight the drag
  if(!SBH) return;
  plScroll=plScrollT=Math.round(sbFrac(x,SBH.left,SBH.w,SBH.thumbW)*SBH.maxPx); repaintAll();
}

/* ------------------------- paint ------------------------- */
/* FillRoundRect rasterises an antialiased path over the panel's whole area -- ~1.7Mpx for the
   main panel, on every repaint of every panel, and it showed up as ~8ms of each frame that no
   content loop accounted for. A flat fill plus the four pre-rendered corner stamps buildCorners
   already makes is visually identical (straight edges have nothing to antialias) and far cheaper.
   The stamps are black, which is correct because every panel sits on the black canvas. */
function panelBg(gr,r,c){
  var rad=M.radius; if(!CORN) CORN=buildCorners(rad);
  gr.FillSolidRect(r.x,r.y,r.w,r.h,c);
  gr.DrawImage(CORN.tl,r.x,r.y,rad,rad,0,0,rad,rad);
  gr.DrawImage(CORN.tr,r.x+r.w-rad,r.y,rad,rad,0,0,rad,rad);
  gr.DrawImage(CORN.bl,r.x,r.y+r.h-rad,rad,rad,0,0,rad,rad);
  gr.DrawImage(CORN.br,r.x+r.w-rad,r.y+r.h-rad,rad,rad,0,0,rad,rad);
}
// carve rounded corners over already-drawn square content: blit black corner masks (no clip API)
var CORN=null;
function buildCorners(rad){
  var specs={tl:[0,0],tr:[-rad,0],bl:[0,-rad],br:[-rad,-rad]}, q={}, key;
  for(key in specs){
    var im=gdi.CreateImage(rad,rad), g=im.GetGraphics(); g.FillSolidRect(0,0,rad,rad,COL.black); im.ReleaseGraphics(g);
    var mk=gdi.CreateImage(rad,rad), mg=mk.GetGraphics();
    mg.FillSolidRect(0,0,rad,rad,RGB(0,0,0)); mg.SetSmoothingMode(2); mg.FillEllipse(specs[key][0],specs[key][1],rad*2,rad*2,RGB(255,255,255));
    mk.ReleaseGraphics(mg); im.ApplyMask(mk); q[key]=im;
  }
  return q;
}
// carve only the top corners, where a square gradient/band overrides panelBg's rounding
function roundTop(gr,x,y,w){
  var rad=M.radius; if(!CORN) CORN=buildCorners(rad);
  gr.DrawImage(CORN.tl,x,y,rad,rad,0,0,rad,rad,0,255);
  gr.DrawImage(CORN.tr,x+w-rad,y,rad,rad,0,0,rad,rad,0,255);
}

/* ---- modal dialogs: dim backdrop + drop-shadowed rounded panel, and a capsule button ---- */
function modalPanel(gr,cw,ch,cy){
  gr.FillSolidRect(0,0,W,H,RGBA(0,0,0,150));
  var cx=Math.round((W-cw)/2);
  gr.FillSolidRect(cx+4,cy+6,cw,ch,RGBA(0,0,0,140));
  gr.FillRoundRect(cx,cy,cw,ch,12,12,RGB(42,42,42));
  return cx;
}
function dlgBtn(gr,x,y,w,h,label,col,hcol,txt){
  var radius=Math.min(20,w/2,h/2);
  var hot=hv(x,y,x+w,y+h);
  gr.FillRoundRect(x,y,w,h,radius,radius,col===COL.accent?accentState(hot):hot?hcol:col);
  tC(gr,label,FONT.pl,txt,x,y,w,h);
  return {x0:x,y0:y,x1:x+w,y1:y+h};
}
// themed context menu + modal overlays, painted on top of everything
function drawOverlays(gr){
  if(lyDialog){drawLyricDialog(gr);return;}
  CTX_HB=[]; CONF_HB=null; RENAME_HB=null; RG_HB=null;
  if(renameEdit){
    var rw=Math.min(420,W-40), rhh=196, ry0=Math.round((H-rhh)/2), rx0=modalPanel(gr,rw,rhh,ry0);
    tL(gr,'Rename playlist',FONT.sect,COL.text,rx0+28,ry0+22,rw-56,26);
    var ix=rx0+28, iyf=ry0+64, iw=rw-56, ih=46;
    gr.FillRoundRect(ix,iyf,iw,ih,6,6,RGB(62,62,62));
    var txt=renameEdit.text,ed=renameEdit,fs=FONT.pl,tx=ix+14,tw=iw-28;
    ed.cursor=Math.max(0,Math.min(ed.cursor,txt.length));
    ed.anchor=Math.max(0,Math.min(ed.anchor,txt.length));
    var start=Math.min(ed.viewStart||0,ed.cursor);
    while(start<ed.cursor && gr.CalcTextWidth(txt.slice(start,ed.cursor),fs)>tw-8)start++;
    while(start>0 && gr.CalcTextWidth(txt.slice(start-1,ed.cursor),fs)<tw-8)start--;
    ed.viewStart=start;
    var edges=[0],end=start;
    for(var ri=start;ri<txt.length;ri++){
      var measured=gr.CalcTextWidth(txt.slice(start,ri+1),fs);
      if(measured>tw-5)break;
      edges.push(measured);end=ri+1;
    }
    ed.hit={x:tx,start:start,edges:edges};
    var selected=renameSelection();
    if(selected[1]>start && selected[0]<end){
      var sa=Math.max(start,selected[0]),sb=Math.min(end,selected[1]);
      var sx=gr.CalcTextWidth(txt.slice(start,sa),fs),ex=gr.CalcTextWidth(txt.slice(start,sb),fs);
      gr.FillSolidRect(tx+sx,iyf+9,Math.max(1,ex-sx),ih-18,RGBA(72,132,196,175));
    }
    tL(gr,txt.slice(start,end),fs,COL.text,tx,iyf,tw,ih);
    if(caretOn){
      var cxr=tx+gr.CalcTextWidth(txt.slice(start,ed.cursor),fs);
      gr.FillSolidRect(cxr,iyf+Math.round((ih-20)/2),2,20,COL.text);
    }
    var canSave=renameEdit.text.replace(/^\s+|\s+$/g,'').length>0;
    var bw=118, bh=40, by=ry0+rhh-bh-22, dx=rx0+rw-28-bw, ccx=dx-14-bw;
    RENAME_HB={
      panel:{x0:rx0,y0:ry0,x1:rx0+rw,y1:ry0+rhh},
      input:{x0:ix,y0:iyf,x1:ix+iw,y1:iyf+ih},
      cancel:dlgBtn(gr,ccx,by,bw,bh,'Cancel',RGB(52,52,52),RGB(66,66,66),COL.text),
      save:dlgBtn(gr,dx,by,bw,bh,'Save',canSave?COL.accent:COL.accentDisabled,canSave?COL.accentHover:COL.accentDisabled,canSave?COL.onAccent:COL.text3),
      canSave:canSave
    };
  }
  if(ctxMenu){
    var ih=42,pad=6,i,it,iw=190,menu=ctxMenu;
    var separators=0;
    for(i=0;i<menu.items.length;i++){
      if(menu.items[i].separator){separators++;continue;}
      iw=Math.max(iw,Math.round(gr.CalcTextWidth(menu.items[i].label,FONT.pl))+48+(menu.items[i].submenu?14:0));
    }
    ih=Math.min(ih,Math.max(18,Math.floor((H-32-pad*2-separators*10)/(menu.items.length-separators))));
    iw=Math.min(iw,Math.max(120,W-20));
    var h=(menu.items.length-separators)*ih+separators*10+pad*2;
    var mnx=Math.max(10,Math.min(menu.x,W-iw-10)),mny=Math.max(10,Math.min(menu.y,H-h-10));
    gr.FillSolidRect(mnx+3,mny+4,iw,h,RGBA(0,0,0,120));
    gr.FillRoundRect(mnx,mny,iw,h,8,8,RGB(43,43,43));
    var parentY=mny,iy=mny+pad;
    for(i=0;i<menu.items.length;i++){
      it=menu.items[i];
      if(it.separator){gr.DrawLine(mnx+12,iy+5,mnx+iw-12,iy+5,1,RGBA(255,255,255,24));iy+=10;continue;}
      if(it.act==='destinations') parentY=iy;
      var active=!it.disabled&&(hv(mnx,iy,mnx+iw,iy+ih)||(menu.subOpen&&it.submenu));
      if(active) gr.FillRoundRect(mnx+4,iy,iw-8,ih,5,5,RGBA(255,255,255,20));
      tL(gr,it.label,FONT.pl,it.disabled?COL.text3:it.danger?COL.dangerHover:COL.text,mnx+16,iy,iw-(it.submenu?54:24),ih);
      if(it.submenu){
        var arx=mnx+iw-22, ary=iy+ih/2;
        gr.DrawLine(arx-4,ary-5,arx+1,ary,2,COL.text2);
        gr.DrawLine(arx+1,ary,arx-4,ary+5,2,COL.text2);
      }
      CTX_HB.push({x0:mnx,y0:iy,x1:mnx+iw,y1:iy+ih,act:it.act,menu:'root',disabled:!!it.disabled});
      iy+=ih;
    }
    menu.subRect=null;
    if(menu.kind==='song' && menu.subOpen){
      var dests=songDestinations(menu);
      var dw=172;
      for(i=0;i<dests.length;i++) dw=Math.max(dw,Math.round(gr.CalcTextWidth(dests[i].label,FONT.pl))+36);
      dw=Math.min(dw,Math.max(130,W-22));
      var page=Math.max(1,Math.min(dests.length,Math.floor((H-32-pad*2)/ih)));
      menu.subPage=page;
      menu.subFirst=clampPx(menu.subFirst||0,Math.max(0,dests.length-page));
      var sh=page*ih+pad*2;
      var sx=(mnx+iw+dw<=W-10)?mnx+iw:mnx-dw;
      sx=Math.max(10,Math.min(sx,W-dw-10));
      var sy=Math.max(10,Math.min(parentY-6,H-sh-10));
      menu.subRect={x0:sx,y0:sy,x1:sx+dw,y1:sy+sh};
      gr.FillSolidRect(sx+3,sy+4,dw,sh,RGBA(0,0,0,140));
      gr.FillRoundRect(sx,sy,dw,sh,8,8,RGB(48,48,48));
      for(i=0;i<page;i++){
        var di=i+menu.subFirst,d=dests[di],dy=sy+pad+i*ih;
        if(hv(sx,dy,sx+dw,dy+ih)) gr.FillRoundRect(sx+4,dy,dw-8,ih,5,5,RGBA(255,255,255,25));
        tL(gr,d.label,FONT.pl,COL.text,sx+16,dy,dw-28,ih);
        CTX_HB.push({x0:sx,y0:dy,x1:sx+dw,y1:dy+ih,act:d.act,menu:'sub'});
      }
      if(menu.subFirst>0) tC(gr,'▲',FONT.plSub,COL.text2,sx,sy,dw,12);
      if(menu.subFirst+page<dests.length) tC(gr,'▼',FONT.plSub,COL.text2,sx,sy+sh-14,dw,12);
    }
  }
  if(confirmDel){
    var cw=380, ch=180, cy=Math.round((H-ch)/2), cx=modalPanel(gr,cw,ch,cy);
    var files=confirmDel.kind==='files';
    var lyricDelete=confirmDel.kind==='lyricsdelete';
    var queueClear=confirmDel.kind==='queueclear',clear=confirmDel.kind==='clear'||queueClear;
    tL(gr,lyricDelete?'Delete embedded lyrics?':queueClear?'Clear upcoming tracks?':files?'Delete music files?':clear?'Clear playlist?':'Delete playlist?',FONT.sect,COL.text,cx+28,cy+24,cw-56,26);
    if(lyricDelete){
      tCE(gr,confirmDel.name,FONT.pl,COL.text2,cx+28,cy+58,cw-56,20);
      tL(gr,'Remove lyric tags only. .lrc/.txt files are kept.',FONT.plSub,COL.text2,cx+28,cy+82,cw-56,20);
    }else if(queueClear){
      tL(gr,'Clear all upcoming tracks?',FONT.pl,COL.text2,cx+28,cy+58,cw-56,20);
      tL(gr,'Playback stops after the current track.',FONT.plSub,COL.text2,cx+28,cy+82,cw-56,20);
    }else tL(gr,files?'Delete '+confirmDel.handles.length+' selected track(s) from disk?':clear?'Remove all tracks from "'+confirmDel.name+'"? Music files are kept.':'Remove "'+confirmDel.name+'"? Music files are kept.',FONT.pl,COL.text2,cx+28,cy+58,cw-56,40);
    var cbw=118,cbh=40,cby=cy+ch-cbh-22,buttonGap=14;
    var cccx=cx+(cw-(cbw*2+buttonGap))/2,cdx=cccx+cbw+buttonGap;
    CONF_HB={
      cancel:dlgBtn(gr,cccx,cby,cbw,cbh,'Cancel',RGB(52,52,52),RGB(66,66,66),COL.text),
      del:dlgBtn(gr,cdx,cby,cbw,cbh,clear?'Clear':'Delete',COL.danger,COL.dangerHover,COL.text)
    };
  }
  if(dupPrompt) drawDupPrompt(gr);
  if(rgPrompt) drawRgPrompt(gr);
  // Always last: sort/group dropdowns should cover filtering, list headers and rows.
  // Hit tests use exactly these final-painted rectangles.
  if(plSortMenuOpen) drawSortMenu(gr);
  if(sgMenuOpen) drawGroupMenu(gr);
  if(audioPopup) drawAudioMenu(gr);
  // Status popup is the final non-modal layer, never behind the track list.
  if(rgTipShown) drawRgTip(gr);
}
// wrapped paragraph; returns the y just past the last line drawn
function tPara(gr,s,f,c,x,y,w,lh){
  var wr=gr.EstimateLineWrap(s,f,w);
  for(var i=0;i<wr.length;i+=2){ tL(gr,wr[i],f,c,x,y,w,lh); y+=lh; }
  return y;
}

function drawTitleBar(gr){
  gr.FillSolidRect(0,0,W,TBH,COL.black);
  // menu bar (left): real foobar File / Edit / View / Playback / Library / Help
  HB_MENU=[]; var mx0=12;
  for(var mi=0;mi<MENUS.length;mi++){
    var lbl=MENUS[mi][0], mw=gr.CalcTextWidth(lbl,FONT.menu)+24, mhover=hv(mx0,0,mx0+mw,TBH);
    if(mhover) gr.FillSolidRect(mx0,0,mw,TBH,RGB(40,40,40));
    tC(gr,lbl,FONT.menu,mhover?COL.text:COL.text2,mx0,0,mw,TBH);
    HB_MENU.push({x0:mx0,y0:0,x1:mx0+mw,y1:TBH,root:MENUS[mi][1],mx:mx0});
    mx0+=mw;
  }

}

/* ---- Header dropdowns: a pill that opens a floating menu. Shared by the playlist sort-by and
   the All Songs group-by; items are [label,value] pairs and the menu is drawn last so it
   floats over the track list. ---- */
function drawDropPill(gr,x,y,w,h,label,open){
  gr.FillRoundRect(x,y,w,h,h/2,h/2,(open||hv(x,y,x+w,y+h))?RGB(58,58,58):RGBA(0,0,0,90));
  tL(gr,label,FONT.pl,COL.text,x+18,y,w-46,h);
  drawIcon(gr,'chevron',COL.text2,x+w-32,y+(h-20)/2,20,20,18);
  return {x0:x,y0:y,x1:x+w,y1:y+h};
}
function drawDropMenu(gr,anchor,items,cur,minW,avoid){
  var out=[];
  if(!anchor) return out;
  var bw=Math.max(minW,anchor.x1-anchor.x0), ih=40, iy=anchor.y1, bh=items.length*ih+10;
  // The queue is an overlay on compact windows. Keep the dropdown reachable
  // while still painting it above the entire main view (including Ctrl+F).
  var farRight=(W<1180&&compactQueueOpen&&R.queueW)?R.queue.x-M.gap:R.main.x+R.main.w;
  var bx=Math.max(R.main.x+4,Math.min(anchor.x1-bw,farRight-bw-4));
  gr.FillSolidRect(bx+3,iy+4,bw,bh,RGBA(0,0,0,120));
  gr.FillRoundRect(bx,iy,bw,bh,8,8,RGB(43,43,43));
  for(var i=0;i<items.length;i++){
    var ry=iy+5+i*ih;
    if(hv(bx,ry,bx+bw,ry+ih)) gr.FillRoundRect(bx+4,ry,bw-8,ih,5,5,RGBA(255,255,255,20));
    tL(gr,items[i][0],FONT.pl,(items[i][1]===cur)?COL.accent:COL.text,bx+18,ry,bw-30,ih);
    out.push({x0:bx,y0:ry,x1:bx+bw,y1:ry+ih,v:items[i][1]});
  }
  return out;
}

function drawSortDirBtn(gr,x,y,w,h,enabled){
  // Always paint the same button footprint. Default ignores direction and keeps
  // the last selected arrow as a subdued, non-interactive reminder.
  var over=enabled && hv(x,y,x+w,y+h);
  gr.FillRoundRect(x,y,w,h,h/2,h/2,over?RGB(58,58,58):RGBA(0,0,0,90));
  drawIcon(gr,plSortDir==='asc'?'sortAsc':'sortDesc',enabled?COL.text:COL.text3,x,y,w,h,18);
  HB_PLSORTDIR=enabled?{x0:x,y0:y,x1:x+w,y1:y+h}:null;
}
function drawSortMenu(gr){
  PL_SORT_HB=plSortMenuOpen?drawDropMenu(gr,HB_PLSORT,PL_SORTS,plSort,180):[];
}
function drawGroupMenu(gr){ SG_HB=sgMenuOpen?drawDropMenu(gr,HB_SG,SONGS_GROUPS,songsGroup,216):[]; }
