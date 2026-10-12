/* verdant/data/playback.js -- playback order, the shuffle engine, and the play* entry points
   Part of Verdant, a Spotify-style theme for foobar2000. Loaded by main.js;
   every module shares one global scope, so load order is set there. */

/* The slider's full position is VOL_CEIL dB rather than foobar's 0 dB (see core/props.js, where
   the property is read and defaults to 0 = no change). The curve itself is untouched -- still
   10 dB per halving of the slider, only shifted down -- so the control feels the same at any
   ceiling, and at the default these are exactly the functions they always were. */
function vol2pos(v){ return Math.pow(2, (v-VOL_CEIL)/10); }                                        // dB(-100..VOL_CEIL) -> 0..1
function pos2vol(p){ return p<=0?-100:Math.max(-100,Math.min(VOL_CEIL,10*Math.log(p)/Math.LN2+VOL_CEIL)); } // 0..1 -> dB
/* foobar remembers its volume across restarts and its own menu/keys are not bound by the ceiling,
   so a session left louder than it is pulled back down once at load. Only at load: fighting
   foobar's native controls on every change would make them look broken. A no-op at the default. */
function capVolume(){ try{ if(fb.Volume>VOL_CEIL) fb.Volume=VOL_CEIL; }catch(e){} }
function readOrder(){ try{ return plman.PlaybackOrder; }catch(e){ return 0; } }
function setOrder(o){ try{ plman.PlaybackOrder=o; }catch(e){} }
// Repeat maps to native PlaybackOrder; shuffle is ours (a hidden shuffled copy -> accurate "next up").
var pbShuffle=propStr('Playback: shuffle','true')!=='false',pbRepeat=0;
function applyPlaybackOrder(){ setOrder(pbRepeat===2?2:(pbRepeat===1?1:0)); }   // native handles repeat only
function syncOrderFromFb(){ var o=readOrder(); pbRepeat=(o===2)?2:(o===1?1:0); }
function toggleShuffle(){
  pbShuffle=!pbShuffle;
  if(fb.IsPlaying||fb.IsPaused){ if(pbShuffle) shuffleEnterFromCurrent(); else shuffleExitToSource(); }
  else clearShuffleHandoff();
  applyPlaybackOrder(); repaintAll();
  persistQueueState();
}
function cycleRepeat(){ pbRepeat=(pbRepeat+1)%3; applyPlaybackOrder(); }

var ROUTE='__verdant_np__'; // hidden playlist used to play library tracks (artist page / search)
/* ---- shuffle engine: plays from a hidden shuffled copy so "next up" is the real order.
   Reshuffles whenever shuffle is toggled on, or a playlist starts while shuffle is on. */
