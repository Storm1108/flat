import initial from '../apartment.json'

export type Status = 'confirmed' | 'provisional' | 'unknown'
export type Room = 'room' | 'hall' | 'bath'
export type Vec = [number, number, number]
export type Pt = [number, number]
export type Spec = { label:string; value:number | null; unit:string; source:string; status:Status }
export type Item = {
  id:string; label:string; kind:string; room:Room; x:number; y:number; z:number;
  w:number; h:number; d:number; rot:number; material:string; color?:string; status:Status;
  source:string; visible:boolean; opening:number; parent?:string; kitchen?:boolean; hinge?:number; doors?:2|3
}
export type Project = {
  version:1; name:string; params:Record<string,Spec>; items:Item[]; kitchen:{id:string;w:number}[];
  duct:Vec[]; materials:Record<string,string>; settings:{light:'day'|'evening';quality:boolean;exposure:number}
}
export type Rect = {x:number;z:number;w:number;d:number}
export type Solid = Rect & {id:string;label:string;h:number;y:number;rot:number;material:string;wall?:string}
export type Floor = Rect & {id:Room;label:string;h:number}
export type Layout = {floors:Floor[]; walls:Solid[]; fixed:Solid[]; openings:Solid[]; shell:Solid[]; passages:Solid[]}
const {geometry:referenceSnapshot,...reference}=initial
export const base=reference as unknown as Project
export const EPS = 1
export const meters = (value:number)=>value/1000
export const mVec = (v:Vec):Vec=>[meters(v[0]),meters(v[1]),meters(v[2])]
export const rad = (angle:number)=>angle*Math.PI/180
export const v = (p:Project,id:string)=>p.params[id]?.value ?? base.params[id]?.value ?? 0
export const letters = {room:'Кухня-гостиная', hall:'Прихожая', bath:'Санузел'}

export function rectangle(x:number,z:number,w:number,d:number):Rect {
  return {x:x+w/2,z:z+d/2,w,d}
}

