/* Reorder playlist occurrences in stored Default order, without restarting playback. */
var playlistDropView=null,playlistDragTimer=null;
function canReorderPlaylist(pl){
  return view==='playlist'&&plman.ActivePlaylist===pl&&plSort==='none'&&canEditPl(pl)&&!(inlineFilterActive()&&filterQuery.trim());
}
function playlistReorderSource(row,entries){
  if(row.pl===undefined||!canReorderPlaylist(row.pl))return null;
  return {pl:row.pl,indices:entries.map(function(e){return e.row.item;}),items:handleArray(row.pl)};
}
function playlistInsertionAt(x,y){
  var d=mainQueueDrag,r=playlistDropView;
  if(!d||!d.reorder||!r||r.pl!==d.reorder.pl||!canReorderPlaylist(r.pl)||x<r.x0||x>=r.x1||y<r.y0||y>=r.y1)return null;
  var index=Math.max(0,Math.min(r.count,Math.floor((y-r.y0+firstRow+r.rh/2)/r.rh)));
  return {index:index,y:Math.max(r.y0,Math.min(r.y1-1,r.y0+index*r.rh-firstRow)),x0:r.x0,x1:r.x1};
}
function stopPlaylistDragScroll(){if(playlistDragTimer!==null){window.ClearInterval(playlistDragTimer);playlistDragTimer=null;}}
function playlistDragDirection(){
  if(!playlistInsertionAt(mx,my))return 0;
  var r=playlistDropView;
  return my<r.y0+28&&firstRow>0?-1:my>r.y1-28&&firstRow<PL_MAXPX?1:0;
}
function trackPlaylistDragScroll(){
  if(!playlistDragDirection()){stopPlaylistDragScroll();return;}
  if(playlistDragTimer===null)playlistDragTimer=window.SetInterval(function(){
    var direction=playlistDragDirection();if(!direction){stopPlaylistDragScroll();return;}
    firstRow=firstRowT=clampPx(firstRow+direction*14,PL_MAXPX);repaintAll();
  },40);
}
function playlistMoveOrder(count,indices,before){
  var picked=Object.create(null),selected=[],remaining=[],i;
  indices.forEach(function(index){picked[index]=true;});
  var insertion=0;
  for(i=0;i<count;i++){
    if(picked[i])selected.push(i);
    else{remaining.push(i);if(i<before)insertion++;}
  }
  return {order:remaining.slice(0,insertion).concat(selected,remaining.slice(insertion)),selected:selected.map(function(_,i){return insertion+i;})};
}
function reorderDraggedPlaylist(source,before){
  if(!canReorderPlaylist(source.pl))return;
  var pl=source.pl,items=handleArray(pl),i;
  // Reject a stale drag if the source playlist changed while the pointer was held.
  if(items.length!==source.items.length)return;
  for(i=0;i<items.length;i++)if(!queueHandlesEqual(items[i],source.items[i]))return;
  var plan=playlistMoveOrder(items.length,source.indices,before),current=items.map(function(_,i){return i;});
  if(plan.order.every(function(index,i){return index===i;})){repaintAll();return;}
  try{
    plman.UndoBackup(pl);
    // Native occurrence moves preserve duplicates and the currently playing item.
    for(i=0;i<plan.order.length;i++){
      var at=current.indexOf(plan.order[i],i);if(at===i)continue;
      plman.ClearPlaylistSelection(pl);plman.SetPlaylistSelection(pl,[at],true);
      if(plman.MovePlaylistSelection(pl,i-at)===false)throw new Error('Playlist item movement was rejected.');
      current.splice(i,0,current.splice(at,1)[0]);
    }
    clearTrackSelection();
    plan.selected.forEach(function(index){markTrack({pl:pl,item:index},true);});
    trackSel.anchor=trackSel.cursor=trackId({pl:pl,item:plan.selected[0]});
    plman.ClearPlaylistSelection(pl);plman.SetPlaylistSelection(pl,plan.selected,true);
    invalidateItems();persistQueueState();
  }catch(e){clearTrackSelection();invalidateItems();fb.ShowPopupMessage('Could not reorder playlist: '+String(e)+'\nUse foobar2000 Undo to revert completed moves.','Otoha');}
  repaintAll();
}
function drawPlaylistInsertionMarker(gr){
  if(!mainQueueDrag||!mainQueueDrag.moved)return;
  var target=playlistInsertionAt(mx,my);
  if(target)gr.FillSolidRect(target.x0,target.y-1,target.x1-target.x0,2,COL.accent);
}
