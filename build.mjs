import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root=dirname(fileURLToPath(import.meta.url));
const result=await build({entryPoints:[join(root,'src/game.mjs')],bundle:true,write:false,format:'iife',platform:'browser',target:['es2020'],minify:true,legalComments:'none',loader:{'.glb':'base64'},alias:{three:join(root,'vendor/three.module.js')}});
const [page,css,icon,license]=await Promise.all([readFile(join(root,'src/page.html'),'utf8'),readFile(join(root,'style.css'),'utf8'),readFile(join(root,'assets/icon.svg')),readFile(join(root,'vendor/THREE-LICENSE.txt'),'utf8')]);
const script=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
const html=page
  .replace('<link rel="stylesheet" href="./style.css">',()=>'<style>'+css+'</style>')
  .replace('href="./assets/icon.svg"','href="data:image/svg+xml;base64,'+icon.toString('base64')+'"')
  .replace(/<script type="importmap">[\s\S]*?<\/script>/,'')
  .replace('<script type="module" src="./src/game.mjs"></script>',()=>'<!-- Three.js license:\n'+license+'-->\n<script>'+script+'</script>');
if(/<(?:script|link)\b[^>]*(?:src|href)="(?!data:)[^"]+"/.test(html))throw new Error('Die Offline-Datei darf keine externen Skripte oder Styles nachladen.');
await writeFile(join(root,'index.html'),html);
for(const [file,size] of [['icon-192.png',192],['icon-512.png',512],['icon-maskable.png',512],['apple-touch-icon.png',180]]){
  let pipeline=sharp(icon);
  if(file==='icon-maskable.png')pipeline=sharp({create:{width:512,height:512,channels:4,background:'#142d35'}}).composite([{input:await sharp(icon).resize(410,410).png().toBuffer(),left:51,top:51}]);
  else pipeline=pipeline.resize(size,size);
  await pipeline.png().toFile(join(root,'assets',file));
}
const manifest=await readFile(join(root,'manifest.webmanifest'));
const template=await readFile(join(root,'src/service-worker.template.js'),'utf8');
const version=createHash('sha256').update(html).update(manifest).update(template).digest('hex').slice(0,16);
await writeFile(join(root,'service-worker.js'),template.replace('__VERSION__',version));
console.log('Offline-Spiel gebaut: index.html ('+(Buffer.byteLength(html)/1024/1024).toFixed(2)+' MB). Kein Server nötig.');
