/* verdant/data/playlist_edit.js -- playlist + track editing: context menus, rename, delete, add, remove
   Part of Verdant, a Spotify-style theme for foobar2000. Loaded by main.js;
   every module shares one global scope, so load order is set there. */

function openPlaylistMenu(pl,x,y){
  var items=[];
  if(!plman.IsPlaylistLocked(pl)) items.push({label:'Add files...',act:'addfiles'},{label:'Add folder...',act:'addfolder'});
  items.push({label:'Save playlist...',act:'save'},{label:'Rename',act:'rename'},{label:'Delete',act:'delete',danger:true});
  ctxMenu={kind:'pl', pl:pl, name:plman.GetPlaylistName(pl), x:x, y:y, items:items};
  repaintAll();
}
/* Export the clicked playlist through foobar2000's native Save Playlist dialog.
   fb.SavePlaylist() saves the ACTIVE playlist; a sidebar right-click can target a
   different playlist, so temporarily activate it and restore the user's active
   playlist afterward. The displayed/sorted order never changes foobar's stored
   item order, so the exported file retains the playlist's own sequence. */
function savePlaylistToFile(pi){
  if(pi<0 || pi>=plman.PlaylistCount) return;
  var old=plman.ActivePlaylist;
  try{
    if(old!==pi) plman.ActivePlaylist=pi;
    if(typeof fb.SavePlaylist==='function') fb.SavePlaylist();
    else if(!fb.RunMainMenuCommand('File/Save playlist...'))
      fb.ShowPopupMessage('Could not open the Save Playlist dialog. Try File > Save Playlist...', 'Verdant');
  }catch(e){
    try{fb.ShowPopupMessage('Could not open the Save Playlist dialog: '+String(e), 'Verdant');}catch(ignore){}
  }finally{
    try{ if(old!==pi && old>=0 && old<plman.PlaylistCount) plman.ActivePlaylist=old; }catch(ignore2){}
  }
  repaintAll();
}

