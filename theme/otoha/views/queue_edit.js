/* Editing the finite Play order never changes a source playlist or music files. */
var queueKeyboardFocus=false,mainQueueDrag=null,queueInsertMarker=null;
function queuePaneHit(x,y){return !fsMode&&queueVisible()&&rightTab==='queue'&&inRect(x,y,{x0:R.queue.x,y0:R.queue.y+50,x1:R.queue.x+R.queue.w,y1:R.queue.y+R.queue.h});}
function queueCurrentIndex(entries){for(var i=0;i<entries.length;i++)if(entries[i].current)return i;return -1;}
function queueSelectedEntries(entries){
  entries=entries||playOrderEntries();var s=queueSelection,out=[];if(!s)return out;
  var selected=s.selected||{};
  if(!s.selected)selected[s.index]=s.handle;
  for(var i=0;i<entries.length;i++)if(selected[i]&&queueHandlesEqual(selected[i],entries[i].handle))out.push({index:i,handle:entries[i].handle});
  return out;
}
function queueRowSelected(index,handle){
  if(!queueSelection)return false;
  var h=queueSelection.selected?queueSelection.selected[index]:queueSelection.index===index?queueSelection.handle:null;
  return !!h&&queueHandlesEqual(h,handle);
}
function queueSelectionMatchesOrder(entries){
  if(!queueSelection)return false;
  var order=queueSelection.order;if(!order)return queueSelectedEntries(entries).length>0;
  if(order.length!==entries.length)return false;
  for(var i=0;i<order.length;i++)if(!queueHandlesEqual(order[i],entries[i].handle))return false;
  return true;
}
function setQueueSelection(indices,entries,lead,anchor){
  var selected={};for(var i=0;i<indices.length;i++)if(entries[indices[i]])selected[indices[i]]=entries[indices[i]].handle;
  if(!Object.keys(selected).length){queueSelection=null;return;}
  if(!selected[lead])lead=Number(Object.keys(selected)[0]);
  queueSelection={index:lead,handle:entries[lead].handle,anchor:anchor===undefined?lead:anchor,selected:selected,order:entries.map(function(e){return e.handle;})};
}
function removeQueueSelection(){removeQueueOccurrences(queueSelectedEntries());}
function removeQueueOccurrences(selected){
  var entries=playOrderEntries(),current=queueCurrentIndex(entries),remove={},first=entries.length;
  for(var i=0;i<selected.length;i++){
    var s=selected[i],e=entries[s.index];
    if(e&&queueHandlesEqual(e.handle,s.handle)&&!((fb.IsPlaying||fb.IsPaused)&&e.current)){remove[s.index]=true;first=Math.min(first,s.index);}
  }
  if(first===entries.length)return;
  var kept=[],nextCurrent=-1;
  for(var j=0;j<entries.length;j++)if(!remove[j]){if(j===current)nextCurrent=kept.length;kept.push(entries[j]);}
  if(nextCurrent<0&&kept.length)nextCurrent=Math.min(first,kept.length-1);
  commitQueueEdit(kept,nextCurrent);
  var next=Math.min(first,kept.length-1);setQueueSelection(next>=0?[next]:[],kept,next);repaintAll();
}
function commitQueueEdit(entries,index){
  if(!entries.length){
    upNextMutation++;try{clearStoppedPlayback();clearShuffleHandoff();plman.FlushPlaybackQueue();restoreUpNextStop();}
    finally{upNextMutation--;}
    queueSelection=null;queueViewportCache=null;persistQueueState();updateNP();repaintAll();return;
  }
  installPlayOrder(entries,index);queueViewportCache=null;updateNP();repaintAll();
}
function insertQueueTracks(handles,index){
  if(!handles.length)return;
  var entries=playOrderEntries(),current=queueCurrentIndex(entries);
  index=Math.max(0,Math.min(index===undefined?entries.length:index,entries.length));
  var added=handles.map(function(h){return {handle:h,current:false};});
  entries=entries.slice(0,index).concat(added,entries.slice(index));
  if(current>=index)current+=handles.length;
  commitQueueEdit(entries,current);var selected=[];for(var i=0;i<handles.length;i++)selected.push(index+i);
  setQueueSelection(selected,entries,index);queueKeyboardFocus=true;repaintAll();
}
function pasteQueueTracks(){
  try{
    if(!fb.CheckClipboardContents())return;
    var list=fb.GetClipboardContents(),handles=[];if(!list)return;
    for(var i=0;i<list.Count;i++)handles.push(list[i]);
    var entries=playOrderEntries(),s=queueSelection,index=entries.length;
    var selected=queueSelectedEntries(entries);if(selected.length)index=selected[selected.length-1].index+1;
    insertQueueTracks(handles,index);
  }catch(e){fb.ShowPopupMessage('Could not paste into Play order: '+String(e),'Otoha');}
}
function queueInsertionAt(x,y){
  if(!queuePaneHit(x,y)||!QUEUE_VIEW||x>=R.queue.x+R.queue.w-24||y<QUEUE_VIEW.y0||y>R.queue.y+R.queue.h-54)return null;
  var entries=playOrderEntries(),index=Math.max(0,Math.min(entries.length,Math.floor((y-QUEUE_VIEW.y0+queueScroll+28)/56)));
  return {index:index,y:Math.max(QUEUE_VIEW.y0,Math.min(QUEUE_VIEW.y1,QUEUE_VIEW.y0+index*56-queueScroll))};
}
function queueDragTargetAt(x,y){
  var row=hit(HB_Q,x,y);
  if(row)return {row:row,after:y>=(row.y0+row.y1)/2};
  var target=queueInsertionAt(x,y);if(!target)return null;
  return {row:{upIndex:target.index,x0:R.queue.x+10,x1:R.queue.x+R.queue.w-24,y0:target.y,y1:target.y},after:false};
}
function beginMainQueueDrag(row,x,y,mask){
  var mods=mouseSelectionModifiers(mask),h=trackHandle(row);if(!h||mods.ctrl||mods.shift)return;
  var entries=isTrackSelected(row)?selectedTrackEntries():[{handle:h}];
  mainQueueDrag={x:x,y:y,moved:false,handles:entries.map(function(e){return e.handle;})};
}
function updateMainQueueDrag(x,y){
  var d=mainQueueDrag;if(!d)return;
  if(!d.moved&&Math.abs(x-d.x)+Math.abs(y-d.y)<6)return;
  d.moved=true;drag='trackqueue';queueInsertMarker=queueInsertionAt(x,y);
  var playlistTarget=trackPlaylistDropTarget(x,y);navDropHover=!!(playlistTarget&&playlistTarget.create);
  trackQueueEdgeScroll(x,y);repaintQueue();
}
function finishMainQueueDrag(x,y){
  var d=mainQueueDrag;mainQueueDrag=null;queueInsertMarker=null;navDropHover=false;stopQueueEdgeScroll();
  if(!d||!d.moved)return false;
  drag=null;var target=queueInsertionAt(x,y);
  var playlistTarget=trackPlaylistDropTarget(x,y);
  if(target)insertQueueTracks(d.handles,target.index);
  else if(playlistTarget)appendDraggedTracks(playlistTarget,d.handles);
  else repaintAll();
  return true;
}
function cancelMainQueueDrag(){mainQueueDrag=null;queueInsertMarker=null;navDropHover=false;if(drag==='trackqueue')drag=null;stopQueueEdgeScroll();repaintAll();}
function trackPlaylistDropTarget(x,y){
  if(fsMode)return null;
  if(HB_ADDPL&&inRect(x,y,HB_ADDPL))return {create:true,rect:HB_ADDPL};
  var row=hit(HB_PL,x,y);
  if(row)return {pl:row.i,rect:row,disabled:!canEditPl(row.i)};
  for(var i=0;i<HB_CARD.length;i++)if(HB_CARD[i].kind==='pl'&&inRect(x,y,HB_CARD[i]))return {pl:HB_CARD[i].id,rect:HB_CARD[i],disabled:!canEditPl(HB_CARD[i].id)};
  return null;
}
function appendDraggedTracks(target,handles){
  if(target.disabled||!handles.length){repaintAll();return;}
  try{
    var pl=target.create?createNewPlaylist():target.pl;
    if(!canEditPl(pl)){repaintAll();return;}
    plman.UndoBackup(pl);plman.InsertPlaylistItems(pl,plman.PlaylistItemCount(pl),songList(handles),false);
    invalidateItems();persistQueueState();
    if(target.create){plman.ActivePlaylist=pl;revealPlaylist(pl);view='playlist';firstRow=firstRowT=0;clearTrackSelection();}
  }catch(e){fb.ShowPopupMessage('Could not add dragged tracks to playlist: '+String(e),'Otoha');}
  repaintAll();
}
function drawPlaylistDropHighlight(gr){
  if(!(mainQueueDrag&&mainQueueDrag.moved)&&!(queueDrag&&queueDrag.moved))return;
  var target=trackPlaylistDropTarget(mx,my);if(!target)return;
  var r=target.rect;strokeRound(gr,r.x0+2,r.y0+2,r.x1-r.x0-4,r.y1-r.y0-4,6,2,target.disabled?COL.text3:COL.accent);
}
function drawQueueInsertionMarker(gr){
  if(!mainQueueDrag||!mainQueueDrag.moved)return;
  queueInsertMarker=queueInsertionAt(queuePointer.x,queuePointer.y);
  if(queueInsertMarker)gr.FillSolidRect(R.queue.x+10,queueInsertMarker.y-1,R.queue.w-34,2,COL.accent);
}
function drawQueueDragPreview(gr){
  var adding=mainQueueDrag&&mainQueueDrag.moved,d=adding?mainQueueDrag:queueDrag&&queueDrag.moved?queueDrag:null;
  if(!d||mx<0||my<0)return;
  var handles=adding?d.handles:d.handles||[d.row.handle],h=handles[0];if(!h)return;
  var multi=handles.length>1,shown=Math.min(3,handles.length),more=handles.length-shown;
  var meta=qRowMeta(h),w=Math.min(multi?340:300,W-24),height=multi?64+shown*20+(more?20:0):82;
  var cursorGap=3,x=mx+cursorGap,y=my+cursorGap;
  if(x+w>W-8)x=mx-w-cursorGap;if(y+height>H-8)y=my-height-cursorGap;
  x=Math.max(8,Math.min(x,W-w-8));y=Math.max(8,Math.min(y,H-height-8));
  gr.FillRoundRect(x+3,y+4,w,height,10,10,RGBA(0,0,0,120));
  gr.FillRoundRect(x,y,w,height,10,10,COL.elev);
  strokeRound(gr,x,y,w,height,10,1,COL.line);
  var tx=x+(multi?88:66),tw=w-(multi?100:78);
  if(multi){
    for(var i=shown-1;i>=0;i--)drawCover(gr,x+12+i*6,y+18+i*6,44,4,handles[i],'queuedrag'+i);
    tL(gr,handles.length+' tracks selected',FONT.qName,COL.text,tx,y+9,tw,22);
    for(var j=0;j<shown;j++){
      var item=qRowMeta(handles[j]);
      tL(gr,(j+1)+'. '+item.t+' - '+item.a,FONT.qArtist,COL.text2,tx,y+36+j*20,tw,18);
    }
    if(more)tL(gr,'+ '+more+' more track'+(more===1?'':'s'),FONT.qArtist,COL.text3,tx,y+36+shown*20,tw,18);
  }else{
    drawCover(gr,x+10,y+12,44,4,h,'queuedrag');
    tL(gr,meta.t,FONT.qName,COL.text,tx,y+9,tw,20);
    tL(gr,meta.a,FONT.qArtist,COL.text2,tx,y+30,tw,18);
  }
  var target=trackPlaylistDropTarget(mx,my),label;
  if(target)label=target.disabled?'Playlist is read-only':target.create?'Create playlist with '+handles.length+' track'+(handles.length===1?'':'s'):'Append to '+plman.GetPlaylistName(target.pl);
  else label=adding?'Add '+handles.length+' track'+(handles.length===1?'':'s')+' to Play order':handles.length>1?'Move '+handles.length+' tracks in Play order':'Move in Play order';
  tL(gr,label,FONT.plSub,target&&target.disabled?COL.text3:COL.accent,multi?x+12:tx,y+height-28,multi?w-24:tw,18);
}
