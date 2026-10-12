/* verdant/core/tokens.js -- design tokens: colours, metrics, fonts, glyphs, text + icon drawing
   Part of Verdant, a Spotify-style theme for foobar2000. Loaded by main.js;
   every module shares one global scope, so load order is set there. */

/* ------------------------- colour helpers ------------------------- */
function RGB(r,g,b){ return (0xff000000|(r<<16)|(g<<8)|b); }
function RGBA(r,g,b,a){ return ((a<<24)|(r<<16)|(g<<8)|b); }

/* ------------------------- tokens -------------------------
   The two knobs worth touching are UISCALE (a panel property now -- see core/props.js) and
   M.navW / M.queueW (sidebar and queue-pane widths). Everything else is derived layout. */
var COL = {
  black:RGB(0,0,0), base:RGB(18,18,18), elev:RGB(24,24,24), hover:RGB(42,42,42),
  text:RGB(255,255,255), text2:RGB(179,179,179), text3:RGB(106,106,106),
  green:RGB(30,215,96), greenC:RGB(29,185,84),
  rowHover:RGBA(255,255,255,18), rowActive:RGBA(255,255,255,38),
  line:RGBA(255,255,255,28), seekbg:RGB(77,77,77)
};
var M = { pad:8, gap:8, navW:190, queueW:240, barH:96, navTopH:84, rowH:56, radius:10, cpad:24, headH:280, artSz:200 };   // navW/queueW: sidebar + queue widths
var PALETTE=[RGB(83,62,140),RGB(30,120,110),RGB(150,64,92),RGB(43,92,160),RGB(120,92,44),RGB(58,120,64),RGB(140,80,120),RGB(52,100,150),RGB(96,72,52),RGB(70,70,96)];

/* ------------------------- fonts (create once) -------------------------
   Every font is built here at load time from UISCALE, which core/props.js has already resolved
   from the panel property (or the display DPI). That is why props.js loads first, and why a
   scale change needs a panel reload rather than just a repaint.
   Regular (non-bold) text uses 'Segoe UI Semibold' so it doesn't read thin. */
function gf(name,sz,style){ return gdi.Font(name, Math.max(1,Math.round(sz*UISCALE)), style||0); }
function F(sz,bold){ return gf(bold?'Segoe UI':'Segoe UI Semibold', sz, bold?1:0); }
var FONT = {
  lib:F(15,1), pl:F(13,1), plSub:F(11,0),
  eyebrow:F(11,1), title:F(52,1), meta:F(13,0),
  rowTitle:F(14,0), rowArtist:F(12,0), rowNum:F(13,0), rowCell:F(13,0), head:F(12,1),
  tab:F(16,1), sect:F(15,1), qName:F(13,0), qArtist:F(11,0),
  npTitle:F(15,0), npArtist:F(12,0), time:F(12,0),
  icon:gf('Segoe MDL2 Assets',15), iconBtn:gf('Segoe MDL2 Assets',18),
  navIco:gf('Segoe MDL2 Assets',24), cap:gf('Segoe MDL2 Assets',10),
  menu:gf('Segoe UI',12), card:gf('Segoe UI',14,1), sect2:gf('Segoe UI',22,1),
  searchTxt:gf('Segoe UI Semibold',16,0),
  lyric:gf('Segoe UI',18,1), fsLyric:gf('Segoe UI',30,1),
  fsSrc:gf('Segoe UI Semibold',13,0),
  fsSrcName:gf('Segoe UI',13,1)   // bold: the playlist name, vs. the plain-weight fixed caption
};
function chr(c){ return String.fromCharCode(c); }
// MDL2 fallbacks for drawIcon when gdi.LoadSVG is unavailable (keys mirror ICONS), plus caption buttons
var GLYPH = {
  play:chr(0xE768), pause:chr(0xE769), prev:chr(0xE892), next:chr(0xE893),
  shuffle:chr(0xE8B1), repeat:chr(0xE8EE), repeat1:chr(0xE8ED), volume:chr(0xE767),
  headphones:chr(0xE7F6), equalizer:chr(0xE9E9), audioSettings:chr(0xE9E9),
  search:chr(0xE721), home:chr(0xE80F), add:chr(0xE710), more:chr(0xE712), clock:chr(0xE823),
  cmin:chr(0xE921), cmax:chr(0xE922), crestore:chr(0xE923), cclose:chr(0xE8BB)
};
var CH_DOT=chr(0xB7), CH_BULL=chr(0x2022);

