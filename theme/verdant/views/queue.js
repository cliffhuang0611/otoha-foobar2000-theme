/* verdant/views/queue.js -- right sidebar: queue and lyrics tabs
   Part of Verdant, a Spotify-style theme for foobar2000. Loaded by main.js;
   every module shares one global scope, so load order is set there. */

/* Manually-queued rows have no playlist behind them, so their title/artist are formatted per
   handle rather than read from a playlist's meta. Cached by path: the queue redraws on every
   hover inside the panel, and two EvalWithMetadb calls per row per frame is pure interop. */
var qMetaCache={};
function qRowMeta(h){
  var p=h.Path, e=qMetaCache[p];
  if(!e) e=qMetaCache[p]={t:TF.title.EvalWithMetadb(h), a:TF.artist.EvalWithMetadb(h)};
  return e;
}
// hover cue + click target for one queue row; rows are rh apart so the boxes tile exactly
function qRow(gr,r,x,qy,rh){
  var x0=x-8, y0=qy-6, x1=r.x+r.w-10, y1=qy+rh-6;
  if(hv(x0,y0,x1,y1)) gr.FillRoundRect(x0,y0,x1-x0,y1-y0,6,6,COL.rowHover);
  return {x0:x0,y0:y0,x1:x1,y1:y1};
}
// cover + title + artist, the layout every queue entry shares
function qEntry(gr,r,x,y,cs,dy,h,seed,key,title,artist,tcol){
  drawCover(gr,x,y,cs,4,h,seed,key);
  var tx=x+cs+12, tw=r.w-36-cs-12;
  tL(gr,title,FONT.qName,tcol,tx,y+dy,tw,18);
  tL(gr,artist,FONT.qArtist,COL.text2,tx,y+dy+20,tw,16);
}
function drawQueue(gr){
  HB_TABS=[]; HB_Q=[];
  var r=R.queue; panelBg(gr,r,COL.base);
  var headerExtra=W<1180&&compactQueueOpen&&r.w<220?36:0;
  var x=r.x+18;
  var qOn=rightTab==='queue';
  tL(gr,'Queue',FONT.tab,qOn?COL.text:COL.text2,x,r.y+16,80,26);
  tL(gr,'Lyrics',FONT.tab,qOn?COL.text2:COL.text,x+82,r.y+16,80,26);
  gr.FillSolidRect(qOn?x:x+82,r.y+46,qOn?54:50,3,COL.green);
  HB_TABS.push({x0:x-6,y0:r.y+8,x1:x+72,y1:r.y+48,tab:'queue'});
  HB_TABS.push({x0:x+76,y0:r.y+8,x1:x+152,y1:r.y+48,tab:'lyrics'});

  if(!qOn){
    loadLyrics();
    if(noLyrics()){
      tC(gr,'No lyrics found',FONT.sect,COL.text2,r.x,r.y+Math.round(r.h/2)-28,r.w,24);
      tC(gr,'No embedded lyrics or .lrc/.txt file found.',FONT.qArtist,COL.text3,r.x,r.y+Math.round(r.h/2)+2,r.w,18);
      return;
    }
    var viewTop=r.y+64+headerExtra, viewBot=r.y+r.h-16, maxW=r.w-28;
    if(lyrics.synced) drawRollingLyrics(gr,r.x+14,viewTop,maxW,viewBot,FONT.lyric,COL.green,'c');
    else drawStaticLyrics(gr,r.x+14,maxW,viewTop+6,viewBot,FONT.lyric,0.45);
    return;
  }

  var qy=r.y+70+headerExtra;
  tL(gr,'Now playing',FONT.sect,COL.text,x,qy,r.w-36,24); qy+=36;
  qEntry(gr,r,x,qy,48,6,NP,'np',undefined,npTitleStr||'Nothing playing',npArtistStr,(fb.IsPlaying||fb.IsPaused)?COL.green:COL.text);
  qy+=70;

  var rh=56, bottom=r.y+r.h-8, shown=0, qi;
  // real manual queue (explicitly-queued tracks) first, if any
  var mq=null; try{ mq=plman.GetPlaybackQueueHandles(); }catch(e){ mq=null; }
  if(mq && mq.Count){
    tL(gr,'Next in queue',FONT.sect,COL.text,x,qy,r.w-110,24); qy+=36;
    for(qi=0;qi<mq.Count && shown<18;qi++){
      if(qy+rh>bottom) break;
      var qh=mq[qi]; if(!qh) continue;
      var qhb=qRow(gr,r,x,qy,rh); qhb.q=qi; HB_Q.push(qhb);
      var qm=qRowMeta(qh);
      qEntry(gr,r,x,qy,44,5,qh,'mq'+qi,undefined,qm.t,qm.a,COL.text);
      qy+=rh; shown++;
    }
    qy+=10;
  }
  // loop-one: playback just repeats the current song, so show only that
  if(pbRepeat===2){
    if(NP && qy+rh+30<bottom){
      tL(gr,'Repeating this song',FONT.sect,COL.text,x,qy,r.w-36,24); qy+=36;
      qEntry(gr,r,x,qy,44,5,NP,'np',undefined,npTitleStr,npArtistStr,COL.green);
    }
    return;
  }
  // "Next up" from the playing playlist
  var loc=playingLoc();
  var pli=(loc&&loc.IsValid)?loc.PlaylistIndex:plman.ActivePlaylist;
  var start=(loc&&loc.IsValid)?loc.PlaylistItemIndex+1:0;
  var rawnm=(pli>=0)?plName(pli):'';
  var pnm=(rawnm===SHUF)?shufSrcName:(rawnm===ROUTE?'':rawnm);   // show the real source, not the hidden copy
  if(qy+30<bottom){
    tL(gr,pnm?('Next from: '+pnm):'Next up',FONT.sect,COL.text,x,qy,r.w-110,24); qy+=36;
    // The playing playlist's metadata is built on ticks like everywhere else -- this runs on the
    // first paint whatever view you are in, so calling getMeta() inline stalled startup on a large
    // playlist even when you were nowhere near it.
    if(pli>=0 && !ensureBuilt('meta'+pli,function(){ return metaReady(pli); },function(){ return metaSteps(pli); })){
      if(skelVisible('meta'+pli)) skelRows(gr,x,qy,r.w-36,Math.min(bottom-qy,rh*4),rh);
    }
    else if(pli>=0){
      var items=getItems(pli), qmeta=getMeta(pli), cnt=plCount(pli);
      for(var k=start;k<cnt&&shown<20;k++){
        if(qy+rh>bottom) break;
        var h=items[k]; if(!h) continue;
        var nhb=qRow(gr,r,x,qy,rh); nhb.pl=pli; nhb.item=k; HB_Q.push(nhb);
        qEntry(gr,r,x,qy,44,5,h,qmeta.album[k]||String(k),qmeta.artkey[k],qmeta.title[k],qmeta.artist[k],COL.text);
        qy+=rh; shown++;
      }
      if(shown===0) tL(gr,'End of playlist',FONT.qArtist,COL.text3,x,qy,r.w-36,18);
    }
  }
}
