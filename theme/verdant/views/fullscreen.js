/* verdant/views/fullscreen.js -- fullscreen chill mode and the spectrum visualizer
   Part of Verdant, a Spotify-style theme for foobar2000. Loaded by main.js;
   every module shares one global scope, so load order is set there. */

/* ------------------------- fullscreen "chill" mode ------------------------- */
function enterFullscreen(){ fsMode=true; try{ if(UIWizard && UIWizard.WindowState!==1) UIWizard.ToggleMaximize(); }catch(e){} if(fsView==='viz') startViz(); if(fsView==='lyrics'){ loadLyrics(); lySnap=true; } repaintAll(); }
function exitFullscreen(){ fsMode=false; vizMenuOpen=false; stopViz(); repaintAll(); }
// the style list belongs to the viz view: leaving it (or fullscreen) must not leave a menu armed
function setFsView(v){ fsView=v; vizMenuOpen=false; if(v==='viz') startViz(); else stopViz(); if(v==='lyrics'){ loadLyrics(); lySnap=true; } repaintAll(); }
function doFsAct(act){
  if(act==='exit') exitFullscreen();
  else if(act==='lyrics') setFsView(fsView==='lyrics'?'default':'lyrics');
  else if(act==='viz') setFsView(fsView==='viz'?'default':'viz');
}
/* ---- audio spectrum visualizer: real PCM via fb.GetAudioChunk -> FFT bars ----
   Three things separate a spectrum that looks designed from one that merely twitches, and all
   three live here rather than in the drawing:
     - bands spaced in HERTZ, not in FFT bin index. The chunk carries its own SampleRate, so band
       edges are derived from it once per rate and cached. Spacing by index quietly put the bands
       in the wrong place on anything that was not 44.1k.
     - a treble tilt. Music is bass-heavy, so an untilted spectrum is a wall on the left and a flat
       line on the right. Everything above VIZ_TILT_HZ is lifted and everything below it trimmed.
     - dB, mapped from a floor to a ceiling. Loudness is logarithmic; the old log(1+m*8)/3.5 was a
       curve chosen to look plausible rather than to mean anything.
   Dynamics are asymmetric on top of that: a transient has to arrive instantly and leave slowly. */
var VIZ_N=72, VIZ_FFT=2048, VIZ_MS=33, VIZ_TOP=200;
var VIZ_ATK=0.62, VIZ_REL=0.14;              // per frame: fast attack, slow release
/* The dB window mapped onto 0..1, and the main tuning knob here. A pure full-scale sine lands one
   bin at -6 dB, and the tilt adds up to +14 on top, so a window ending at -8 pinned ordinary music
   against the ceiling with every bar at maximum. Ending at 0 leaves the top of the range for what
   is actually a peak. Raise the floor to make quiet passages calmer, lower it to make them busier. */
var VIZ_DB_FLOOR=-52, VIZ_DB_CEIL=0;
var VIZ_TILT_HZ=250, VIZ_TILT=0.42;          // treble lift, as an exponent on (f/VIZ_TILT_HZ)
var VIZ_F0=32;                               // lowest band edge; the top edge follows the rate
var vizRe=null, vizIm=null, vizWin=null, vizBand=null;

function vizBuffers(){ if(!vizRe){ vizRe=new Float64Array(VIZ_FFT); vizIm=new Float64Array(VIZ_FFT); } }
// Hann window, built once per size: 2048 cosines every frame is pure waste
function vizWindow(n){
  if(vizWin && vizWin.n===n) return vizWin.w;
  var w=new Float64Array(n);
  for(var i=0;i<n;i++) w[i]=0.5-0.5*Math.cos(2*Math.PI*i/(n-1));
  vizWin={n:n,w:w}; return w;
}
/* Band edges in Hz -> bin ranges, plus each band's tilt gain. Cached per (rate, size), both of
   which only change when the output format does. The lowest bands can land on the same bin --
   2048 points at 44.1k is ~21 Hz -- and that is fine: neighbouring bass bars moving together is
   what bass actually looks like. */
