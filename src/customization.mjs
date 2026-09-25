import {VEHICLE_DIMENSIONS} from './vehicle-dimensions.mjs';
export const WING_TYPES=Object.freeze(['lip','sport','stunt','delta','none']);
export const LIGHT_TYPES=Object.freeze(['bar','round','pods','rally','none']);
export const DECAL_TYPES=Object.freeze(['stripes','bolt','flames','tribal','none']);
export const DEFAULT_BUILD=Object.freeze({body:'pickup',wheels:'standard',lift:'normal',engine:'classic',wing:'none',lights:'none',decals:'stripes',pipes:true});
export const DEFAULT_PAINT=Object.freeze({body:'#14bdd1',wheels:'#ff941f',lift:'#ff941f',engine:'#ff941f',wing:'#ff941f',lights:'#ff941f',decals:'#ff941f',pipes:'#a4b6bb'});
export const WHEEL_TYPES=Object.freeze({
  standard:{scale:1},
  giant:{scale:1.2},
  sand:{scale:1.05},
  street:{scale:.95},
});
export const LIFT_HEIGHTS=Object.freeze({normal:0,high:.28,tall:.42,extraHigh:.56});
export const ENGINE_TUNING=Object.freeze({
  classic:{power:1,response:3.4},
  injected:{power:1.08,response:3.4},
  supercharged:{power:1.14,response:3.1},
  electric:{power:1.04,response:5.0},
});
export function isPartAvailable(part,build){return part!=='pipes'||build.engine!=='electric';}
const color=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
export function normalizePaint(value={}){
  if(!value||typeof value!=='object')value={};
  return Object.fromEntries(Object.entries(DEFAULT_PAINT).map(([part,fallback])=>[part,color(value[part])?value[part]:part!=='body'&&color(value.accent)?value.accent:fallback]));
}
export function normalizeBuild(value={}){
  if(!value||typeof value!=='object')value={};
  const engine=Object.hasOwn(ENGINE_TUNING,value.engine)?value.engine:'classic';
  return {body:['pickup','buggy','van','hotrod'].includes(value.body)?value.body:'pickup',wheels:Object.hasOwn(WHEEL_TYPES,value.wheels)?value.wheels:'standard',lift:Object.hasOwn(LIFT_HEIGHTS,value.lift)?value.lift:'normal',engine,
    wing:value.wing===true?'stunt':WING_TYPES.includes(value.wing)?value.wing:'none',
    lights:value.lights===true?'pods':LIGHT_TYPES.includes(value.lights)?value.lights:'none',
    decals:DECAL_TYPES.includes(value.decals)?value.decals:'stripes',pipes:engine!=='electric'};
}
export function buildGeometry(value){
  const build=normalizeBuild(value),wheelScale=WHEEL_TYPES[build.wheels].scale;
  return {...build,wheelScale,wheelRadius:VEHICLE_DIMENSIONS.wheelRadius*wheelScale,groundLift:VEHICLE_DIMENSIONS.wheelRadius*(wheelScale-1),bodyLift:LIFT_HEIGHTS[build.lift]};
}

// Removable accessories and decals toggle off; structural parts retain one choice.
export function selectBuildOption(build,part,value){
  const next=['wing','lights','decals'].includes(part)&&build[part]===value?'none':value;
  return normalizeBuild({...build,[part]:next});
}
