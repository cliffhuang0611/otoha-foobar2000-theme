/* otoha/data/dedupe.js -- duplicate detection on playlist inserts
   Part of Otoha, a local music theme for foobar2000. Loaded by main.js;
   every module shares one global scope, so load order is set there. */

/* ---- duplicate detection: neither insert path lets us vet incoming files first (DropTargetAction
   is write-only, fb.AddFiles returns nothing), so snapshot the playlist before an insert we
   triggered, diff once the items land, and offer to drop the extra copies. */
var dupWatch=null, dupPrompt=null, DUP_HB=null;
function trackKey(h){ return h ? (h.RawPath+'#'+h.SubSong).toLowerCase() : ''; }   // same file, same subsong
function armDupWatch(pl){
  if(pl<0 || pl>=plman.PlaylistCount){ dupWatch=null; return; }
  var it=getItems(pl), before={}, i, k;
  for(i=0;i<it.Count;i++){ k=trackKey(it[i]); before[k]=(before[k]||0)+1; }
  dupWatch={pl:pl, before:before, timer:null};
}
function scheduleDupScan(){
  if(dupWatch.timer) window.ClearTimeout(dupWatch.timer);
  dupWatch.timer=window.SetTimeout(runDupScan,350);   // inserts arrive in batches; wait for them to settle
}
function runDupScan(){
  var w=dupWatch; dupWatch=null;
  if(!w || w.pl>=plman.PlaylistCount) return;
  var it=getItems(w.pl), seen={}, idx=[], i, k, allow;   // same cached list getMeta indexes, so idx lines up
  for(i=0;i<it.Count;i++){
    k=trackKey(it[i]); seen[k]=(seen[k]||0)+1;
    allow=w.before[k]||0; if(!allow) allow=1;   // a song new to this playlist may stay once
    if(seen[k]>allow) idx.push(i);              // every copy beyond that is a duplicate we just introduced
  }
  if(!idx.length) return;                       // note: pre-existing duplicates are left alone
  var meta=getMeta(w.pl), rows=[];
  for(i=0;i<idx.length;i++) rows.push({t:meta.title[idx[i]]||'', a:meta.artist[idx[i]]||''});
  dupPrompt={pl:w.pl, name:plman.GetPlaylistName(w.pl), idx:idx, rows:rows};
  repaintAll();
}
function canRemoveFrom(pl){
  try{ return plman.GetPlaylistLockedActions(pl).indexOf('RemoveItems')<0; }catch(e){ return true; }
}
function dupSkip(){
  var d=dupPrompt; dupPrompt=null;
  if(d && d.pl<plman.PlaylistCount && canRemoveFrom(d.pl)){
    plman.UndoBackup(d.pl);
    plman.ClearPlaylistSelection(d.pl);
    for(var i=0;i<d.idx.length;i++) plman.SetPlaylistSelectionSingle(d.pl,d.idx[i],true);
    plman.RemovePlaylistSelection(d.pl);   // one call, so the shifting indices never matter
    invalidateItems();
  }
  repaintAll();
}
function dupKeep(){ dupPrompt=null; repaintAll(); }

// "these are already in the playlist" warning, listing what was just added twice
function drawDupPrompt(gr){
  var n=dupPrompt.idx.length, lh=26;
  var fit=Math.max(1,Math.floor((H-260)/lh));            // never taller than the window
  var show=Math.min(n,6,fit), more=n-show;
  var cw=Math.min(480,W-40), ch=188+show*lh+(more>0?22:0);
  var cy=Math.max(10,Math.round((H-ch)/2)), cx=modalPanel(gr,cw,ch,cy);
  var px=cx+28, pw=cw-56, y=cy+24;
  tL(gr,n===1?'1 song is already here':(n+' songs are already here'),FONT.sect,COL.text,px,y,pw,26); y+=34;
  tL(gr,'Already in "'+dupPrompt.name+'":',FONT.pl,COL.text2,px,y,pw,22); y+=30;
  var tw=Math.round(pw*0.58), ax=px+tw+10, aw=pw-tw-10;
  for(var i=0;i<show;i++){
    tL(gr,dupPrompt.rows[i].t,FONT.rowTitle,COL.text,px,y,tw,20);
    tL(gr,dupPrompt.rows[i].a,FONT.rowArtist,COL.text2,ax,y+1,aw,18);
    y+=lh;
  }
  if(more>0){ tL(gr,'and '+more+' more',FONT.plSub,COL.text3,px,y,pw,20); y+=22; }
  var w2=pillW(gr,'Skip duplicates'), w1=pillW(gr,'Add anyway'), gap=12;
  var by=cy+ch-22-PILL_H, x2=cx+cw-28-w2, x1=x2-gap-w1;
  DUP_HB={ keep:drawPill(gr,x1,by,w1,'Add anyway',false), skip:drawPill(gr,x2,by,w2,'Skip duplicates',true) };
}
