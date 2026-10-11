/* verdant/views/home.js -- home view: playlist shelf + artist grid
   Part of Verdant, a Spotify-style theme for foobar2000. Loaded by main.js;
   every module shares one global scope, so load order is set there. */

var homeViewMode=propStr('Home: view (grid | list)','grid'),HB_HOME_VIEW=[];
var HOME_ART_HEADER_Y=0,HOME_ART_HEADER_H=42;
function homeContentRect(r){return {x:r.x,y:r.y,w:r.w,h:r.h};}
function setHomeViewMode(mode){
  mode=mode==='list'?'list':'grid';
  if(mode===homeViewMode)return;
  homeViewMode=mode;
  try{window.SetProperty('Home: view (grid | list)',homeViewMode);}catch(e){}
  // Both artist layouts share the visible pixel offset. The next paint clamps
  // it to the new layout's actual maximum, rather than restoring a mode bookmark.
  homeScrollT=homeScroll;SBH=null;
  repaintAll();
}
function drawHomeViewToggle(gr,r){
  HB_HOME_VIEW=[];
  var y=Math.max(r.y,HOME_ART_HEADER_Y);
  if(y+HOME_ART_HEADER_H>r.y+r.h)return;
  var left=r.x+M.cpad,label='Artists in your library';
  var right=r.x+r.w-M.cpad-(W<1180&&!compactQueueOpen?48:0);
  var titleW=Math.max(16,Math.min(gr.CalcTextWidth(label,FONT.sect2),right-left-80));
  // Cover fractional image edges too: GDI blits can leave a one-pixel seam
  // above a fill whose coordinates round differently from the scrolling cards.
  var fillX=Math.floor(r.x),fillY=Math.floor(y)-1;
  var fillRight=Math.ceil(r.x+r.w-M.cpad),fillBottom=Math.ceil(y+HOME_ART_HEADER_H);
  gr.FillSolidRect(fillX,fillY,Math.max(1,fillRight-fillX),fillBottom-fillY,COL.base);
  tL(gr,label,FONT.sect2,COL.text,left,y+6,titleW,28);
  var x=left+titleW+12;
  y+=5;
  for(var i=0;i<2;i++){
    var mode=i?'list':'grid',bx=x+i*34;
    gr.FillRoundRect(bx,y,30,30,8,8,homeViewMode===mode?COL.rowActive:COL.elev);
    drawIcon(gr,mode,homeViewMode===mode?COL.green:COL.text2,bx,y,30,30,17);
    HB_HOME_VIEW.push({x0:bx,y0:y,x1:bx+30,y1:y+30,mode:mode});
  }
}
function drawHomeArtistListRow(gr,x,y,w,a,top,bottom){
  var h=64,vy0=Math.max(y,top),vy1=Math.min(y+h,bottom);
  if(vy1<=vy0)return;
  var hov=hv(x,vy0,x+w,vy1);
  function paint(g,bx,by){
    if(hov)g.FillRoundRect(bx,by,w,h-4,6,6,COL.rowHover);
    drawCircle(g,bx+8,by+8,44,artistCover(a.name,a.handle),a.name);
    tL(g,a.name,FONT.pl,COL.text,bx+64,by+10,w-72,22);
    var count=artistTracksMap&&artistTracksMap[a.name]?artistTracksMap[a.name].length:0;
    tL(g,count+' songs',FONT.plSub,COL.text2,bx+64,by+34,w-72,18);
  }
  if(vy0===y&&vy1===y+h)paint(gr,x,y);
  else{
    var im=gdi.CreateImage(Math.max(1,w|0),h),bg=im.GetGraphics();
    bg.FillSolidRect(0,0,w,h,COL.base);paint(bg,0,0);im.ReleaseGraphics(bg);
    gr.DrawImage(im,x,vy0,w,vy1-vy0,0,vy0-y,w,vy1-vy0);
  }
  HB_CARD.push({x0:x,y0:vy0,x1:x+w,y1:vy1,kind:'artist',id:a.name});
}
function drawHome(gr,r){
  HB_HOME_VIEW=[];
  HB_CARD=[];
  var content=homeContentRect(r);
  if(content.h>0){
    drawHomeGrid(gr,content);
  }else{SB=null;SBH=null;}
  drawHomeViewToggle(gr,r);
  // The sticky heading covers artist rows; their click targets must start below it.
  var headerBottom=Math.max(r.y,HOME_ART_HEADER_Y)+HOME_ART_HEADER_H;
  for(var i=0;i<HB_CARD.length;i++)if(HB_CARD[i].kind==='artist'){
    HB_CARD[i].y0=Math.max(HB_CARD[i].y0,headerBottom);
  }
}
function drawHomeGrid(gr,r){
  HB_CARD=[];
  var pad=M.cpad, x0=r.x+pad, w=r.w-pad*2, rightEdge=r.x+r.w, i;
  // Below this width, neither a card nor its cover is meaningful; keep the view safe.
  if(!isFinite(w) || w<32 || r.h<=0) return;
  // At narrow viewport widths, prefer more compact cards over filling the row with
  // three oversized ones. Desktop maintains the original ~176px card pitch.
  var compact=r.w<850;
  var gap=compact?12:16;
  var targetW=compact?132:176;
  var cols=Math.max(1,Math.floor((Math.max(0,w)+gap)/(targetW+gap)));
  var availableW=Math.max(0,w-gap*(cols-1));
  var cardW=Math.max(25,Math.floor(availableW/cols));
  // When only one column fits, avoid making a massive square artwork card.
  cardW=Math.min(cardW,compact?170:220);
  if(w<25) return;
  var cardH=cardW+56;
  // ---- geometry ----
  var shelfTitleY=r.y+18, shelfY=shelfTitleY+42;
  var pls=visiblePlaylists();
  // The playlist shelf is not a CSS grid: don't distribute spare width into
  // the cards when there are only a few playlists.
  var scardW=compact?Math.min(140,cardW):((pls.length>cols)?Math.max(25,Math.floor((Math.max(0,w)-cols*gap)/(cols+0.4))):cardW);
  var scardH=scardW+56;
  var artTitleY=shelfY+scardH+(pls.length>cols?26:16), gy=artTitleY+42;   // artist grid top
  var artistListMode=homeViewMode==='list',artistCols=artistListMode?1:cols;
  var artistHeight=artistListMode?64:cardH;
  var cropY=r.y+r.h,rowStep=artistListMode?64:cardH+8,viewH=r.h;
  // The shelf and artist grid share a single vertical page scroll.
  var pageHeaderH=gy-r.y;
  // The artist grid waits on getArtistList (a full-library TF pass); the shelf does not -- playlist
  // names and counts are available immediately, so it renders real cards straight away and its
  // covers fill in as they arrive, which is what Spotify does with data it already has.
  var listReady=ensureBuilt('arts',function(){ return artistList!==null; },
                            function(){ return [function(){ libTF('artistName'); },function(){ getArtistList(); }]; });
  var arts=listReady?artistList:[];
  /* The shelf holds its reveal until its covers are in: a 2x2 mosaic with two of four albums looks
     broken rather than merely unfinished, and it is only ~20 cards, so the wait is about a second.
     The artist grid does NOT wait on artwork -- it is 250+ cards, the wait would be several
     seconds, and its fallback is a seeded colour per artist rather than a grey box. It appears as
     soon as the names are known and fills in, which is also what Spotify does once it has data. */
  var shelfReady=ensureBuilt('shelfh',function(){ return shelfHandles!==null; },function(){ return shelfSteps(pls); })
                 && gateReady('shelf',shelfHandles);
  var artsReady=listReady;
  if(artsReady && !warmed['home']){ warmed['home']=1; startWarmHome(arts,pls); }
  var totalRows=Math.max(1,Math.ceil(arts.length/artistCols)), contentH=pageHeaderH+totalRows*rowStep, maxPx=Math.max(0,contentH-viewH);
  HOME_MAXROW=artsReady?maxPx:Math.max(maxPx,homeScroll,homeScrollT);
  if(artsReady){homeScroll=clampPx(homeScroll,maxPx);homeScrollT=clampPx(homeScrollT,maxPx);}
  HOME_ART_HEADER_Y=artTitleY-homeScroll;

  // ---- 1) Artist grid, scrolling with the whole Home page ----
  var artistTop=gy-homeScroll;
  var viewportTop=r.y;
  if(!artsReady){
    var sy=Math.max(viewportTop,artistTop);
    if(sy<cropY && (listReady || skelVisible('arts'))){
      skelCardsCached(gr,x0,sy,w,cropY-sy,cardW,gap);
      shimmer(gr,x0,sy,w,cropY-sy);
    }
  } else {
    var first=Math.max(0,Math.floor(Math.max(0,homeScroll-pageHeaderH)/rowStep)*artistCols);
    for(i=first;i<arts.length;i++){
      var col=i%artistCols,row=Math.floor(i/artistCols);
      var ay=artistTop+row*rowStep;
      if(ay>=cropY) break;
      if(ay+artistHeight<=viewportTop) continue;
      // The cached bitmap path clips partially visible rows at the viewport's top.
      if(artistListMode)drawHomeArtistListRow(gr,x0,ay,w,arts[i],viewportTop,cropY);
      else drawArtistCard(gr,x0+col*(cardW+gap),ay,cardW,arts[i],viewportTop,cropY);
    }
  }

  // ---- 2) The playlist shelf and both headings move together as one region ----
  // Render the header to a small offscreen surface and blit only its visible slice;
  // this prevents its covers/title from drawing above the main panel when scrolled.
  var visibleHeaderH=Math.min(pageHeaderH,Math.max(0,pageHeaderH-homeScroll));
  HOME_SHELF_Y0=shelfY-homeScroll;
  HOME_SHELF_Y1=HOME_SHELF_Y0+scardH;
  var stride=scardW+gap, shelfW=Math.max(0,pls.length*stride-gap);
  HOME_PLMAX=Math.max(0,shelfW-w); HOME_STRIDE=stride;
  plScroll=clampPx(plScroll,HOME_PLMAX); plScrollT=clampPx(plScrollT,HOME_PLMAX);
  if(visibleHeaderH>0){
    var bmp=gdi.CreateImage(Math.max(1,r.w|0),Math.max(1,pageHeaderH|0));
    var bg=bmp.GetGraphics(), bx=pad, by=shelfY-r.y;
    bg.FillSolidRect(0,0,r.w,pageHeaderH,COL.base);
    tL(bg,'Your Playlists',FONT.sect2,COL.text,bx,shelfTitleY-r.y,w,28);
    // Temporarily translate hover coordinates for card painting into the bitmap.
    var oldMx=mx, oldMy=my, cardStart=HB_CARD.length;
    mx-=r.x; my-=r.y-homeScroll;
    try {
      if(!shelfReady){
        skelCardsCached(bg,bx,by,w,scardH,scardW,gap);
        shimmer(bg,bx,by,w,scardH);
      } else {
        for(i=Math.floor(plScroll/stride);i<pls.length;i++){
          var cx=Math.round(bx+i*stride-plScroll);
          if(cx>=bx+w) break;
          // Use the same content boundary as the shelf scrollbar. The remaining
          // right-hand gutter belongs to the full-page vertical scrollbar.
          drawPlaylistCard(bg,cx,by,scardW,pls[i],bx,bx+w);
        }
      }
      var sbY=by+scardH+6;
      drawScrollbarH(bg,bx,sbY,w,plScroll,HOME_PLMAX,w,shelfW,
        hv(bx,by,bx+w,sbY+10)||drag==='scrollh');
    } finally { mx=oldMx; my=oldMy; }
    // Card hitboxes were recorded in bitmap-local coordinates.
    for(i=cardStart;i<HB_CARD.length;i++){
      var h=HB_CARD[i]; h.x0+=r.x; h.x1+=r.x;
      h.y0+=r.y-homeScroll; h.y1+=r.y-homeScroll;
      h.y0=Math.max(h.y0,r.y); h.y1=Math.min(h.y1,r.y+visibleHeaderH);
      if(h.y1<=h.y0) h.y1=h.y0;
    }
    if(SBH){
      SBH.x0+=r.x; SBH.x1+=r.x; SBH.left+=r.x;
      SBH.y0+=r.y-homeScroll; SBH.y1+=r.y-homeScroll;
      SBH.top+=r.y-homeScroll;
      if(SBH.y1<=r.y || SBH.y0>=r.y+visibleHeaderH) SBH=null;
      else { SBH.y0=Math.max(SBH.y0,r.y); SBH.y1=Math.min(SBH.y1,r.y+visibleHeaderH); }
    }
    bmp.ReleaseGraphics(bg);
    gr.DrawImage(bmp,r.x,r.y,r.w,visibleHeaderH,0,homeScroll,r.w,visibleHeaderH);
  } else SBH=null;

  // Full-page scrollbar (rather than artist-grid-only).
  drawScrollbar(gr,x0+w+8,r.y,r.h,homeScroll,maxPx,r.h,contentH,
    hv(x0,r.y,x0+w+16,cropY)||drag==='scroll');
}
