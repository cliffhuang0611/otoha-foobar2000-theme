/* otoha/data/replaygain.js -- normalize volume: ReplayGain state, scan, confirm prompt, pill
   Part of Otoha, a local music theme for foobar2000. Loaded by main.js;
   every module shares one global scope, so load order is set there. */

/* ------------------------- normalize volume (ReplayGain) -------------------------
   "Normalize volume" is ReplayGain, and it is two independent halves: a per-track loudness figure
   has to exist in each file's tags, AND playback has to be told to apply it. Either one alone does
   nothing audible, so the button reflects both and only offers a scan when tags are actually
   missing -- flipping the playback mode is instant once the library is scanned.

   The scan itself is foobar's: it owns the progress window and the "update file tags" confirmation.
   That is why nothing here tracks progress. Tags landing fires on_metadb_changed, which drops
   rgStat, so the pill recomputes on the next paint whether the user finished or cancelled. */
var rgStat=null, rgScanFailed=false, rgPrompt=null, RG_HB=null;
/* One title-format pass over the library, same shape (and cost) as the libTF fields -- so it runs
   as a sliced step of the All Songs build rather than inline in a paint. Holds the missing handles
   rather than just a count: they are exactly what the scan gets handed. */
function rgCompute(){
  var lib=libItems(), total=lib?lib.Count:0, flags=[], miss=[], i;
  if(total){ try{ flags=TF.rg.EvalWithMetadbs(lib); }catch(e){ flags=[]; } }
  for(i=0;i<flags.length;i++) if(flags[i]!=='1') miss.push(lib[i]);
  rgStat={total:total, missing:miss, scanned:total-miss.length};
  return rgStat;
}
function rgState(){ return rgStat||rgCompute(); }
function rgModeOn(){ try{ return fb.ReplaygainMode!==0; }catch(e){ return false; } }
function rgSetMode(on){ try{ fb.ReplaygainMode=on?1:0; }catch(e){} }   // 1 = track gain: every track to the same loudness
function rgActive(){ var s=rgState(); return s.total>0 && !s.missing.length && rgModeOn(); }
/* The scanner's context command has sat under different parents across foobar versions, so try the
   known paths and promote whichever answers. flag 8 (flag_view_full) runs the item even if the user
   has hidden it under Preferences > Display > Context Menu. */
var RG_SCAN_CMDS=['ReplayGain/Scan per-file track gain',
                  'Utilities/ReplayGain/Scan per-file track gain',
                  'Tagging/ReplayGain/Scan per-file track gain'];
function rgRunScan(handles){
  if(!handles.length) return true;
  var hl=fb.CreateHandleList(), i;
  for(i=0;i<handles.length;i++) hl.Add(handles[i]);
  for(i=0;i<RG_SCAN_CMDS.length;i++){
    var ok=false;
    try{ ok=fb.RunContextCommandWithMetadb(RG_SCAN_CMDS[i],hl,8); }catch(e){ ok=false; }
    if(ok){ RG_SCAN_CMDS.unshift(RG_SCAN_CMDS.splice(i,1)[0]); return true; }   // remember what worked
  }
  return false;
}
// One button, three situations: already normalizing -> switch off; tags all present -> switch on
// instantly; tags missing -> confirm first, because scanning WRITES to the user's files.
function rgToggle(){
  var s=rgState();
  if(!s.total) return;
  rgScanFailed=false;
  if(rgActive()){ rgSetMode(false); repaintAll(); return; }
  if(!s.missing.length){ rgSetMode(true); repaintAll(); return; }
  rgPrompt={n:s.missing.length, total:s.total}; repaintAll();
}
function rgConfirmScan(){
  var miss=rgState().missing;
  rgPrompt=null;
  rgSetMode(true);                 // so the tags take effect the moment they land
  rgScanFailed=!rgRunScan(miss);
  rgStat=null;                     // recount on the next paint; the scan is foobar's from here
  repaintAll();
}

/* Scanning WRITES ReplayGain tags into the user's audio files, so it is confirmed rather than run
   off a single click -- and the copy says so plainly. Height follows the wrapped body so the text
   can never overrun the panel at a different UISCALE. */
var RG_BODY='foobar2000 will scan them and write ReplayGain tags into the files, then play every '+
            'track at the same loudness. Its own progress window runs the scan, and nothing is deleted.';
function drawRgPrompt(gr){
  var cw=Math.min(470,W-40), pw=cw-56, lh=24;
  var nl=Math.max(1,gr.EstimateLineWrap(RG_BODY,FONT.pl,pw).length/2);
  var ch=138+nl*lh+PILL_H;
  var cy=Math.max(10,Math.round((H-ch)/2)), cx=modalPanel(gr,cw,ch,cy);
  var px=cx+28, y=cy+26;
  tL(gr,'Normalize volume?',FONT.sect,COL.text,px,y,pw,26); y+=38;
  tL(gr,fmtNum(rgPrompt.n)+' of '+fmtNum(rgPrompt.total)+' tracks still need a loudness scan.',FONT.pl,COL.text2,px,y,pw,22); y+=32;
  tPara(gr,RG_BODY,FONT.pl,COL.text2,px,y,pw,lh);
  var w2=pillW(gr,'Scan & normalize'), w1=pillW(gr,'Cancel'), gap=12;
  var by=cy+ch-22-PILL_H, x2=cx+cw-28-w2, x1=x2-gap-w1;
  RG_HB={ cancel:drawPill(gr,x1,by,w1,'Cancel',false), scan:drawPill(gr,x2,by,w2,'Scan & normalize',true) };
}