/* ------------------------- DrawText flags ------------------------- */
var DT_L = 0x4|0x20|0x800|0x8000;        // left + vcenter + singleline + noprefix + end-ellipsis
var DT_R = 0x2|0x4|0x20|0x800;           // right + vcenter + singleline + noprefix
var DT_C = 0x1|0x4|0x20|0x800;           // center + vcenter + singleline + noprefix
/* Labels are singleline+vcenter, which CLIPS to the rect: call sites pass hardcoded box heights
   while fonts scale with UISCALE, so descenders get sliced off. fitV() grows a too-short box
   symmetrically to the line height (identity-cached per font). */
var LH_F=[], LH_V=[];
function lineH(gr,f){
  for(var i=0;i<LH_F.length;i++) if(LH_F[i]===f) return LH_V[i];
  var n=0; try{ n=Math.ceil(gr.CalcTextHeight('Ag',f)); }catch(e){ n=0; }
  LH_F.push(f); LH_V.push(n); return n;
}
var fitY=0, fitH=0;
function fitV(gr,f,y,h){ var n=lineH(gr,f); if(n>h){ fitY=y-((n-h)>>1); fitH=n; } else { fitY=y; fitH=h; } }
function tL(gr,s,f,c,x,y,w,h){ fitV(gr,f,y,h); gr.GdiDrawText(s,f,c,x,fitY,w,fitH,DT_L); }
var TITLE_FIT_SIZES=[52,46,40,36,32,28,24,22,20,18,16,14,12];
var TITLE_FIT_FONTS=null;
function fitHeaderFont(gr,text,width){
  if(!TITLE_FIT_FONTS){ TITLE_FIT_FONTS=[]; for(var i=0;i<TITLE_FIT_SIZES.length;i++) TITLE_FIT_FONTS.push(F(TITLE_FIT_SIZES[i],1)); }
  for(var j=0;j<TITLE_FIT_FONTS.length;j++) if(gr.CalcTextWidth(text,TITLE_FIT_FONTS[j])<=width) return TITLE_FIT_FONTS[j];
  return TITLE_FIT_FONTS[TITLE_FIT_FONTS.length-1];
}
function tR(gr,s,f,c,x,y,w,h){ fitV(gr,f,y,h); gr.GdiDrawText(s,f,c,x,fitY,w,fitH,DT_R); }
function tC(gr,s,f,c,x,y,w,h){ fitV(gr,f,y,h); gr.GdiDrawText(s,f,c,x,fitY,w,fitH,DT_C); }
function tCE(gr,s,f,c,x,y,w,h){ fitV(gr,f,y,h); gr.GdiDrawText(s,f,c,x,fitY,w,fitH,DT_C|0x8000); }   // centered, ellipsized

