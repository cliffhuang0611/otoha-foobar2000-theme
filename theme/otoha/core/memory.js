/* otoha/core/memory.js -- bounded image caches, sized at runtime against the component memory limit
   Part of Otoha, a local music theme for foobar2000. Loaded by main.js;
   every module shares one global scope, so load order is set there. */

/* Bounded image caches. Left unbounded these hold one <=500px image per album, plus a resized
   copy per size and per mask -- fine at a couple of thousand tracks, gigabytes on a large
   library. Eviction is oldest-first and only ever costs a reload, never a wrong pixel. Each key
   is inserted exactly once (callers check hasOwnProperty first), so the order list can't grow
   duplicates. */
function capPut(store,order,cap,key,val){
  store[key]=val; order.push(key);
  if(order.length>cap){
    var drop=order.splice(0,Math.floor(cap/4));
    for(var i=0;i<drop.length;i++) delete store[drop[i]];
  }
}
var artOrder=[], thumbOrder=[], cArtOrder=[];
/* Adaptive cache sizing. window.JsMemoryStats reports usage against the component's hard limit --
   and crossing that limit fails EVERY panel with OOM, so it is the real budget, not free system
   RAM. Measurement confirmed the counter includes native bitmaps and not just the JS heap, which
   is what makes this worth doing at all.
   Caps grow while comfortably under the limit and shrink when approaching it; capPut and
   evictArtCards do the actual freeing on their next insert. */
/* Absolute byte targets, not a fraction of the component limit: the limit here is 2.5GB, but
   measurement showed performance degrading well before that, so the real constraint is machine
   memory pressure rather than the OOM ceiling. Comfort 500MB, hard back-off at 900MB. Still
   clamped against the component limit in case it is smaller than these figures elsewhere. */
var MEM_COMFORT=420*1048576, MEM_CEILING=900*1048576, MEM_STEP=1.25, memTimer=null;
var CAP_MIN={art:200,cart:300,thumb:400,card:200};
/* Growth headroom differs per cache by design. artCache is capped tightly: it is the source for
   derivatives and is never blitted, so measurement showed growing it from 300 to 535 entries cost
   ~250MB and changed nothing (misses were already zero). The derivative caches are what actually
   get drawn and cost far less per entry, so they may grow freely. */
var CAP_MAX={art:350,cart:1200,thumb:2500,card:600};
function capClamp(v,lo,hi){ return v<lo?lo:(v>hi?hi:v); }
function memTick(){
  var s=null; try{ s=window.JsMemoryStats; }catch(e){}
  if(!s || !s.TotalMemoryLimit) return;
  var used=Math.max(s.MemoryUsage||0,s.TotalMemoryUsage||0);
  var lim=s.TotalMemoryLimit;
  var hi=Math.min(MEM_CEILING,lim*0.6), lo=Math.min(MEM_COMFORT,hi*0.6);
  var d=(used<lo)?MEM_STEP:((used>hi)?(1/MEM_STEP):0);
  if(!d) return;
  ART_CAP      =capClamp(Math.round(ART_CAP*d),      CAP_MIN.art,  CAP_MAX.art);
  CART_CAP     =capClamp(Math.round(CART_CAP*d),     CAP_MIN.cart, CAP_MAX.cart);
  THUMB_CAP    =capClamp(Math.round(THUMB_CAP*d),    CAP_MIN.thumb,CAP_MAX.thumb);
  ART_CARD_CAP =capClamp(Math.round(ART_CARD_CAP*d), CAP_MIN.card, CAP_MAX.card);
  GATE_MAX=ART_CAP-60;   // a reveal gate can only wait on what the cache can still hold
}
function startMemWatch(){ if(!memTimer) memTimer=window.SetInterval(memTick,4000); }
function stopMemWatch(){ if(memTimer){ window.ClearInterval(memTimer); memTimer=null; } }
/* Cache caps, adjusted at runtime by memTick() against the component's real memory limit. These
   are starting points: artCache holds decoded bitmaps (~0.6MB each at ART_MAXPX), masked art is
   ~96KB, row thumbs ~8KB -- so the same entry count means wildly different memory per cache, which
   is why they differ. ART_CAP must also exceed the artist count for the shelf/grid reveal gates to
   mean anything: artwork evicted mid-wait would reveal "complete" with placeholders anyway. */
/* artCache is only the SOURCE for derivatives -- never blitted directly -- yet at ~465KB an entry
   it dominates the footprint, so it stays small. artCardCache is what actually removes re-renders
   from the grid and costs ~168KB an entry, so it gets enough slots to hold a full artist list.
   Measured: pushing the total to ~570MB made even panelBg (a plain fill, cache-independent) twice
   as slow -- memory pressure costs more than the cache misses it removes. */
var ART_CAP=300, THUMB_CAP=1200, CART_CAP=600;
