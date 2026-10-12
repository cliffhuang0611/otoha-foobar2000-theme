/* verdant/views/bar.js -- bottom playback bar
   Part of Verdant, a Spotify-style theme for foobar2000. Loaded by main.js;
   every module shares one global scope, so load order is set there. */

function ctrlBtn(gr,name,cx,cyc,active,act,rad,isz){
  rad=rad||18; isz=isz||22;
  var hot=hv(cx-rad,cyc-rad,cx+rad,cyc+rad);
  drawIcon(gr,name,active?accentState(hot):(hot?COL.text:COL.text2),cx-rad,cyc-rad,rad*2,rad*2,isz);
  HB_CTRL.push({x0:cx-rad,y0:cyc-rad,x1:cx+rad,y1:cyc+rad,act:act});
}
// seek / volume track: filled progress on a dim rail, with a generously padded hitbox
function drawTrackBar(gr,x,y,w,th,trackCol,pos){
  gr.FillSolidRect(x,y,w,th,trackCol);
  if(pos>0) gr.FillSolidRect(x,y,Math.max(1,Math.round(w*pos)),th,COL.text);
  return {x0:x,y0:y-10,x1:x+w,y1:y+10+th,x:x,w:w};
}
function drawBar(gr){
  HB_CTRL=[];
  var by=R.barY;
  gr.FillSolidRect(0,by,W,M.barH,COL.black);
  var playing=fb.IsPlaying&&!fb.IsPaused;
  // left: cover + title/artist
  var cs=64, cx=16, cy=by+(M.barH-cs)/2;
  if(NP)drawCover(gr,cx,cy,cs,5,NP,'np');
  else{gr.FillRoundRect(cx,cy,cs,cs,8,8,COL.elev);drawIcon(gr,'music',COL.text3,cx+16,cy+16,32,32,26);}
  var tx=cx+cs+14;
  var titleWidth=Math.max(0,Math.min(260,Math.round(W/2)-174-tx));
  if(titleWidth>20){
    var queued=!NP&&upNextEntries(1).length>0;
    tL(gr,NP?npTitleStr:queued?'Ready to play':'Nothing playing',FONT.npTitle,NP?COL.text:COL.text2,tx,by+26,titleWidth,20);
    tL(gr,NP?npArtistStr:queued?'Tracks waiting in Up next':'Choose a track to begin',FONT.npArtist,COL.text2,tx,by+50,titleWidth,18);
  }
  // center: transport row + seekbar
  var cxC=Math.round(W/2);
  var pcy=by+34, pb=hv(cxC-27,by+7,cxC+27,by+61)?52:48, pbx=cxC-pb/2, pby=pcy-pb/2;
  ctrlBtn(gr,'stop',cxC-108,pcy,false,'stop',22,22);
  ctrlBtn(gr,'prev',cxC-58,pcy,false,'prev',22,26);
  gr.FillEllipse(pbx,pby,pb,pb,COL.text);
  drawIcon(gr,playing?'pause':'play',COL.black,pbx,pby,pb,pb,Math.round(pb*0.5));
  HB_CTRL.push({x0:pbx,y0:pby,x1:pbx+pb,y1:pby+pb,act:'play'});
  ctrlBtn(gr,'next',cxC+58,pcy,false,'next',22,26);
  ctrlBtn(gr,'shuffle',cxC+108,pcy,pbShuffle,'shuffle',18,22);
  ctrlBtn(gr,pbRepeat===2?'repeat1':'repeat',cxC+146,pcy,pbRepeat>0,'repeat',18,22);
  var sbW=Math.min(Math.round(W*0.36),560), sbX=cxC-sbW/2, sbY=by+74;
  var len=fb.PlaybackLength, pos=(drag==='seek')?dragFrac:(len>0?fb.PlaybackTime/len:0);
  HB_SEEK=drawTrackBar(gr,sbX,sbY,sbW,5,COL.seekbg,pos);
  tR(gr,fmtTime((drag==='seek')?len*dragFrac:fb.PlaybackTime),FONT.time,COL.text2,sbX-54,sbY-7,46,17);
  tL(gr,fmtTime(len),FONT.time,COL.text2,sbX+sbW+10,sbY-7,46,17);
  // right: volume + fullscreen
  var gearC=by+M.barH/2, fsx=W-46;
  drawIcon(gr,'expand',hv(fsx-8,gearC-16,fsx+30,gearC+16)?COL.text:COL.text2,fsx,gearC-13,26,26,22);
  HB_CTRL.push({x0:fsx-8,y0:gearC-16,x1:fsx+30,y1:gearC+16,act:'fullscreen'});
  var volW=104, volX=fsx-24-volW, volY=gearC-2;
  // One icon to the left of volume (EOLE-style Output / DSP submenu).
  // Hide on narrow layouts rather than overlap Repeat or Volume.
  HB_AUDIO=[];
  var audioX=volX-78, audioY=gearC-18;
  if(audioX>=cxC+172){
    var ah=36, ahov=hv(audioX,audioY,audioX+36,audioY+ah);
    drawIcon(gr,'audioSettings',fb.StopAfterCurrent?accentState(ahov):(ahov||audioPopup)?COL.text:COL.text2,audioX,audioY,36,ah,22);
    HB_AUDIO.push({x0:audioX,y0:audioY,x1:audioX+36,y1:audioY+ah});
  }
  drawIcon(gr,'volume',COL.text2,volX-32,gearC-13,26,26,22);
  HB_VOL=drawTrackBar(gr,volX,volY,volW,5,COL.seekbg,clamp01(vol2pos(fb.Volume)));
}
