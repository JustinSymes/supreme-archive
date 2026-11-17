// Compare color at a shared exposure while retaining a smaller brightness
// difference. Limit amplification of very dark samples so black stays black
// and sensor noise cannot become a strong color signal.
function photoColorDistance(query,reference) {
  const queryLight=query.reduce((a,b)=>a+b,0)/3;
  const referenceLight=reference.reduce((a,b)=>a+b,0)/3;
  const queryGain=128/Math.max(32,queryLight);
  const referenceGain=128/Math.max(32,referenceLight);
  return Math.hypot(...query.map((value,i)=>value*queryGain-reference[i]*referenceGain),
    (queryLight-referenceLight)*.25);
}
if(typeof module!=='undefined') module.exports=photoColorDistance;