/* ------------------------- vector icons (SVG rasterized via gdi.LoadSVG, tinted + cached) ------------------------- */
var ICONS={
 play:"<path d='M8 5v14l11-7z'/>",
 pause:"<rect x='6' y='5' width='4' height='14' rx='1.3'/><rect x='14' y='5' width='4' height='14' rx='1.3'/>",
 prev:"<path d='M6 6h2.2v12H6zm3 6l9 6V6z'/>",
 next:"<path d='M15.8 6H18v12h-2.2zM6 18l9-6-9-6z'/>",
 shuffle:"<path d='M10.59 9.17 5.41 4 4 5.41l5.17 5.17zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04z'/>",
 repeat:"<path d='M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z'/>",
 repeat1:"<path d='M13 15V9h-1l-2 1v1h1.5v4zm4-8v3l4-4-4-4v3H5v6h2V7zm0 10H7v-3l-4 4 4 4v-3h12v-6h-2z'/>",
 volume:"<path d='M3 9v6h4l5 5V4L7 9zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z'/>",
 home:"<path d='M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z'/>",
  headphones:"<path d='M12 2a9 9 0 0 0-9 9v7a3 3 0 0 0 3 3h3v-9H5v-1a7 7 0 0 1 14 0v1h-4v9h3a3 3 0 0 0 3-3v-7a9 9 0 0 0-9-9z'/>",
  search:"<path d='M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19zm-6 0A4.5 4.5 0 1 1 14 9.5 4.49 4.49 0 0 1 9.5 14z'/>",
 add:"<path d='M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z'/>",
 more:"<path d='M6 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm12 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z'/>",
 clock:"<path d='M11.99 2A10 10 0 1 0 22 12 10 10 0 0 0 11.99 2zM12 20a8 8 0 1 1 8-8 8 8 0 0 1-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z'/>",
 panelOpen:"<path d='M3 5h18v2H3zm0 12h18v2H3zm0-10h2v10H3zm16 0h2v10h-2zM16 11h-5V8l-4 4 4 4v-3h5z'/>",
 grid:"<path d='M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z'/>",
 list:"<path d='M3 4h3v3H3zm5 0h13v3H8zM3 10h3v3H3zm5 0h13v3H8zM3 16h3v3H3zm5 0h13v3H8z'/>",
 stop:"<path d='M5 5h14v14H5z'/>",
 music:"<path d='M9 3v12.2A3.5 3.5 0 1 0 11 18V7l8-2v8.2A3.5 3.5 0 1 0 21 16V1z'/>",
 panelClose:"<path d='M3 5h18v2H3zm0 12h18v2H3zm0-10h2v10H3zm16 0h2v10h-2zM8 11h5V8l4 4-4 4v-3H8z'/>",
 expand:"<path d='M7 14H5v5h5v-2H7zm-2-4h2V7h3V5H5zm12 7h-3v2h5v-5h-2zM14 5v2h3v3h2V5z'/>",
 compress:"<path d='M5 16h3v3h2v-5H5zm3-8H5v2h5V5H8zm6 11h2v-3h3v-2h-5zm2-11V5h-2v5h5V8z'/>",
 mic:"<path d='M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11z'/>",
 equalizer:"<path d='M10 20h4V4h-4zm-6 0h4v-8H4zm12-11v11h4V9z'/>",
 audioSettings:"<path d='M4 7h9v2H4zm13 0h3v2h-3zM4 15h3v2H4zm7 0h9v2h-9z'/><circle cx='15' cy='8' r='2.7'/><circle cx='9' cy='16' r='2.7'/>",
 chevron:"<path d='M7 10l5 5 5-5z'/>",
 sortAsc:"<path d='M4 12l1.41 1.41L11 7.83V20h2V7.83l5.59 5.58L20 12l-8-8-8 8z'/>",
 sortDesc:"<path d='M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.59-5.58L4 12l8 8 8-8z'/>"
};
var svgCache={};
// keyed on the numeric colour (alpha stripped -- drawIcon applies that at blit time), so a hit
// costs one concat instead of unpacking the channels into a string on every icon of every frame
function iconImg(name,size,col){
  var key=name+'|'+size+'|'+(col&0xffffff);
  if(svgCache.hasOwnProperty(key)) return svgCache[key];
  var rgb=((col>>16)&0xff)+','+((col>>8)&0xff)+','+(col&0xff);
  var xml="<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='"+size+"' height='"+size+"'><g fill='rgb("+rgb+")'>"+ICONS[name]+"</g></svg>";
  var bmp=null; try{ bmp=gdi.LoadSVG(xml,size); }catch(e){ bmp=null; }
  svgCache[key]=bmp; return bmp;
}
// draw a crisp size-px vector icon centred in [x,y,w,h]; falls back to the MDL2 glyph if LoadSVG is unavailable
function drawIcon(gr,name,col,x,y,w,h,size){
  var s=size||Math.min(w,h), img=iconImg(name,s,col);
  if(img){ var a=(col>>>24)&0xff; if(!a) a=255; gr.DrawImage(img,Math.round(x+(w-s)/2),Math.round(y+(h-s)/2),s,s,0,0,img.Width,img.Height,0,a); return; }
  tC(gr,GLYPH[name]||'?',(s>=26?FONT.navIco:(s>=18?FONT.iconBtn:FONT.icon)),col,x,y,w,h);
}