function vizBands(sr,n){
  if(vizBand && vizBand.sr===sr && vizBand.n===n) return vizBand;
  var half=n>>1, hz=sr/n, top=Math.min(16000,sr*0.45), i;
  var lo=[], hi=[], tilt=[];
  for(i=0;i<VIZ_N;i++){
    var fa=VIZ_F0*Math.pow(top/VIZ_F0,i/VIZ_N), fz=VIZ_F0*Math.pow(top/VIZ_F0,(i+1)/VIZ_N);
    var b0=Math.max(1,Math.round(fa/hz)), b1=Math.max(b0+1,Math.round(fz/hz));
    if(b0>=half) b0=half-1;
    if(b1>half) b1=half;
    var g=Math.pow(Math.sqrt(fa*fz)/VIZ_TILT_HZ,VIZ_TILT);
    lo.push(b0); hi.push(b1); tilt.push(g<0.45?0.45:(g>5?5:g));
  }
  vizBand={sr:sr,n:n,lo:lo,hi:hi,tilt:tilt}; return vizBand;
}
// one band's envelope: instant rise, slow fall
function vizStep(i,val){
  var cur=vizBars[i]||0;
  cur+=(val-cur)*((val>cur)?VIZ_ATK:VIZ_REL);
  if(cur<0.0008) cur=0;
  vizBars[i]=cur;
}
function vizDecay(){ for(var i=0;i<VIZ_N;i++) vizStep(i,0); }
/* Oscilloscope trace, captured from the same chunk as the spectrum. Three details do the work:
   buckets are AVERAGED rather than point-sampled, so the trace is anti-aliased instead of aliased;
   it starts at a rising zero crossing, so a steady tone stands still instead of sliding across the
   screen frame after frame; and the level is tracked, so a quiet passage still draws a wave rather
   than a flat line. */
