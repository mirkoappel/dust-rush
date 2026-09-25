import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const bundle=await build({
  stdin:{contents:"export * from './src/models/spring.mjs';",resolveDir:fileURLToPath(new URL('../',import.meta.url))},
  bundle:true,write:false,format:'esm',platform:'node',logLevel:'silent',
  alias:{three:fileURLToPath(new URL('../vendor/three.module.js',import.meta.url))}
});
const {springProfile,createSpringGeometry,updateSpringGeometry}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].contents).toString('base64'));
test('Vier Federbaugrößen wachsen in Durchmesser, Draht und Windungszahl statt nur in der Länge',()=>{
  const profiles=[0,.28,.42,.56].map(springProfile);
  assert.deepEqual(profiles.map(p=>p.turns),[7,9,10,11]);
  for(let i=1;i<profiles.length;i++){
    assert.ok(profiles[i].radius>profiles[i-1].radius);
    assert.ok(profiles[i].wire>profiles[i-1].wire);
  }
});
test('Einfedern lässt den Draht kreisrund und unverändert dick; Normale bleiben korrekt',()=>{
  const g=createSpringGeometry(),p=g.attributes.position,n=g.attributes.normal;
  for(const lift of [0,.28,.42,.56])for(const length of [.30,.55,.85,1.12]){
    updateSpringGeometry(g,length,lift);const profile=springProfile(lift);
    for(let i=0;i<=154;i++){
      const t=i/154,a=t*profile.turns*Math.PI*2,c=Math.cos(a),s=Math.sin(a);
      const centre=[profile.radius*c,t*length,profile.radius*s];
      const tangent=[-profile.radius*profile.turns*Math.PI*2*s,length,profile.radius*profile.turns*Math.PI*2*c];
      for(let j=0;j<=8;j++){
        const k=i*9+j,dx=p.getX(k)-centre[0],dy=p.getY(k)-centre[1],dz=p.getZ(k)-centre[2];
        assert.ok(Math.abs(Math.hypot(dx,dy,dz)-profile.wire)<1e-6);
        assert.ok(Math.abs(n.getX(k)*tangent[0]+n.getY(k)*tangent[1]+n.getZ(k)*tangent[2])<1e-6);
      }
    }
  }
});
test('Bewegte Federn behalten ihre Puffer; Stillstand lädt keine Geometrie neu hoch',()=>{
  const g=createSpringGeometry(),p=g.attributes.position.array,n=g.attributes.normal.array;
  updateSpringGeometry(g,.6,.28);const version=g.attributes.position.version;
  assert.equal(updateSpringGeometry(g,.6,.28),false);assert.equal(g.attributes.position.version,version);
  updateSpringGeometry(g,.45,.28);assert.equal(g.attributes.position.array,p);assert.equal(g.attributes.normal.array,n);
  assert.ok(g.boundingSphere.radius>0);
});
