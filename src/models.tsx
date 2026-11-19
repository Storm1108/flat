import type {ReactNode} from 'react'
import {EdgesGeometry, BoxGeometry, Vector2, type Texture, type Vector3} from 'three'
import {useEffect,useMemo} from 'react'
import {RoundedBox} from '@react-three/drei'
import {mVec,meters,rad,type Item,type Project,type Vec} from './model'

const wallpaperStrength=new Vector2(.29,.29)

export function Box({size,at=[0,0,0],color,roughness=.62,metalness=0,radius=0,texture,normalMap,tileMeters}:{
  size:Vec;at?:Vec;color:string;roughness?:number;metalness?:number;radius?:number;texture?:Texture;normalMap?:Texture;tileMeters?:number
}){
  const dims=mVec(size.map(n=>Math.max(1,n)) as Vec)
  const [w,h,d]=dims
  const tiledGeometry=useMemo(()=>{
    if(!tileMeters||radius>0)return null
    const geo=new BoxGeometry(w,h,d)
    const uv=geo.attributes.uv
    // BoxGeometry packs the two X, two Y and two Z faces in that order.
    const spans=[[d,h],[w,d],[w,h]]
    for(let i=0;i<uv.count;i++){
      const [u,v]=spans[Math.floor(i/8)]
      uv.setXY(i,uv.getX(i)*u/tileMeters,uv.getY(i)*v/tileMeters)
    }
    return geo
  },[w,h,d,tileMeters,radius])
  useEffect(()=>()=>tiledGeometry?.dispose(),[tiledGeometry])
  const material=<meshStandardMaterial color={color} roughness={roughness} metalness={metalness} map={texture}
    normalMap={normalMap} normalScale={wallpaperStrength}/>
  return radius>0?<RoundedBox args={dims} position={mVec(at)} radius={Math.min(meters(radius),...dims.map(n=>n*.35))} smoothness={1} castShadow receiveShadow>{material}</RoundedBox>:
    <mesh position={mVec(at)} geometry={tiledGeometry??undefined} castShadow receiveShadow>{!tiledGeometry&&<boxGeometry args={dims}/>}{material}</mesh>
}

function Disk({at,r,length,color,axis='z'}:{at:Vec;r:number;length:number;color:string;axis?:'z'|'y'}){
  return <mesh position={mVec(at)} rotation={[axis==='z'?Math.PI/2:0,0,0]} castShadow receiveShadow><cylinderGeometry args={[meters(r),meters(r),meters(length),24]}/><meshStandardMaterial color={color} roughness={.38}/></mesh>
}

