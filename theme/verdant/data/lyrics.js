/* verdant/data/lyrics.js -- .lrc / .txt lyrics: load, parse, layout, rolling render
   Part of Verdant, a Spotify-style theme for foobar2000. Loaded by main.js;
   every module shares one global scope, so load order is set there. */

/* ------------------------- lyrics (.lrc / .txt beside the track) ------------------------- */
var lyricsFor=null, lyrics=null; // {lines:[{t,text}],synced} | 'none'
var lyScroll=0, lyTarget=0, lyCur=0, lyTimer=null, lySnap=true, lyLay={lyr:null,w:-1};   // pixel roll: lines wrap
var lyStScroll=0, lyStMax=0;   // unsynced lyrics: wheel-driven offset + its clamp, both in pixels
function currentLyricLine(){
  if(!lyrics || lyrics==='none' || !lyrics.synced) return 0;
  var pt=fb.PlaybackTime, c=-1;
  for(var i=0;i<lyrics.lines.length;i++){ if(lyrics.lines[i].t<=pt) c=i; else break; }
  return c;
}
// wrap each phrase to width+font, precompute cumulative block geometry (cached by width+font)
function lyLayout(gr,maxW,font){
  font=font||FONT.lyric;
  if(lyLay.lyr===lyrics && lyLay.w===maxW && lyLay.font===font) return lyLay;
  var subLh=Math.round(gr.CalcTextHeight('Ag',font))+4, gap=Math.round(subLh*0.55);
  var subs=[], top=[], cen=[], blockH=[], acc=0;
  for(var i=0;i<lyrics.lines.length;i++){
    var wr=gr.EstimateLineWrap(lyrics.lines[i].text||'',font,maxW), parts=[];
    for(var j=0;j<wr.length;j+=2) parts.push(wr[j]);
    if(!parts.length) parts=[''];
    var bh=parts.length*subLh;
    subs.push(parts); top.push(acc); blockH.push(bh); cen.push(acc+bh/2); acc+=bh+gap;
  }
  lyLay={lyr:lyrics,w:maxW,font:font,subs:subs,top:top,cen:cen,blockH:blockH,subLh:subLh};
  return lyLay;
}
// rolling synced lyrics (queue tab + fullscreen). align: 'c' centred / 'l' left
function drawRollingLyrics(gr,x,top,w,bot,font,curCol,align){
  var viewMid=Math.round((top+bot)/2), L=lyLayout(gr,w,font), subLh=L.subLh, li,s;
  lyCur=currentLyricLine();
  lyTarget=L.cen[Math.max(0,lyCur)]||0;
  if(lySnap){ lyScroll=lyTarget; lySnap=false; } else if(Math.abs(lyTarget-lyScroll)>0.5) startLyAnim();
  for(li=0;li<lyrics.lines.length;li++){
    var bcY=viewMid+(L.cen[li]-lyScroll);
    if(bcY<top-L.blockH[li] || bcY>bot+L.blockH[li]) continue;
    var isCur=(li===lyCur), dist=Math.abs(bcY-viewMid), a=clamp01(1-dist/(viewMid-top));
    var col=isCur?curCol:RGBA(255,255,255,Math.round(24+120*a));
    var parts=L.subs[li], bTop=Math.round(bcY-L.blockH[li]/2);
    /* The cull above keeps a block while its CENTRE is near the view, which let its top edge sit a
       whole block height above `top` -- over the tab strip in the queue pane, over the mini header
       in fullscreen. There is no clip API, so each sub-line is drawn only when it fits entirely
       inside the view, exactly as the unsynced block does. The rolling fade already takes lines to
       near-invisible at the edges, so the cut lands where there is almost nothing to see. */
    for(s=0;s<parts.length;s++){
      var sy=bTop+s*subLh;
      if(sy<top || sy+subLh>bot) continue;
      if(align==='l') tL(gr,parts[s],font,col,x,sy,w,subLh); else tC(gr,parts[s],font,col,x,sy,w,subLh);
    }
  }
}
/* Unsynced lyrics: a plain top-down block, no roll -- there are no timestamps to roll to. Anything
   past the bottom of the pane used to be simply unreachable, so the block scrolls on the wheel
   instead (lyStWheel). There is no clip API, so a line is drawn only when it fits ENTIRELY within
   the view: a half-line would otherwise spill over the tab strip above or the controls below.
   The cost is up to one line-height of slack at each edge, which reads as padding. */
