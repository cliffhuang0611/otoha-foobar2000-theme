/* otoha/core/jobs.js -- deferred section builds run in time-budgeted slices
   Part of Otoha, a local music theme for foobar2000. Loaded by main.js;
   every module shares one global scope, so load order is set there. */

/* ---- deferred section builds -------------------------------------------------------------
   The panel has one thread, so a section that builds its data inline blocks the very paint that
   should be showing a loading state -- and blocks input with it. Instead a section reports "not
   ready", paints a skeleton, and its build runs as a sequence of short steps on timer ticks, so
   the message loop keeps processing clicks and scrolls in between.
   The units we cannot split are a single EvalWithMetadbs and Array.sort; everything else is
   sliced around them. ready() reads the real data, so any invalidate*() re-arms this for free. */
/* Steps run in time-budgeted slices, not one per tick. A timer on Windows lands ~15ms out, so
   one-step-per-tick turned an eleven-step build that used to take 20ms into ~165ms -- slower than
   the thing it was smoothing, and long enough to flash a skeleton. Instead a slice keeps running
   steps until it has used its budget, and the FIRST slice runs synchronously: anything that fits
   in a frame finishes inline and never shows a loading state at all. */
var jobs={}, JOB_BUDGET=8;
function jobRun(key,steps){
  if(jobs[key]) return;
  jobs[key]={i:0,steps:steps,t:Date.now()};
  jobSlice(key,false);
}
function jobSlice(key,fromTimer){
  var j=jobs[key]; if(!j) return;
  var t0=Date.now();
  while(j.i<j.steps.length){
    var again=false;
    try{ again=(j.steps[j.i]()===true); }catch(e){}
    if(!again) j.i++;
    if((Date.now()-t0)>=JOB_BUDGET) break;
  }
  if(j.i>=j.steps.length){
    delete jobs[key];
    // only repaint if we actually yielded; a build that finished inline is already being drawn
    if(fromTimer){ repaintMain(); if(R.queue) repaintQueue(); }
    return;
  }
  window.SetTimeout(function(){ jobSlice(key,true); },1);
}
function ensureBuilt(key,ready,steps){
  if(ready()){ if(jobs[key]) delete jobs[key]; return true; }
  jobRun(key,steps());
  return ready();   // fast builds complete inside the synchronous first slice
}
// A build that finishes quickly must not flash a skeleton, so nothing is drawn for the first
// 150ms -- on the fast path that is a frame or two and invisible.
var SKEL_DELAY=150;
function skelVisible(key){ var j=jobs[key]; return !!j && (Date.now()-j.t)>SKEL_DELAY; }