var VIZ_WAVE_N=260, vizWave=[], vizWaveEnv=0.15;
function vizCapture(d,cc,sc){
  var span=Math.min(sc,2048), base=(sc-span)*cc, i, k, c, v;
  var scan=Math.floor(span/3), t=0, prev=0;
  for(i=0;i<scan;i++){                            // trigger: first rising zero crossing
    v=d[base+i*cc]||0;
    if(prev<0 && v>=0){ t=i; break; }
    prev=v;
  }
  var step=(span-t)/VIZ_WAVE_N, peak=0, acc, cnt, s, e, mono;
  for(i=0;i<VIZ_WAVE_N;i++){
    s=t+Math.floor(i*step); e=t+Math.floor((i+1)*step); if(e<=s) e=s+1;
    acc=0; cnt=0;
    for(k=s;k<e && k<span;k++){
      mono=0;
      for(c=0;c<cc;c++) mono+=d[base+k*cc+c]||0;
      acc+=mono/cc; cnt++;
    }
    v=cnt?acc/cnt:0;
    if(v>peak) peak=v; else if(-v>peak) peak=-v;
    vizWave[i]=(vizWave[i]||0)+(v-(vizWave[i]||0))*0.55;
  }
  vizWaveEnv+=(peak-vizWaveEnv)*((peak>vizWaveEnv)?0.5:0.03);
}
function vizWaveDecay(){
  for(var i=0;i<VIZ_WAVE_N;i++) vizWave[i]=(vizWave[i]||0)*0.80;
  vizWaveEnv+=(0.15-vizWaveEnv)*0.05;
}
function vizAnalyse(ch){
  var d=ch.Data, cc=ch.ChannelCount||2, sc=ch.SampleCount, sr=ch.SampleRate||44100;
  if(!d || !sc) return false;
  var n=VIZ_FFT; while(n>256 && n>sc) n>>=1;      // a short chunk gets a smaller transform, not none
  if(n<256) return false;
  if(vizStyle==='wave') vizCapture(d,cc,sc);      // before the FFT: it destroys the input buffer
  vizBuffers();
  var re=vizRe, im=vizIm, w=vizWindow(n), i, c;
  var start=(sc-n)*cc; if(start<0) start=0;       // the MOST RECENT n samples, not a decimated scan
  for(i=0;i<n;i++){
    var si=start+i*cc, v=0;
    for(c=0;c<cc;c++) v+=d[si+c]||0;
    re[i]=(v/cc)*w[i]; im[i]=0;
  }
  fftMag(re,im,n);
  var B=vizBands(sr,n), half=n>>1, scale=2/n, k, m, pw;
  for(i=0;i<VIZ_N;i++){
    m=0;
    for(k=B.lo[i];k<B.hi[i] && k<half;k++){ pw=re[k]*re[k]+im[k]*im[k]; if(pw>m) m=pw; }
    m=Math.sqrt(m)*scale*B.tilt[i];
    var db=20*Math.log(m+1e-9)/Math.LN10;
    vizStep(i,clamp01((db-VIZ_DB_FLOOR)/(VIZ_DB_CEIL-VIZ_DB_FLOOR)));
  }
  return true;
}
function vizIdle(){
  for(var i=0;i<VIZ_N;i++) if((vizBars[i]||0)>0) return false;
  if(vizStyle==='wave') for(i=0;i<VIZ_WAVE_N;i++) if(Math.abs(vizWave[i]||0)>0.0005) return false;
  return true;
}
var vizWasIdle=false;
function vizUpdate(){
  if(!fsMode || fsView!=='viz'){ stopViz(); return; }
  var ch=null, ok=false;
  try{ ch=fb.GetAudioChunk(0.06); }catch(e){ ch=null; }
  if(ch && ch.SampleCount>0){ try{ ok=vizAnalyse(ch); }catch(e){ ok=false; } }
  if(ok) vizWasIdle=false;
  else {
    vizDecay();                                    // paused, stopped, or no visualisation stream
    if(vizStyle==='wave') vizWaveDecay();
    // once everything has decayed to nothing there is no reason to keep repainting an empty band
    var idle=vizIdle();
    if(idle && vizWasIdle) return;
    vizWasIdle=idle;
  }
  repaintViz();
}
function fftMag(re,im,n){
  var i,j=0,k,l,t; for(i=1;i<n;i++){ var bit=n>>1; for(;j&bit;bit>>=1) j^=bit; j^=bit; if(i<j){ t=re[i];re[i]=re[j];re[j]=t; t=im[i];im[i]=im[j];im[j]=t; } }
  for(l=2;l<=n;l<<=1){ var ang=-2*Math.PI/l, wr=Math.cos(ang), wi=Math.sin(ang); for(i=0;i<n;i+=l){ var cr=1,ci=0; for(k=0;k<l/2;k++){ var pr=re[i+k], pi=im[i+k], qr=cr*re[i+k+l/2]-ci*im[i+k+l/2], qi=cr*im[i+k+l/2]+ci*re[i+k+l/2]; re[i+k]=pr+qr; im[i+k]=pi+qi; re[i+k+l/2]=pr-qr; im[i+k+l/2]=pi-qi; var ncr=cr*wr-ci*wi; ci=cr*wi+ci*wr; cr=ncr; } } }
}
function startViz(){ if(!vizTimer){ vizTimer=window.SetInterval(vizUpdate,VIZ_MS); } }
function stopViz(){ if(vizTimer){ window.ClearInterval(vizTimer); vizTimer=null; } }
function fsIcon(gr,name,col,x,y,sz,act){
  var hot=hv(x-8,y-8,x+sz+8,y+sz+8);
  drawIcon(gr,name,col===COL.accent?accentState(hot):hot?COL.text:col,x,y,sz,sz,sz);
  HB_FS.push({x0:x-8,y0:y-8,x1:x+sz+8,y1:y+sz+8,act:act});
}
// name of the real playlist driving playback, or null (e.g. playing from library/search/artist)
function npPlaylistSrc(){
  var loc=playingLoc(), pli=(loc&&loc.IsValid)?loc.PlaylistIndex:-1;
  if(pli<0) return null;
  var rnm=plName(pli);
  if(rnm===SHUF) return shufSrcName||null;
  if(rnm && !isHiddenPl(rnm)) return rnm;
  return null;
}
function fsMiniNP(gr){   // small cover + title + artist, top-left (lyrics/viz views)
  var s=64, src=npPlaylistSrc();
  if(src){
    var lbl='PLAYING FROM PLAYLIST  ';
    tL(gr,lbl,FONT.fsSrc,COL.text3,64,20,W/2,20);
    var lw=gr.CalcTextWidth(lbl,FONT.fsSrc);
    tL(gr,src,FONT.fsSrcName,COL.text,64+lw,20,Math.max(0,W/2-lw),20);   // bold: the playlist name
  }
  drawRounded(gr,64,78,s,6,NP,'np');
  tL(gr,npTitleStr||'Nothing playing',FONT.sect2,COL.text,64+s+18,84,W/2,26);
  tL(gr,npArtistStr,FONT.qName,COL.text2,64+s+18,116,W/2,20);
}
// cover + title + artist, centred between the header and the transport bar
function drawFsDefault(gr,bot){
  var top=120, avail=bot-top, txtH=130, gap=30;
  var sz=Math.max(140,Math.min(420,avail-txtH-gap));
  var y0=top+Math.max(0,Math.round((avail-(sz+gap+txtH))/2));
  drawRounded(gr,Math.round((W-sz)/2),y0,sz,12,NP,'np');
  var tx=72, tw=W-144, ty=y0+sz+gap;
  tCE(gr,npTitleStr||'Nothing playing',FONT.title,COL.text,tx,ty,tw,90);
  tCE(gr,npArtistStr,FONT.sect2,COL.text2,tx,ty+96,tw,34);
}
function drawFsLyrics(gr,bot){
  HB_LY_ACTION=[];
  fsMiniNP(gr);
  loadLyrics();   // reload for the current track (fast: cached by track; reloads on track change)
  if(noLyrics()){ tC(gr,'No lyrics found',FONT.sect2,COL.text2,0,Math.round(H*0.45),W,40);drawLyricActions(gr,Math.round(W/2)-110,bot-44,220);return; }
  drawLyricActions(gr,Math.round(W/2)-110,bot-44,220);bot-=80;
  if(lyrics.synced) drawRollingLyrics(gr,140,165,W-280,bot,FONT.fsLyric,COL.accent,'c');
  else drawStaticLyrics(gr,140,W-280,180,bot,FONT.fsLyric,0.4);
}
function vizAlpha(c,a){ return RGBA((c>>16)&255,(c>>8)&255,c&255,a); }
/* One colour ramp, shared by every style: theme accent, brightening toward white as a band gets
   louder. Shared rather than repeated, because two call sites matching each other by eye is how
   they drift apart in the first place -- change this and every visualizer changes with it.
   (An earlier version tinted the bars with the cover's dominant colour. It is gone: the styles now
   read as part of the theme rather than as a per-track accent.) */