export function geometry(p:Project):Layout {
  const a = (key:string)=>v(p,key)
  const W=a('roomW'), L=a('roomL'), H=a('roomH'), hallX=W-a('hallW'), hallEnd=L+a('hallL')
  const B=a('bathW'), bathEnd=hallEnd, bathStart=bathEnd-a('bathL'), T=a('wallT'), cX=W-a('columnX'), cZ=a('columnZ')
  const Hh=a('hallH'), Hb=a('bathH'), beamD=a('beamD'), beamH=a('beamH')
  const floors:Floor[]=[
    {...rectangle(0,0,W,L),id:'room',label:letters.room,h:H},
    {...rectangle(hallX,L,W-hallX,hallEnd-L),id:'hall',label:letters.hall,h:Hh},
    {...rectangle(0,bathStart,B,bathEnd-bathStart),id:'bath',label:letters.bath,h:Hb}
  ]
  const walls:Solid[]=[], fixed:Solid[]=[], openings:Solid[]=[], passages:Solid[]=[]
  function add(list:Solid[],id:string,label:string,x:number,z:number,w:number,d:number,y:number,h:number,material='wall',wall?:string){
    if(w>0&&d>0&&h>0)list.push({...rectangle(x,z,w,d),id,label,y,h,rot:0,material,wall})
  }
  const wall = (id:string,label:string,x:number,z:number,w:number,d:number,y:number,h:number,side:string)=>
    add(walls,id,label,x,z,w,d,y,h,'wall',side)
  const winX=a('windowX'), winW=a('windowW'), sill=a('windowSill'), winH=a('windowH')
  wall('north-left','Простенок окна слева',-T,-T,winX+T,T,0,H,'north')
  wall('north-right','Простенок окна справа',winX+winW,-T,W+T-winX-winW,T,0,H,'north')
  wall('north-sill','Стена под окном',winX,-T,winW,T,0,sill,'north')
  wall('north-lintel','Стена над окном',winX,-T,winW,T,sill+winH,H-sill-winH,'north')
  add(openings,'window','Окно',winX,-T,winW,T,sill,winH)
  wall('west','Левая наружная стена',-T,0,T,bathEnd,0,H,'west')
  wall('east-room','Правая стена комнаты',W,0,T,L,0,H,'east')
  wall('east-hall','Правая стена прихожей',W,L,T,hallEnd-L,0,Hh,'east')
  wall('bath-north','Перегородка комнаты и санузла',0,L,hallX,bathStart-L,0,Math.max(Hb,Hh),'inner')
  wall('bath-back','Торец санузла',-T,bathEnd,hallX+T,T,0,Hb,'south')
  const entryX=hallX+a('entryX'), entryW=a('entryW'), entryH=a('entryH')
  wall('entry-left','Входной простенок слева',hallX,hallEnd,entryX-hallX,T,0,Hh,'south')
  wall('entry-right','Входной простенок справа',entryX+entryW,hallEnd,W+T-entryX-entryW,T,0,Hh,'south')
  wall('entry-lintel','Стена над входом',entryX,hallEnd,entryW,T,entryH,Hh-entryH,'south')
  add(openings,'entry','Входная дверь',entryX,hallEnd,entryW,T,0,entryH)
  const bathDoorZ=L+a('bathDoorZ'), bathDoorW=a('bathDoorW'), bathDoorH=a('bathDoorH')
  wall('bath-wall-a','Перегородка санузла',B,bathStart,hallX-B,bathDoorZ-bathStart,0,Hb,'inner')
  wall('bath-wall-b','Перегородка санузла',B,bathDoorZ+bathDoorW,hallX-B,hallEnd-bathDoorZ-bathDoorW,0,Hb,'inner')
  wall('bath-lintel','Стена над дверью санузла',B,bathDoorZ,hallX-B,bathDoorW,bathDoorH,Hb-bathDoorH,'inner')
  add(openings,'bathDoor','Дверь санузла',B,bathDoorZ,hallX-B,bathDoorW,0,bathDoorH)
  add(fixed,'column','Конструктивная колонна',cX,L,W-cX,cZ,0,Hh)
  add(fixed,'pier','Выступ в санузле',0,bathEnd-a('pierZ'),a('pierX'),a('pierZ'),0,Hb)
  add(fixed,'beam','Балка над проходом',hallX,L,cX-hallX,beamD,beamH,H-beamH)
  add(fixed,'drop','Перепад потолка',cX,L,W-cX,beamD,Hh,H-Hh)
  add(fixed,'radiator','Радиатор',a('radiatorX'),45,a('radiatorW'),a('radiatorD'),40,a('radiatorH'),'white')
  add(fixed,'sill','Подоконник',winX-22,-T,winW+44,T+100,sill-24,24,'white')
  const ventW=a('ventW')
  add(fixed,'vent','Вентиляционная решётка',W-a('ventOffset')-ventW/2,L-16,ventW,16,a('ventY'),a('ventH'),'white')
  add(passages,'hall-pass','Проход между колонной и перегородкой',hallX,L,cX-hallX,cZ,0,beamH)
  add(passages,'entry-clear','Подход к входной двери',entryX,hallEnd-entryW,entryW,entryW,0,entryH)
  add(passages,'bath-clear','Подход к двери санузла',hallX,bathDoorZ,bathDoorW,bathDoorW,0,bathDoorH)
  add(passages,'bath-swing','Сектор распахивания двери санузла · внутрь',B-bathDoorW,bathDoorZ,bathDoorW,bathDoorW,0,bathDoorH)
  return {floors,walls,fixed,openings,passages,shell:[...walls,...fixed]}
}

export function corners(o:Rect & {rot:number}):Pt[] {
  const c=Math.cos(rad(o.rot)), s=Math.sin(rad(o.rot))
  return [[-o.w/2,-o.d/2],[o.w/2,-o.d/2],[o.w/2,o.d/2],[-o.w/2,o.d/2]].map(([x,z])=>[o.x+c*x+s*z,o.z-s*x+c*z])
}

export function intersects(a:Solid,b:Solid,tol=EPS):boolean {
  if(Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)<=tol)return false
  const pa=corners(a), pb=corners(b)
  for(const poly of [pa,pb]){
    for(let i=0;i<2;i++){
      const dx=poly[i+1][0]-poly[i][0], dz=poly[i+1][1]-poly[i][1], l=Math.hypot(dx,dz)
      if(!l)continue
      const dot=([x,z]:Pt)=>(x*dz-z*dx)/l
      const ap=pa.map(dot), bp=pb.map(dot)
      if(Math.min(Math.max(...ap),Math.max(...bp))-Math.max(Math.min(...ap),Math.min(...bp))<=tol)return false
    }
  }
  return true
}

export function within(r:Rect,x:number,z:number,tol=0){
  return Math.abs(x-r.x)<=r.w/2+tol && Math.abs(z-r.z)<=r.d/2+tol
}

