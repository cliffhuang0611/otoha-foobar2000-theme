/* verdant/views/queue.js -- right sidebar: queue and lyrics tabs
   Part of Verdant, a Spotify-style theme for foobar2000. Loaded by main.js;
   every module shares one global scope, so load order is set there. */

/* Manually-queued rows have no playlist behind them, so their title/artist are formatted per
   handle rather than read from a playlist's meta. Cached by path: the queue redraws on every
   hover inside the panel, and two EvalWithMetadb calls per row per frame is pure interop. */
var qMetaCache={};
var queueDrag=null,queueSelection=null;
var queueScroll=0,QUEUE_MAXPX=0,QUEUE_VIEW=null,SBQ=null,HB_QUEUE_CLEAR=null,queueViewportCache=null,queueViewportStopFlag=null,queueRevealPending=true;
var queueEdgeTimer=null,queuePointer={x:0,y:0};
var playOrderSyncTimer=null;
function stopPlayOrderSync(){if(playOrderSyncTimer!==null){window.ClearTimeout(playOrderSyncTimer);playOrderSyncTimer=null;}}
function schedulePlayOrderSync(){
  if(upNextMutation)return;
  stopPlayOrderSync();
  var q=plman.GetPlaybackQueueContents(),count=q.length-(shuffleHandoffQueueIndex()>=0?1:0);
  if(!count||!(fb.IsPlaying||fb.IsPaused)||fb.StopAfterCurrent)return;
  // Batch native queue additions into one stable sequence. Otherwise native
  // queue consumption would remove rows from the finite order as they play.
  playOrderSyncTimer=window.SetTimeout(function(){
    playOrderSyncTimer=null;
    var q=plman.GetPlaybackQueueContents(),count=q.length-(shuffleHandoffQueueIndex()>=0?1:0);
    if(!count||!(fb.IsPlaying||fb.IsPaused)||fb.StopAfterCurrent)return;
    var entries=playOrderEntries(),current=-1;
    for(var i=0;i<entries.length;i++)if(entries[i].current){current=i;break;}
    if(current>=0){installPlayOrder(entries,current);repaintAll();}
  },100);
}
function stopQueueEdgeScroll(){if(queueEdgeTimer!==null){window.ClearInterval(queueEdgeTimer);queueEdgeTimer=null;}}
function queueEdgeDirection(){
  if(!queueDrag||!queueDrag.moved||!QUEUE_VIEW)return 0;
  var v=QUEUE_VIEW,p=queuePointer;
  if(p.x<v.x0||p.x>=v.x1||p.y<v.y0-20||p.y>v.y1+20)return 0;
  return p.y<v.y0+28?-1:p.y>v.y1-28?1:0;
}
function trackQueueEdgeScroll(x,y){
  queuePointer={x:x,y:y};
  if(!queueEdgeDirection()){stopQueueEdgeScroll();return;}
  if(queueEdgeTimer===null)queueEdgeTimer=window.SetInterval(function(){
    var direction=queueEdgeDirection();
    if(!direction){stopQueueEdgeScroll();return;}
    var next=clampPx(queueScroll+direction*14,QUEUE_MAXPX);
    if(next!==queueScroll){queueScroll=next;queueDrag.target=null;repaintQueue();}
  },40);
}
function setQueueScroll(y){if(SBQ){queueScroll=Math.round(sbFrac(y,SBQ.top,SBQ.h,SBQ.thumbH)*SBQ.maxPx);repaintQueue();}}
function promptClearUpNext(){
  if(!hasUpcomingPlayback())return;
  stopQueueEdgeScroll();queueDrag=null;if(drag==='queue')drag=null;
  ctxMenu=null;confirmDel={kind:'queueclear'};repaintAll();
}
function hasUpcomingPlayback(){
  return upNextEntries(1).length>0||(!(fb.StopAfterCurrent||upNextStopState!==null)&&(fb.IsPlaying||fb.IsPaused)&&pbRepeat>0);
}
function queueHandlesEqual(a,b){
  return !!(a&&b&&a.RawPath===b.RawPath&&a.Path===b.Path&&a.SubSong===b.SubSong);
}
function upNextEntries(limit){
  var out=[],q=plman.GetPlaybackQueueContents(),handoff=shuffleHandoffQueueIndex();
  limit=limit===undefined?Infinity:limit;
  for(var i=0;i<q.length&&out.length<limit;i++)if(i!==handoff)
    out.push({q:i,handle:q[i].Handle});
  if(stoppedPlayback&&!(fb.IsPlaying||fb.IsPaused)){
    var saved=playlistOfName(stoppedPlayback),savedItems=saved>=0?getItems(saved):null;
    if(savedItems)for(var i=stoppedIndex+1;i<savedItems.Count&&out.length<limit;i++)out.push({pl:saved,item:i,handle:savedItems[i]});
    return out;
  }
  if(fb.StopAfterCurrent)return [];
  if(upNextStopState!==null)return out;
  if(!(fb.IsPlaying||fb.IsPaused)&&!(shuffleHandoff&&handoff>=0))return out;
  var loc=playingLoc(),pl=-1,start=0;
  if(shuffleHandoff&&handoff>=0){pl=shuffleHandoff.pl;start=shuffleHandoff.item;}
  else if(pbRepeat===2){
    var current=fb.GetNowPlaying();if(current&&out.length<limit)out.push({handle:current,repeat:true});return out;
  }else{
    // Native queued playlist entries move the playback cursor to their playlist.
    var last=q.length?q[q.length-1]:null;
    if(last&&last.PlaylistIndex>=0){pl=last.PlaylistIndex;start=last.PlaylistItemIndex+1;}
    else if(loc&&loc.IsValid){pl=loc.PlaylistIndex;start=loc.PlaylistItemIndex+1;}
  }
  if(pl<0)return out;
  var items=getItems(pl);
  if(items)for(var i=start;i<items.Count&&out.length<limit;i++)out.push({pl:pl,item:i,handle:items[i]});
  return out;
}
function playOrderEntries(){
  var current=fb.IsPlaying||fb.IsPaused?fb.GetNowPlaying():stoppedTrack();
  var loc=playingLoc(),pl=-1,index=-1,q=plman.GetPlaybackQueueContents(),handoff=shuffleHandoffQueueIndex();
  if(stoppedPlayback&&!(fb.IsPlaying||fb.IsPaused)){pl=playlistOfName(stoppedPlayback);index=stoppedIndex;}
  else if(playOrderPreview&&current&&queueHandlesEqual(current,playOrderPreview.handle)){
    pl=playOrderPreview.pl;index=playOrderPreview.current;
  }else if(shuffleHandoff&&handoff>=0){
    pl=shuffleHandoff.pl;var items=getItems(pl);
    index=shuffleHandoff.item>0?shuffleHandoff.item-1:items.Count-1;
    if(!current||!queueHandlesEqual(items[index],current))index=-1;
  }else if(loc&&loc.IsValid){pl=loc.PlaylistIndex;index=loc.PlaylistItemIndex;}
  var out=[],items=pl>=0?getItems(pl):null;
  if(items)for(var i=0;i<items.Count;i++)out.push({pl:pl,item:i,handle:items[i],current:i===index});
  if(current&&index<0){index=0;out.unshift({handle:current,current:true});}
  var manual=[];
  for(var i=0;i<q.length;i++)if(i!==handoff)manual.push({q:i,handle:q[i].Handle,current:false});
  if(manual.length)out=out.slice(0,index+1).concat(manual,out.slice(index+1));
  if(upNextStopState!==null&&current&&index>=0)out=out.slice(0,index+1);
  return out;
}
function installPlayOrder(entries,currentIndex,playIndex){
  var active=plman.ActivePlaylist,loc=playingLoc(),wasStopped=!!stoppedPlayback&&!(fb.IsPlaying||fb.IsPaused);
  var name=loc&&loc.IsValid&&plman.GetPlaylistName(loc.PlaylistIndex)===QUEUE_ORDER?QUEUE_ORDER_ALT:QUEUE_ORDER;
  var handles=entries.map(function(e){return e.handle;}),target=plman.FindOrCreatePlaylist(name,true);
  upNextMutation++;
  try{
    clearShuffleHandoff();plman.FlushPlaybackQueue();restoreUpNextStop();
    plman.ClearPlaylist(target);plman.InsertPlaylistItems(target,0,songList(handles),false);invalidateItems();
    if(playIndex!==undefined){
      clearStoppedPlayback();playOrderPreview=null;queueRevealPending=true;
      plman.ExecutePlaylistDefaultAction(target,playIndex);
    }else if(wasStopped){stoppedPlayback=name;stoppedIndex=currentIndex;playOrderPreview=null;}
    else if(currentIndex>=0){
      playOrderPreview={pl:target,current:currentIndex,handle:handles[currentIndex]};
      var next=pbRepeat===2?currentIndex:currentIndex+1;
      if(next>=handles.length&&pbRepeat===1)next=0;
      if(next<handles.length)queueShuffleHandoff(target,next);
      else{upNextStopState=!!fb.StopAfterCurrent;fb.StopAfterCurrent=true;}
    }else queueShuffleHandoff(target,0);
    queueViewportCache=null;persistQueueState();
  }finally{plman.ActivePlaylist=active;upNextMutation--;}
}
function upNextEqual(a,b){
  if(a.length!==b.length)return false;
  for(var i=0;i<a.length;i++)if(a[i].q!==b[i].q||a[i].pl!==b[i].pl||a[i].item!==b[i].item||!queueHandlesEqual(a[i].handle,b[i].handle))return false;
  return true;
}
function selectQueueRow(row){queueSelection={index:row.upIndex,handle:row.handle};repaintQueue();}
function paintQueueSelection(gr,row,handle){
  var s=queueSelection;
  if(s&&s.index===row.upIndex&&queueHandlesEqual(s.handle,handle))
    gr.FillRoundRect(row.x0,row.y0,row.x1-row.x0,row.y1-row.y0,6,6,COL.rowActive);
}
var HB_QUEUE_NP=null;
function openQueueMenu(x,y){
  stopQueueEdgeScroll();queueDrag=null;if(drag==='queue')drag=null;
  clearPlaylistNameTooltip();
  var row=hit(HB_Q,x,y),handle=row?row.handle:HB_QUEUE_NP&&inRect(x,y,HB_QUEUE_NP)?HB_QUEUE_NP.handle:null;
  if(handle){
    if(row)selectQueueRow(row);
    openSongMenu(handle,x,y,undefined,undefined,[{handle:handle}],true);
    ctxMenu.items=ctxMenu.items.filter(function(item){return item.act!=='deletefiles';});
    ctxMenu.items.push({separator:true},{label:'Clear upcoming tracks',act:'clearqueue',disabled:!hasUpcomingPlayback()});
    repaintAll();return;
  }
  ctxMenu={kind:'queue',x:x,y:y,items:[{label:'Clear upcoming tracks',act:'clearqueue',disabled:!hasUpcomingPlayback()}]};
  repaintAll();
}
function clearManualQueue(){stopQueueEdgeScroll();installUpNextPlan([]);clearArtistQueueOrder();queueViewportCache=null;queueScroll=0;queueSelection=null;queueDrag=null;if(drag==='queue')drag=null;repaintAll();}
function installUpNextPlan(handles,playNow){
  playOrderPreview=null;
  queueViewportCache=null;
  var wasStopped=!!stoppedPlayback&&!(fb.IsPlaying||fb.IsPaused);
  var current=wasStopped?stoppedTrack():fb.GetNowPlaying(),active=plman.ActivePlaylist,loc=playingLoc();
  if(loc&&loc.IsValid){
    var source=plman.GetPlaylistName(loc.PlaylistIndex);
    if(source===SHUF)queueOrderSource=shufSrcName;
    else if(source!==QUEUE_ORDER&&source!==QUEUE_ORDER_ALT)queueOrderSource=source;
  }
  upNextMutation++;
  try{
    clearShuffleHandoff();plman.FlushPlaybackQueue();restoreUpNextStop();
    if(!handles.length&&!wasStopped){
      if(fb.IsPlaying||fb.IsPaused){upNextStopState=!!fb.StopAfterCurrent;fb.StopAfterCurrent=true;}
      persistQueueState();return;
    }
    // Alternate copies keep the currently playing playlist intact during edits.
    var name=loc&&loc.IsValid&&plman.GetPlaylistName(loc.PlaylistIndex)===QUEUE_ORDER?QUEUE_ORDER_ALT:QUEUE_ORDER;
    var target=plman.FindOrCreatePlaylist(name,true),arr=current?[current].concat(handles):handles.slice();
    var start=current?1:0;
    plman.ClearPlaylist(target);plman.InsertPlaylistItems(target,0,songList(arr),false);invalidateItems();
    if(playNow){clearStoppedPlayback();plman.ExecutePlaylistDefaultAction(target,start);}
    else if(wasStopped){stoppedPlayback=name;stoppedIndex=0;}
    else queueShuffleHandoff(target,start);
    persistQueueState();
  }finally{plman.ActivePlaylist=active;upNextMutation--;}
}
function playUpNextRow(row){
  var entries=playOrderEntries();
  if(!entries[row.upIndex]||!queueHandlesEqual(entries[row.upIndex].handle,row.handle))return;
  installPlayOrder(entries,-1,row.upIndex);queueSelection=null;repaintAll();
}
function beginQueueDrag(row,x,y){
  stopQueueEdgeScroll();
  var loc=playingLoc();
  queueDrag={row:row,x:x,y:y,moved:false,target:null,entries:playOrderEntries(),
    loc:loc&&loc.IsValid?{pl:loc.PlaylistIndex,item:loc.PlaylistItemIndex}:null};
}
function updateQueueDrag(x,y){
  if(!queueDrag)return;
  if(!queueDrag.moved&&Math.abs(x-queueDrag.x)+Math.abs(y-queueDrag.y)<6)return;
  queueDrag.moved=true;drag='queue';queueDrag.target=null;
  trackQueueEdgeScroll(x,y);
  for(var i=0;i<HB_Q.length;i++)if(inRect(x,y,HB_Q[i])){
    var row=HB_Q[i];queueDrag.target={row:row,after:y>=(row.y0+row.y1)/2};break;
  }
  repaintQueue();
}
function finishQueueDrag(){
  stopQueueEdgeScroll();
  try{applyQueueDrag();}
  catch(e){queueDrag=null;drag=null;fb.ShowPopupMessage('Could not reorder Up next: '+String(e),'Verdant');repaintAll();}
}
function applyQueueDrag(){
  var d=queueDrag;queueDrag=null;drag=null;
  if(!d)return;
  if(!d.moved){selectQueueRow(d.row);return;}
  if(!d.target){repaintQueue();return;}
  var entries=playOrderEntries(),loc=playingLoc();
  if(!upNextEqual(d.entries,entries)||!!d.loc!==!!(loc&&loc.IsValid)||(d.loc&&(loc.PlaylistIndex!==d.loc.pl||loc.PlaylistItemIndex!==d.loc.item))){repaintQueue();return;}
  var from=d.row.upIndex,to=d.target.row.upIndex+(d.target.after?1:0);
  if(to>from)to--;
  if(to===from){repaintQueue();return;}
  var entry=entries.splice(from,1)[0];entries.splice(to,0,entry);
  var currentIndex=-1;for(var i=0;i<entries.length;i++)if(entries[i].current){currentIndex=i;break;}
  installPlayOrder(entries,currentIndex);if(entry.current)queueRevealPending=true;
  queueSelection={index:to,handle:entry.handle};repaintAll();
}
function drawQueueDragMarker(gr){
  if(!queueDrag||!queueDrag.moved||!queueDrag.target)return;
  var t=queueDrag.target,row=t.row,y=t.after?row.y1:row.y0;
  gr.FillSolidRect(row.x0,y-1,row.x1-row.x0,2,COL.accent);
}
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
  if(h)drawCover(gr,x,y,cs,4,h,seed,key);
  else{
    gr.FillRoundRect(x,y,cs,cs,6,6,COL.elev);
    var iconSize=Math.round(cs*0.5),inset=(cs-iconSize)/2;
    drawIcon(gr,'music',COL.text3,x+inset,y+inset,iconSize,iconSize,iconSize);
  }
  var tx=x+cs+12, tw=r.w-36-cs-12;
  tL(gr,title,FONT.qName,tcol,tx,y+dy,tw,18);
  tL(gr,artist,FONT.qArtist,COL.text2,tx,y+dy+20,tw,16);
}
function drawQueue(gr){
  drawQueueContents(gr);
  if(queueDrag&&queueDrag.moved){
    queueDrag.target=null;
    for(var i=0;i<HB_Q.length;i++)if(inRect(queuePointer.x,queuePointer.y,HB_Q[i])){
      var row=HB_Q[i];queueDrag.target={row:row,after:queuePointer.y>=(row.y0+row.y1)/2};break;
    }
  }
  drawQueueDragMarker(gr);
}
function drawQueueContents(gr){
  HB_QUEUE_NP=null;
  HB_LY_ACTION=[];
  HB_TABS=[]; HB_Q=[];
  SBQ=null;HB_QUEUE_CLEAR=null;QUEUE_VIEW=null;
  var r=R.queue; panelBg(gr,r,COL.base);
  var headerExtra=W<1180&&compactQueueOpen&&r.w<220?36:0;
  var x=r.x+18;
  var qOn=rightTab==='queue';
  tL(gr,'Queue',FONT.tab,qOn?COL.text:COL.text2,x,r.y+16,80,26);
  tL(gr,'Lyrics',FONT.tab,qOn?COL.text2:COL.text,x+82,r.y+16,80,26);
  gr.FillSolidRect(qOn?x:x+82,r.y+46,qOn?54:50,3,COL.accent);
  HB_TABS.push({x0:x-6,y0:r.y+8,x1:x+72,y1:r.y+48,tab:'queue'});
  HB_TABS.push({x0:x+76,y0:r.y+8,x1:x+152,y1:r.y+48,tab:'lyrics'});

  if(!qOn){
    loadLyrics();
    if(noLyrics()){
      tC(gr,'No lyrics found',FONT.sect,COL.text2,r.x,r.y+Math.round(r.h/2)-28,r.w,24);
      tC(gr,'No embedded lyrics or .lrc/.txt file found.',FONT.qArtist,COL.text3,r.x,r.y+Math.round(r.h/2)+2,r.w,18);
      drawLyricActions(gr,r.x+18,r.y+r.h-48,r.w-36);
      return;
    }
    var viewTop=r.y+64+headerExtra, viewBot=r.y+r.h-84, maxW=r.w-28;
    if(lyrics.synced) drawRollingLyrics(gr,r.x+14,viewTop,maxW,viewBot,FONT.lyric,COL.accent,'c');
    else drawStaticLyrics(gr,r.x+14,maxW,viewTop+6,viewBot,FONT.lyric,0.45);
    drawLyricActions(gr,r.x+18,r.y+r.h-48,r.w-36);
    return;
  }

  var qy=r.y+70+headerExtra;
  tL(gr,stoppedPlayback&&!(fb.IsPlaying||fb.IsPaused)?'Stopped':'Now playing',FONT.sect,COL.text,x,qy,r.w-36,24);qy+=36;
  qEntry(gr,r,x,qy,48,6,NP,'np',undefined,npTitleStr||'Nothing playing',npArtistStr,(fb.IsPlaying||fb.IsPaused)?COL.accent:COL.text);
  if(NP)HB_QUEUE_NP={x0:r.x+10,y0:qy-6,x1:r.x+r.w-24,y1:qy+54,handle:NP};
  qy+=70;

  var rh=56,footerTop=r.y+r.h-54,bottom=footerTop-8;
  tL(gr,'Play order',FONT.sect,COL.text,x,qy,r.w>=260?100:r.w-36,24);
  if(r.w>=260)tR(gr,fb.StopAfterCurrent?'Stops after track':pbRepeat===2?'Repeat one':pbRepeat===1?'Repeat all':'',FONT.plSub,COL.text2,r.x+r.w-142,qy+2,124,20);
  qy+=36;
  if(queueViewportStopFlag!==!!fb.StopAfterCurrent){queueViewportCache=null;queueViewportStopFlag=!!fb.StopAfterCurrent;}
  if(queueViewportCache===null)queueViewportCache=playOrderEntries();
  var entries=queueViewportCache,top=Math.min(qy,bottom),viewH=Math.max(0,bottom-top);
  QUEUE_MAXPX=Math.max(0,entries.length*rh-viewH);
  if(queueRevealPending&&viewH>0){
    for(var i=0;i<entries.length;i++)if(entries[i].current){
      var currentY=i*rh;
      if(currentY<queueScroll)queueScroll=currentY;
      else if(currentY+rh>queueScroll+viewH)queueScroll=currentY+rh-viewH;
      break;
    }
    queueRevealPending=false;
  }
  queueScroll=clampPx(queueScroll,QUEUE_MAXPX);
  QUEUE_VIEW={x0:r.x+8,y0:top,x1:r.x+r.w-20,y1:bottom};
  if(!entries.length){
    if(viewH>=36)tL(gr,fb.StopAfterCurrent?'Stops after this track':(fb.IsPlaying||fb.IsPaused)?'Nothing queued - stops after this track':'Nothing queued',FONT.qArtist,COL.text3,x,top,r.w-36,36);
  }
  for(var i=Math.floor(queueScroll/rh);viewH>0&&i<entries.length;i++){
    var y=top+i*rh-queueScroll;if(y>=bottom)break;
    var e=entries[i],vy0=Math.max(top,y),vy1=Math.min(bottom,y+rh);
    var row={x0:r.x+10,y0:vy0,x1:r.x+r.w-24,y1:vy1,upIndex:i,handle:e.handle};
    var meta=qRowMeta(e.handle),selected=queueSelection&&queueSelection.index===i&&queueHandlesEqual(queueSelection.handle,e.handle);
    var hovered=hv(row.x0,vy0,row.x1,vy1),rowW=r.w-34,isCurrent=!!e.current;
    function paint(g,bx,by){
      if(isCurrent||selected||hovered)g.FillRoundRect(bx,by,rowW,rh-4,6,6,isCurrent||selected?COL.rowActive:COL.rowHover);
      qEntry(g,{w:r.w-30},bx+8,by+6,44,5,e.handle,'playorder'+i,undefined,meta.t,meta.a,isCurrent?COL.accent:COL.text);
      if(isCurrent)drawIcon(g,fb.IsPaused?'pause':fb.IsPlaying?'equalizer':'stop',COL.accent,bx+rowW-17,by+20,14,14,12);
    }
    if(vy0===y&&vy1===y+rh)paint(gr,row.x0,y);
    else{
      var im=gdi.CreateImage(Math.max(1,rowW|0),rh),bg=im.GetGraphics();
      bg.FillSolidRect(0,0,rowW,rh,COL.base);paint(bg,0,0);im.ReleaseGraphics(bg);
      gr.DrawImage(im,row.x0,vy0,rowW,vy1-vy0,0,vy0-y,rowW,vy1-vy0);
    }
    HB_Q.push(row);
  }
  SBQ=drawSBV(gr,r.x+r.w-9,top,viewH,queueScroll,QUEUE_MAXPX,viewH,entries.length*rh,
    hv(r.x,top,r.x+r.w,bottom)||drag==='scrollq'||!!queueDrag,{sw:5,min:30,track:16,on:150,off:80,key:'scrollq'});
  gr.FillSolidRect(r.x+8,footerTop,Math.max(1,r.w-16),54,COL.base);
  gr.DrawLine(r.x+12,footerTop,r.x+r.w-12,footerTop,1,RGBA(255,255,255,24));
  var bx=r.x+14,by=footerTop+10,bw=Math.max(20,r.w-28),enabled=hasUpcomingPlayback();
  gr.FillRoundRect(bx,by,bw,32,8,8,enabled&&hv(bx,by,bx+bw,by+32)?COL.hover:COL.elev);
  tC(gr,r.w<210?'Clear upcoming':'Clear upcoming tracks',FONT.plSub,enabled?COL.text2:COL.text3,bx,by,bw,32);
  HB_QUEUE_CLEAR={x0:bx,y0:by,x1:bx+bw,y1:by+32,disabled:!enabled};
}
