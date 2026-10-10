/* verdant/views/album.js -- a dedicated album page opened from search results. */
function drawAlbum(gr,r){
  HB_TR=[]; HB_ALBBACK=null;
  if(!viewAlbum) return;
  var a=viewAlbum,pad=M.cpad,x0=r.x+pad,w=r.w-pad*2,art=Math.min(150,Math.max(76,Math.floor(w*0.28)));
  gr.FillGradRect(r.x,r.y,r.w,218,90,blend(artHue(a.handle,a.album),COL.base,0.44),COL.base,1.0);
  var bx=r.x+10,by=r.y+8,bw=32,bh=32;
  HB_ALBBACK={x0:bx,y0:by,x1:bx+bw,y1:by+bh};
  if(hv(bx,by,bx+bw,by+bh)) gr.FillRoundRect(bx,by,bw,bh,8,8,RGBA(255,255,255,28));
  var ac=hv(bx,by,bx+bw,by+bh)?COL.text:COL.text2,ax=bx+9,ay=by+16;
  gr.DrawLine(ax+13,ay,ax,ay,2,ac); gr.DrawLine(ax,ay,ax+6,ay-6,2,ac); gr.DrawLine(ax,ay,ax+6,ay+6,2,ac);
  drawRounded(gr,x0,r.y+38,art,8,a.handle,a.album);
  var tx=x0+art+20,tw=Math.max(30,w-art-20);
  tL(gr,'ALBUM',FONT.eyebrow,COL.text,tx,r.y+44,tw,18);
  tL(gr,a.album,fitHeaderFont(gr,a.album,tw),COL.text,tx,r.y+70,tw,60);
  tL(gr,a.artist+(a.year?('  '+CH_DOT+'  '+a.year):'')+'  '+CH_DOT+'  '+(a.display.taggedDiscCount>1?a.display.taggedDiscCount+' discs  '+CH_DOT+'  ':'')+a.tracks.length+' songs',FONT.meta,COL.text2,tx,r.y+152,tw,22);
  var top=r.y+226,bot=r.y+r.h-10,rh=44,viewH=Math.max(1,bot-top);
  var listing=a.display||albumDisplayRows(a.tracks),rows=listing.rows;
  ALBUM_MAXPX=Math.max(0,listing.height+12-viewH);
  albumScroll=clampPx(albumScroll,ALBUM_MAXPX);
  for(var i=0;i<rows.length;i++){
    var row=rows[i],y=top+row.y-albumScroll,rowH=row.h;
    if(y+rowH<=top) continue;
    if(y>=bot) break;
    var yy=Math.max(top,y),yb=Math.min(bot,y+rowH);
    if(row.kind==='disc'){
      if(y>=top && y+rowH<=bot){
        var label=row.discNo?'Disc '+row.discNo:'Disc number not tagged';
        gr.DrawLine(x0,y+rowH-2,x0+w,y+rowH-2,1,COL.line);
        tL(gr,label,FONT.meta,COL.text2,x0+2,y+6,w-4,rowH-8);
      }
      continue;
    }
    var tr=a.tracks[row.idx];
    if(isTrackSelected({album:true,idx:row.idx})) gr.FillRoundRect(x0-8,y,w+16,rowH,4,4,COL.rowActive);
    else if(hv(x0-8,yy,x0+w+8,yb)) gr.FillRoundRect(x0-8,y,w+16,rowH,4,4,COL.rowHover);
    if(y>=top && y+rowH<=bot){
      tL(gr,tr.trackNo?String(tr.trackNo):'',FONT.rowNum,COL.text2,x0,y,26,rowH);
      tL(gr,tr.title,FONT.rowTitle,COL.text,x0+36,y,w-36-64,rowH);
      tR(gr,tr.len,FONT.rowCell,COL.text2,x0+w-60,y,60,rowH);
    }
    if(yb>yy) HB_TR.push({x0:x0-8,y0:yy,x1:x0+w+8,y1:yb,album:true,idx:row.idx});
  }
  gr.FillSolidRect(r.x,bot,r.w,r.y+r.h-bot,COL.base);
  drawScrollbar(gr,x0+w+8,top,viewH,albumScroll,ALBUM_MAXPX,viewH,listing.height+12,hv(x0,top,x0+w+16,bot));
}