// right-click a playlist row. Locked/auto playlists offer nothing -> fall through to JSplitter's menu
function openTrackMenu(pl,item,x,y){
  if(!canEditPl(pl)) return false;
  ctxMenu={kind:'track', pl:pl, item:item, x:x, y:y,
           items:[{label:'Remove from this playlist',act:'trkremove',danger:true}]};
  repaintAll(); return true;
}
function canEditPl(pl){
  if(pl<0) return false;
  try{ if(plman.IsPlaylistLocked(pl) || plman.IsAutoPlaylist(pl)) return false; }catch(e){}
  return true;
}
// Is this row the track you're hearing? Only playback straight off this playlist points the
// location at the row (index match tells duplicates apart); the hidden SHUF/ROUTE copies report
// a foreign PlaylistIndex, so fall back to matching the file.
function isRowPlaying(pl,item,h){
  if(!fb.IsPlaying && !fb.IsPaused) return false;
  var loc=playingLoc();
  if(loc && loc.IsValid && loc.PlaylistIndex===pl) return loc.PlaylistItemIndex===item;
  return sameHandle(h,NP);
}
// Removing the playing item does NOT stop foobar, so confirm the fb.Next() hand-off actually
// took once the edit settled: push again if not, stop if there was nowhere to go.
function verifyAdvanced(h){
  window.SetTimeout(function(){
    var np=null; try{ np=fb.GetNowPlaying(); }catch(e){}
    if(!(fb.IsPlaying||fb.IsPaused) || !sameHandle(np,h)) return;
    fb.Next();
    window.SetTimeout(function(){
      var n2=null; try{ n2=fb.GetNowPlaying(); }catch(e2){}
      if((fb.IsPlaying||fb.IsPaused) && sameHandle(n2,h)) fb.Stop();
    },150);
  },60);
}
// Drop the row out of the manual playback queue. Entries queued by handle alone (PlaylistIndex < 0)
// are matched by file. Must run BEFORE the playlist removal, while item indices still line up.
function dequeueRow(pl,item,h){
  var q=null; try{ q=plman.GetPlaybackQueueContents(); }catch(e){ q=null; }
  if(!q || !q.length) return;
  var kill=[];
  for(var i=0;i<q.length;i++){
    var e=q[i];
    if(e.PlaylistIndex===pl && e.PlaylistItemIndex===item) kill.push(i);
    else if(e.PlaylistIndex<0 && sameHandle(e.Handle,h)) kill.push(i);
  }
  if(kill.length){ try{ plman.RemoveItemsFromPlaybackQueue(kill); }catch(e2){} }
}
// shuffle reads "next up" from the hidden copy, so pull every instance out of that too
function removeFromShuffleCopy(pl,h){
  if(!pbShuffle || !h || pl<0) return;
  if(plman.GetPlaylistName(pl)!==shufSrcName) return;      // a different playlist is the shuffle source
  var si=playlistOfName(SHUF); if(si<0) return;
  var list=null; try{ list=plman.GetPlaylistItems(si); }catch(e){ return; }
  if(!list || !list.Count) return;
  var kill=[], i;
  for(i=0;i<list.Count;i++) if(sameHandle(list[i],h)) kill.push(i);
  if(!kill.length) return;
  try{
    plman.ClearPlaylistSelection(si);
    for(i=0;i<kill.length;i++) plman.SetPlaylistSelectionSingle(si,kill[i],true);
    plman.RemovePlaylistSelection(si,false);
    plman.ClearPlaylistSelection(si);
  }catch(e){}
}
// Remove one row: RemovePlaylistSelection is selection-based, so select just that item first.
// Removing the playing track hands playback on first; paused playback stops instead of advancing.
function removeTrackFromPl(pl,item){
  if(!canEditPl(pl) || item<0 || item>=plman.PlaylistItemCount(pl)) return;
  var items=getItems(pl), h=(items && item<items.Count)?items[item]:null;
  var playing=isRowPlaying(pl,item,h), wasPaused=fb.IsPaused;
  dequeueRow(pl,item,h);
  if(playing){ if(wasPaused) fb.Stop(); else fb.Next(); }
  removeFromShuffleCopy(pl,h);
  try{
    plman.UndoBackup(pl);
    plman.ClearPlaylistSelection(pl);
    plman.SetPlaylistSelectionSingle(pl,item,true);
    plman.RemovePlaylistSelection(pl,false);
    plman.ClearPlaylistSelection(pl);
  }catch(e){}
  if(playing && !wasPaused) verifyAdvanced(h);
  invalidateItems(); updateNP(); repaintAll();
}
function startRename(pl){ renameEdit={pl:pl, text:plman.GetPlaylistName(pl)}; ctxMenu=null; caretOn=true; startCaret(); applyKeyMode(); repaintAll(); }
function commitRename(){ if(!renameEdit) return; var t=renameEdit.text.replace(/^\s+|\s+$/g,''); if(t) plman.RenamePlaylist(renameEdit.pl,t); renameEdit=null; applyKeyMode(); repaintAll(); }
function cancelRename(){ renameEdit=null; applyKeyMode(); repaintAll(); }
function doDeletePlaylist(pl){
  var wasShown=(view==='playlist' && pl===plman.ActivePlaylist);
  try{ plman.RemovePlaylist(pl); }catch(e){}
  confirmDel=null; invalidateItems();
  if(wasShown || plman.PlaylistCount===0) view='home';   // don't strand the view on a deleted list
  repaintAll();
}

// create a uniquely-named empty playlist, return its index
function newPlaylistName(){ var b='New Playlist', nm=b, k=1, i; for(;;){ var hit=false; for(i=0;i<plman.PlaylistCount;i++){ if(plman.GetPlaylistName(i)===nm){ hit=true; break; } } if(!hit) return nm; k++; nm=b+' '+k; } }
function createNewPlaylist(){ return plman.CreatePlaylist(plman.PlaylistCount, newPlaylistName()); }
// fb.AddFiles/AddDirectory take no arguments and always target the ACTIVE playlist, so point it
// at the destination first. The insert is async; on_playlist_items_added repaints.
function addFilesToPl(i){ if(i<0 || plman.IsPlaylistLocked(i)) return; plman.ActivePlaylist=i; armDupWatch(i); fb.AddFiles(); }
function addFolderToPl(i){ if(i<0 || plman.IsPlaylistLocked(i)) return; plman.ActivePlaylist=i; armDupWatch(i); fb.AddDirectory(); }


/* Multi-row playlist deletion is one undoable edit. Remove the queued entries BEFORE
   the indices move; advance playback once if its row is included. */