export function ObjectModel({o,p,selected,onSelect}:{o:Item;p:Project;selected:boolean;onSelect:(point:Vector3)=>void}){
  const {w,h,d}=o, finish=o.color??p.materials[o.material]??'#f3eee6', black=p.materials.black, wood=p.materials.wood
  const front=d/2, open=o.opening*Math.PI/200, side=o.hinge??1
  const box=(W:number,H:number,D:number,x=0,y=H/2,z=0,color=finish,radius=0)=><Box size={[W,H,D]} at={[x,y,z]} color={color} radius={radius}/>
  const pull=(x:number,y:number,z=front+9,len=Math.min(135,w*.35))=>box(len,10,17,x,y,z,black,3)
  const carcass=(bottom=0,top=0,split=false)=><>
    {[-1,1].map(s=><Box key={s} size={[17,h,d-18]} at={[s*(w/2-8.5),h/2,-9]} color={finish}/>)}
    {box(w,16,d-18,0,bottom+8,-9)}{top>0&&box(w,16,d-18,0,h-8,-9)}
    {box(w,h,8,0,h/2,-front+4)}{split&&box(w-34,16,d-28,0,h*.52,-8)}
  </>
  const face=(x:number,y:number,W:number,H:number,color=finish)=>box(W,H,18,x,y,front-9,color,2)
  function door(hingeX:number,sign:number,W:number,H:number,y:number,offset=12,color=finish,features?:ReactNode){
    return <group position={mVec([hingeX,y,front-offset])} rotation={[0,sign*open,0]}>
      {box(W,H,22,-sign*W/2,H/2,0,color,3)}{features}
    </group>
  }
  let content:ReactNode
  switch(o.kind){
    case 'bed':
      content=<>{box(w,230,d,0,185,0,wood,15)}{box(w,190,d-65,0,386,12,'#e6ded2',38)}
        {box(w,52,d*.70,0,498,d*.12,finish,25)}{box(w,65,d*.23,0,512,d*.30,'#c4b299',18)}
        {box(w,h,65,0,h/2,-front+32,wood,18)}
        {[-1,1].map(s=><Box key={s} size={[w*.42,105,d*.24]} at={[s*w*.245,515,-d*.31]} color="#f7f3e9" radius={44}/>)}</>
      break
    case 'sofa':
      content=<>{box(w-40,h*.43,d,0,h*.265,0,finish,30)}
        {box(w-80,h*.67,d*.23,0,h*.64,-d*.37,finish,38)}
        {[-1,1].map(s=><group key={s}>{box(w*.13,h*.68,d*.92,s*w*.435,h*.46,0,finish,27)}
          {box(w*.36,h*.14,d*.65,s*w*.19,h*.51,d*.09,finish,28)}
          {box(w*.35,h*.40,d*.18,s*w*.19,h*.73,-d*.25,'#b5bbb0',40)}
          {box(30,65,40,s*w*.39,32,d*.28,black,3)}</group>)}</>
      break
    case 'desk':
      content=<>{box(w,35,d,0,h-17,0,finish,6)}
        {[-1,1].flatMap(s=>[-1,1].map(t=><Box key={s+':'+t} at={[s*(w/2-45),(h-35)/2,t*(d/2-45)]} size={[38,h-35,38]} color={wood} radius={3}/>))}
        {box(w*.37,32,d*.36,0,h+19,-d*.18,black,6)}{box(w*.15,135,22,0,h+80,-d*.27,black,6)}
        {box(w*.51,300,23,0,h+295,-d*.27,black,10)}{box(w*.49,280,2,0,h+295,-d*.27+12,'#424b50',5)}</>
      break
    case 'oval':
      content=<><mesh position={[0,meters(h-20),0]} scale={[meters(w/2),.04,meters(d/2)]} castShadow receiveShadow><cylinderGeometry args={[1,1,1,64]}/><meshStandardMaterial color={finish}/></mesh>
        {[-1,1].flatMap(s=>[-1,1].map(t=><Box key={s+':'+t} at={[s*w*.26,(h-36)/2,t*d*.29]} size={[38,h-36,38]} color={wood} radius={5}/>))}</>
      break
    case 'chair':
      content=<>{box(w,h*.10,d,0,h*.52,0,finish,20)}{box(w*.90,h*.39,50,0,h*.80,-d*.42,finish,20)}
        {[-1,1].flatMap(s=>[-1,1].map(t=><Box key={s+':'+t} at={[s*w*.37,h*.25,t*d*.37]} size={[23,h*.50,23]} color={black} radius={3}/>))}</>
      break
    case 'rack':
      content=<>{[-1,1].map(s=><Box key={s} at={[s*(w/2-9),h/2,0]} size={[18,h,d]} color={finish}/>)}
        {[.015,.25,.49,.73,.985].map((s,i)=><Box key={s} at={[0,h*s,0]} size={[w,18,d]} color={i===2?wood:finish}/>)}
        {box(w,h,11,0,h/2,-front+6)}</>
      break
    case 'closedRack': {
      const drawerH=h*.125
      const doorY=drawerH*2+42
      content=<>{carcass(40,1,true)}{box(w-18,44,d-35,0,22,-9)}
        {[0,1].map(i=><group key={i}>
          {face(0,44+(i+.5)*drawerH,w-5,drawerH-4)}
          {pull(0,44+(i+.73)*drawerH)}
        </group>)}
        {face(0,(doorY+h)/2,w-5,h-doorY-4)}
        {box(8,88,17,w/2-34,doorY+105,front+7,black,2)}
      </>
      break
    }
    case 'wardrobe': {
      if(o.doors===3){
        const leaf=w/3
        content=<>{carcass(44,1)}{box(w-18,50,d-38,0,25,-10)}
          {[-1,0,1].map(i=><group key={i}>{face(i*leaf,h*.516,leaf-4,h*.963)}
            {box(9,120,18,i*leaf+(i===0?-1:1)*(leaf/2-38),h*.48,front+8,black,3)}</group>)}</>
        break
      }
      content=<>{carcass(44,1)}{box(w-18,50,d-38,0,25,-10)}
        {[-1,1].map(s=><group key={s}>{face(s*w/4,h*.516,w/2-4,h*.963)}{box(9,155,18,s*33,h*.51,front+8,black,3)}</group>)}</>
      break
    }
    case 'laundryTall': {
      const seam=Math.round(h*.44)
      const leaf=w-4
      const hingeX=side*(w/2-2)
      const handle=(H:number)=>box(10,125,20,-side*(leaf-48),H/2,19,black,4)
      content=<>{[-1,1].map(s=><Box key={s} size={[17,h,d-22]} at={[s*(w/2-8.5),h/2,-11]} color={finish}/>)}
        {box(w,16,d-22,0,h-8,-11)}{box(w-34,16,d-28,0,seam+8,-12)}
        {box(w-34,h-seam,8,0,(h+seam)/2,-front+4)}
        {[.33,.66].map(f=><Box key={f} size={[w-34,16,d-28]} at={[0,seam+(h-seam)*f,-12]} color={finish}/>)}
        {door(hingeX,side,leaf,seam-12,4,11,finish,handle(seam-12))}
        {door(hingeX,side,leaf,h-seam-8,seam+4,11,finish,handle(h-seam-8))}</>
      break
    }
    case 'laundry':
      content=<>{carcass(33,1)}{box(w,22,d,0,h-11,0)}{box(w,40,d-30,0,20,-10)}
        {[-1,1].map(s=><group key={s}>{door(s*(w/2-7),s,w/2-4,h-58,42,11,finish,box(12,125,20,-s*(w/2-43),h*.55,20,black,4))}</group>)}</>
      break
    case 'washer':
      content=<>{box(w,h,d,0,h/2,0,finish,12)}{box(w*.95,104,5,0,h-63,front,finish,7)}
        {box(w*.31,37,5,w*.23,h-63,front+5,black,4)}<Disk at={[0,h*.49,front+4]} r={w*.318} length={27} color="#adb2b0"/><Disk at={[0,h*.49,front+20]} r={w*.255} length={13} color="#34373a"/><Disk at={[0,h*.49,front+27]} r={w*.208} length={3} color="#202426"/></>
      break
    case 'fridge':
      content=<>{box(w,h,d-36,0,h/2,-18,finish,9)}
        {door(side*w/2,side,w,h*.69,h*.31,16,finish,<>{box(w*.16,h*.12,4,-side*w*.50,h*.495,14,black,4)}
        {box(w*.42,10,12,-side*w*.56,29,17,'#d5d5cf',4)}</>)}
        {door(side*w/2,side,w,h*.30,0,16,finish,box(w*.42,10,12,-side*w*.56,h*.275,17,'#c7c8c2',4))}</>
      break
    case 'oven':
      content=<>{box(w-28,h,d-30,0,h/2,-15,'#252529')}{box(w,h*.18,24,0,h*.905,front-12,black,3)}
        {[-1,0,1].map(s=><Disk key={s} at={[s*w*.28,h*.906,front+6]} r={19} length={12} color="#35383a"/>)}
        <group position={mVec([0,12,front-12])} rotation={[open,0,0]}>
          {box(w,h*.81,24,0,h*.405,0,black,3)}{box(w*.83,h*.62,3,0,h*.374,13,'#45484f',6)}{pull(0,h*.71,26,w*.84)}
        </group></>
      break
    case 'micro':
      content=<>{box(w-23,h-17,d-28,0,h/2,-14,'#25262a')}
        {face(w*.37,h*.50,w*.26,h,black)}<Disk at={[w*.375,h*.54,front+4]} r={20} length={11} color="#515355"/>
        {door(-w/2,-1,w*.73,h,0,12,black,box(w*.60,h*.70,3,w*.365,h*.50,13,'#45484d',5))}</>
      break
    case 'hood':
      content=<>{box(w-18,h-25,d-24,0,h/2+12,-12,'#8c9291')}{box(w,25,d,0,12,0,finish,2)}
        {box(w,23,82,0,11,front-42+o.opening*1.8,'#969c9b',2)}{box(w-56,3,58,0,0,front-45+o.opening*1.8,'#424547')}</>
      break
    case 'hob':
      content=<>{box(w,h,d,0,h/2,0,black,6)}
        {[-1,1].map(s=><group key={s}><Disk at={[0,h+1,s*d*.215]} r={w*.34} length={2} color="#677174" axis="y"/><Disk at={[0,h+2,s*d*.215]} r={w*.327} length={2} color="#242528" axis="y"/></group>)}
        {box(w*.23,1,6,0,h+4,d*.41,'#8d9491')}</>
      break
    case 'sink':
      content=<>{box(w,16,d,0,47,0,'#9fa6a6',10)}{box(w*.83,17,d*.72,0,56,d*.055,'#586364',12)}
        <Disk at={[0,111,-d*.36]} r={15} length={131} color="#aeb5b5" axis="y"/>
        <Disk at={[0,166,-d*.21]} r={13} length={d*.33} color="#adb3b3"/>
        <Disk at={[0,147,-d*.05]} r={12} length={45} color="#aeb5b5" axis="y"/></>
      break
    case 'ovenCab':
      content=<>{carcass(0,0)}{face(0,81,w-4,158)}{pull(0,119)}</>
      break
    case 'drawers':
      content=<>{carcass(0,0)}{[0,1,2].map(i=><group key={i}>{face(0,h*(i+.5)/3,w-4,h/3-4)}{pull(0,h*(i+.78)/3)}</group>)}</>
      break
    case 'upper':
      content=<>{carcass(0,1,true)}
        {o.id==='upper11'?<>{face(0,(h+300)/2,w-4,h-304)}{pull(0,330)}</>:
          o.id==='upper10'?<>{face(0,(h+24)/2,w-4,h-28)}{pull(0,62)}</>:
          <>{face(0,h/2,w-4,h-4)}{pull(0,Math.max(48,h*.12))}</>}</>
      break
    case 'cabinet':
      content=<>{carcass(0,0,true)}{face(0,h/2,w-4,h-5)}{pull(0,h-60)}</>
      break
    default:
      content=box(w,h,d,0,h/2,0,finish)
  }
  const edge=useMemo(()=>{
    const geo=new BoxGeometry(meters(w+11),meters(h+11),meters(d+11))
    const edges=new EdgesGeometry(geo)
    geo.dispose()
    return edges
  },[w,h,d])
  return <group position={mVec([o.x,o.y,o.z])} rotation={[0,rad(o.rot),0]} onClick={event=>{event.stopPropagation();onSelect(event.point)}}>
    {content}
    {selected&&<lineSegments geometry={edge} position={[0,meters(h/2),0]}><lineBasicMaterial color="#3bd1aa" depthTest={false}/></lineSegments>}
  </group>
}