var VIZ_PEAK=blend(COL.accent,COL.text,0.22);
function vizCol(v){ return blend(COL.accentPressed,VIZ_PEAK,clamp01(v*1.3)); }
/* ---- proportions -------------------------------------------------------------
   Two rules, one borrowed and one the theme's own.
   Borrowed, from Stephen Few's "Bar Widths and the Spaces in Between": the gap between bars should
   be 50-75% of a bar's width -- wider than that and it reads as exaggerated, wasting space without
   adding anything -- and the longest bar wants a length-to-width ratio of at least about 10:1,
   below which bars look stubby and their width distracts from the one dimension that carries the
   meaning. The bars were at the loose end of the first rule; the radial spokes broke the spirit of
   the second in the other direction, running to 140% of the inner radius, so the ring was longer
   than the disc it was supposed to wrap.
   The theme's own: everything else in fullscreen -- the seek bar, the mini now-playing block, the
   transport row -- lives in a 72px margin column. The visualizer used its own 150px inset, which is
   why it read as a strip floating in the middle of the screen rather than as part of the page.
   Each style now shares that column, and none of them uses the full height of the band: leaving air
   above and below is what stops a visualizer looking like a test pattern. */
var VIZ_MARGIN=72;                 // the fullscreen content column, shared with the seek bar
var VIZ_GAPR=0.55;                 // gap as a fraction of bar width (Few's preferred end)
var VIZ_SWING=0.62;                // share of the band's half-height the loudest bar may use
/* Radial is measured from the OUTER radius inwards, because that is the edge the eye reads first:
   the ring takes VIZ_R_FILL of the band's half-height, the cover disc gets VIZ_R_INNER of that, and
   the spokes get everything left over. Sizing it the other way round -- cover first, spokes as
   whatever fitted -- is what produced a 418px disc wearing a 119px fringe, an assembly using two
   thirds of the band with the rest of the screen empty around it. */
