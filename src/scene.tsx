import {Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react'
import {Canvas, useFrame, useThree} from '@react-three/fiber'
import {Line, OrbitControls, useTexture} from '@react-three/drei'
import {CanvasTexture, Euler, PCFShadowMap, Quaternion, RepeatWrapping, SRGBColorSpace, TextureLoader, Vector3,type Texture,type Group} from 'three'
import {Box,ObjectModel} from './models'
import {activeItems} from './store'
import {geometry, intersects, mVec, meters, movingPanels, v, within,type Project,type Solid,type Vec} from './model'

export type WalkVector={right:number;forward:number}
export type CameraMode='plan'|'orbit'|'walk'
export type Display={walls:string[];ceiling:boolean;cutaway:boolean;duct:boolean;dimensions:boolean;collision:boolean;eye:number}
type SceneProps={walkInput:{current:WalkVector};p:Project;mode:'orbit'|'walk';view:Display;selected:string|null;measure:boolean;points:Vec[];setPoint:(v:Vec)=>void;select:(id:string|null)=>void;canvas:(v:HTMLCanvasElement)=>void}
const scenePoint=(pt:Vector3):Vec=>[Math.round(pt.x*1000),Math.round(pt.y*1000),Math.round(pt.z*1000)]
const asset=(name:string)=>import.meta.env.BASE_URL+name
const staticShadows={type:PCFShadowMap,autoUpdate:false}

function woodTexture(){
  const canvas=document.createElement('canvas')
  canvas.width=768;canvas.height=768
  const ctx=canvas.getContext('2d')!
  let seed=15783
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296)
  for(let col=0;col<7;col++){
    const x=col*110, offset=Math.round(random()*350)
    for(let y=-offset;y<768;y+=355){
      const gray=211+Math.floor(random()*37)
      ctx.fillStyle='rgb('+gray+','+(gray-4)+','+(gray-8)+')';ctx.fillRect(x,y,110,355)
      ctx.fillStyle='#796f642a';ctx.fillRect(x,y,1,355);ctx.fillRect(x,y,110,1)
      for(let j=0;j<380;j++){
        const px=x+random()*109, py=y+random()*355
        ctx.strokeStyle=random()<.5?'#fff7e733':'#604c2910'
        ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+.85,py+random()*110);ctx.stroke()
      }
    }
  }
  const tex=new CanvasTexture(canvas)
  tex.colorSpace=SRGBColorSpace;tex.wrapS=RepeatWrapping;tex.wrapT=RepeatWrapping;tex.anisotropy=4
  return tex
}

function Glazing({opening:o,p}:{opening:Solid;p:Project}){
  const map=useTexture(asset('window-view.jpg'))
  const gl=useThree(s=>s.gl)
  useLayoutEffect(()=>{gl.shadowMap.needsUpdate=true},[gl])
  map.colorSpace=SRGBColorSpace
  const split=Math.min(o.w-100,v(p,'windowSplit')), f=p.materials.white
  return <group position={mVec([o.x,o.y,o.z])}>
    <mesh position={[0,meters(o.h/2),-.098]}><planeGeometry args={[meters(o.w),meters(o.h)]}/><meshBasicMaterial map={map} toneMapped={false}/></mesh>
    {[-1,1].map(s=><group key={s}>
      <Box size={[o.w,44,70]} at={[0,s>0?o.h-22:22,35]} color={f}/>
      <Box size={[45,o.h,70]} at={[s*(o.w/2-22.5),o.h/2,35]} color={f}/>
    </group>)}
    <Box size={[54,o.h,72]} at={[-o.w/2+split,o.h/2,35]} color={f}/>
    <Box size={[split,45,72]} at={[-o.w/2+split/2,o.h*.25,35]} color={f}/>
    <Box size={[11,120,33]} at={[-o.w/2+split-62,o.h*.59,84]} color={f} radius={4}/>
  </group>
}

