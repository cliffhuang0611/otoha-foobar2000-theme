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
/* The rename dialog is a painted edit control, just like Verdant Search.
   Keep caret, anchor, horizontal clipping and clipboard behavior explicitly;
   JSplitter cannot provide Windows text editing for a GDI-drawn rectangle. */
function startRename(pl){
  if(pl<0 || pl>=plman.PlaylistCount) return;
  var name=plman.GetPlaylistName(pl);
  // Windows/Explorer F2 behavior: preselect the existing name for replacement.
  renameEdit={pl:pl,text:name,cursor:name.length,anchor:0,viewStart:0,hit:null};
  ctxMenu=null; caretOn=true; startCaret(); applyKeyMode(); repaintAll();
}
function renameSelection(){
  return [Math.min(renameEdit.cursor,renameEdit.anchor),Math.max(renameEdit.cursor,renameEdit.anchor)];
}
function renameHasSelection(){return !!renameEdit && renameEdit.cursor!==renameEdit.anchor;}
function renameReplace(text){
  if(!renameEdit)return;
  text=String(text||'').replace(/[\r\n\t]+/g,' ');
  var bounds=renameSelection(),old=renameEdit.text;
  renameEdit.text=old.slice(0,bounds[0])+text+old.slice(bounds[1]);
  renameEdit.cursor=renameEdit.anchor=bounds[0]+text.length;
  caretOn=true;repaintAll();
}
function renameMove(pos,extend){
  if(!renameEdit)return;
  renameEdit.cursor=Math.max(0,Math.min(renameEdit.text.length,pos));
  if(!extend)renameEdit.anchor=renameEdit.cursor;
  caretOn=true;repaintAll();
}
function renameWordLeft(pos){
  var txt=renameEdit.text;
  while(pos>0 && searchCharGroup(txt.charAt(pos-1))===0)pos--;
  if(pos<=0)return 0;
  var kind=searchCharGroup(txt.charAt(pos-1));
  while(pos>0 && searchCharGroup(txt.charAt(pos-1))===kind)pos--;
  return pos;
}
function renameWordRight(pos){
  var txt=renameEdit.text,kind=searchCharGroup(txt.charAt(pos));
  if(kind){while(pos<txt.length && searchCharGroup(txt.charAt(pos))===kind)pos++;}
  while(pos<txt.length && searchCharGroup(txt.charAt(pos))===0)pos++;
  return pos;
}
function renameDelete(back,word){
  if(!renameEdit)return;
  if(renameHasSelection()){renameReplace('');return;}
  var pos=back?(word?renameWordLeft(renameEdit.cursor):Math.max(0,renameEdit.cursor-1))
              :(word?renameWordRight(renameEdit.cursor):Math.min(renameEdit.text.length,renameEdit.cursor+1));
  if(pos===renameEdit.cursor)return;
  renameEdit.anchor=pos;renameReplace('');
}
function renameCopy(){
  if(!renameHasSelection())return;
  var b=renameSelection();
  try{if(utils.SetClipboardText)utils.SetClipboardText(renameEdit.text.slice(b[0],b[1]));}catch(e){}
}
function renamePaste(){
  try{if(utils.GetClipboardText){var v=utils.GetClipboardText();if(v)renameReplace(v);}}catch(e){}
}
function renameHitCursor(x){
  if(!renameEdit || !renameEdit.hit)return renameEdit?renameEdit.text.length:0;
  var h=renameEdit.hit,edges=h.edges;
  if(x<=h.x)return h.start;
  for(var i=0;i<edges.length-1;i++)if(x<h.x+(edges[i]+edges[i+1])/2)return h.start+i;
  return h.start+edges.length-1;
}
function renameKeyDown(vkey,ctrl,shift,alt){
  if(!renameEdit)return false;
  if(vkey===27){cancelRename();return true;}
  if(vkey===13){commitRename();return true;}
  if(alt)return true;
  if(ctrl){
    if(vkey===65){renameEdit.anchor=0;renameEdit.cursor=renameEdit.text.length;caretOn=true;repaintAll();return true;}
    if(vkey===67){renameCopy();return true;}
    if(vkey===88){renameCopy();if(renameHasSelection())renameReplace('');return true;}
    if(vkey===86){renamePaste();return true;}
  }
  if(vkey===37 || vkey===39){
    var pos;
    if(!shift && !ctrl && renameHasSelection())pos=vkey===37?renameSelection()[0]:renameSelection()[1];
    else if(ctrl)pos=vkey===37?renameWordLeft(renameEdit.cursor):renameWordRight(renameEdit.cursor);
    else pos=renameEdit.cursor+(vkey===37?-1:1);
    renameMove(pos,shift);return true;
  }
  if(vkey===36){renameMove(0,shift);return true;}
  if(vkey===35){renameMove(renameEdit.text.length,shift);return true;}
  if(vkey===8){renameDelete(true,ctrl);return true;}
  if(vkey===46){renameDelete(false,ctrl);return true;}
  return true;
}
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
               {label:'Properties',act:'properties'},
               {label:'Show more options',act:'native'},
               {label:'Delete files...',act:'deletefiles',danger:true}];
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
function openNativeSongMenu(handles,x,y){
  try{
    var manager=fb.CreateContextMenuManager(),popup=window.CreatePopupMenu();
    manager.InitContext(songList(handles));
    manager.BuildMenu(popup,1,32767);
    var id=popup.TrackPopupMenu(x,y);
    if(id>0){manager.ExecuteByID(id-1);watchFileOperation(handles);}
  }catch(e){fb.ShowPopupMessage('Could not open the foobar2000 context menu: '+String(e),'Verdant');}
}
function promptDeleteFiles(handles){
  if(!handles.length)return false;
  confirmDel={kind:'files',handles:handles.slice(0)};
  repaintAll();return true;
}
var fileOperationTimer=null,missingLibraryFiles=Object.create(null);
function localFileExists(path){
  if(!/^(?:[a-z]:\\|\\\\)/i.test(path))return null;
  try{return !!utils.FileTest(path,'e');}catch(e){return null;}
}
function watchFileOperation(handles){
  if(fileOperationTimer!==null)window.ClearTimeout(fileOperationTimer);
  var paths=[],seen=Object.create(null),attempts=0;
  for(var i=0;i<handles.length;i++){
    var path=handles[i].Path;
    if(!seen[path] && localFileExists(path)!==null){paths.push(path);seen[path]=true;}
  }
  if(!paths.length)return;
  function check(){
    fileOperationTimer=null;
    var changed=false;
    for(var i=paths.length-1;i>=0;i--){
      if(localFileExists(paths[i])===false){
        missingLibraryFiles[paths[i]]=true;paths.splice(i,1);changed=true;
      }
    }
    if(changed)libChanged();
    // Native confirmation/deletion may finish asynchronously. Cancellation leaves files visible.
    if(paths.length && ++attempts<120)fileOperationTimer=window.SetTimeout(check,500);
  }
  fileOperationTimer=window.SetTimeout(check,100);
}
function commitDeletePrompt(){
  if(!confirmDel)return;
  if(confirmDel.kind!=='files'){doDeletePlaylist(confirmDel.pl);return;}
  var handles=confirmDel.handles;
  confirmDel=null;repaintAll();
  // Include both menu paths and leaf names used by different component versions.
  if(!runSongContext(handles,['File Operations/Delete file(s)','Delete file(s)','File Operations/Delete files','Delete files','Delete file']))
    fb.ShowPopupMessage('Could not run file deletion. Use the track menu > Show more options > File Operations to choose Delete.', 'Verdant');
  else watchFileOperation(handles);
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
  }else if(act==='native'){
    repaintAll();openNativeSongMenu(handles,menu.x,menu.y);
  }else if(act==='deletefiles'){
    promptDeleteFiles(handles);
  }else if(act==='trkremove'){
    if(handles.length===1) removeTrackFromPl(menu.pl,menu.item);
    else removeSelectedTracksFromPl(menu.pl,entries);
  }
  repaintAll();
}
