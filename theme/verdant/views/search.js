/* verdant/views/search.js -- search view: box + artist/song results
   Part of Verdant, a Spotify-style theme for foobar2000. Loaded by main.js;
   every module shares one global scope, so load order is set there. */

// factored out so the blinking caret repaints just this strip (dirtySearch), not the whole view
/* Search is painted with GDI, not a native edit control. Keep actual Windows-style
   caret/selection state rather than treating all input as append-only. */
var searchCursor=0,searchAnchor=0,searchViewStart=0,searchTextHit=null;
/* One GDI-drawn editor shared by global Search and Ctrl+F filtering.
   Keep direct inline Japanese text input (IME positioning is host-controlled). */
function editInputActive(){ return view==='search'||inlineFilterActive(); }
function editText(){ return inlineFilterActive()?filterQuery:searchQuery; }
function setEditText(v){ if(inlineFilterActive())filterQuery=v;else searchQuery=v; }
function resetEditSelection(text){
  searchCursor=String(text||'').length;searchAnchor=0;searchViewStart=0;caretOn=true;
}
function searchHasSelection(){return searchCursor!==searchAnchor;}
function searchSelection(){return [Math.min(searchCursor,searchAnchor),Math.max(searchCursor,searchAnchor)];}
function searchEdited(){
  if(inlineFilterActive())filterEdited();
  else { searchQ2=null; searchScroll=searchScrollT=0; }
  caretOn=true;repaintAll();
}
function searchReplace(text){
  text=String(text||'').replace(/[\r\n\t]+/g,' ');
  var s=searchSelection(),current=editText();
  setEditText(current.slice(0,s[0])+text+current.slice(s[1]));
  searchCursor=searchAnchor=s[0]+text.length;
  searchEdited();
}
function searchMove(pos,extend){
  searchCursor=Math.max(0,Math.min(editText().length,pos));
  if(!extend) searchAnchor=searchCursor;
  caretOn=true;repaintAll();
}
function searchCharGroup(c){
  if(!c)return 0;
  if(/\s/.test(c))return 0;
  if(/[a-zA-Z0-9_\u0080-\uffff]/.test(c))return 1;
  return 2;
}
function searchWordLeft(pos){
  var s=editText();
  while(pos>0 && searchCharGroup(s.charAt(pos-1))===0)pos--;
  if(pos<=0)return 0;
  var kind=searchCharGroup(s.charAt(pos-1));
  while(pos>0 && searchCharGroup(s.charAt(pos-1))===kind)pos--;
  return pos;
}
function searchWordRight(pos){
  var s=editText(),kind=searchCharGroup(s.charAt(pos));
  if(kind){while(pos<s.length && searchCharGroup(s.charAt(pos))===kind)pos++;}
  while(pos<s.length && searchCharGroup(s.charAt(pos))===0)pos++;
  return pos;
}
function searchDeleteBack(word){
  if(searchHasSelection()){searchReplace('');return;}
  var pos=word?searchWordLeft(searchCursor):Math.max(0,searchCursor-1);
  if(pos===searchCursor)return;
  searchAnchor=pos;searchReplace('');
}
function searchDeleteForward(word){
  if(searchHasSelection()){searchReplace('');return;}
  var pos=word?searchWordRight(searchCursor):Math.min(editText().length,searchCursor+1);
  if(pos===searchCursor)return;
  searchAnchor=pos;searchReplace('');
}
function searchClipboardCopy(){
  if(!searchHasSelection())return;
  var s=searchSelection();
  try{if(utils.SetClipboardText)utils.SetClipboardText(editText().slice(s[0],s[1]));}catch(e){}
}
function searchClipboardPaste(){
  try{if(utils.GetClipboardText){var t=utils.GetClipboardText();if(t)searchReplace(t);}}catch(e){}
}
/* Ctrl+F matches all query words in any order across title, artist,
   album artist and album. Substring match is the default. For Latin tokens
   of 4+ letters, a single typo (insert/delete/replace/transpose) is allowed.
   This is a view-local FILTER, not a reordering of the actual playlist. */
