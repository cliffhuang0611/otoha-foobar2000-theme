/* Single audio icon with hover/click flyouts for Output device and saved DSP preset.
   All menus are painted on the final overlay layer (after search and player bar).
   Only built-in JSplitter APIs are used. */
var audioPopup=null, HB_AUDIO=[], AUDIO_ROW_HB=[];
function audioChoiceItems(kind){
  var raw=[],out=[],i,e;
  try{
    if(kind==='scheduler')return {items:[{name:'Stop after current song',active:!!fb.StopAfterCurrent,index:0}],error:''};
    var data=kind==='output'?fb.GetOutputDevices():fb.GetDSPPresets();
    raw=typeof data==='string'?JSON.parse(data):data;
    if(!raw || !Array.isArray(raw)) throw new Error('Invalid list returned by JSplitter');
    for(i=0;i<raw.length;i++){
      e=raw[i]; if(!e || typeof e.name!=='string') continue;
      if(kind==='output' && (!e.output_id || !e.device_id)) continue;
      out.push({name:e.name,active:!!e.active,index:i,output_id:e.output_id,device_id:e.device_id});
    }
    return {items:out,error:''};
  }catch(ex){
    return {items:[],error:'JSplitter '+kind+' API unavailable: '+String(ex.message||ex)};
  }
}
function audioActiveName(kind){
  if(kind==='scheduler')return fb.StopAfterCurrent?'Stops after current song':'Off';
  var data=audioPopup&&audioPopup.lists[kind],a=data?data.items:[];
  for(var i=0;i<a.length;i++) if(a[i].active) return a[i].name;
  return a.length?'No active '+(kind==='output'?'device':'preset'):'None';
}
function audioOpen(){
  if(!HB_AUDIO.length) return;
  audioPopup={sub:'',first:0,page:0,rootRect:null,subRect:null,
    lists:{output:audioChoiceItems('output'),dsp:audioChoiceItems('dsp'),scheduler:audioChoiceItems('scheduler')}};
  AUDIO_ROW_HB=[];repaintAll();
}
function audioClose(){if(audioPopup){audioPopup=null;AUDIO_ROW_HB=[];repaintAll();}}
function audioFocus(kind){
  if(!audioPopup || (kind!=='output'&&kind!=='dsp'&&kind!=='scheduler') || audioPopup.sub===kind) return;
  audioPopup.sub=kind;audioPopup.first=0;
  var a=audioPopup.lists[kind].items;
  for(var i=0;i<a.length;i++) if(a[i].active){audioPopup.first=Math.max(0,i-2);break;}
  repaintAll();
}
function audioApply(row){
  if(!audioPopup||!row) return;
  if(row.type==='section'){audioFocus(row.section);return;}
  if(row.type!=='item') return;
  var list=audioPopup.lists[row.section].items, choice=list[row.idx];
  if(!choice) return;
  audioPopup=null;AUDIO_ROW_HB=[];
  try{
    if(row.section==='output') fb.SetOutputDevice(choice.output_id,choice.device_id);
    else if(row.section==='dsp')fb.SetDSPPreset(choice.index);
    else if(row.section==='scheduler'){
      var enabled=!fb.StopAfterCurrent;
      restoreUpNextStop();fb.StopAfterCurrent=enabled;queueViewportCache=null;
    }
  }catch(e){try{fb.ShowPopupMessage('Could not change audio setting:\n'+String(e),'Otoha');}catch(ignore){}}
  repaintAll();
}
function audioListWheel(step){
  if(!audioPopup||!audioPopup.sub||!audioPopup.subRect) return;
  var m=audioPopup, a=m.lists[m.sub].items, max=Math.max(0,a.length-(m.page||1));
  m.first=Math.max(0,Math.min(max,m.first-(step>0?1:-1)*Math.max(1,Math.abs(step)*2)));
  repaintAll();
}
function audioChanged(kind){
  if(audioPopup){audioPopup.lists[kind]=audioChoiceItems(kind);audioPopup.first=0;repaintAll();}
  else repaintBar();
}
function audioHitSection(x,y){
  for(var i=0;i<AUDIO_ROW_HB.length;i++){
    var h=AUDIO_ROW_HB[i];
    if(h.type==='section' && inRect(x,y,h))return h.section;
  }
  return '';
}
function drawAudioMenu(gr){
  AUDIO_ROW_HB=[];
  if(!audioPopup||!HB_AUDIO.length) return;
  var m=audioPopup,btn=HB_AUDIO[0],w=244,rh=50,pad=5,h=rh*3+pad*2;
  var x=Math.max(8,Math.min(btn.x1-w,W-w-8)),y=Math.max(8,btn.y0-h); // flush with audio button: no 6px gap
  m.rootRect={x0:x,y0:y,x1:x+w,y1:y+h};
  gr.FillSolidRect(x+3,y+4,w,h,RGBA(0,0,0,130));
  gr.FillRoundRect(x,y,w,h,8,8,RGB(43,43,43));
  var sections=['output','dsp','scheduler'],labels=['Output device','DSP preset','Scheduler'];
  for(var i=0;i<sections.length;i++){
    var section=sections[i],top=y+pad+i*rh,sel=m.sub===section;
    if(sel||hv(x,top,x+w,top+rh))gr.FillRoundRect(x+4,top,w-8,rh,5,5,sel?RGB(60,60,60):COL.hover);
    drawIcon(gr,section==='output'?'headphones':section==='dsp'?'equalizer':'clock',COL.text2,x+12,top+11,25,25,17);
    tL(gr,labels[i],FONT.pl,COL.text,x+44,top+1,w-74,25);
    tL(gr,audioActiveName(section),FONT.plSub,COL.text2,x+44,top+24,w-74,20);
    // Right-pointing chevron for submenu
    gr.DrawLine(x+w-20,top+20,x+w-15,top+25,2,COL.text2);
    gr.DrawLine(x+w-15,top+25,x+w-20,top+30,2,COL.text2);
    AUDIO_ROW_HB.push({x0:x,y0:top,x1:x+w,y1:top+rh,type:'section',section:section});
  }
  m.subRect=null;
  if(!m.sub) return;
  var contents=m.lists[m.sub],items=contents.items;
  // Submenu touches parent horizontally, so the pointer can enter without crossing a gap.
  var sw=Math.min(m.sub==='output'?340:290,Math.max(190,W-24)),srow=34,head=38,foot=8;
  var available=Math.max(1,R.barY-16);
  var page=Math.max(1,Math.floor((available-head-foot)/srow));
  m.page=Math.max(1,Math.min(items.length||1,page));
  m.first=Math.max(0,Math.min(m.first,Math.max(0,items.length-m.page)));
  var count=items.length?m.page:1, sh=head+count*srow+foot;
  // Prefer a left flyout. Shrink slightly on compact windows so it still
  // meets the parent edge rather than covering it or jumping across a gap.
  if(x-sw<8 && x+w+sw>W-8) sw=Math.max(190,Math.min(sw,x-8));
  var sx=(x-sw>=8)?x-sw:x+w;
  if(sx+sw>W-8) sx=Math.max(8,W-sw-8);
  // Anchor to the selected category, not the top of the entire root menu.
  // Short flyouts may extend below the root; only the window edge limits them.
  var parentTop=y+pad+sections.indexOf(m.sub)*rh;
  var sy=Math.max(8,Math.min(parentTop,H-sh-8));
  m.subRect={x0:sx,y0:sy,x1:sx+sw,y1:sy+sh};
  gr.FillSolidRect(sx+3,sy+4,sw,sh,RGBA(0,0,0,140));
  gr.FillRoundRect(sx,sy,sw,sh,8,8,RGB(48,48,48));
  tL(gr,m.sub==='output'?'Output device':m.sub==='dsp'?'DSP preset':'Scheduler',FONT.pl,COL.text,sx+15,sy+5,sw-30,29);
  gr.FillSolidRect(sx+12,sy+head-2,sw-24,1,COL.line);
  if(!items.length){
    tL(gr,contents.error||('No '+(m.sub==='output'?'devices':'saved presets')),FONT.plSub,COL.text2,sx+14,sy+head,sw-28,srow);
    return;
  }
  for(i=0;i<m.page;i++){
    var idx=m.first+i,it=items[idx],ry=sy+head+i*srow;
    if(hv(sx,ry,sx+sw,ry+srow)) gr.FillRoundRect(sx+4,ry,sw-8,srow,4,4,COL.hover);
    if(it.active) gr.FillEllipse(sx+13,ry+srow/2-4,8,8,COL.accent);
    tL(gr,it.name,FONT.plSub,it.active?COL.accent:COL.text,sx+29,ry,sw-44,srow);
    AUDIO_ROW_HB.push({x0:sx,y0:ry,x1:sx+sw,y1:ry+srow,type:'item',section:m.sub,idx:idx});
  }
  if(items.length>m.page){
    var track=count*srow-6, thumb=Math.max(10,Math.round(m.page/items.length*track));
    var pos=track-thumb,off=Math.round(m.first/Math.max(1,items.length-m.page)*pos);
    gr.FillRoundRect(sx+sw-5,sy+head+3+off,2,thumb,1,1,COL.text2);
  }
}