function drawStaticLyrics(gr,x,w,top,bot,font,gapMul){
  stopLyAnim();
  var L=lyLayout(gr,w,font), gap=Math.round(L.subLh*gapMul), li, s, h=0;
  for(li=0;li<lyrics.lines.length;li++) h+=L.subs[li].length*L.subLh+gap;
  lyStMax=Math.max(0,Math.round(h-gap-(bot-top)));   // the trailing gap is not content to scroll to
  if(lyStScroll>lyStMax) lyStScroll=lyStMax;
  if(lyStScroll<0) lyStScroll=0;
  var y=top-lyStScroll;
  for(li=0;li<lyrics.lines.length && y<bot;li++){
    var p=L.subs[li];
    for(s=0;s<p.length;s++){
      if(y>=top && y+L.subLh<=bot) tC(gr,p[s],font,COL.text2,x,y,w,L.subLh);
      y+=L.subLh;
    }
    y+=gap;
  }
}
/* Wheel handling for that block, shared by the right pane and fullscreen. Returns false when there
   is nothing to scroll -- synced lyrics roll themselves, and in fullscreen the wheel is the volume
   control, which it must stay whenever the lyrics cannot use it. lyStMax is set by the draw above,
   so this is a no-op until the pane has been painted once. */
function lyStWheel(step){
  if(noLyrics() || lyrics.synced || lyStMax<=0) return false;
  var v=lyStScroll-Math.round(step*3*(lyLay.subLh||20));
  if(v<0) v=0; else if(v>lyStMax) v=lyStMax;
  if(v===lyStScroll) return false;
  lyStScroll=v; return true;
}
function noLyrics(){ return !lyrics || lyrics==='none' || !lyrics.lines || !lyrics.lines.length; }
function lyTick(){
  var d=lyTarget-lyScroll; if(Math.abs(d)<0.5){ lyScroll=lyTarget; stopLyAnim(); } else lyScroll+=d*0.25;
  if(fsMode){ repaintAll(); } else { markDirty(); dirtyQueue=true; window.RepaintRect(R.queue.x,R.queue.y,R.queue.w,R.queue.h); }
}
function startLyAnim(){ if(!lyTimer) lyTimer=window.SetInterval(lyTick,16); }   // 60fps roll
function stopLyAnim(){ if(lyTimer){ window.ClearInterval(lyTimer); lyTimer=null; } }
// blinking caret in the Search box / rename dialog
var caretOn=true, caretTimer=null;
function caretTick(){
  if(renameEdit){ caretOn=!caretOn; repaintAll(); return; }              // caret sits in a playlist row/card
  if(editInputActive()){ caretOn=!caretOn; markDirty(); dirtySearch=true; var b=searchBoxRect(); window.RepaintRect(b.x,b.y,b.w,b.h); return; }
  stopCaret();
}
function startCaret(){ if(!caretTimer){ caretOn=true; caretTimer=window.SetInterval(caretTick,530); } }
function stopCaret(){ if(caretTimer){ window.ClearInterval(caretTimer); caretTimer=null; } caretOn=true; }
function readFirst(paths){
  for(var i=0;i<paths.length;i++){
    try{ if(utils.IsFile && !utils.IsFile(paths[i])) continue; var t=utils.ReadUTF8(paths[i]); if(t && t.length) return t; }catch(e){}
  }
  return null;
}
function parseLyrics(text){
  // Embedded USLT/SYLT tags and external LRC text share this parser.
  var raw=String(text||'').replace(/^\uFEFF/,'').split(/\r?\n/),lines=[],synced=false;
  var reAll=/\[(\d+):(\d+(?:[.:]\d+)?)\]/g, offset=0,i,j,m;
  for(i=0;i<raw.length;i++){
    var line=raw[i],om=/^\s*\[offset:([+-]?\d+)\]\s*$/i.exec(line);
    if(om){ offset=parseInt(om[1],10)||0; continue; }
    var times=[]; reAll.lastIndex=0;
    while((m=reAll.exec(line))!==null){
      var seconds=parseInt(m[1],10)*60+parseFloat(m[2].replace(':','.'))+offset/1000;
      times.push(Math.max(0,seconds));
    }
    var txt=line.replace(reAll,'').trim();
    if(/^\s*\[[a-zA-Z#]+:/.test(txt)) continue;
    if(times.length){ synced=true; for(j=0;j<times.length;j++) lines.push({t:times[j],text:txt}); }
    else if(txt.length) lines.push({t:-1,text:txt});
  }
  if(synced){
    // In timed lyrics, untimed lines cannot be synchronized reliably.
    lines=lines.filter(function(line){return line.t>=0;});
    lines.sort(function(a,b){ return a.t-b.t; });
  }
  return {lines:lines,synced:synced};
}
/* Direct file-info lookup works with standard LYRICS as well as various
   SYNCEDLYRICS/UNSYNCEDLYRICS spellings written by taggers. */
function embeddedLyrics(handle){
  if(!handle) return null;
  try{
    var info=handle.GetFileInfo(true); if(!info) return null;
    var fields=['SYNCED LYRICS','SYNCEDLYRICS','SYNCED_LYRICS','LYRICS','UNSYNCED LYRICS','UNSYNCEDLYRICS','UNSYNCED_LYRICS'],i,k,v,found=[];
    for(i=0;i<fields.length;i++){
      k=info.MetaFind(fields[i]);
      if(k<0) continue;
      for(var j=0;j<info.MetaValueCount(k);j++){
        v=info.MetaValue(k,j); if(v && v.trim()) found.push(v);
      }
    }
    // Prefer timestamped values over plain text, regardless of which field held them.
    for(i=0;i<found.length;i++) if(/\[\d+:\d+(?:[.:]\d+)?\]/.test(found[i])) return found[i];
    return found.length?found[0]:null;
  }catch(e){ return null; }
}
function loadLyrics(){
  var key=NP?(NP.Path+'|'+NP.SubSong):null;
  if(key===lyricsFor) return;
  lyricsFor=key; lyrics='none'; lyScroll=0; lyTarget=0; lySnap=true; lyLay={lyr:null,w:-1};
  lyStScroll=0; lyStMax=0;
  if(!NP) return;
  var base=NP.Path.replace(/\.[^.\\\/]+$/,'');
  var sideLrc=readFirst([base+'.lrc']),tagged=embeddedLyrics(NP),sideTxt=null;
  // Prefer synced embedded data, then synced sidecar .lrc, then plain embedded data,
  // and finally sidecar .txt. External .lrc remains supported exactly as before.
  var taggedParsed=tagged?parseLyrics(tagged):null;
  if(taggedParsed && taggedParsed.synced && taggedParsed.lines.length) lyrics=taggedParsed;
  else if(sideLrc){ var parsed=parseLyrics(sideLrc); if(parsed.lines.length) lyrics=parsed; }
  if(lyrics==='none' && taggedParsed && taggedParsed.lines.length) lyrics=taggedParsed;
  if(lyrics==='none'){ sideTxt=readFirst([base+'.txt']); if(sideTxt){ var plain=parseLyrics(sideTxt); if(plain.lines.length) lyrics=plain; } }
}