export function pointDistance(a:Vec,b:Vec){
  return Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])
}

export function localPoint(o:Item,x:number,y:number,z:number):Vec {
  const c=Math.cos(rad(o.rot)), s=Math.sin(rad(o.rot))
  return [o.x+c*x+s*z,o.y+y,o.z-s*x+c*z]
}

export function movingPanels(o:Item){
  const a=o.opening*Math.PI/200, side=o.hinge??1
  const leaf=(w:number,h:number,y:number,hingeX:number,direction:number,front:number,angle:number):Solid=>{
    const center=localPoint(o,hingeX-direction*w/2*Math.cos(angle),y,front+w/2*Math.sin(angle))
    return {...o,x:center[0],y:center[1],z:center[2],w,h,d:28,rot:o.rot+direction*angle*180/Math.PI,label:o.label+' · створка'}
  }
  switch(o.kind){
    case 'fridge': return [leaf(o.w,o.h*.69,o.h*.31,side*o.w/2,side,o.d/2-16,a),leaf(o.w,o.h*.30,0,side*o.w/2,side,o.d/2-16,a)]
    case 'laundryTall': {
      const seam=Math.round(o.h*.44)
      return [leaf(o.w-4,seam-12,4,side*(o.w/2-2),side,o.d/2-11,a),
        leaf(o.w-4,o.h-seam-8,seam+4,side*(o.w/2-2),side,o.d/2-11,a)]
    }
    case 'laundry': return [-1,1].map(sign=>leaf(o.w/2-4,o.h-58,42,sign*(o.w/2-7),sign,o.d/2-11,a))
    case 'micro': return [leaf(o.w*.73,o.h,0,-o.w/2,-1,o.d/2-12,a)]
    case 'oven': {
      const length=o.h*.81, forward=length*Math.sin(a), vertical=length*Math.cos(a)
      const center=localPoint(o,0,0,o.d/2-12+forward/2)
      return [{...o,x:center[0],z:center[2],y:o.y,w:o.w,h:vertical+24,d:forward+24,label:o.label+' · дверца'}]
    }
    case 'hood': {
      const center=localPoint(o,0,0,o.d/2-42+o.opening*1.8)
      return [{...o,x:center[0],z:center[2],h:25,d:82,label:o.label+' · панель'}]
    }
    default:return []
  }
}

export function ductParts(p:Project):Solid[] {
  const d=v(p,'ductD')
  if(d<=0)return []
  return p.duct.slice(1).map((end,i)=>{
    const start=p.duct[i], dx=end[0]-start[0], dz=end[2]-start[2], run=Math.hypot(dx,dz)
    return {id:'duct-'+i,label:'Воздуховод · участок '+(i+1),x:(start[0]+end[0])/2,z:(start[2]+end[2])/2,
      y:Math.min(start[1],end[1])-d/2,h:Math.abs(end[1]-start[1])+d,w:run||d,d,rot:-Math.atan2(dz,dx)*180/Math.PI,material:'metal'}
  })
}

export function freeWidth(p:Project,layout:Layout,z:number,room:Room){
  const floor=layout.floors.find(f=>f.id===room)!
  const left=floor.x-floor.w/2,right=floor.x+floor.w/2
  const occupied=[...p.items.filter(o=>o.visible&&!o.parent),...layout.shell].filter(o=>o.y<1800&&o.y+o.h>30).flatMap(o=>{
    const pts=corners(o)
    const hits=pts.flatMap(([x,z0],i)=>{
      const [x1,z1]=pts[(i+1)%4]
      if(Math.abs(z0-z1)<1e-7)return Math.abs(z-z0)<1e-7?[x,x1]:[]
      return z>=Math.min(z0,z1)&&z<=Math.max(z0,z1)?[x+(x1-x)*(z-z0)/(z1-z0)]:[]
    })
    return hits.length?[[Math.max(left,Math.min(...hits)),Math.min(right,Math.max(...hits))]]:[]
  }).filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0])
  let edge=left,best=0
  for(const [a,b] of occupied){best=Math.max(best,a-edge);edge=Math.max(edge,b)}
  return Math.round(Math.max(best,right-edge))
}