function removeSelectedTracksFromPl(pl,entries){
  if(!canEditPl(pl)) return;
  var ids=[],seen={},i,j,items=getItems(pl),wasPaused=fb.IsPaused,playing=false,playingHandle=null;
  for(i=0;i<entries.length;i++){
    var r=entries[i].row,idx=r.item;
    if(r.pl!==pl || idx<0 || idx>=items.Count || seen[idx]) continue;
    seen[idx]=true; ids.push(idx);
    if(isRowPlaying(pl,idx,items[idx])){ playing=true; playingHandle=items[idx]; }
  }
  if(!ids.length) return;
  for(j=0;j<ids.length;j++){
    var id=ids[j],h=items[id];
    dequeueRow(pl,id,h);
    removeFromShuffleCopy(pl,h);
  }
  if(playing){ if(wasPaused) fb.Stop(); else fb.Next(); }
  try{
    plman.UndoBackup(pl);
    plman.ClearPlaylistSelection(pl);
    for(j=0;j<ids.length;j++) plman.SetPlaylistSelectionSingle(pl,ids[j],true);
    plman.RemovePlaylistSelection(pl,false);
    plman.ClearPlaylistSelection(pl);
  }catch(e){}
  if(playing && !wasPaused) verifyAdvanced(playingHandle);
  clearTrackSelection(); invalidateItems(); updateNP(); repaintAll();
}

/* Song-level actions for library, search, artist, and playlist views.
   The flyout draws beside the main context menu (ui/chrome.js), not in its place. */
function openSongMenu(handle,x,y,pl,item,entries){
  entries=(entries&&entries.length)?entries:[{handle:handle,row:{pl:pl,item:item}}];
  var amount=entries.length;
  var actions=[{label:'Add to playlist',act:'destinations',submenu:true},
               {label:'Add to playback queue',act:'enqueue'},
               {label:'Open containing folder',act:'folder'},
               {label:'Properties',act:'properties'}];
  if(pl!==undefined && canEditPl(pl)) actions.push({label:amount>1?'Remove selected tracks':'Remove from this playlist',act:'trkremove',danger:true});
  ctxMenu={kind:'song',handle:handle,entries:entries,pl:pl,item:item,x:x,y:y,items:actions,
           destinations:null,subOpen:false,subFirst:0};
  repaintAll();
}
function songList(handles){
  var hl=fb.CreateHandleList();
  for(var i=0;i<handles.length;i++) hl.Add(handles[i]);
  return hl;
}
function runSongContext(handles,choices){
  var hl=songList(handles);
  for(var j=0;j<choices.length;j++){
    try{ if(fb.RunContextCommandWithMetadb(choices[j],hl,8)) return true; }catch(e){}
  }
  return false;
}
function songDestinations(menu){
  if(menu.destinations) return menu.destinations;
  var entries=[];
  for(var i=0;i<plman.PlaylistCount;i++) if(!isHiddenPl(plName(i)) && canEditPl(i))
    entries.push({label:plName(i),act:'dest:'+i});
  entries.push({label:'+ New playlist',act:'dest:new'});
  menu.destinations=entries;
  return entries;
}
function handleSongMenuAction(act,menu){
  var i,handles=[],entries=menu.entries||[];
  if(act==='destinations'){ menu.subOpen=true; repaintAll(); return; }
  for(i=0;i<entries.length;i++) handles.push(entries[i].handle);
  if(!handles.length) handles=[menu.handle];
  ctxMenu=null;
  if(act.indexOf('dest:')===0){
    var dest=act==='dest:new'?createNewPlaylist():parseInt(act.slice(5),10);
    if(dest>=0 && canEditPl(dest)){
      try{
        plman.UndoBackup(dest);
        plman.InsertPlaylistItems(dest,plman.PlaylistItemCount(dest),songList(handles),false);
      }catch(e){}
      invalidateItems();
    }
  }else if(act==='enqueue'){
    for(i=0;i<handles.length;i++) try{ plman.AddItemToPlaybackQueue(handles[i]); }catch(e){}
  }else if(act==='folder'){
    // Explorer opens the folder of the track you right-clicked; opening one window
    // per selected track would be very disruptive for a large range selection.
    runSongContext([menu.handle],['Open containing folder','Utilities/Open containing folder','File Operations/Open containing folder']);
  }else if(act==='properties'){
    runSongContext(handles,['Properties']);
  }else if(act==='trkremove'){
    if(handles.length===1) removeTrackFromPl(menu.pl,menu.item);
    else removeSelectedTracksFromPl(menu.pl,entries);
  }
  repaintAll();
}
