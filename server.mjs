import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.DUST_RUSH_PORT||4177),host='127.0.0.1';
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.glb':'model/gltf-binary','.png':'image/png','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  try{
    const u=new URL(req.url,'http://'+host+':'+port);
    if(u.pathname==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({app:'dust-rush',status:'ok'}));return;}
    const decoded=decodeURIComponent(u.pathname),target=path.resolve(root,'.'+decoded);
    if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
    let file=target;const info=await stat(file);if(info.isDirectory())file=path.join(file,'index.html');
    const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);
  }catch(e){res.writeHead(e.code==='ENOENT'?404:400,{'Content-Type':'text/plain'});res.end('Nicht gefunden.');}
});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'Port '+port+' ist bereits belegt. Falls Dust Rush schon läuft, öffne http://'+host+':'+port:e);process.exitCode=1;});
server.listen(port,host,()=>{const url='http://'+host+':'+port;console.log('DUST RUSH läuft: '+url);if(process.argv.includes('--open'))spawn('open',[url],{stdio:'ignore'}).unref();});