function normFind(s){
  s=String(s||'').toLowerCase();
  try{s=s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'');}catch(e){}
  return s;
}
function fuzzyOneTypo(a,b){
  if(Math.abs(a.length-b.length)>1)return false;
  var i=0,j=0,err=0;
  while(i<a.length && j<b.length){
    if(a.charAt(i)===b.charAt(j)){i++;j++;continue;}
    if(++err>1)return false;
    if(a.length>b.length)i++;
    else if(a.length<b.length)j++;
    else if(i+1<a.length && j+1<b.length && a.charAt(i)===b.charAt(j+1) && a.charAt(i+1)===b.charAt(j)){
      i+=2;j+=2; // common adjacent transposition
    }else{i++;j++;}
  }
  return true;
}
function fuzzyTrackMatch(query,fields){
  // Every token may match ANY metadata field, in ANY order. Short tokens are
  // literal substrings/prefixes; longer ASCII tokens allow one typo as well.
  // Example: "vau rep" matches ALBUM ARTIST=Vaundy and ALBUM=replica.
  var q=normFind(query).replace(/^\s+|\s+$/g,'');
  if(!q)return true;
  var columns=[],words=[];
  for(var i=0;i<fields.length;i++){
    var v=normFind(fields[i]);columns.push(v);
    var pieces=v.split(/[^a-z0-9]+/);
    for(var j=0;j<pieces.length;j++)if(pieces[j])words.push(pieces[j]);
  }
  var tokens=q.split(/\s+/);
  for(var k=0;k<tokens.length;k++){
    var token=tokens[k],ok=false;
    for(i=0;i<columns.length;i++){
      if(columns[i].indexOf(token)!==-1){ok=true;break;}
    }
    if(ok)continue;
    if(token.length<4 || !/^[a-z0-9]+$/.test(token))return false;
    for(j=0;j<words.length;j++){
      var w=words[j];
      var candidate=w.length>token.length+1?w.slice(0,token.length):w;
      if(fuzzyOneTypo(token,candidate)){ok=true;break;}
    }
    if(!ok)return false;
  }
  return true;
}
// Hit-test configuration shared by the full Search page and filtered track lists.
function searchBoxRect(){
  var r=R.main,inline=inlineFilterActive();
  var head=(view==='songs'?SHEAD:(r.w<950?156:M.headH));
  var y=inline?r.y+head+12:r.y+SBOX_TOP-4;
  var x=r.x+M.cpad-2;
  // At compact sizes the queue is an overlay, not part of R.main's width.
  // Keep BOTH the Search page input and the Ctrl+F filter fully to its left.
  var right=r.x+r.w-M.cpad+6;
  if(W<1180 && compactQueueOpen && R.queueW>0){
    // The compact queue's collapse button occupies the 32px immediately
    // to the LEFT of the queue, plus its 10px offset. The search editor
    // must stop before that control (not merely before the queue panel),
    // or its blinking caret repaint can paint over the toggle icon.
    var queueToggleLeft=R.queue.x-32-10;
    right=Math.min(right,queueToggleLeft-12);
  }
  // Inline filters have an X button 10px to the right of the input, 30px
  // wide; leave another 8px of breathing room before the queue/sidebar.
  var reserved=inline?48:0;
  var width=Math.max(8,Math.min(528,right-reserved-x));
  return {x:x,y:y,w:width,h:SBOX_H+8};
}
function searchBoxContains(x,y){var r=searchBoxRect();return x>=r.x && x<r.x+r.w && y>=r.y && y<r.y+r.h;}
function searchHitCursor(px){
  var h=searchTextHit;if(!h)return editText().length;
  var edges=h.edges;
  if(px<=h.x)return h.start;
  for(var i=0;i<edges.length-1;i++)if(px<h.x+(edges[i]+edges[i+1])/2)return h.start+i;
  return h.start+edges.length-1;
}
function searchSelectWord(pos){
  var left=searchWordLeft(pos),right=searchWordRight(pos);
  searchAnchor=left;searchCursor=right;caretOn=true;repaintAll();
}
var SBOX_H=44,SBOX_TOP=26;
function drawSearchBox(gr,r,inline){
  var rect=searchBoxRect(),x0=rect.x+2,boxH=SBOX_H,boxY=rect.y+4,boxW=rect.w-8;
  var query=editText();
  gr.FillSolidRect(x0-2,boxY-4,boxW+8,boxH+8,COL.base);
  gr.FillRoundRect(x0,boxY,boxW,boxH,boxH/2,boxH/2,RGB(42,42,42));
  // No native-input popup: use all available width for inline editing.
  // In an extremely narrow window the queue can leave only a sliver of
  // main content visible. Hide the magnifier before it crowds the caret.
  var showIcon=boxW>=70;
  var txtX=x0+(showIcon?48:9),txtW=Math.max(1,x0+boxW-12-txtX);
  if(showIcon)drawIcon(gr,'search',COL.text2,x0+16,boxY,22,boxH,18);
  var empty=!query.length,caretH=20,caretY=boxY+(boxH-caretH)/2,caretX;
  searchCursor=Math.max(0,Math.min(searchCursor,query.length));
  searchAnchor=Math.max(0,Math.min(searchAnchor,query.length));
  if(empty){
    searchViewStart=0;caretX=txtX;
    searchTextHit={x:txtX,start:0,edges:[0]};
    tL(gr,inline?'Filter tracks...':'What do you want to play?',FONT.searchTxt,COL.text3,txtX+12,boxY,Math.max(1,txtW-12),boxH);
  }else{
    var fs=FONT.searchTxt,start=Math.min(searchViewStart,searchCursor);
    while(start<searchCursor && gr.CalcTextWidth(query.slice(start,searchCursor),fs)>txtW-8)start++;
    while(start>0 && gr.CalcTextWidth(query.slice(start-1,searchCursor),fs)<txtW-8)start--;
    searchViewStart=start;
    var ends=[0],end=start,i;
    for(i=start;i<query.length;i++){
      var cw=gr.CalcTextWidth(query.slice(start,i+1),fs);
      if(cw>txtW-5)break;
      ends.push(cw);end=i+1;
    }
    var shown=query.slice(start,end),sel=searchSelection();
    searchTextHit={x:txtX,start:start,edges:ends};
    if(sel[1]>start && sel[0]<end){
      var a=Math.max(start,sel[0]),b=Math.min(end,sel[1]);
      var left=gr.CalcTextWidth(query.slice(start,a),fs),right=gr.CalcTextWidth(query.slice(start,b),fs);
      gr.FillSolidRect(txtX+left,boxY+9,Math.max(1,right-left),boxH-18,RGBA(72,132,196,175));
    }
    tL(gr,shown,fs,COL.text,txtX,boxY,txtW,boxH);
    caretX=txtX+gr.CalcTextWidth(query.slice(start,searchCursor),fs);
  }
  if(caretOn)gr.FillSolidRect(caretX,caretY,2,caretH,empty?COL.text2:COL.text);
}
function drawInlineFilterBox(gr,r){
  if(!inlineFilterActive())return;
  drawSearchBox(gr,r,true);
  var rect=searchBoxRect(),cx=rect.x+rect.w+10,cy=rect.y+10,cw=30,ch=30;
  HB_FILTER_CLOSE={x0:cx,y0:cy,x1:cx+cw,y1:cy+ch};
  if(hv(cx,cy,cx+cw,cy+ch))gr.FillRoundRect(cx,cy,cw,ch,7,7,COL.rowHover);
  gr.DrawLine(cx+10,cy+10,cx+20,cy+20,2,COL.text2);
  gr.DrawLine(cx+20,cy+10,cx+10,cy+20,2,COL.text2);
}
/* Artists + Songs are one continuously-scrolled document (same model as the home artist grid).
   The search box stays pinned: content is drawn first and allowed to overflow upward, then the
   band above the viewport is painted over and the box redrawn on top. */
