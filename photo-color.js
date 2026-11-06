// Sample both sides of the lower torso, away from central chest artwork.
// Used by the index builder and the browser with the same white 96px canvas.
function photoFabricColor(pixels, channels=4) {
  const samples=[[],[],[]];
  for(let y=60;y<80;y++) for(const start of [34,53]) for(let x=start;x<start+9;x++) {
    const offset=(y*96+x)*channels;
    for(let channel=0;channel<3;channel++) samples[channel].push(pixels[offset+channel]);
  }
  return samples.map(values=>values.sort((a,b)=>a-b)[values.length>>1]);
}
if(typeof module!=='undefined') module.exports=photoFabricColor;

function photoCenterColor(pixels, channels=4) {
  const samples=[[],[],[]];
  for(let y=38;y<68;y++) for(const start of [35,52]) for(let x=start;x<start+10;x++) {
    const offset=(y*96+x)*channels;
    for(let channel=0;channel<3;channel++) samples[channel].push(pixels[offset+channel]);
  }
  return samples.map(values=>values.sort((a,b)=>a-b)[values.length>>1]);
}
if(typeof module!=='undefined') module.exports.center=photoCenterColor;
