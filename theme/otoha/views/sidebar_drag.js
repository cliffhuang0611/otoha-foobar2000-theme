/* Drag playlist rows to change foobar2000's stored playlist order. */
var sidebarPlaylistDrag=null,sidebarPlaylistViewport=null,sidebarPlaylistTimer=null;
function beginSidebarPlaylistDrag(row,x,y){
  if(typeof plman.MovePlaylist!=='function')return;
  var names=[];for(var i=0;i<plman.PlaylistCount;i++)names.push(plman.GetPlaylistName(i));
  sidebarPlaylistDrag={from:row.i,x:x,y:y,moved:false,names:names,name:plman.GetPlaylistName(row.i)};
}
function sidebarPlaylistInsertion(x,y){
  var r=sidebarPlaylistViewport;
  if(!r||!sidebarPlaylistDrag||x<r.x0||x>=r.x1||y<r.y0||y>=r.y1)return null;
  var index=Math.max(0,Math.min(r.playlists.length,Math.floor((y-r.y0+navScroll+r.rh/2)/r.rh)));
  return {index:index,y:Math.max(r.y0,Math.min(r.y1-1,r.y0+index*r.rh-navScroll))};
}
function stopSidebarPlaylistScroll(){if(sidebarPlaylistTimer!==null){window.ClearInterval(sidebarPlaylistTimer);sidebarPlaylistTimer=null;}}
function sidebarPlaylistScrollDirection(){
  if(!sidebarPlaylistDrag||!sidebarPlaylistDrag.moved||!sidebarPlaylistInsertion(mx,my))return 0;
  var r=sidebarPlaylistViewport;
  return my<r.y0+28&&navScroll>0?-1:my>r.y1-28&&navScroll<NAV_MAX?1:0;
}
function updateSidebarPlaylistDrag(x,y){
  var d=sidebarPlaylistDrag;if(!d)return;
  if(!d.moved&&Math.abs(x-d.x)+Math.abs(y-d.y)<6)return;
  d.moved=true;drag='playlistorder';clearPlaylistNameTooltip();
  if(!sidebarPlaylistScrollDirection())stopSidebarPlaylistScroll();
  else if(sidebarPlaylistTimer===null)sidebarPlaylistTimer=window.SetInterval(function(){
    var dir=sidebarPlaylistScrollDirection();if(!dir){stopSidebarPlaylistScroll();return;}
    navScroll=navScrollT=clampPx(navScroll+dir*14,NAV_MAX);repaintAll();
  },40);
  repaintAll();
}
function sidebarPlaylistMoveTarget(playlists,from,before){
  var at=playlists.indexOf(from);if(at<0)return -1;
  var remaining=playlists.filter(function(pl){return pl!==from;}),slot=before-(at<before?1:0);
  slot=Math.max(0,Math.min(slot,remaining.length));
  var proposed=remaining.slice();proposed.splice(slot,0,from);
  if(proposed.every(function(pl,i){return pl===playlists[i];}))return -1;
  if(slot<remaining.length){var target=remaining[slot];return target-(from<target?1:0);}
  var last=remaining[remaining.length-1];return last+(from>last?1:0);
}
function remapMovedPlaylistIndex(index,from,to){
  if(index===from)return to;
  if(from<to&&index>from&&index<=to)return index-1;
  if(from>to&&index>=to&&index<from)return index+1;
  return index;
}
function remapSidebarPlaylistReferences(from,to){
  function remap(i){return remapMovedPlaylistIndex(i,from,to);}
  navPages.forEach(function(page){page.pl=remap(page.pl);if(page.view==='playlist')page.key='playlist:'+page.pl;});
  if(shuffleHandoff)shuffleHandoff.pl=remap(shuffleHandoff.pl);
  if(playOrderPreview)playOrderPreview.pl=remap(playOrderPreview.pl);
  if(dupWatch)dupWatch.pl=remap(dupWatch.pl);
  if(navRevealPl>=0)navRevealPl=remap(navRevealPl);
  if(filterScope.indexOf('pl:')===0)filterScope='pl:'+remap(Number(filterScope.slice(3)));
}
function finishSidebarPlaylistDrag(x,y){
  var d=sidebarPlaylistDrag,target=sidebarPlaylistInsertion(x,y),playlists=sidebarPlaylistViewport?sidebarPlaylistViewport.playlists.slice():[];
  cancelSidebarPlaylistDrag();
  if(!d||!d.moved)return false;
  trackClickModifiers=null;
  if(!target||d.names.length!==plman.PlaylistCount)return true;
  for(var i=0;i<d.names.length;i++)if(plman.GetPlaylistName(i)!==d.names[i])return true;
  var to=sidebarPlaylistMoveTarget(playlists,d.from,target.index);if(to<0)return true;
  var active=plman.ActivePlaylist,scroll=firstRow,scrollTarget=firstRowT;
  try{
    if(plman.MovePlaylist(d.from,to)===false)throw new Error('Playlist movement was rejected.');
    remapSidebarPlaylistReferences(d.from,to);
    var nextActive=remapMovedPlaylistIndex(active,d.from,to);
    if(plman.ActivePlaylist!==nextActive)plman.ActivePlaylist=nextActive;
    firstRow=scroll;firstRowT=scrollTarget;clearTrackSelection();invalidateItems();persistQueueState();
  }catch(e){fb.ShowPopupMessage('Could not reorder playlists: '+String(e),'Otoha');}
  repaintAll();return true;
}
function cancelSidebarPlaylistDrag(){stopSidebarPlaylistScroll();sidebarPlaylistDrag=null;if(drag==='playlistorder')drag=null;repaintAll();}
function drawSidebarPlaylistDrag(gr){
  var d=sidebarPlaylistDrag;if(!d||!d.moved)return;
  var target=sidebarPlaylistInsertion(mx,my),r=sidebarPlaylistViewport;
  if(target)gr.FillSolidRect(r.x0+10,target.y-1,r.x1-r.x0-24,2,COL.accent);
  var w=Math.min(260,W-16),h=62,x=Math.max(8,Math.min(mx+3,W-w-8)),y=Math.max(8,Math.min(my+3,H-h-8));
  gr.FillRoundRect(x,y,w,h,8,8,COL.elev);strokeRound(gr,x,y,w,h,8,1,COL.line);
  tL(gr,d.name,FONT.pl,COL.text,x+12,y+8,w-24,22);
  tL(gr,'Move playlist',FONT.plSub,COL.accent,x+12,y+33,w-24,18);
}
