/* verdant/views/artist.js -- artist view
   Part of Verdant, a Spotify-style theme for foobar2000. Loaded by main.js;
   every module shares one global scope, so load order is set there. */

function drawArtist(gr,r){
  HB_TR=[];
  var pad=M.cpad, x0=r.x+pad, w=r.w-pad*2, bottom=r.y+r.h-12, i;
  // header artwork = the artist's first album that actually HAS art. artistAlbums is already one
  // entry per album, so it is the candidate list directly -- no scan, no dedupe (art loads async)
  var cands=[]; for(i=0;i<artistAlbums.length && i<COVER_CANDS;i++) if(artistAlbums[i].handle) cands.push(artistAlbums[i].handle);
  var picked=coverPick('av|'+viewArtist,cands,1);
  var cover=picked.list.length?picked.list[0]:(cands.length?cands[0]:null);
  gr.FillGradRect(r.x,r.y,r.w,220,90,blend(artHue(cover,viewArtist),COL.base,0.44),COL.base,1.0);
  // Subtle icon-only back action, aligned to the header's top-left corner.
  HB_ARTBACK=null;
  if(r.w>=72){
    var bx=r.x+10, by=r.y+8, bw=32, bh=32;
    HB_ARTBACK={x0:bx,y0:by,x1:bx+bw,y1:by+bh};
    var backHover=hv(bx,by,bx+bw,by+bh);
    if(backHover) gr.FillRoundRect(bx,by,bw,bh,8,8,RGBA(255,255,255,28));
    // An outline arrow instead of text, using the theme's neutral icon palette.
    var ax=bx+9, ay=by+16;
    gr.DrawLine(ax+13,ay,ax,ay,2,backHover?COL.text:COL.text2);
    gr.DrawLine(ax,ay,ax+6,ay-6,2,backHover?COL.text:COL.text2);
    gr.DrawLine(ax,ay,ax+6,ay+6,2,backHover?COL.text:COL.text2);
  }
  var art=150, ay=r.y+34;
  drawCircle(gr,x0,ay,art,cover,viewArtist);
  var tx=x0+art+24, tw=w-art-24, songs=0;
  for(i=0;i<artistAlbums.length;i++) songs+=artistAlbums[i].tracks.length;
  tL(gr,'ARTIST',FONT.eyebrow,COL.text,tx,ay+10,tw,18);
  tL(gr,viewArtist,fitHeaderFont(gr,viewArtist,tw),COL.text,tx,ay+30,tw,70);
  tL(gr,artistAlbums.length+' albums '+CH_DOT+' '+songs+' songs in your library',FONT.meta,COL.text2,tx,ay+112,tw,22);
  ART_MAXBLOCK=Math.max(0,artistAlbums.length-1);
  var y=r.y+236;
  for(var b=artScroll;b<artistAlbums.length;b++){
    if(y+96>bottom) break;
    var al=artistAlbums[b];
    drawRounded(gr,x0,y,72,6,al.handle,al.album);
    tL(gr,al.album,FONT.sect2,COL.text,x0+88,y+6,w-88,26);
    tL(gr,(al.year||'')+' '+CH_DOT+' '+al.tracks.length+' songs',FONT.meta,COL.text2,x0+88,y+38,w-88,20);
    var ty=y+84, rows=al.display?al.display.rows:albumDisplayRows(al.tracks).rows;
    for(var ri=(b===artScroll?artistRowStart:0);ri<rows.length;ri++){
      var row=rows[ri];
      if(row.kind==='disc'){
        if(ty+30>bottom) break;
        gr.DrawLine(x0,ty+28,x0+w,ty+28,1,COL.line);
        tL(gr,row.discNo?'Disc '+row.discNo:'Disc number not tagged',FONT.meta,COL.text2,x0+2,ty+4,w-4,22);
        ty+=34;continue;
      }
      if(ty+40>bottom) break;
      var t=row.idx,tr=al.tracks[t];
      if(isTrackSelected({lib:true,block:b,idx:t})) gr.FillRoundRect(x0-8,ty,(r.x+r.w-pad+8)-(x0-8),40,4,4,COL.rowActive);
      else if(hv(x0-8,ty,r.x+r.w-pad+8,ty+40)) gr.FillRoundRect(x0-8,ty,(r.x+r.w-pad+8)-(x0-8),40,4,4,COL.rowHover);
      tL(gr,tr.trackNo?String(tr.trackNo):'',FONT.rowNum,COL.text2,x0,ty,26,40);
      tL(gr,tr.title,FONT.rowTitle,COL.text,x0+36,ty,w-36-64,40);
      tR(gr,tr.dur,FONT.rowCell,COL.text2,r.x+r.w-pad-60,ty,60,40);
      HB_TR.push({x0:x0-8,y0:ty,x1:r.x+r.w-pad+8,y1:ty+40,lib:true,block:b,idx:t});
      ty+=40;
    }
    y=ty+22;
  }
}
