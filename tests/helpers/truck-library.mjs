import {readFileSync} from 'node:fs';
export async function loadTruckLibrary(GLTFLoader){
  const scenes=await Promise.all(['truck-library-v2','workshop-parts-v1'].map(async name=>{
    const bytes=readFileSync(new URL('../../assets/'+name+'.glb',import.meta.url));
    return (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
  }));
  scenes[0].add(scenes[1]);return scenes[0];
}