var VIZ_R_FILL=0.96;               // ring outer radius as a share of the band's half-height
var VIZ_R_INNER=0.44;              // inner radius as a share of the outer; spokes get the other 56%
var VIZ_ART_GAP=26;                // clearance between the cover and where the spokes start
var VIZ_SPOKE=0.645;               // spoke width as a share of its slot, so the gap lands at ~55%
/* Spokes per half-circle, and deliberately fewer than the linear style's bands. A circle gives
   every bar the same slice of a much smaller perimeter, so matching Bars one-for-one would leave
   6px hairs; folding the analysis down to a coarser count buys the width back. The bands that
   share a spoke are combined by max, so nothing quietly disappears -- a peak in either still
   shows. VIZ_N stays a multiple of this. */
var VIZ_RN=36;
var VIZ_WAVE_AMP=0.42;             // waveform: share of the half-height at full scale
var VIZ_AXIS=RGBA(255,255,255,14); // the hairline the mirrored halves meet on

// ---- style 1: mirrored pill bars, theme accent (the original, on the rebuilt analysis) ----
function drawVizBars(gr,top,bot){
  var cy=Math.round((top+bot)/2), n=VIZ_N, i;
  var w=W-VIZ_MARGIN*2, cell=w/n, bw=Math.max(3,Math.round(cell/(1+VIZ_GAPR)));
  var x0=Math.round(VIZ_MARGIN+(cell-bw)/2);
  var hh=Math.round((bot-top)/2*VIZ_SWING);
  gr.DrawLine(VIZ_MARGIN,cy,W-VIZ_MARGIN,cy,1,VIZ_AXIS);
  for(i=0;i<n;i++){
    var v=vizBars[i]||0, bh=Math.max(2,Math.round(v*hh)), bx=Math.round(x0+i*cell);
    var rad=Math.min(bw>>1,bh);   // GDI+ needs 2*rad <= both width and height, so floor -- never round
    gr.FillRoundRect(bx,cy-bh,bw,bh*2,rad,rad,vizCol(v));
  }
}
/* ---- style 2: radial ring ----
   The spectrum wrapped around the cover, which is the form modern players reach for and the one
   that suits a fullscreen layout with artwork already in it. Mirrored left and right rather than
   run once around the circle: a continuous sweep puts a visible seam where the top band meets the
   bottom one, while a mirrored ring is symmetric wherever you look at it. Bass sits at the top,
   treble meets at the bottom. */
