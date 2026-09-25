import {VEHICLE_DIMENSIONS as DIM} from '../vehicle-dimensions.mjs';
import {WHEEL_CORNERS} from '../suspension.mjs';

export function extendChassis(model){
  if(model.userData.longChassis)throw new Error('Chassis already extended');
  for(const corner of WHEEL_CORNERS){
    const suspension=model.getObjectByName('Suspension_'+corner.code);
    const spring=model.getObjectByName('Spring_and_damper_'+corner.code);
    const oldZ=suspension.position.z;
    suspension.position.z=oldZ*DIM.chassisStretch;
    const delta=suspension.position.z-oldZ;
    // Springs use baked source coordinates. Translate each complete coil to
    // its new axle; stretching the mesh would also distort its circular wire.
    spring.traverse(object=>{
      if(object.isMesh)object.geometry=object.geometry.clone().translate(0,0,delta);
    });
  }
  model.getObjectByName('Frame_and_bumpers').traverse(object=>{
    if(object.isMesh)object.geometry=object.geometry.clone().scale(1,1,DIM.chassisStretch);
  });
  model.userData.longChassis=true;
}
