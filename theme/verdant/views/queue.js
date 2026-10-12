/* verdant/views/queue.js -- right sidebar: queue and lyrics tabs
   Part of Verdant, a Spotify-style theme for foobar2000. Loaded by main.js;
   every module shares one global scope, so load order is set there. */

/* Manually-queued rows have no playlist behind them, so their title/artist are formatted per
   handle rather than read from a playlist's meta. Cached by path: the queue redraws on every
   hover inside the panel, and two EvalWithMetadb calls per row per frame is pure interop. */
var qMetaCache={};
var queueDrag=null,queueSelection=null;
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
    if(savedItems)for(var i=1;i<savedItems.Count&&out.length<limit;i++)out.push({pl:saved,item:i,handle:savedItems[i]});
    return out;
  }
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
  // Repeat-all adds the wrapped prefix; repeat-off never wraps to the beginning.
  if(pbRepeat===1&&items)for(var i=0;i<Math.min(start,items.Count)&&out.length<limit;i++)out.push({pl:pl,item:i,handle:items[i],wrap:true});
  return out;
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
function openQueueMenu(x,y){
  clearPlaylistNameTooltip();
  ctxMenu={kind:'queue',x:x,y:y,items:[{label:'Clear Up next',act:'clearqueue',disabled:upNextEntries(1).length===0}]};
  repaintAll();
}
function clearManualQueue(){installUpNextPlan([]);queueSelection=null;queueDrag=null;if(drag==='queue')drag=null;repaintAll();}
function installUpNextPlan(handles,playNow){
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
    else if(wasStopped)stoppedPlayback=name;
    else queueShuffleHandoff(target,start);
    persistQueueState();
  }finally{plman.ActivePlaylist=active;upNextMutation--;}
}
function playUpNextRow(row){
  var entries=upNextEntries();
  if(!entries[row.upIndex]||!queueHandlesEqual(entries[row.upIndex].handle,row.handle))return;
  installUpNextPlan(entries.slice(row.upIndex).map(function(e){return e.handle;}),true);
  queueSelection=null;repaintAll();
}
function beginQueueDrag(row,x,y){
  var loc=playingLoc();
  queueDrag={row:row,x:x,y:y,moved:false,target:null,entries:upNextEntries(),
    loc:loc&&loc.IsValid?{pl:loc.PlaylistIndex,item:loc.PlaylistItemIndex}:null};
}
function updateQueueDrag(x,y){
  if(!queueDrag)return;
  if(!queueDrag.moved&&Math.abs(x-queueDrag.x)+Math.abs(y-queueDrag.y)<6)return;
  queueDrag.moved=true;drag='queue';queueDrag.target=null;
  for(var i=0;i<HB_Q.length;i++)if(inRect(x,y,HB_Q[i])){
    var row=HB_Q[i];queueDrag.target={row:row,after:y>=(row.y0+row.y1)/2};break;
  }
  repaintQueue();
}
function finishQueueDrag(){
  try{applyQueueDrag();}
  catch(e){queueDrag=null;drag=null;fb.ShowPopupMessage('Could not reorder Up next: '+String(e),'Verdant');repaintAll();}
}
function applyQueueDrag(){
  var d=queueDrag;queueDrag=null;drag=null;
  if(!d)return;
  if(!d.moved){selectQueueRow(d.row);return;}
  if(!d.target){repaintQueue();return;}
  var entries=upNextEntries(),loc=playingLoc();
  if(!upNextEqual(d.entries,entries)||!!d.loc!==!!(loc&&loc.IsValid)||(d.loc&&(loc.PlaylistIndex!==d.loc.pl||loc.PlaylistItemIndex!==d.loc.item))){repaintQueue();return;}
  var from=d.row.upIndex,to=d.target.row.upIndex+(d.target.after?1:0);
  if(to>from)to--;
  if(to===from){repaintQueue();return;}
  var entry=entries.splice(from,1)[0];entries.splice(to,0,entry);
  installUpNextPlan(entries.map(function(e){return e.handle;}));
  queueSelection={index:to,handle:entry.handle};repaintAll();
}
function drawQueueDragMarker(gr){
  if(!queueDrag||!queueDrag.moved||!queueDrag.target)return;
  var t=queueDrag.target,row=t.row,y=t.after?row.y1:row.y0;
  gr.FillSolidRect(row.x0,y-1,row.x1-row.x0,2,COL.green);
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
  drawCover(gr,x,y,cs,4,h,seed,key);
  var tx=x+cs+12, tw=r.w-36-cs-12;
  tL(gr,title,FONT.qName,tcol,tx,y+dy,tw,18);
  tL(gr,artist,FONT.qArtist,COL.text2,tx,y+dy+20,tw,16);
}
function drawQueue(gr){drawQueueContents(gr);drawQueueDragMarker(gr);}
function drawQueueContents(gr){
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
  tL(gr,stoppedPlayback&&!(fb.IsPlaying||fb.IsPaused)?'Stopped':'Now playing',FONT.sect,COL.text,x,qy,r.w-36,24);qy+=36;
  qEntry(gr,r,x,qy,48,6,NP,'np',undefined,npTitleStr||'Nothing playing',npArtistStr,(fb.IsPlaying||fb.IsPaused)?COL.green:COL.text);
  qy+=70;

  var rh=56,bottom=r.y+r.h-8;
  tL(gr,'Up next',FONT.sect,COL.text,x,qy,r.w-36,24);qy+=36;
  var entries=upNextEntries(Math.max(1,Math.floor((bottom-qy)/rh)));
  if(!entries.length){
    tL(gr,(fb.IsPlaying||fb.IsPaused)?'Nothing queued - stops after this track':'Nothing queued',FONT.qArtist,COL.text3,x,qy,r.w-36,36);
    return;
  }
  for(var i=0;i<entries.length&&qy+rh<=bottom;i++){
    var e=entries[i],row=qRow(gr,r,x,qy,rh);row.upIndex=i;row.handle=e.handle;
    HB_Q.push(row);paintQueueSelection(gr,row,e.handle);
    var meta=qRowMeta(e.handle);
    qEntry(gr,r,x,qy,44,5,e.handle,'upnext'+i,undefined,meta.t,meta.a,COL.text);
    qy+=rh;
  }
}