// the ring's coarser bands: the loudest of the analysis bands folded into each spoke
function vizRadialLevel(i){
  var per=VIZ_N/VIZ_RN, k=Math.floor(i*per), e=Math.floor((i+1)*per), m=0, v;
  if(e<=k) e=k+1;
  for(;k<e && k<VIZ_N;k++){ v=vizBars[k]||0; if(v>m) m=v; }
  return m;
}
function drawVizRadial(gr,top,bot){
  var cx=Math.round(W/2), cy=Math.round((top+bot)/2);
  var half=Math.min((bot-top)/2,(W-VIZ_MARGIN*2)/2);
  var R=Math.round(half*VIZ_R_FILL);
  if(R<90) return;
  var r0=Math.round(R*VIZ_R_INNER), len=R-r0, art=Math.max(40,(r0-VIZ_ART_GAP)*2);
  drawCircle(gr,Math.round(cx-art/2),Math.round(cy-art/2),art,NP,npTitleStr||'np');
  /* Each spoke is the SAME primitive as a bar in the linear style -- a fully rounded FillRoundRect
     pill -- drawn straight up at twelve o'clock and then rotated into its slot. Rotate() takes an
     explicit centre, so the pill lands on the ring without any trigonometry of its own, and the
     rounded ends come for free instead of the flat caps a DrawLine leaves. Width is sized from the
     slot so the gap between spokes stays in the 50-75% range the bars use. */
  var wgt=Math.max(3,Math.round(Math.PI*r0/VIZ_RN*VIZ_SPOKE)), i, s;
  for(i=0;i<VIZ_RN;i++){
    var v=vizRadialLevel(i), L=Math.max(wgt,Math.round(v*len));   // never shorter than round: a dot
    var col=vizCol(v), rad=Math.min(wgt>>1,L>>1), deg=(i+0.5)*180/VIZ_RN;
    for(s=-1;s<=1;s+=2){
      gr.PushTransform();
      gr.Rotate(s*deg,cx,cy);
      gr.FillRoundRect(cx-wgt/2,cy-r0-L,wgt,L,rad,rad,col);
      gr.PopTransform();
    }
  }
}
/* ---- style 3: waveform ----
   The raw wave rather than the spectrum, so it moves with the sound instead of with the beat --
   the one style here that is not an FFT. A translucent body under the trace stops it reading as a
   bare hairline on a big screen. */
function drawVizWave(gr,top,bot){
  var cy=Math.round((top+bot)/2), x0=VIZ_MARGIN, w=W-VIZ_MARGIN*2, i;
  var hh=Math.round((bot-top)/2*VIZ_WAVE_AMP);
  var g=0.92/Math.max(0.06,vizWaveEnv); if(g>9) g=9;
  var body=vizCol(0.9), fill=vizAlpha(body,54);
  var px=[], py=[], poly=[x0,cy];
  for(i=0;i<VIZ_WAVE_N;i++){
    var v=(vizWave[i]||0)*g; if(v>1) v=1; else if(v<-1) v=-1;
    px.push(Math.round(x0+w*i/(VIZ_WAVE_N-1))); py.push(Math.round(cy-v*hh));
    poly.push(px[i],py[i]);
  }
  poly.push(x0+w,cy);
  try{ gr.FillPolygon(fill,0,poly); }catch(e){}
  gr.DrawLine(x0,cy,x0+w,cy,1,VIZ_AXIS);
  for(i=1;i<VIZ_WAVE_N;i++) gr.DrawLine(px[i-1],py[i-1],px[i],py[i],3,body);
}
// ---- style dispatch + the picker ----
/* The waveform is parked, not deleted: it is off the picker on request, and its capture is gated
   on the style below so it costs nothing while it is out. Putting it back is this one line. */
var VIZ_STYLES=[['Bars','bars'],['Radial ring','radial']];
var vizMenuOpen=false, HB_VIZ=null, VIZ_HB=[];
function setVizStyle(v){
  vizStyle=v; vizMenuOpen=false;
  try{ window.SetProperty('Visualizer: style (bars | radial | wave)',v); }catch(e){}   // survives a restart
  repaintAll();
}
function drawVizBody(gr,top,bot){
  if(vizStyle==='radial') drawVizRadial(gr,top,bot);
  else if(vizStyle==='wave') drawVizWave(gr,top,bot);
  else drawVizBars(gr,top,bot);              // also the landing place for an unknown property value
}
function drawFsViz(gr,bot){
  fsMiniNP(gr);
  drawVizBody(gr,VIZ_TOP,bot);
  var pw=196, ph=36, px=W-72-pw, py=52;
  HB_VIZ=drawDropPill(gr,px,py,pw,ph,labelOf(VIZ_STYLES,vizStyle,'Bars'),vizMenuOpen);
  VIZ_HB=vizMenuOpen?drawDropMenu(gr,HB_VIZ,VIZ_STYLES,vizStyle,pw):[];
}
/* A viz frame repaints only the band the visual lives in: at 30fps nothing else on screen has
   moved. The picker is deliberately NOT drawn here -- its menu hangs into the top of the band, so
   while it is open on_paint takes the full path instead (see the fullscreen branch there). */