function CylinderBetween({a,b,d,metal}:{a:Vec;b:Vec;d:number;metal:string}){
  const start=new Vector3(...mVec(a)),end=new Vector3(...mVec(b)), axis=end.clone().sub(start)
  const rotation=new Quaternion().setFromUnitVectors(new Vector3(0,1,0),axis.clone().normalize())
  return <mesh position={start.add(end).multiplyScalar(.5)} quaternion={rotation} castShadow><cylinderGeometry args={[meters(d/2),meters(d/2),axis.length(),20]}/><meshStandardMaterial color={metal} roughness={.35} metalness={.35}/></mesh>
}

function Walk({p,view,walkInput}:{p:Project;view:Display;walkInput:SceneProps['walkInput']}){
  const {camera,gl}=useThree(), keys=useRef(new Set<string>()), rotation=useRef(new Euler(0,0,0,'YXZ'))
  const layout=useMemo(()=>geometry(p),[p])
  const obstacles=useMemo(()=>[...layout.shell,...(view.collision?activeItems(p).flatMap(o=>o.parent?[]:[o,...(o.opening?movingPanels(o):[])]):[])],[layout,p,view.collision])
  useEffect(()=>{
    const hall=layout.floors[1]
    camera.position.set(meters(hall.x-125),meters(view.eye),meters(hall.z+hall.d/2-320))
    camera.rotation.set(0,0,0)
    rotation.current.set(0,0,0,'YXZ')
  },[camera])
  useEffect(()=>{
    const element=gl.domElement
    let drag=false
    const down=(e:MouseEvent)=>{
      if(e.button!==0||touch||(e as MouseEvent & {sourceCapabilities?:{firesTouchEvents:boolean}}).sourceCapabilities?.firesTouchEvents)return
      drag=true
      try{const lock=element.requestPointerLock?.();if(lock)void lock.catch(()=>{})}catch{/* Drag remains available. */}
    }
    const up=()=>{drag=false}
    const move=(e:MouseEvent)=>{
      if(document.pointerLockElement!==element&&!drag)return
      const look=rotation.current
      look.y-=e.movementX*.0024;look.x=Math.max(-1.45,Math.min(1.45,look.x-e.movementY*.0024))
      camera.rotation.copy(look)
    }
    let touch:{id:number;x:number;y:number}|null=null
    const touchStart=(e:PointerEvent)=>{
      if(e.pointerType==='mouse'||touch)return
      touch={id:e.pointerId,x:e.clientX,y:e.clientY}
      element.setPointerCapture(e.pointerId)
    }
    const touchMove=(e:PointerEvent)=>{
      if(touch?.id!==e.pointerId)return
      const look=rotation.current
      look.y-=(e.clientX-touch.x)*.005
      look.x=Math.max(-1.35,Math.min(1.35,look.x-(e.clientY-touch.y)*.005))
      touch={id:e.pointerId,x:e.clientX,y:e.clientY}
      camera.rotation.copy(look)
    }
    const touchEnd=(e:PointerEvent)=>{if(touch?.id===e.pointerId)touch=null}
    element.addEventListener('pointerdown',touchStart)
    element.addEventListener('pointermove',touchMove)
    element.addEventListener('lostpointercapture',touchEnd)
    const press=(e:KeyboardEvent)=>{
      if((e.target as HTMLElement)?.closest('input, select, textarea, dialog'))return
      if(['KeyW','KeyS','KeyA','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){keys.current.add(e.code);e.preventDefault()}
    }
    const release=(e:KeyboardEvent)=>keys.current.delete(e.code)
    const blur=()=>keys.current.clear()
    element.addEventListener('mousedown',down);window.addEventListener('mouseup',up);window.addEventListener('mousemove',move)
    window.addEventListener('keydown',press);window.addEventListener('keyup',release);window.addEventListener('blur',blur)
    return ()=>{
      element.removeEventListener('pointerdown',touchStart)
      element.removeEventListener('pointermove',touchMove)
      element.removeEventListener('lostpointercapture',touchEnd)
      element.removeEventListener('mousedown',down);window.removeEventListener('mouseup',up);window.removeEventListener('mousemove',move)
      window.removeEventListener('keydown',press);window.removeEventListener('keyup',release);window.removeEventListener('blur',blur)
      if(document.pointerLockElement===element)document.exitPointerLock()
    }
  },[camera,gl])
  useFrame((_,dt)=>{
    camera.position.y=meters(view.eye)
    const angle=rotation.current.y
    const held=(a:string,b:string)=>Number(keys.current.has(a)||keys.current.has(b))
    const right=walkInput.current.right+held('KeyD','ArrowRight')-held('KeyA','ArrowLeft')
    const forward=walkInput.current.forward+held('KeyW','ArrowUp')-held('KeyS','ArrowDown')
    if(!right&&!forward)return
    const step=Math.min(dt,.05)*1.48/Math.max(1,Math.hypot(right,forward))
    const dx=(right*Math.cos(angle)-forward*Math.sin(angle))*step
    const dz=(-right*Math.sin(angle)-forward*Math.cos(angle))*step
    function canStand(x:number,z:number){
      if(!layout.floors.some(f=>within(f,x*1000,z*1000,12))&&!layout.openings.some(o=>o.id==='bathDoor'&&within(o,x*1000,z*1000,25)))return false
      const body:Solid={id:'viewer',label:'Камера',x:x*1000,z:z*1000,w:290,d:290,y:0,h:view.eye+90,rot:0,material:'wall'}
      return !obstacles.some(o=>intersects(body,o))
    }
    if(canStand(camera.position.x+dx,camera.position.z))camera.position.x+=dx
    if(canStand(camera.position.x,camera.position.z+dz))camera.position.z+=dz
  })
  return null
}

function WallVisibility({side,cutaway,center,children}:{side:string;cutaway:boolean;center:[number,number];children:React.ReactNode}){
  const g=useRef<Group>(null)
  useFrame(({camera,gl})=>{
    if(!g.current)return
    const [x,z]=center, c=camera.position
    const near=side==='north'&&c.z<z-2||side==='south'&&c.z>z+2||side==='east'&&c.x>x+1.3||side==='west'&&c.x<x-1.3
    const visible=!cutaway||!near
    if(g.current.visible!==visible){
      g.current.visible=visible
      gl.shadowMap.needsUpdate=true
    }
  })
  return <group ref={g}>{children}</group>
}

function SceneContent({p,walkInput,mode,view,selected,measure,points,setPoint,select}:SceneProps){
  const layout=useMemo(()=>geometry(p),[p]), floorMap=useMemo(woodTexture,[])
  const [wallpaper,setWallpaper]=useState<Texture>()
  useEffect(()=>{
    let active=true
    const map=new TextureLoader().load(asset('wallpaper-normal.jpg'),loaded=>{
      if(active)setWallpaper(loaded)
    })
    map.wrapS=map.wrapT=RepeatWrapping
    map.anisotropy=4
    return ()=>{active=false;map.dispose()}
  },[])
  const gl=useThree(s=>s.gl)
  useLayoutEffect(()=>{gl.shadowMap.needsUpdate=true},[gl,p,view,mode])
  useEffect(()=>()=>floorMap.dispose(),[floorMap])
  const evening=p.settings.light==='evening'
  const show=(s:Solid)=>view.walls.includes(s.wall??'')
  const cent:[number,number]=[meters(v(p,'roomW')/2),meters((v(p,'roomL')+v(p,'hallL'))/2)]
  const cutaway=mode==='orbit'&&view.cutaway
  function hit(point:Vector3,id:string|null){if(mode==='walk')return;if(measure)setPoint(scenePoint(point));else select(id)}
  return <>
    <color attach="background" args={[evening?'#b1b5b8':'#e5e8e2']}/>
    <ambientLight intensity={evening?.34:.46}/>
    <hemisphereLight args={[evening?'#ded5c8':'#edf4ff','#b29b83',evening?.55:1.08]}/>
    <directionalLight position={[.85,3.8,-2.25]} intensity={evening?.32:2.15} color={evening?'#bcd3ff':'#fff4e2'} castShadow
      shadow-mapSize={p.settings.quality?[2048,2048]:[1024,1024]} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-5} shadow-bias={-.0003} shadow-normalBias={.021} shadow-radius={p.settings.quality?4:2.5}/>
    <pointLight position={[2.05,2.35,2.65]} color="#ffdec3" intensity={evening?24:3} distance={7} decay={2}/>
    <pointLight position={[2.45,2.22,5.6]} color="#ffe0bc" intensity={evening?14:2} distance={4} decay={2}/>
    <pointLight position={[3.16,1.46,3.7]} color="#ffd5a9" intensity={evening?6:1} distance={2.3} decay={2}/>
    {mode==='orbit'?<OrbitControls makeDefault target={[1.835,.46,3.32]} enableDamping minDistance={1.6} maxDistance={21} maxPolarAngle={Math.PI*.495}/>:
      <Walk p={p} view={view} walkInput={walkInput}/>}
    {layout.floors.map(f=><group key={f.id} onClick={event=>{event.stopPropagation();hit(event.point,null)}}>
      <Box at={[f.x,-35,f.z]} size={[f.w,70,f.d]} color={p.materials[f.id==='bath'?'tile':'floor']} texture={f.id==='bath'?undefined:floorMap} tileMeters={f.id==='bath'?undefined:1.32} roughness={.72}/>
      {(mode==='walk'||view.ceiling)&&<Box at={[f.x,f.h+20,f.z]} size={[f.w,40,f.d]} color={p.materials.ceiling}/>}
      <group position={mVec([f.x,f.h-18,f.z])}><Box size={[260,28,120]} color="#eee7d9" radius={12}/></group>
    </group>)}
    {layout.walls.filter(s=>mode==='walk'||show(s)).map(s=><WallVisibility key={s.id} side={s.wall??''} cutaway={cutaway} center={cent}><group onClick={e=>{e.stopPropagation();hit(e.point,s.id)}}>
      <Box at={[s.x,s.y+s.h/2,s.z]} size={[s.w,s.h,s.d]} color={p.materials.wall} roughness={.92} normalMap={wallpaper} tileMeters={.27}/>
      {s.y===0&&s.id!=='north-sill'&&<Box at={[s.x,37,s.z]} size={[s.w+16,74,s.d+16]} color={p.materials.white}/>}
    </group></WallVisibility>)}
    <Suspense fallback={null}>{layout.openings.filter(o=>o.id==='window'&&(mode==='walk'||view.walls.includes('north'))).map(o=><WallVisibility key={o.id} side="north" cutaway={cutaway} center={cent}><Glazing opening={o} p={p}/></WallVisibility>)}</Suspense>
    {layout.openings.filter(o=>o.id!=='window'&&(mode==='walk'||view.walls.includes(o.id==='entry'?'south':'inner'))).map(o=>{
      const entry=o.id==='entry',w=entry?o.w:o.d
      return <WallVisibility key={o.id} side={entry?'south':'inner'} cutaway={cutaway} center={cent}><group position={mVec([o.x,0,o.z])} rotation={[0,entry?0:-Math.PI/2,0]} onClick={e=>{e.stopPropagation();hit(e.point,o.id)}}>
        {[-1,1].map(s=><Box key={s} at={[s*(w/2-12),o.h/2,0]} size={[24,o.h,107]} color="#d8c9b5"/>)}
        <Box at={[0,o.h-13,0]} size={[w,26,107]} color="#d8c9b5"/>
        <group position={mVec([-w/2+20,0,0])} rotation={[0,entry?0:-Math.PI*.45,0]}>
          <Box at={[(w-40)/2,(o.h-31)/2+9,0]} size={[w-40,o.h-31,42]} color={p.materials.wood} radius={4}/>
          <Box at={[w-90,980,34]} size={[92,18,38]} color={p.materials.black} radius={7}/>
        </group>
      </group></WallVisibility>
    })}
    {layout.fixed.map(s=><group key={s.id} onClick={e=>{e.stopPropagation();hit(e.point,s.id)}}>
      <Box at={[s.x,s.y+s.h/2,s.z]} size={[s.w,s.h,s.d]} color={p.materials[s.material]} radius={s.id==='radiator'?9:0} normalMap={['column','pier'].includes(s.id)?wallpaper:undefined} tileMeters={['column','pier'].includes(s.id)?.27:undefined}/>
      {s.id==='radiator'&&[-1,0,1].map(n=><Box key={n} at={[s.x+n*s.w*.415,23,s.z]} size={[32,46,49]} color={p.materials.white}/>)}
      {s.id==='vent'&&Array.from({length:10},(_,i)=><Box key={i} at={[s.x,s.y+14+i*s.h*.08,s.z-s.d/2-1]} size={[s.w*.80,3,3]} color="#89908b"/>)}
    </group>)}
    {view.duct&&p.duct.slice(1).map((b,i)=><CylinderBetween key={i} a={p.duct[i]} b={b} d={v(p,'ductD')} metal={p.materials.metal}/>)}
    {activeItems(p).map(o=><ObjectModel key={o.id} o={o} p={p} selected={o.id===selected&&!measure} onSelect={pt=>hit(pt,o.id)}/>)}
    {points.map((pt,i)=><mesh key={i} position={mVec(pt)}><sphereGeometry args={[.023,14,14]}/><meshBasicMaterial color="#116e57" depthTest={false}/></mesh>)}
    {points.length===2&&<Line points={points.map(mVec)} color="#1a9276" lineWidth={3} depthTest={false}/>}
  </>
}

export function Scene(props:SceneProps){
  const touchDisplay=matchMedia('(pointer: coarse)').matches
  const maxDpr=touchDisplay?(props.p.settings.quality?1.4:1.15):(props.p.settings.quality?1.8:1.5)
  return <Canvas key={props.mode} shadows={staticShadows}
    gl={{antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'}} dpr={[1,maxDpr]}
    camera={{position:[-4.2,8.4,11.3],fov:props.mode==='walk'?65:43,near:.035,far:80}}
    onCreated={({gl})=>props.canvas(gl.domElement)} onPointerMissed={()=>{if(!props.measure)props.select(null)}}>
    <Exposure value={props.p.settings.exposure}/>
    {touchDisplay&&<TabletResolution maxDpr={maxDpr}/>}
    <SceneContent {...props}/>
  </Canvas>
}
function Exposure({value}:{value:number}){const {gl}=useThree();useEffect(()=>{gl.toneMappingExposure=value},[gl,value]);return null}


function TabletResolution({maxDpr}:{maxDpr:number}){
  const setDpr=useThree(s=>s.setDpr)
  const budget=useRef({seconds:0,frames:0,fastWindows:0})
  useEffect(()=>{budget.current={seconds:0,frames:0,fastWindows:0}},[maxDpr])
  useFrame(({viewport},delta)=>{
    if(document.hidden)return
    const sample=budget.current
    sample.seconds+=Math.min(delta,.25)
    sample.frames++
    if(sample.seconds<1.25)return
    const fps=sample.frames/sample.seconds
    sample.fastWindows=fps>=52?sample.fastWindows+1:0
    if(fps<43&&viewport.dpr>.8)setDpr(Math.max(.8,viewport.dpr-.15))
    if(sample.fastWindows>=3&&viewport.dpr<maxDpr){
      setDpr(Math.min(maxDpr,viewport.dpr+.1))
      sample.fastWindows=0
    }
    sample.seconds=0
    sample.frames=0
  })
  return null
}
