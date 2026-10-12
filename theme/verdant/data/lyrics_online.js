/* Manual LRCLIB lookup. Never sends a request during painting or playback changes. */
var lyOnline=null, lyRequest=null, lyRequestTimer=null, lyOnlineCache={}, lyOnlineKeys=[], HB_LY_ACTION=[];
var lyRetryAt=0;
var lyDialog=null, LY_DIALOG_HB=null;
var lyDialogDoubleClickUp=false;
function lyricTrackKey(h){return h?String(h.Path)+'|'+h.SubSong:null;}
function stopLyricRequest(){
  if(lyRequestTimer!==null){window.ClearInterval(lyRequestTimer);lyRequestTimer=null;}
  if(lyRequest){try{lyRequest.abort();}catch(e){}lyRequest=null;}
}
function lyricOnlineState(){return lyOnline&&lyOnline.key===lyricTrackKey(NP)?lyOnline:null;}
function rememberOnlineLyrics(key,text){
  if(!lyOnlineCache.hasOwnProperty(key))lyOnlineKeys.push(key);
  lyOnlineCache[key]=text;
  while(lyOnlineKeys.length>20)delete lyOnlineCache[lyOnlineKeys.shift()];
}
function searchOnlineLyrics(){
  if(!NP)return;
  if(Date.now()<lyRetryAt)return;
  stopLyricRequest();
  var h=NP,title=TF.npTitle.EvalWithMetadb(h),artist=TF.npArtist.EvalWithMetadb(h);
  if(!title||!artist){fb.ShowPopupMessage('Add title and artist metadata before searching LRCLIB.','Verdant');return;}
  lyOnline={key:lyricTrackKey(h),handle:h,status:'Searching LRCLIB...',results:[],started:Date.now()};
  openLyricDialog(lyOnline);
  try{
    lyRequest=new ActiveXObject('MSXML2.XMLHTTP.6.0');
    lyRequest.open('GET','https://lrclib.net/api/search?track_name='+encodeURIComponent(title)+'&artist_name='+encodeURIComponent(artist),true);
    lyRequest.setRequestHeader('Lrclib-Client','Verdant/1.2.0 (https://github.com/superziper/verdant-foobar2000-theme)');
    lyRequest.send();
    lyRequestTimer=window.SetInterval(pollOnlineLyrics,100);
  }catch(e){stopLyricRequest();lyOnline.status='Search failed. Check your connection.';}
  repaintAll();
}
function pollOnlineLyrics(){
  if(!lyRequest)return;
  if(!lyricOnlineState()){stopLyricRequest();return;}
  if(Date.now()-lyOnline.started>20000){stopLyricRequest();lyOnline.status='Search timed out. Try again.';repaintAll();return;}
  try{
    if(lyRequest.readyState!==4)return;
    var status=lyRequest.status,body=lyRequest.responseText;
    if(status===429){
      var retry=lyRequest.getResponseHeader('Retry-After'),wait=Number(retry);
      lyRetryAt=retry&&isFinite(wait)?Date.now()+Math.max(1,wait)*1000:Math.max(Date.now()+1000,Date.parse(retry)||Date.now()+60000);
      lyOnline.retryAt=lyRetryAt;
      lyOnline.status='Rate limited. Please wait before retrying.';
    }else if(status!==200)lyOnline.status='Search failed (HTTP '+status+').';
    else{
      var rows=JSON.parse(body);
      if(!Array.isArray(rows))throw new Error('Invalid response');
      lyOnline.results=rows.filter(function(r){return r&&!r.instrumental&&(r.syncedLyrics||r.plainLyrics);}).slice(0,20);
      lyOnline.status=lyOnline.results.length?lyOnline.results.length+' result(s). Choose a version.':'No matching lyrics found.';
    }
  }catch(e){lyOnline.status='Could not read the LRCLIB response.';}
  stopLyricRequest();repaintAll();
}
function chooseOnlineLyrics(x,y){
  var state=lyricOnlineState();if(!state||!state.results.length)return;
  openLyricDialog(state);repaintAll();
}
function onlineLyricsMenu(x,y){
  if(!NP)return;
  openLyricsContextMenu(x,y,NP,currentLyricsText(NP),true);
}
function drawLyricActions(gr,x,y,w){
  HB_LY_ACTION=[];if(!NP)return;
  var state=lyricOnlineState(),busy=state&&lyRequest,blocked=lyRetryAt>Date.now();
  var available=!noLyrics(),results=state&&state.results.length;
  var label=available?'Lyrics options':busy?'Searching...':results?'Choose lyrics': 'Search lyrics';
  var canSearch=noLyrics()&&!busy&&!blocked;
  gr.FillRoundRect(x,y,w,32,16,16,COL.elev);tC(gr,label,FONT.plSub,!available&&(busy||blocked)?COL.text3:COL.text2,x,y,w,32);
  if(available||results||canSearch)HB_LY_ACTION.push({x0:x,y0:y,x1:x+w,y1:y+32,act:available?'options':results?'choose':'search'});
  if(state)tC(gr,state.status,FONT.qArtist,COL.text3,x,y-24,w,20);
}
function lyricActionClick(x,y){
  var action=hit(HB_LY_ACTION,x,y);if(!action)return false;
  if(action.act==='search')searchOnlineLyrics();
  else if(action.act==='choose')chooseOnlineLyrics(x,y);
  else onlineLyricsMenu(x,y);
  return true;
}
function openLyricDialog(state){
  lyDialog={state:state,selected:0,first:0,scroll:0,max:0,wrap:null};LY_DIALOG_HB=null;
}
function closeLyricDialog(){
  if(lyRequest){stopLyricRequest();if(lyOnline)lyOnline.status='Search canceled. Try again.';}
  lyDialog=null;LY_DIALOG_HB=null;repaintAll();
}
function applyLyricDialog(){
  if(!lyDialog||lyDialog.state!==lyricOnlineState())return;
  var state=lyDialog.state,chosen=state.results[lyDialog.selected];if(!chosen)return;
  var text=chosen.syncedLyrics||chosen.plainLyrics;
  rememberOnlineLyrics(state.key,text);lyricsFor=null;loadLyrics();
  // An explicit preview can replace currently displayed local lyrics without writing them.
  lyrics=parseLyrics(text);lyLay={lyr:null,w:-1};lySnap=true;lyStScroll=0;
  state.status='LRCLIB preview';closeLyricDialog();
}
function lyricPanelMenu(x,y){
  var handle=NP;if(!handle)return;
  openLyricsContextMenu(x,y,handle,currentLyricsText(handle),true);
}
function openLyricsContextMenu(x,y,handle,text,includeSearch){
  var state=lyricOnlineState(),items=[];
  if(includeSearch)items.push({label:'Search lyrics...',act:'lysearch',disabled:!!lyRequest||Date.now()<lyRetryAt});
  items.push({label:'Choose search result...',act:'lyresults',disabled:!state||!state.results.length});
  items.push({separator:true});
  items.push({label:'Edit lyrics...',act:'lyedit'});
  items.push({label:'Save lyrics to metadata...',act:'lysave',disabled:!String(text||'').trim()});
  items.push({separator:true},{label:'Delete lyrics from metadata...',act:'lydelete',danger:true,disabled:!embeddedLyrics(handle)});
  ctxMenu={kind:'lyrics',x:x,y:y,handle:handle,text:text,items:items};CTX_HB=[];repaintAll();
}
function handleLyricsMenuAction(action,menu){
  ctxMenu=null;CTX_HB=[];repaintAll();
  if(lyricTrackKey(menu.handle)!==lyricTrackKey(NP))return;
  if(action==='lysearch'){if(!lyRequest&&Date.now()>=lyRetryAt)searchOnlineLyrics();return;}
  if(action==='lyresults'){chooseOnlineLyrics(menu.x,menu.y);return;}
  if(action==='lyedit'){openLyricsEditor(menu.handle,menu.text);return;}
  if(action==='lydelete'){
    confirmDel={kind:'lyricsdelete',handle:menu.handle,name:TF.npTitle.EvalWithMetadb(menu.handle)};
    repaintAll();return;
  }
  var text=String(menu.text||''),field=parseLyrics(text).hasTiming?'SYNCEDLYRICS':'LYRICS';
  if(action==='lysave'){
    ctxMenu={kind:'lyrics',x:menu.x,y:menu.y,handle:menu.handle,text:text,
      items:[{label:'Replace '+field+' with these lyrics',act:'lysaveconfirm'},{label:'Cancel',act:'lycancel'}]};
    repaintAll();return;
  }
  if(action!=='lysaveconfirm'||!text.trim())return;
  try{
    var values={};values[field]=text;
    songList([menu.handle]).UpdateFileInfoFromJSON(JSON.stringify(values));
    var state=lyricOnlineState();if(state)state.status='Metadata write requested';
  }catch(e){fb.ShowPopupMessage('Could not save lyrics: '+String(e),'Verdant');}
  repaintAll();
}
function deleteLyricsMetadata(handle){
  try{
    var values={},info=handle.GetFileInfo(true);
    for(var i=0;i<LYRIC_META_FIELDS.length;i++)if(info.MetaFind(LYRIC_META_FIELDS[i])>=0)values[LYRIC_META_FIELDS[i]]='';
    if(!Object.keys(values).length)return;
    songList([handle]).UpdateFileInfoFromJSON(JSON.stringify(values));
    var key=lyricTrackKey(handle);delete lyOnlineCache[key];
    lyOnlineKeys=lyOnlineKeys.filter(function(k){return k!==key;});
    if(lyOnline&&lyOnline.key===key)lyOnline.status='Lyric metadata removal requested';
    if(lyricTrackKey(NP)===key){lyricsFor=null;loadLyrics();}
  }catch(e){fb.ShowPopupMessage('Could not delete lyric metadata: '+String(e),'Verdant');}
  repaintAll();
}
function selectLyricResult(index){
  if(!lyDialog)return;
  index=Math.max(0,Math.min(lyDialog.state.results.length-1,index));
  if(index!==lyDialog.selected){lyDialog.selected=index;lyDialog.scroll=0;lyDialog.wrap=null;}
  if(LY_DIALOG_HB){var page=LY_DIALOG_HB.page;if(index<lyDialog.first)lyDialog.first=index;else if(index>=lyDialog.first+page)lyDialog.first=index-page+1;}
  repaintAll();
}
function drawLyricDialog(gr){
  if(!lyDialog)return;
  var d=lyDialog,state=d.state,rows=state.results,valid=state===lyricOnlineState();
  var w=Math.min(860,W-40),h=Math.min(600,H-32),y=Math.round((H-h)/2),x=modalPanel(gr,w,h,y);
  tL(gr,'Find lyrics - LRCLIB',FONT.sect,COL.text,x+24,y+18,w-48,26);
  tCE(gr,valid?state.status:'The playing track changed. Close and search again.',FONT.qArtist,COL.text3,x+24,y+49,w-48,22);
  var wide=w>=640,top=y+82,contentH=h-156,resultsW=wide?Math.round((w-60)*0.4):w-48;
  var listH=wide?contentH:Math.min(132,Math.round(contentH*0.4));
  var list={x0:x+24,y0:top,x1:x+24+resultsW,y1:top+listH};
  var preview={x0:wide?list.x1+16:x+24,y0:wide?top:list.y1+14,x1:x+w-24,y1:top+contentH};
  var rowH=Math.min(66,listH),page=Math.max(1,Math.floor(listH/rowH)),hits=[];
  d.first=Math.max(0,Math.min(d.first,Math.max(0,rows.length-page)));
  gr.FillRoundRect(list.x0,list.y0,resultsW,listH,8,8,COL.base);
  for(var i=d.first;i<Math.min(rows.length,d.first+page);i++){
    var row=rows[i],ry=top+(i-d.first)*rowH,seconds=Math.round(Number(row.duration)||0),selected=i===d.selected;
    if(selected)gr.FillRoundRect(list.x0+4,ry+3,resultsW-12,rowH-6,6,6,COL.elev);
    tCE(gr,row.trackName||'Untitled',FONT.pl,selected?COL.accent:COL.text,list.x0+12,ry+7,resultsW-30,20);
    if(rowH>=60){
      tCE(gr,(row.artistName||'')+' - '+(row.albumName||'Unknown album'),FONT.qArtist,COL.text2,list.x0+12,ry+27,resultsW-30,18);
      tL(gr,Math.floor(seconds/60)+':'+('0'+seconds%60).slice(-2)+' / '+(row.syncedLyrics?'Synced':'Plain'),FONT.qArtist,COL.text3,list.x0+12,ry+45,resultsW-30,18);
    }
    hits.push({x0:list.x0,y0:ry,x1:list.x1,y1:ry+rowH,index:i});
  }
  if(rows.length>page){var sh=Math.max(18,listH*page/rows.length);gr.FillRoundRect(list.x1-6,top+(listH-sh)*d.first/Math.max(1,rows.length-page),3,sh,1,1,COL.text3);}
  gr.FillRoundRect(preview.x0,preview.y0,preview.x1-preview.x0,preview.y1-preview.y0,8,8,COL.base);
  var chosen=rows[d.selected],pw=preview.x1-preview.x0-28,ph=preview.y1-preview.y0-20;
  if(chosen){
    if(!d.wrap||d.wrap.row!==chosen||d.wrap.w!==pw){
      var parsed=parseLyrics(chosen.syncedLyrics||chosen.plainLyrics),lines=[];
      for(var j=0;j<parsed.lines.length;j++){
        var parts=gr.EstimateLineWrap(parsed.lines[j].text||' ',FONT.pl,pw);
        for(var k=0;k<parts.length;k+=2)lines.push(parts[k]);
      }
      d.wrap={row:chosen,w:pw,lines:lines,lh:Math.round(gr.CalcTextHeight('Ag',FONT.pl))+7};
    }
    var lh=d.wrap.lh;d.max=Math.max(0,d.wrap.lines.length*lh-ph);d.scroll=Math.max(0,Math.min(d.scroll,d.max));
    for(var n=Math.floor(d.scroll/lh);n<d.wrap.lines.length;n++){
      var ty=preview.y0+10+n*lh-d.scroll;if(ty+lh>preview.y1-10)break;if(ty<preview.y0+10)continue;
      tL(gr,d.wrap.lines[n],FONT.pl,COL.text,preview.x0+12,ty,pw,lh);
    }
    if(d.max>0){var thumb=Math.max(18,ph*ph/(d.wrap.lines.length*lh));gr.FillRoundRect(preview.x1-6,preview.y0+10+(ph-thumb)*d.scroll/d.max,3,thumb,1,1,COL.text3);}
  }else tC(gr,lyRequest?'Searching...':'Select a result to preview its lyrics.',FONT.qArtist,COL.text3,preview.x0+10,preview.y0+12,pw,40);
  var gap=12,bw=Math.min(150,Math.floor((w-48-gap*3)/4)),bx=x+(w-(bw*4+gap*3))/2,by=y+h-54;
  var cancel=dlgBtn(gr,bx,by,bw,36,'Cancel',COL.elev,RGB(66,66,66),COL.text);
  var retry=dlgBtn(gr,bx+bw+gap,by,bw,36,'Search again',COL.elev,RGB(66,66,66),COL.text);
  var edit=dlgBtn(gr,bx+2*(bw+gap),by,bw,36,'Edit lyrics',COL.elev,chosen&&valid?RGB(66,66,66):COL.elev,chosen&&valid?COL.text:COL.text3);
  var use=dlgBtn(gr,bx+3*(bw+gap),by,bw,36,'Use lyrics',chosen&&valid?COL.accent:COL.elev,chosen&&valid?COL.accentHover:COL.elev,chosen&&valid?COL.onAccent:COL.text3);
  LY_DIALOG_HB={panel:{x0:x,y0:y,x1:x+w,y1:y+h},list:list,preview:preview,rows:hits,page:page,cancel:cancel,retry:retry,edit:edit,use:use};
}
function lyricDialogClick(x,y){
  var hb=LY_DIALOG_HB;if(!hb)return;
  if(inRect(x,y,hb.cancel)||!inRect(x,y,hb.panel)){closeLyricDialog();return;}
  if(inRect(x,y,hb.retry)){if(!lyRequest&&Date.now()>=lyRetryAt)searchOnlineLyrics();return;}
  if(inRect(x,y,hb.edit)){editLyricDialogSelection();return;}
  if(inRect(x,y,hb.use)){applyLyricDialog();return;}
  var row=hit(hb.rows,x,y);if(row)selectLyricResult(row.index);
}
function lyricDialogDoubleClick(x,y){
  if(!lyDialog||!LY_DIALOG_HB)return;
  var row=hit(LY_DIALOG_HB.rows,x,y);if(!row)return;
  selectLyricResult(row.index);applyLyricDialog();
  // Consume the release after WM_LBUTTONDBLCLK so it cannot click the view underneath.
  if(!lyDialog)lyDialogDoubleClickUp=true;
}
function lyricDialogWheel(step){
  if(!LY_DIALOG_HB||!lyDialog)return;
  if(inRect(mx,my,LY_DIALOG_HB.list))lyDialog.first=Math.max(0,Math.min(lyDialog.state.results.length-LY_DIALOG_HB.page,lyDialog.first-step*2));
  else if(inRect(mx,my,LY_DIALOG_HB.preview))lyDialog.scroll=Math.max(0,Math.min(lyDialog.max,lyDialog.scroll-step*60));
  repaintAll();
}
