export const DEFAULT_BUILD=Object.freeze({wheels:'standard',lift:'normal',wing:false,lights:false,pipes:false});
export function normalizeBuild(value={}){
  if(!value||typeof value!=='object')value={};
  return {wheels:value.wheels==='giant'?'giant':'standard',lift:value.lift==='high'?'high':'normal',wing:value.wing===true,lights:value.lights===true,pipes:value.pipes===true};
}
export function buildGeometry(value){
  const build=normalizeBuild(value),wheelScale=build.wheels==='giant'?1.2:1;
  return {...build,wheelScale,wheelRadius:.685*wheelScale,groundLift:.685*(wheelScale-1),bodyLift:build.lift==='high'?.28:0};
}
