/* Native multiline editor. Data enters the textarea as text, never as HTML. */
function currentLyricsText(h){
  var key=lyricTrackKey(h);
  if(lyOnlineCache[key])return lyOnlineCache[key];
  var base=h.Path.replace(/\.[^.\\\/]+$/,'');
  return embeddedLyrics(h)||readFirst([base+'.lrc',base+'.txt'])||'';
}
function editLyricDialogSelection(){
  if(!lyDialog||lyDialog.state!==lyricOnlineState())return;
  var state=lyDialog.state,row=state.results[lyDialog.selected];if(!row)return;
  closeLyricDialog();openLyricsEditor(state.handle,row.syncedLyrics||row.plainLyrics);
}
function plainLyricsText(text){
  return String(text).replace(/^\uFEFF/,'').replace(/\[\d+:\d+(?:[.:]\d+)?\]/g,'').replace(/^\s*\[(?:ar|al|ti|by|offset|length|re|ve):[^\r\n]*\]\s*$/gmi,'').trim();
}
function lyricTimestamp(seconds){
  var ticks=Math.floor(Math.max(0,Number(seconds)||0)*100),mins=Math.floor(ticks/6000),secs=Math.floor(ticks/100)%60,centis=ticks%100;
  return '['+('0'+mins).slice(-Math.max(2,String(mins).length))+':'+('0'+secs).slice(-2)+'.'+('0'+centis).slice(-2)+']';
}
function lyricsEditorAction(h,action,text,overwrite){
  try{
    if(action==='playback'||action==='toggle'||action==='seek'||action==='seekrelative'){
      var active=fb.IsPlaying||fb.IsPaused,same=active&&lyricTrackKey(fb.GetNowPlaying())===lyricTrackKey(h);
      if(action==='toggle'){
        if(same)fb.PlayOrPause();else playHandleList([h],0);
      }else if(action==='seek'||action==='seekrelative'){
        if(!same)throw new Error('Play this editor\'s track before seeking.');
        var seconds=Number(text);if(!isFinite(seconds))throw new Error('Invalid seek position.');
        fb.PlaybackTime=Math.max(0,Math.min(Math.max(0,fb.PlaybackLength-0.01),action==='seekrelative'?fb.PlaybackTime+seconds:seconds));
      }
      active=fb.IsPlaying||fb.IsPaused;same=active&&lyricTrackKey(fb.GetNowPlaying())===lyricTrackKey(h);
      return JSON.stringify({ok:true,same:!!same,paused:!!fb.IsPaused,position:same?fb.PlaybackTime:0,duration:same?fb.PlaybackLength:Number(h.Length)||0});
    }
    if(action==='time'){
      if(!(fb.IsPlaying||fb.IsPaused)||lyricTrackKey(fb.GetNowPlaying())!==lyricTrackKey(h))throw new Error('Play this editor\'s track before adding a timestamp.');
      return JSON.stringify({ok:true,stamp:lyricTimestamp(fb.PlaybackTime)});
    }
    text=String(text||'').replace(/\r\n?/g,'\n');
    if(!text.trim())throw new Error('Enter lyrics before saving or using them.');
    if(action==='preview'){
      rememberOnlineLyrics(lyricTrackKey(h),text);
      if(lyOnline&&lyOnline.key===lyricTrackKey(h))lyOnline.status='Edited lyrics preview';
      if(lyricTrackKey(NP)===lyricTrackKey(h)){lyricsFor=null;loadLyrics();lyrics=parseLyrics(text);lyLay={lyr:null,w:-1};lySnap=true;lyStScroll=0;repaintAll();}
      return JSON.stringify({ok:true,message:'Lyrics applied to the panel. Not saved to disk.'});
    }
    if(action==='metadata'){
      if(!overwrite)return JSON.stringify({confirm:true,message:'Replace the embedded lyric fields for this track?'});
      var timed=parseLyrics(text).hasTiming,values={LYRICS:plainLyricsText(text),SYNCEDLYRICS:timed?text:''};
      var aliases=['SYNCED LYRICS','SYNCED_LYRICS','UNSYNCED LYRICS','UNSYNCEDLYRICS','UNSYNCED_LYRICS'];
      var info=h.GetFileInfo(true);
      for(var i=0;i<aliases.length;i++)if(info.MetaFind(aliases[i])>=0)values[aliases[i]]='';
      songList([h]).UpdateFileInfoFromJSON(JSON.stringify(values));
      return JSON.stringify({ok:true,message:'Metadata write requested. Foobar2000 reports any tagging errors.'});
    }
    if(action!=='txt'&&action!=='lrc')throw new Error('Unknown editor action.');
    if(!/^(?:[a-zA-Z]:[\\\/]|\\\\)/.test(h.Path)||Number(h.SubSong)>0)throw new Error('Sidecar saving requires a local, single-track file. Use metadata for this track.');
    if(action==='lrc'&&!parseLyrics(text).hasTiming)throw new Error('Add timestamps before saving a timed .lrc file.');
    var path=h.Path.replace(/\.[^.\\\/]+$/,'')+'.'+action;
    if(utils.FileTest(path,'e')&&!overwrite)return JSON.stringify({confirm:true,message:'Replace the existing lyric file?\n'+path});
    var content=action==='txt'?plainLyricsText(text):text;
    if(!utils.WriteTextFile(path,content,true))throw new Error('Could not write the lyric file. Check folder permissions.');
    if(String(utils.ReadUTF8(path)).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n')!==content)throw new Error('Could not verify the saved lyric file.');
    if(lyricTrackKey(NP)===lyricTrackKey(h)){lyricsFor=null;loadLyrics();repaintAll();}
    return JSON.stringify({ok:true,message:'Saved: '+path});
  }catch(e){return JSON.stringify({ok:false,message:String(e.message||e)});}
}
function openLyricsEditor(h,text){
  if(!h)return;
  try{
    utils.ShowHtmlDialog(0,lyricsEditorHtml(),{width:780,height:650,resizable:true,selection:true,context_menu:true,scroll:false,
      data:[JSON.stringify({text:String(text||''),title:TF.npTitle.EvalWithMetadb(h),artist:TF.npArtist.EvalWithMetadb(h)}),function(action,value,overwrite){return lyricsEditorAction(h,action,value,overwrite);}]});
  }catch(e){fb.ShowPopupMessage('Could not open the lyrics editor: '+String(e),'Otoha');}
}
function lyricsEditorHtml(){return `<!doctype html>
<html><head><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta charset="utf-8"><title>Edit lyrics</title>
<style>
html,body{height:100%;margin:0;background:${THEME_COLORS.editorMain};color:${THEME_COLORS.editorText};font:14px "Segoe UI",Meiryo,sans-serif;overflow:hidden}
#header{padding:18px 22px}h2{margin:0 0 6px;font-size:20px}#track{color:${THEME_COLORS.textSecondary};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#tools{padding:0 22px 12px}button{border:0;border-radius:18px;background:${THEME_COLORS.editorButton};color:${THEME_COLORS.textSecondary};padding:9px 16px;margin-right:8px;font:13px "Segoe UI",Meiryo,sans-serif;cursor:pointer}button:hover{background:${THEME_COLORS.editorButtonHover};color:${THEME_COLORS.text}}
button:disabled{color:${THEME_COLORS.editorDisabled};cursor:default}#transport{margin-top:10px}#seek{width:240px;vertical-align:middle}#clock{color:${THEME_COLORS.textSecondary};margin-left:8px;font-size:12px;white-space:nowrap}
#edit{position:absolute;top:134px;bottom:117px;left:22px;right:22px}textarea{width:100%;height:100%;box-sizing:border-box;resize:none;border:1px solid ${THEME_COLORS.editorBorder};border-radius:8px;background:${THEME_COLORS.editorField};color:${THEME_COLORS.editorText};padding:12px;font:15px/1.65 Consolas,Meiryo,monospace;overflow:auto}
#footer{position:absolute;bottom:0;left:0;right:0;padding:14px 22px}#status{height:34px;margin-bottom:8px;color:${THEME_COLORS.textSecondary};overflow:auto;font-size:12px}#use{background:${THEME_COLORS.accent};color:${THEME_COLORS.onAccent}}#hint{font-size:12px;color:${THEME_COLORS.textSecondary};margin-top:7px}
#use:hover{background:${THEME_COLORS.accentHover}}#use:active{background:${THEME_COLORS.accentPressed}}textarea:focus{outline:1px solid ${THEME_COLORS.accent}}
#seek::-ms-track{background:transparent;border-color:transparent;color:transparent;height:4px}#seek::-ms-fill-lower{background:${THEME_COLORS.accent}}#seek::-ms-fill-upper{background:${THEME_COLORS.seekRail}}#seek::-ms-thumb{background:${THEME_COLORS.accent};border:0;width:12px;height:12px;border-radius:6px}#seek:hover::-ms-thumb{background:${THEME_COLORS.accentHover}}#seek:active::-ms-thumb{background:${THEME_COLORS.accentPressed}}
</style></head><body>
<div id="header"><h2>Edit lyrics</h2><div id="track"></div></div>
<div id="tools"><button id="stamp" type="button">Add current timestamp (F3)</button><div id="hint">F3 stamps the cursor line. F4 pauses/resumes. F2 / F5 seek back/forward 5 seconds.</div><div id="transport"><button id="toggle" type="button">Play / pause (F4)</button><button id="back" type="button">-5s (F2)</button><button id="forward" type="button">+5s (F5)</button><input id="seek" type="range" min="0" max="0" step="0.1" value="0" aria-label="Playback position"><span id="clock"></span></div></div>
<div id="edit"><textarea id="lyrics" spellcheck="false" aria-label="Lyrics editor"></textarea></div>
<div id="footer"><div id="status" role="status"></div><button id="use" type="button">Use lyrics</button><button id="txt" type="button">Save .txt</button><button id="lrc" type="button">Save .lrc</button><button id="metadata" type="button">Save metadata</button><button id="close" type="button">Close</button></div>
<script>
var args=window.external.dialogArguments.toArray(),initial=JSON.parse(args[0]),bridge=args[1],box=document.getElementById('lyrics'),lastSaved=initial.text,lastStart=0,lastEnd=0;
box.value=initial.text;document.getElementById('track').innerText=initial.title+' - '+initial.artist;
function status(message){document.getElementById('status').innerText=message;}
function layout(){var tools=document.getElementById('tools'),footer=document.getElementById('footer'),edit=document.getElementById('edit');edit.style.top=(tools.offsetTop+tools.offsetHeight+6)+'px';edit.style.bottom=(footer.offsetHeight+12)+'px';}
window.onresize=layout;
function call(action,overwrite){return JSON.parse(bridge(action,box.value,!!overwrite));}
var seek=document.getElementById('seek'),scrubbing=false;
function clock(seconds){seconds=Math.floor(Math.max(0,Number(seconds)||0));return Math.floor(seconds/60)+':'+('0'+seconds%60).slice(-2);}
function updatePlayback(result){
  if(!result.ok){status(result.message);return;}
  document.getElementById('toggle').innerText=result.same?(result.paused?'Resume (F4)':'Pause (F4)'):'Play this track (F4)';
  document.getElementById('back').disabled=document.getElementById('forward').disabled=seek.disabled=!result.same;
  if(!scrubbing){seek.max=result.duration||0;seek.value=result.position||0;}
  document.getElementById('clock').innerText=clock(result.position)+' / '+clock(result.duration);
}
function control(action,value){try{updatePlayback(JSON.parse(bridge(action,String(value||0),false)));}catch(e){status('Playback control failed: '+e.message);}}
document.getElementById('toggle').onclick=function(){control('toggle');};
document.getElementById('back').onclick=function(){control('seekrelative',-5);};
document.getElementById('forward').onclick=function(){control('seekrelative',5);};
seek.onmousedown=function(){scrubbing=true;};seek.onchange=function(){scrubbing=false;control('seek',seek.value);};seek.onblur=function(){scrubbing=false;};
var playbackTimer=window.setInterval(function(){control('playback');},250);
window.onunload=function(){window.clearInterval(playbackTimer);};
function rememberSelection(){lastStart=box.selectionStart;lastEnd=box.selectionEnd;}
box.onkeyup=box.onclick=box.onselect=rememberSelection;
function save(action){try{var result=call(action,false);if(result.confirm){if(!window.confirm(result.message))return;result=call(action,true);}status(result.message||'');if(result.ok&&action!=='preview')lastSaved=box.value;}catch(e){status('Operation failed: '+e.message);}}
document.getElementById('stamp').onmousedown=function(){rememberSelection();};
document.getElementById('stamp').onclick=function(){try{var result=call('time',false);if(!result.ok){status(result.message);return;}
  var text=box.value,pos=lastStart,start=pos===0?0:text.lastIndexOf('\\n',pos-1)+1,end=text.indexOf('\\n',pos);if(end<0)end=text.length;
  var line=text.substring(start,end).replace(/\\[\\d+:\\d+(?:[.:]\\d+)?\\]/g,'').replace(/^[ \\t]+/,''),replacement=result.stamp+' '+line;
  box.value=text.substring(0,start)+replacement+text.substring(end);box.focus();var next=end<text.length?start+replacement.length+1:start+result.stamp.length+1;
  box.setSelectionRange(next,next);rememberSelection();status('Added '+result.stamp+'. Cursor moved to the next line.');
}catch(e){status('Could not add timestamp: '+e.message);}};
document.onkeydown=function(event){var e=event||window.event,key=e.keyCode||e.which;if(key>=113&&key<=116&&!e.ctrlKey&&!e.altKey&&!e.shiftKey){
  if(e.preventDefault)e.preventDefault();e.returnValue=false;
  if(key===114){rememberSelection();document.getElementById('stamp').onclick();}
  else if(key===115)control('toggle');else control('seekrelative',key===113?-5:5);
  return false;
}};
document.getElementById('use').onclick=function(){save('preview');};
document.getElementById('txt').onclick=function(){save('txt');};
document.getElementById('lrc').onclick=function(){save('lrc');};
document.getElementById('metadata').onclick=function(){save('metadata');};
document.getElementById('close').onclick=function(){window.close();};
window.onbeforeunload=function(){if(box.value!==lastSaved)return 'Close without saving the latest lyrics?';};
box.focus();layout();control('playback');
</script></body></html>`;}