/* Normalize-volume pill: the same capsule as the group-by dropdown, but a state toggle rather than
   a menu -- filled with the accent only when normalizing is genuinely in effect (tags present AND playback
   applying them), so it can never claim to be on while doing nothing. */
function drawNormalizePill(gr,x,y,w,h){
  var on=rgActive(), hot=hv(x,y,x+w,y+h);
  gr.FillRoundRect(x,y,w,h,h/2,h/2,on?accentState(hot):(hot?RGB(58,58,58):RGBA(0,0,0,90)));
  var col=on?COL.onAccent:COL.text;
  drawIcon(gr,'equalizer',col,x+14,y+(h-20)/2,20,20,18);
  tL(gr,'Normalize volume',FONT.pl,col,x+42,y,w-56,h);
  return {x0:x,y0:y,x1:x+w,y1:y+h};
}


/* Scan-status tooltip: only while hovering over the Normalize pill. It is painted in
   drawOverlays(), after the list and other chrome, rather than consuming header height.
   The percentage is the share of FILES WITH ReplayGain tags, not a live scan job. */
var rgTipTimer=null, rgTipHover=false, rgTipShown=false, RG_TIP_DELAY=400;
function rgTipClear(){
  if(rgTipTimer!==null){ try{window.ClearTimeout(rgTipTimer);}catch(e){} rgTipTimer=null; }
  rgTipHover=false; rgTipShown=false;
}
function rgTipAllowed(x,y){
  return !fsMode && view==='songs' && !!HB_RGNORM && inRect(x,y,HB_RGNORM) &&
         !rgPrompt && !renameEdit && !ctxMenu && !confirmDel && !dupPrompt &&
         !sgMenuOpen && !plSortMenuOpen && !audioPopup;
}
function rgTipTrack(x,y){
  if(!rgTipAllowed(x,y)){
    var wasShown=rgTipShown;
    rgTipClear();
    // Full repaint clears a popup that extends outside its original button rectangle.
    if(wasShown) repaintAll();
    return;
  }
  if(rgTipHover) return; // keep one timer while moving inside the same button
  rgTipHover=true;
  rgTipTimer=window.SetTimeout(function(){
    rgTipTimer=null;
    if(rgTipHover && rgTipAllowed(mx,my)){
      rgTipShown=true;
      repaintAll();
    }
  },RG_TIP_DELAY);
}
function drawRgTip(gr){
  if(!rgTipShown || !rgTipAllowed(mx,my)) return;
  var st=rgStat;
  var availRight=(W<1180 && compactQueueOpen && R.queueW)?R.queue.x-10:R.main.x+R.main.w-12;
  var xMin=R.main.x+12, room=availRight-xMin, width=Math.min(288,room), height=108;
  if(width<140) return;
  var x=Math.max(xMin,Math.min(HB_RGNORM.x0,availRight-width));
  var y=Math.min(HB_RGNORM.y1+8,R.barY-height-12);
  if(y< R.main.y+8) y=R.main.y+8;
  gr.FillRoundRect(x+3,y+4,width,height,9,9,RGBA(0,0,0,155));
  gr.FillRoundRect(x,y,width,height,9,9,RGB(40,40,40));
  gr.DrawRoundRect(x,y,width,height,9,9,1,RGBA(255,255,255,26));
  var ix=x+15, iw=width-30;
  tL(gr,'Loudness scan status',FONT.pl,COL.text,ix,y+10,iw,21);
  if(!st || !st.total){
    tL(gr,'Library scan data unavailable',FONT.plSub,COL.text2,ix,y+40,iw,20);
    return;
  }
  var count=fmtNum(st.scanned)+' / '+fmtNum(st.total)+' tracks';
  tL(gr,count,FONT.plSub,COL.text2,ix,y+36,iw,20);
  // JSplitter v3's GDI FillRoundRect throws when arc size exceeds a tiny
  // rectangle (e.g. 87/4569 tracks yields a ~5px-wide bar). Quantize first,
  // never pass fractional arc sizes, and draw very short fills as solid rects.
  var frac=Math.max(0,Math.min(1,st.scanned/st.total));
  var progY=Math.round(y+65), progX=Math.round(ix), progW=Math.max(1,Math.round(iw));
  gr.FillRoundRect(progX,progY,progW,5,2,2,RGB(85,85,85));
  if(frac>0){
    var fillW=Math.max(1,Math.min(progW,Math.round(progW*frac)));
    if(fillW<8) gr.FillSolidRect(progX,progY,fillW,5,COL.accent);
    else gr.FillRoundRect(progX,progY,fillW,5,2,2,COL.accent);
  }
  var suffix=rgScanFailed ? 'ReplayGain scan could not start'
            : st.missing.length ? (fmtNum(st.missing.length)+' remaining ('+Math.round(frac*100)+'% scanned)')
            : ('All scanned '+CH_DOT+' normalization '+(rgModeOn()?'on':'off'));
  tL(gr,suffix,FONT.plSub,rgScanFailed?RGB(240,110,110):COL.text2,ix,y+76,iw,21);
}