export type Issue = {text:string;id?:string;level:'check'|'note'}
export function diagnostics(p:Project,layout=geometry(p)):Issue[] {
  const out:Issue[]=[]
  const flag=(text:string,id?:string,level:Issue['level']='check')=>out.push({text,id,level})
  const a=(key:string)=>v(p,key)
  const live=p.items.filter(o=>o.visible&&(!o.parent||p.items.some(x=>x.id===o.parent&&x.visible)))
  const L=a('roomL'), W=a('roomW')
  if(a('windowX')+a('windowW')>W+EPS||a('windowSill')+a('windowH')>a('roomH')+EPS)
    flag('Оконный проём выходит за границы стены.')
  if(a('entryX')+a('entryW')>a('hallW')+EPS||a('entryH')>a('hallH')+EPS)
    flag('Входной проём выходит за границы стены.')
  if(a('bathDoorZ')+a('bathDoorW')>a('hallL')+EPS||a('bathDoorH')>a('bathH')+EPS||
     a('bathDoorZ')<a('hallL')-a('bathL')-EPS)
    flag('Проём санузла выходит за границы перегородки.')
  if(a('roomW')-a('hallW')-a('bathW')<=0||a('hallL')<a('bathL')||a('columnX')>=a('hallW')||a('columnZ')>a('hallL'))
    flag('Размеры перегородки, санузла или колонны противоречат контурам.')
  const sum=p.kitchen.reduce((n,s)=>n+s.w,0)
  if(Math.abs(sum-a('kitchen_total_length'))>EPS)flag('Сумма секций кухни '+sum+' мм расходится с заданной длиной.')
  let cursor=L
  for(const slot of p.kitchen){
    const o=live.find(i=>i.id===slot.id)
    if(slot.id!=='end-gap'&&!o)flag('Отсутствует секция кухни '+(p.items.find(i=>i.id===slot.id)?.label??slot.id)+'.')
    if(o&&(o.w-slot.w>EPS || (slot.id!=='fridge'&&Math.abs(o.w-slot.w)>EPS)||Math.abs(o.z-(cursor-slot.w/2))>EPS||Math.abs(o.x+o.d/2-W)>EPS||Math.abs(o.rot+90)>.1))
      flag(o.label+' расходится с размерной цепью кухни.',o.id)
    cursor-=slot.w
  }
  if(Math.abs(a('hallW')-a('columnX')-a('passage'))>EPS)flag('Фактическая ширина проёма в модели расходится с размером на плане.')
  const hallGap=a('hallL')-a('columnZ')-live.filter(o=>['hallwardrobe','laundry'].includes(o.id)).reduce((n,o)=>n+o.w,0)
  if(hallGap<0)flag('После колонны под шкафы не хватает '+(-hallGap)+' мм по правой стене.','laundry')
  const laundry=live.find(o=>o.id==='laundry')
  const washer=live.find(o=>o.id==='washer'&&o.parent===laundry?.id)
  if(laundry&&washer&&washer.d>laundry.d+EPS)
    flag('Стиральная машина глубже шкафа на '+(washer.d-laundry.d)+' мм даже без учёта фасада и коммуникаций.','washer')
  const micro=p.items.find(o=>o.id==='micro'), microCab=p.items.find(o=>o.id==='upper11')
  if(micro?.visible&&microCab?.visible&&a('microCutD')>microCab.d+EPS)
    flag('Указанная глубина ниши СВЧ '+a('microCutD')+' мм превышает глубину шкафа '+microCab.d+' мм. Проверьте монтаж для навесного шкафа.','micro')
  const fridge=live.find(o=>o.id==='fridge')
  const upper13=live.find(o=>o.id==='upper13')
  if(fridge&&upper13&&intersects(fridge,upper13))
    flag('Шкаф №13 перекрывает холодильник по высоте на '+Math.round(fridge.y+fridge.h-upper13.y)+' мм.','upper13')
  const skipPair=(x:Item,y:Item)=>x.parent===y.id||y.parent===x.id||Boolean(x.parent&&x.parent===y.parent)||
    ((x.id==='hob'||x.id==='sink')&&['backsplash','sinkCab','ovenCab','oven'].includes(y.id))||
    ((y.id==='hob'||y.id==='sink')&&['backsplash','sinkCab','ovenCab','oven'].includes(x.id))
  for(const [i,o] of live.entries()){
    const hit=layout.shell.find(s=>intersects(o,s))
    if(hit)flag(o.label+' пересекается с конструкцией «'+hit.label+'».',o.id)
    const pts=corners(o)
    if(pts.some(([x,z])=>!layout.floors.some(f=>within(f,x,z,EPS))))flag(o.label+' выходит за внутренний контур.',o.id)
    const covered=layout.floors.find(f=>within(f,o.x,o.z))
    if(covered&&o.y+o.h>covered.h+EPS)flag(o.label+' выше потолка.',o.id)
    for(const other of live.slice(i+1)){
      if((o.id==='fridge'&&other.id==='upper13')||skipPair(o,other))continue
      if(intersects(o,other))flag(o.label+' пересекается с «'+other.label+'».',o.id)
    }
    const swingTargets=[...live.filter(s=>!s.parent&&s.id!==o.id&&s.id!==o.parent),...layout.shell]
    if(o.opening>0){
      const steps=Math.ceil(o.opening/5)
      const swept=Array.from({length:steps},(_,j)=>movingPanels({...o,opening:o.opening*(j+1)/steps})).flat()
      const clash=swingTargets.find(s=>swept.some(panel=>intersects(panel,s)))
      if(clash)flag(o.label+' при открывании пересекается с «'+clash.label+'».',o.id)
    }
  }
  for(const zone of layout.passages){
    const obstruction=live.find(o=>!o.parent&&intersects(zone,o))
    if(obstruction)flag(zone.label+' пересекается с «'+obstruction.label+'».',obstruction.id)
  }
  const ductHits=live.filter(o=>!o.parent&&ductParts(p).some(s=>intersects(s,o))).map(o=>o.label)
  if(ductHits.length)flag('Трасса воздуховода пересекает '+ductHits.join(', ')+'.',undefined,'note')
  return out
}

