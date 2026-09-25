import * as THREE from 'three';
import {DECAL_TYPES} from '../customization.mjs';

// Shared, colorless masks: recoloring changes a uniform, never regenerates textures.
const PATTERNS={
  stripes:[[[.06,.80],[.29,.80],[.94,.29],[.71,.29]],[[.08,.55],[.18,.55],[.81,.07],[.71,.07]]],
  bolt:[[[.05,.85],[.53,.85],[.40,.57],[.96,.65],[.57,.12],[.67,.43],[.18,.36],[.31,.63]]],
  flames:[[[.04,.17],[.04,.79],[.22,.63],[.31,.87],[.48,.58],[.68,.82],[.61,.52],[.96,.69],[.79,.40],[.96,.28],[.59,.31],[.72,.07],[.43,.27],[.27,.13]]],
  tribal:[[[.05,.80],[.32,.66],[.51,.91],[.46,.61],[.94,.81],[.75,.54],[.93,.33],[.60,.42],[.73,.08],[.42,.38],[.11,.16],[.29,.46]]],
};
const REGIONS={
  pickup:[-1.51,.66,-.31,.34],van:[-1.5,.78,.09,.53],
  buggy:[-.89,.62,-.23,.29],hotrod:[-1.58,-.28,.045,.38],
};
const masks=new Map();
export function insidePolygon(x,y,points){
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[i],b=points[j];
    if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
export function decalMask(kind){
  if(masks.has(kind))return masks.get(kind);
  const width=256,height=128,data=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    let coverage=0;
    for(const dx of [.25,.75])for(const dy of [.25,.75]){
      if(PATTERNS[kind].some(p=>insidePolygon((x+dx)/width,(y+dy)/height,p)))coverage++;
    }
    const i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=coverage*255/4;data[i+3]=255;
  }
  const texture=new THREE.DataTexture(data,width,height);
  texture.magFilter=texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;
  texture.name='Decal_mask_'+kind;masks.set(kind,texture);return texture;
}

// The older GLB merges graphics, indicators and harnesses into one orange primitive.
// Filter only the known graphic regions in this asset revision; preserve real hardware.
export function isLegacyGraphic(x,y,z,body){
  return (Math.abs(x)>.58&&z>-1.56&&z<.71)||
    (body==='pickup'&&Math.abs(x)<.40&&y>.38&&z>.55&&z<1.70);
}
export function prepareBodyDecor(model,body){
  const materials=[],ownedGeometry=[],uniforms={
    drDecalMap:{value:decalMask('stripes')},drDecalColor:{value:new THREE.Color('#ff941f')},
    drDecalRegion:{value:new THREE.Vector4(...REGIONS[body])},
    drDecalHood:{value:body==='pickup'?1:0},
  };
  model.traverse(object=>{
    if(!object.isMesh||Array.isArray(object.material))return;
    if(object.material.name.includes('Orange')){
      const original=object.geometry,p=original.attributes.position,indices=original.index;
      const kept=[];
      for(let i=0;i<(indices?.count||p.count);i+=3){
        const ids=[0,1,2].map(j=>indices?indices.getX(i+j):i+j);
        if(!ids.every(id=>isLegacyGraphic(p.getX(id),p.getY(id),p.getZ(id),body)))kept.push(...ids);
      }
      if(kept.length<(indices?.count||p.count)){
        const geometry=original.clone();geometry.setIndex(kept);object.geometry=geometry;ownedGeometry.push(geometry);
      }
    }
    if(!object.material.name.includes('Turquoise'))return;
    // A private material isolates each configured truck and each preview entry.
    const material=object.material.clone();object.material=material;materials.push(material);
    material.customProgramCacheKey=()=> 'dust-rush-body-decor-v1';
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      shader.vertexShader='varying vec3 drPosition;\nvarying vec3 drNormal;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ndrPosition=position;drNormal=normal;');
      shader.fragmentShader=`varying vec3 drPosition;
varying vec3 drNormal;
uniform sampler2D drDecalMap;
uniform vec3 drDecalColor;
uniform vec4 drDecalRegion;
uniform float drDecalHood;
float drInside(vec2 uv){return step(0.0,uv.x)*step(uv.x,1.0)*step(0.0,uv.y)*step(uv.y,1.0);}
`+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
vec2 drUV=vec2((drPosition.z-drDecalRegion.x)/(drDecalRegion.y-drDecalRegion.x),(drPosition.y-drDecalRegion.z)/(drDecalRegion.w-drDecalRegion.z));
float drSide=texture2D(drDecalMap,drUV).r*drInside(drUV)*smoothstep(.35,.65,abs(normalize(drNormal).x))*step(.50,abs(drPosition.x));
vec2 drTopUV=vec2((drPosition.z-.55)/1.1,drPosition.x+.5);
float drTop=texture2D(drDecalMap,drTopUV).r*drInside(drTopUV)*step(.32,drPosition.y)*smoothstep(.5,.8,normalize(drNormal).y)*drDecalHood;
diffuseColor.rgb=mix(diffuseColor.rgb,drDecalColor,max(drSide,drTop));
`);
    };
  });
  return {
    materials,
    setStyle(kind){uniforms.drDecalMap.value=decalMask(DECAL_TYPES.includes(kind)?kind:'stripes');},
    setPaint(color){uniforms.drDecalColor.value.set(color);},
    dispose(){for(const material of materials)material.dispose();for(const geometry of ownedGeometry)geometry.dispose();},
  };
}
