/* verdant/core/tf.js -- title-format objects, compiled once
   Part of Verdant, a Spotify-style theme for foobar2000. Loaded by main.js;
   every module shares one global scope, so load order is set there. */

/* ------------------------- title formats ------------------------- */
var TF = {
  title:fb.TitleFormat('%title%'), artist:fb.TitleFormat('[%artist%]'),
  album:fb.TitleFormat('[%album%]'), len:fb.TitleFormat('%length%'),
  npTitle:fb.TitleFormat('[%title%]'), npArtist:fb.TitleFormat('[%artist%]'),
  albkey:fb.TitleFormat('%album artist% - %album%'), artistName:fb.TitleFormat('%album artist%'),
  year:fb.TitleFormat('$year(%date%)'), lensec:fb.TitleFormat('%length_seconds%'),
  trackno:fb.TitleFormat('[%tracknumber%]'), discno:fb.TitleFormat('[%discnumber%]'),
  rg:fb.TitleFormat('$if(%replaygain_track_gain%,1,0)')   // '1' once a loudness scan has tagged the file
};