export function roomContours(layout:Layout):Record<Room,Pt[]> {
  return Object.fromEntries(layout.floors.map(f=>{
    const pts=corners({...f,rot:0})
    return [f.id,[...pts,pts[0]]]
  })) as Record<Room,Pt[]>
}

export function encodeProject(p:Project){
  const layout=geometry(p)
  const {shell,...snapshot}=layout
  return JSON.stringify({...p,geometry:{...snapshot,contours:roomContours(layout)}},null,2)+'\n'
}

const validColor=(color:unknown):color is string=>typeof color==='string'&&/^#[0-9a-f]{6}$/i.test(color)
export function decodeProject(payload:string):Project{
  const p=JSON.parse(payload) as Project & {geometry?:unknown}
  const n=(x:unknown)=>typeof x==='number'&&Number.isFinite(x)
  const states=['confirmed','provisional','unknown']
  if(!p||p.version!==1||typeof p.name!=='string'||!Array.isArray(p.items)||!Array.isArray(p.kitchen)||
    !Array.isArray(p.duct)||p.duct.length<2||!p.materials||!p.params||
    !['day','evening'].includes(p.settings?.light)||typeof p.settings?.quality!=='boolean'||
    !n(p.settings?.exposure)||p.settings.exposure<.25||p.settings.exposure>3)throw new Error('Неподдерживаемый формат проекта.')
  if(!Object.keys(base.params).every(k=>{
    const s=p.params[k]
    return s&&(s.value===null||(n(s.value)&&s.value>=0&&s.value<=20000))&&states.includes(s.status)&&typeof s.source==='string'&&typeof s.label==='string'&&typeof s.unit==='string'
  })||!Object.values(p.materials).every(validColor)||!Object.keys(base.materials).every(k=>validColor(p.materials[k])))throw new Error('Некорректные параметры или материалы.')
  const ids=new Set<string>()
  for(const o of p.items){
    if(!o||typeof o.id!=='string'||ids.has(o.id)||typeof o.label!=='string'||typeof o.kind!=='string'||
      !Object.hasOwn(letters,o.room)||![o.x,o.y,o.z,o.w,o.h,o.d,o.rot,o.opening].every(n)||
      Math.min(o.w,o.h,o.d)<=0||Math.max(o.w,o.h,o.d)>20000||o.opening<0||o.opening>100||
      typeof o.visible!=='boolean'||!states.includes(o.status)||typeof o.source!=='string'||
      !Object.hasOwn(p.materials,o.material)||(o.color!==undefined&&!validColor(o.color)))throw new Error('Некорректная запись предмета.')
    ids.add(o.id)
  }
  if(p.duct.some(pt=>!Array.isArray(pt)||pt.length!==3||!pt.every(n))||p.kitchen.some(s=>!s||typeof s.id!=='string'||!n(s.w)||s.w<=0))throw new Error('Некорректная трасса или размерная цепь.')
  delete p.geometry
  return p
}