function drawVizBand(gr){
  var bot=H-172;
  gr.FillSolidRect(0,VIZ_TOP,W,Math.max(0,bot-VIZ_TOP),COL.base);
  drawVizBody(gr,VIZ_TOP,bot);
}
function drawFsBar(gr){
  var playing=fb.IsPlaying&&!fb.IsPaused, by=H-150;
  var sbX=72, sbW=W-144, sbY=by+30;
  var len=fb.PlaybackLength, pos=(drag==='seek')?dragFrac:(len>0?fb.PlaybackTime/len:0);
  var rail=RGBA(255,255,255,55);
  HB_SEEK=drawTrackBar(gr,sbX,sbY,sbW,4,rail,pos);
  tR(gr,fmtTime((drag==='seek')?len*dragFrac:fb.PlaybackTime),FONT.time,COL.text2,sbX-54,sbY-6,46,16);
  tL(gr,fmtTime(len),FONT.time,COL.text2,sbX+sbW+8,sbY-6,46,16);
  var cxC=Math.round(W/2), cy=by+86, pb=56, pbx=cxC-pb/2, pby=cy-pb/2;
  ctrlBtn(gr,'shuffle',cxC-150,cy,pbShuffle,'shuffle');
  ctrlBtn(gr,'prev',cxC-84,cy,false,'prev');
  gr.FillEllipse(pbx,pby,pb,pb,COL.text);
  drawIcon(gr,playing?'pause':'play',COL.black,pbx,pby,pb,pb,Math.round(pb*0.5));
  HB_CTRL.push({x0:pbx,y0:pby,x1:pbx+pb,y1:pby+pb,act:'play'});
  ctrlBtn(gr,'next',cxC+84,cy,false,'next');
  ctrlBtn(gr,pbRepeat===2?'repeat1':'repeat',cxC+150,cy,pbRepeat>0,'repeat');
  fsIcon(gr,'equalizer',fsView==='viz'?COL.accent:COL.text2,72,cy-13,26,'viz');
  fsIcon(gr,'mic',fsView==='lyrics'?COL.accent:COL.text2,114,cy-13,26,'lyrics');
  var rx=W-72;
  fsIcon(gr,'compress',COL.text2,rx-26,cy-13,26,'exit');
  var volW=120, volX=rx-26-46-volW, volY=cy-2;
  drawIcon(gr,'volume',COL.text2,volX-32,cy-12,24,24,20);
  HB_VOL=drawTrackBar(gr,volX,volY,volW,4,rail,clamp01(vol2pos(fb.Volume)));
}
function drawFullscreen(gr){
  HB_LY_ACTION=[];
  HB_CTRL=[]; HB_SEEK=null; HB_VOL=null; HB_FS=[]; SB=null; SBH=null; SBN=null;
  gr.FillSolidRect(0,0,W,H,COL.base);
  var bot=H-172;
  if(fsView==='lyrics') drawFsLyrics(gr,bot);
  else if(fsView==='viz') drawFsViz(gr,bot);
  else {
    var src=npPlaylistSrc();
    if(src){ tL(gr,'PLAYING FROM PLAYLIST',FONT.fsSrc,COL.text2,72,54,W-144,18); tL(gr,src,FONT.sect,COL.text,72,76,W-144,28); }
    drawFsDefault(gr,bot);
  }
  drawFsBar(gr);
}
