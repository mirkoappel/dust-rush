// Bounded LRU: arbitrary future color-picker values cannot grow memory forever.
export function createPreviewCache(limit=64,onEvict=()=>{}){
  const entries=new Map();
  if(!Number.isInteger(limit)||limit<1)throw new Error('Preview cache needs a positive limit');
  return {
    get size(){return entries.size;},
    get(key){
      const value=entries.get(key);if(value===undefined)return undefined;
      entries.delete(key);entries.set(key,value);return value;
    },
    set(key,value){
      if(entries.has(key)){const old=entries.get(key);entries.delete(key);if(old!==value)onEvict(old);}
      entries.set(key,value);
      while(entries.size>limit){const oldest=entries.keys().next().value;onEvict(entries.get(oldest));entries.delete(oldest);}
    },
    clear(){for(const value of entries.values())onEvict(value);entries.clear();}
  };
}

export function previewKey(part,value,build,paint){
  const body=['wing','lights','pipes'].includes(part)?build.body:'';
  return [part,value||'',body,paint[part].toLowerCase(),
    part==='body'?build.decals:'',part==='body'?paint.decals.toLowerCase():''].join('|');
}
