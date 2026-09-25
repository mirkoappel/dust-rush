// Keep the menu composition truck-relative: each cached course has its own
// spawn position and heading, but switching scenery must not move the truck.
export function captureMenuView(world){
  if(!world?.cameraInitialized||world.race.mode!=='menu')return null;
  const car=world.race.player,c=Math.cos(car.heading),s=Math.sin(car.heading);
  const local=point=>{
    const x=point.x-car.x,z=point.z-car.z;
    return {x:c*x-s*z,y:point.y-car.y,z:s*x+c*z};
  };
  return {position:local(world.camera.position),target:local(world.smoothedTarget),clock:world.clock,fov:world.camera.fov};
}

export function restoreMenuView(world,view){
  if(!view||world.race.mode!=='menu')return;
  const car=world.race.player,c=Math.cos(car.heading),s=Math.sin(car.heading);
  const restore=(point,local)=>point.set(car.x+c*local.x+s*local.z,car.y+local.y,car.z-s*local.x+c*local.z);
  restore(world.camera.position,view.position);restore(world.smoothedTarget,view.target);
  world.clock=view.clock;world.camera.fov=view.fov;
  world.horizonRoll=0;world.cameraHorizonRoll=0;world.cameraInitialized=true;
  world.camera.lookAt(world.smoothedTarget);world.camera.updateProjectionMatrix();
}