var SHUF='__verdant_shuffle__',QUEUE_ORDER='__verdant_queue__',QUEUE_ORDER_ALT='__verdant_queue_alt__',queueOrderSource='',shufSrcName='',lastShufIdx=-1;
var shuffleHandoff=null;
var upNextMutation=0,upNextStopState=null,stoppedPlayback='';
var STOPPED_ORDER='__verdant_stopped__';
function stoppedTrack(){var pl=playlistOfName(stoppedPlayback);var items=pl>=0?getItems(pl):null;return items&&items.Count?items[0]:null;}
function clearStoppedPlayback(){
  var retained=!!stoppedPlayback;stoppedPlayback='';
  if(retained&&!upNextMutation){upNextMutation++;try{plman.FlushPlaybackQueue();}finally{upNextMutation--;}}
  persistQueueState();
}
function stopPlaybackRetainingQueue(){
  if(!(fb.IsPlaying||fb.IsPaused))return;
  var current=fb.GetNowPlaying();if(!current)return;
  var entries=upNextEntries(),handles=[current];
  for(var i=0;i<entries.length;i++)handles.push(entries[i].handle);
  var pl=plman.FindOrCreatePlaylist(STOPPED_ORDER,true),active=plman.ActivePlaylist;
  upNextMutation++;
  try{
    plman.ClearPlaylist(pl);plman.InsertPlaylistItems(pl,0,songList(handles),false);
    clearShuffleHandoff();plman.FlushPlaybackQueue();restoreUpNextStop();
    stoppedPlayback=STOPPED_ORDER;invalidateItems();persistQueueState();fb.Stop();
  }finally{plman.ActivePlaylist=active;upNextMutation--;}
  repaintAll();
}
function playOrPauseRetainingQueue(){
  if((fb.IsPlaying||fb.IsPaused)||!stoppedTrack()){fb.PlayOrPause();return;}
  var handles=[stoppedTrack()],entries=upNextEntries();
  for(var i=0;i<entries.length;i++)handles.push(entries[i].handle);
  var active=plman.ActivePlaylist,target=plman.FindOrCreatePlaylist(QUEUE_ORDER,true);
  upNextMutation++;
  try{
    clearShuffleHandoff();plman.FlushPlaybackQueue();restoreUpNextStop();
    plman.ClearPlaylist(target);plman.InsertPlaylistItems(target,0,songList(handles),false);
    clearStoppedPlayback();invalidateItems();plman.ExecutePlaylistDefaultAction(target,0);
  }finally{plman.ActivePlaylist=active;upNextMutation--;}
  repaintAll();
}
function persistQueueState(){
  try{
    var h=shuffleHandoff;
    window.SetProperty('Playback: shuffle',pbShuffle?'true':'false');
    window.SetProperty('Playback: Up next state',JSON.stringify({source:shufSrcName,queueSource:queueOrderSource,stop:upNextStopState,stopped:stoppedPlayback,
      handoff:h?{name:plman.GetPlaylistName(h.pl),item:h.item,path:h.handle.Path,raw:h.handle.RawPath,sub:h.handle.SubSong}:null}));
  }catch(e){}
}
function restoreQueueState(){
  try{
    var state=JSON.parse(propStr('Playback: Up next state','{}'));
    shufSrcName=state.source||'';queueOrderSource=state.queueSource||'';
    upNextStopState=typeof state.stop==='boolean'?state.stop:null;
    stoppedPlayback=typeof state.stopped==='string'&&!(fb.IsPlaying||fb.IsPaused)?state.stopped:'';
    var h=state.handoff,pl=h?playlistOfName(h.name):-1,items=pl>=0?getItems(pl):null;
    if(items&&h.item>=0&&h.item<items.Count){
      var handle=items[h.item];
      if(handle.Path===h.path&&handle.RawPath===h.raw&&handle.SubSong===h.sub){
        shuffleHandoff={pl:pl,item:h.item,handle:handle};
        if(shuffleHandoffQueueIndex()<0)shuffleHandoff=null;
      }
    }
    if(!(fb.IsPlaying||fb.IsPaused))restoreUpNextStop();
  }catch(e){shuffleHandoff=null;}
}
function restoreUpNextStop(){
  if(upNextStopState!==null){fb.StopAfterCurrent=upNextStopState;upNextStopState=null;persistQueueState();}
}
function normalizeQueueHandoff(){
  if(upNextMutation)return;
  var q=plman.GetPlaybackQueueContents(),idx=shuffleHandoffQueueIndex();
  if(upNextStopState!==null&&q.length){
    installUpNextPlan(q.map(function(e){return e.Handle;}));return;
  }
  if(idx>=0&&idx<q.length-1){
    var h=shuffleHandoff;upNextMutation++;
    try{plman.RemoveItemFromPlaybackQueue(idx);plman.AddPlaylistItemToPlaybackQueue(h.pl,h.item);}
    finally{upNextMutation--;}
  }
}
function shuffleHandoffQueueIndex(){
  if(!shuffleHandoff)return -1;
  var q=plman.GetPlaybackQueueContents();
  for(var i=q.length-1;i>=0;i--)if(q[i].PlaylistIndex===shuffleHandoff.pl&&q[i].PlaylistItemIndex===shuffleHandoff.item&&sameHandle(q[i].Handle,shuffleHandoff.handle))return i;
  return -1;
}
function clearShuffleHandoff(){
  var i=shuffleHandoffQueueIndex();shuffleHandoff=null;
  persistQueueState();
  if(i>=0)plman.RemoveItemFromPlaybackQueue(i);
}
function queueShuffleHandoff(pl,item){
  var items=getItems(pl);
  if(!items || item<0 || item>=items.Count)return;
  shuffleHandoff={pl:pl,item:item,handle:items[item]};
  try{plman.AddPlaylistItemToPlaybackQueue(pl,item);}catch(e){shuffleHandoff=null;throw e;}
  persistQueueState();
}
function isHiddenPl(nm){ return nm===ROUTE || nm===SHUF || nm===QUEUE_ORDER || nm===QUEUE_ORDER_ALT || nm===STOPPED_ORDER; }
function playlistOfName(nm){ for(var i=0;i<plman.PlaylistCount;i++) if(plman.GetPlaylistName(i)===nm) return i; return -1; }
function handleArray(pi){ var it=getItems(pi), a=[]; if(it){ for(var i=0;i<it.Count;i++) a.push(it[i]); } return a; }
function sameHandle(a,b){ return !!(a&&b&&a.Path===b.Path); }
function indexOfHandle(arr,h){ if(!h) return -1; for(var i=0;i<arr.length;i++) if(sameHandle(arr[i],h)) return i; return -1; }
function shuffleArr(a){ for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)), t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
function playShuffled(pi,startHandle,name,preservePos){   // build hidden shuffled copy of pi (start first) and play it
  clearShuffleHandoff();
  var arr=handleArray(pi); if(!arr.length) return;
  shuffleArr(arr);
  if(startHandle){ var ci=indexOfHandle(arr,startHandle); if(ci>=0) arr.splice(ci,1); arr.unshift(startHandle); }
  if(name!==undefined && !isHiddenPl(name)) shufSrcName=name;
  var pl=plman.FindOrCreatePlaylist(SHUF,true);
  try{ plman.ClearPlaylist(pl); }catch(e){}
  var hl=fb.CreateHandleList(); for(var i=0;i<arr.length;i++) hl.Add(arr[i]);
  plman.InsertPlaylistItems(pl,0,hl,false);
  var savedActive=plman.ActivePlaylist, wasActive=(fb.IsPlaying||fb.IsPaused), pos=fb.PlaybackTime;
  plman.ExecutePlaylistDefaultAction(pl,0);
  try{ plman.ActivePlaylist=savedActive; }catch(e){}   // keep the user's viewed playlist, not the hidden one
  if(preservePos && wasActive && pos>0){ try{ fb.PlaybackTime=pos; }catch(e){} }
  lastShufIdx=0;invalidateItems();persistQueueState();
}
// on loop-around, reshuffle the tail in place so the next pass differs (item 0 stays put, no restart)
function reshuffleTail(shufPi){
  var it=getItems(shufPi), n=it.Count; if(n<=2) return;
  var tail=[], i; for(i=1;i<n;i++) tail.push(it[i]);
  shuffleArr(tail);
  plman.ClearPlaylistSelection(shufPi);
  for(i=1;i<n;i++) plman.SetPlaylistSelectionSingle(shufPi,i,true);
  plman.RemovePlaylistSelection(shufPi);
  var hl=fb.CreateHandleList(); for(i=0;i<tail.length;i++) hl.Add(tail[i]);
  plman.InsertPlaylistItems(shufPi,1,hl,false);
  invalidateItems();
}
function shuffleEnterFromCurrent(){   // shuffle ON mid-playback: reshuffle the source, keep the current track
  clearShuffleHandoff();
  var loc=playingLoc();
  var src=(loc&&loc.IsValid)?loc.PlaylistIndex:plman.ActivePlaylist; if(src<0) return;
  if(plman.GetPlaylistName(src)===SHUF){var original=playlistOfName(shufSrcName);if(original>=0)src=original;}
  var name=plman.GetPlaylistName(src),arr=handleArray(src),current=fb.GetNowPlaying();
  if(!arr.length || !current)return;
  var at=loc&&loc.IsValid&&loc.PlaylistIndex===src?loc.PlaylistItemIndex:indexOfHandle(arr,current);
  if(at>=0)arr.splice(at,1);
  shuffleArr(arr);arr.unshift(current);
  shufSrcName=name===QUEUE_ORDER||name===QUEUE_ORDER_ALT?queueOrderSource:name;
  var pl=plman.FindOrCreatePlaylist(SHUF,true),savedActive=plman.ActivePlaylist;
  try{plman.ClearPlaylist(pl);plman.InsertPlaylistItems(pl,0,songList(arr),false);}
  finally{plman.ActivePlaylist=savedActive;}
  invalidateItems();lastShufIdx=-1;
  queueShuffleHandoff(pl,arr.length>1?1:(pbRepeat===1?0:-1));
}
function shuffleExitToSource(){   // shuffle OFF: resume the real playlist at the current track, in order
  clearShuffleHandoff();
  var si=playlistOfName(shufSrcName); if(si<0) return;
  var loc=playingLoc();
  if(loc&&loc.IsValid&&loc.PlaylistIndex===si)return; // toggled back before the handoff
  var it=getItems(si),idx=indexOfHandle(handleArray(si),fb.GetNowPlaying());
  if(!it || idx<0)return;
  // At the source's end there is no ordered successor to queue. Remove only
  // the hidden tail so playback can end naturally after the current track.
  if(idx+1>=it.Count && pbRepeat!==1 && loc&&loc.IsValid&&plman.GetPlaylistName(loc.PlaylistIndex)===SHUF){
    var sp=loc.PlaylistIndex,count=plman.PlaylistItemCount(sp);
    plman.ClearPlaylistSelection(sp);
    for(var i=loc.PlaylistItemIndex+1;i<count;i++)plman.SetPlaylistSelectionSingle(sp,i,true);
    plman.RemovePlaylistSelection(sp,false);invalidateItems();return;
  }
  queueShuffleHandoff(si,idx+1<it.Count?idx+1:(pbRepeat===1?0:-1));
}
function playPlaylistItem(pl,item){   // clicking a track: shuffle-aware
  clearStoppedPlayback();
  restoreUpNextStop();
  clearShuffleHandoff();
  if(pbShuffle) playShuffled(pl,getItems(pl)[item],plman.GetPlaylistName(pl),false);
  else plman.ExecutePlaylistDefaultAction(pl,item);
}
/* Queue rows jump straight to the track -- deliberately NOT playPlaylistItem(), which would
   reshuffle the hidden playlist and throw away the running order the user is looking at. */
function playQueueNext(pl,item){clearStoppedPlayback();restoreUpNextStop();clearShuffleHandoff();try{plman.ExecutePlaylistDefaultAction(pl,item);}catch(e){} }
// manually-queued row: play it and drop it from the queue, it is no longer "up next"
function playQueueItem(qi){
  var c=null; try{ c=plman.GetPlaybackQueueContents(); }catch(e){ c=null; }
  if(!c || !c.length || qi>=c.length) return;
  var it=c[qi], pi=it.PlaylistIndex, ii=it.PlaylistItemIndex;
  try{ plman.RemoveItemFromPlaybackQueue(qi); }catch(e){}
  if(pi>=0 && ii>=0) playQueueNext(pi,ii);
  else if(it.Handle) playHandleList([it.Handle],0);   // queued from outside any playlist
}
// is the now-playing track this playlist's shuffled source? (for highlighting the right row)
function npIsShuffleOf(name){ return pbShuffle && NP && name===shufSrcName; }