function drawSearch(gr,r){
  HB_CARD=[]; HB_TR=[];
  computeSearch();
  var pad=M.cpad, x0=r.x+pad, w=r.w-pad*2, i;
  var boxH=SBOX_H, boxY=r.y+SBOX_TOP;
  if(!searchQuery.length){
    drawSearchBox(gr,r);
    tL(gr,'Search your playlists and library.',FONT.qArtist,COL.text3,x0+2,boxY+boxH+18,w,18);
    return;
  }
  if(!searchArts.length && !searchAlbums.length && !searchTrks.length){
    drawSearchBox(gr,r);
    tC(gr,'No results found for "'+searchQuery+'"',FONT.sect,COL.text2,r.x,r.y+Math.round(r.h/2),r.w,24);
    return;
  }
  var top=boxY+boxH+26, cropY=r.y+r.h, viewH=cropY-top;
  // ---- measure the document, then clamp the scroll to it ----
  var gap=16, cardW=176, cols=Math.max(2,Math.floor((w+gap)/(cardW+gap)));
  cardW=Math.floor((w-gap*(cols-1))/cols);
  var cardH=cardW+56, rh=56, durW=64;
  var artsH=searchArts.length?(42+Math.ceil(searchArts.length/cols)*(cardH+8)+18):0;
  var albumRh=72,albumsH=searchAlbums.length?(42+searchAlbums.length*albumRh+14):0;
  var contentH=artsH+albumsH+(searchTrks.length?(38+searchTrks.length*rh):0);
  var maxPx=Math.max(0,contentH-viewH);
  SEARCH_MAXPX=maxPx;
  searchScroll=clampPx(searchScroll,maxPx); searchScrollT=clampPx(searchScrollT,maxPx);
  var cy=top-searchScroll;
  // ---- artists ----
  if(searchArts.length){
    tL(gr,'Artists',FONT.sect2,COL.text,x0,cy,w,28);
    var gy=cy+42;
    for(i=0;i<searchArts.length;i++){
      var ay=gy+Math.floor(i/cols)*(cardH+8);
      if(ay>=cropY) break;
      if(ay+cardH<=top) continue;
      drawArtistCard(gr,x0+(i%cols)*(cardW+gap),ay,cardW,searchArts[i],top,cropY);
    }
    cy+=artsH;
  }
  // ---- albums: click a result to open its complete track listing ----
  if(searchAlbums.length){
    tL(gr,'Albums',FONT.sect2,COL.text,x0,cy,w,28);
    var ary0=cy+42;
    for(i=0;i<searchAlbums.length;i++){
      var ary=ary0+i*albumRh,alb=searchAlbums[i];
      if(ary>=cropY) break;
      if(ary+albumRh<=top) continue;
      var topHit=Math.max(top,ary),bottomHit=Math.min(cropY,ary+albumRh);
      if(hv(x0-8,topHit,x0+w+8,bottomHit)) gr.FillRoundRect(x0-8,ary,w+16,albumRh,5,5,COL.rowHover);
      if(ary>=top && ary+albumRh<=cropY){
        drawCover(gr,x0,ary+8,52,5,alb.handle,alb.album);
        tL(gr,alb.album,FONT.rowTitle,COL.text,x0+66,ary+8,w-72,27);
        tL(gr,alb.artist+(alb.year?('  '+CH_DOT+'  '+alb.year):'')+'  '+CH_DOT+'  '+alb.tracks.length+' songs',FONT.rowArtist,COL.text2,x0+66,ary+34,w-72,20);
      }
      if(bottomHit>topHit) HB_CARD.push({x0:x0-8,y0:topHit,x1:x0+w+8,y1:bottomHit,kind:'album',album:alb});
    }
    cy+=albumsH;
  }
  // ---- songs ----
  if(searchTrks.length){
    tL(gr,'Songs',FONT.sect2,COL.text,x0,cy,w,28);
    var ry0=cy+38;
    for(i=0;i<searchTrks.length;i++){
      var ry=ry0+i*rh;
      if(ry>=cropY) break;
      if(ry+rh<=top) continue;
      var tr=searchTrks[i];
      if(isTrackSelected({srch:true,idx:i})) gr.FillRoundRect(x0-8,ry,w+16,rh,4,4,COL.rowActive);
      else if(hv(r.x,Math.max(ry,top),r.x+r.w,Math.min(ry+rh,cropY))) gr.FillRoundRect(x0-8,ry,w+16,rh,4,4,COL.rowHover);
      drawCover(gr,x0,ry+8,40,4,tr.h,tr.album||tr.title);
      tL(gr,tr.title,FONT.rowTitle,COL.text,x0+52,ry+8,w-52-durW,20);
      tL(gr,tr.artist+(tr.album?('  '+CH_BULL+'  '+tr.album):''),FONT.rowArtist,COL.text2,x0+52,ry+30,w-52-durW,16);
      tR(gr,tr.len,FONT.rowCell,COL.text2,r.x+r.w-pad-durW,ry,durW,rh);
      var hy0=Math.max(ry,top), hy1=Math.min(ry+rh,cropY);   // clip the click target to the viewport
      if(hy1>hy0) HB_TR.push({x0:x0-8,y0:hy0,x1:r.x+r.w-pad+8,y1:hy1,srch:true,idx:i});
    }
  }
  // ---- mask the overflow, re-pin the search box, then the scrollbar ----
  gr.FillSolidRect(r.x,r.y,r.w,top-r.y,COL.base);
  gr.FillSolidRect(r.x,cropY,r.w,M.pad+2,COL.black);
  drawSearchBox(gr,r);
  drawScrollbar(gr,x0+w+8,top,viewH,searchScroll,maxPx,viewH,contentH,hv(x0,top,x0+w+16,cropY)||drag==='scroll');
}
