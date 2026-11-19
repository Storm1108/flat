import {useRef,useState,type PointerEvent} from 'react'
import {activeItems} from './store'
import {freeWidth,geometry,movingPanels,pointDistance,v,type Item,type Project,type Vec} from './model'
import type {Display} from './scene'

type Props={p:Project;view:Display;selected:string|null;measure:boolean;points:Vec[];setPoint:(v:Vec)=>void;select:(id:string|null)=>void;update:(id:string,patch:Partial<Item>)=>void;svg:(el:SVGSVGElement|null)=>void}
const colors:Record<string,string>={bed:'#e6daca',sofa:'#b9c9c1',wardrobe:'#e0e6d6',desk:'#d7e4d8',chair:'#cddbd6',rack:'#dce7d8',oval:'#ead7b9',fridge:'#f9f9f5',washer:'#e0e2dc',laundry:'#e0e6d6',laundryTall:'#e0e6d6',cabinet:'#eadcc8',drawers:'#eadcc8',ovenCab:'#eadcc8',hob:'#434a4a',sink:'#bbc6c4'}
const labels:Record<string,string>={bed:'Кровать',wardrobe:'Шкаф',sofa:'Диван',table:'Стол',desk:'Рабочее место',rack:'Пенал',hallwardrobe:'Шкаф',laundry:'Стиральная машина',fridge:'Холодильник',sinkCab:'Мойка',dishCab:'ПММ',ovenCab:'Духовка',drawers:'Ящики'}
const ink='#263e38', accent='#13765f'
function Dimension({x1,z1,x2,z2,title}:{x1:number;z1:number;x2:number;z2:number;title:string}){
  const vertical=x1===x2
  return <g fill={accent} stroke={accent} strokeWidth="9" pointerEvents="none">
    <path d={vertical?'M '+(x1-38)+' '+z1+' h 76 M '+(x2-38)+' '+z2+' h 76':'M '+x1+' '+(z1-38)+' v 76 M '+x2+' '+(z2-38)+' v 76'}/>
    <line x1={x1} y1={z1} x2={x2} y2={z2}/>
    <text x={(x1+x2)/2+(vertical?-31:0)} y={(z1+z2)/2+(vertical?0:-46)} stroke="#f3f3ec" strokeWidth="23" paintOrder="stroke" fontSize="104" textAnchor="middle"
      transform={vertical?'rotate(-90 '+(x1-31)+' '+((z1+z2)/2)+')':undefined}>{title}</text>
  </g>
}
export function Plan({p,view,selected,measure,points,setPoint,select,update,svg}:Props){
  const ref=useRef<SVGSVGElement|null>(null)
  const [preview,setPreview]=useState<{id:string;x:number;z:number}|null>(null)
  const drag=useRef<{id:string;start:Vec;x:number;z:number;pointer:number}|null>(null)
  const [zoom,setZoom]=useState(1)
  const layout=geometry(p), W=v(p,'roomW'), L=v(p,'roomL'), end=L+v(p,'hallL')
  const hallX=W-v(p,'hallW'), columnX=W-v(p,'columnX'), columnZ=v(p,'columnZ')
  const kitchenLength=v(p,'kitchen_total_length'), t=v(p,'wallT')
  const extent=[-680,-440,W+1350,end+1040]
  const zw=extent[2]/zoom,zh=extent[3]/zoom
  const viewBox=[extent[0]+(extent[2]-zw)/2,extent[1]+(extent[3]-zh)/2,zw,zh].join(' ')
  function coordinate(e:PointerEvent):Vec{
    const s=ref.current
    const matrix=s?.getScreenCTM()
    if(!s||!matrix)return [0,0,0]
    const pt=s.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY
    const local=pt.matrixTransform(matrix.inverse())
    return [Math.round(local.x),0,Math.round(local.y)]
  }
  function begin(e:PointerEvent,o:Item){
    if(measure)return
    e.stopPropagation()
    select(o.id)
    drag.current={id:o.id,start:coordinate(e),x:o.x,z:o.z,pointer:e.pointerId}
    ref.current?.setPointerCapture(e.pointerId)
  }
  function move(e:PointerEvent){
    const d=drag.current
    if(!d||e.pointerId!==d.pointer)return
    const [x,,z]=coordinate(e)
    if(Math.hypot(x-d.start[0],z-d.start[2])<16&&!preview)return
    setPreview({id:d.id,x:Math.round((d.x+x-d.start[0])/10)*10,z:Math.round((d.z+z-d.start[2])/10)*10})
  }
  function finish(e:PointerEvent){
    if(measure){setPoint(coordinate(e));return}
    if(drag.current){
      if(preview)update(preview.id,{x:preview.x,z:preview.z})
      drag.current=null;setPreview(null)
    }
  }
  const items=activeItems(p), draw=items.filter(o=>!o.parent&&(o.y<1100||o.id===selected)&&!['plinth','backsplash','counter'].includes(o.id))
  const plaque=(x:number,z:number,name:string)=><text x={x} y={z} textAnchor="middle" fontSize="109" fontWeight="600" fill={ink}>{name}</text>
  return <div className="plan">
    <svg aria-label="План квартиры сверху" ref={el=>{ref.current=el;svg(el)}} xmlns="http://www.w3.org/2000/svg" viewBox={viewBox}
      onPointerMove={move} onPointerUp={finish} onPointerCancel={()=>{drag.current=null;setPreview(null)}} style={{cursor:measure?'crosshair':undefined}}
      fontFamily="system-ui,sans-serif">
      <defs>
        <pattern id="grid-mm" width="100" height="100" patternUnits="userSpaceOnUse">
          <path d="M 0 100 V 0 H 100" fill="none" stroke="#c9cfc4" strokeWidth="5"/>
        </pattern>
        <pattern id="column-hatch" width="55" height="55" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="55" height="55" fill="#334e46"/><path d="M 0 0 V 55" stroke="#62766c" strokeWidth="14"/>
        </pattern>
      </defs>
      <rect x={-15000} y={-15000} width={30000} height={30000} fill="#eeefe8" onPointerDown={()=>{if(!measure)select(null)}}/>
      {layout.floors.map(f=><g key={f.id} onPointerDown={()=>{if(!measure)select(null)}}>
        <rect x={f.x-f.w/2} y={f.z-f.d/2} width={f.w} height={f.d} fill={f.id==='bath'?'#e6eae1':'#faf8ef'}/>
        <rect x={f.x-f.w/2} y={f.z-f.d/2} width={f.w} height={f.d} fill="url(#grid-mm)"/>
      </g>)}
      {layout.walls.filter(s=>s.y===0&&view.walls.includes(s.wall??'')&&s.id!=='north-sill').map(s=><rect key={s.id}
        x={s.x-s.w/2} y={s.z-s.d/2} width={s.w} height={s.d} fill={selected===s.id?accent:ink}
        onPointerDown={()=>{if(!measure)select(s.id)}}/>)}
      {layout.openings.filter(s=>view.walls.includes(s.id==='entry'?'south':s.id==='window'?'north':'inner')).map(s=><g key={s.id} onPointerDown={()=>{if(!measure)select(s.id)}}>
        <rect x={s.x-s.w/2} y={s.z-s.d/2} width={s.w} height={s.d} fill={s.id==='window'?'#cce7e7':'#f4f2e6'} stroke={s.id==='window'?'#6caba6':'#9b9d8c'} strokeWidth="12"/>
        {s.id==='window'?<line x1={s.x-s.w/2} y1={s.z} x2={s.x+s.w/2} y2={s.z} stroke="#649e9b" strokeWidth="10"/>:
          s.id==='bathDoor'?<path d={'M '+(s.x-s.w/2-s.d)+' '+(s.z-s.d/2)+' H '+(s.x-s.w/2)+' m -'+s.d+' 0 a '+s.d+' '+s.d+' 0 0 0 '+s.d+' '+s.d} stroke="#8a8b78" strokeWidth="12" strokeDasharray="32 22" fill="none"/>:null}
      </g>)}
      {layout.fixed.filter(s=>['column','pier','radiator'].includes(s.id)).map(s=><g key={s.id} onPointerDown={()=>{if(!measure)select(s.id)}}>
        <rect x={s.x-s.w/2} y={s.z-s.d/2} width={s.w} height={s.d} rx={s.id==='radiator'?22:0} fill={s.id==='radiator'?'#e1ede7':'url(#column-hatch)'} stroke={s.id===selected?'#44c2a2':'#70847d'} strokeWidth={s.id===selected?19:10}/>
        {s.id==='radiator'&&<line x1={s.x-s.w/2+55} y1={s.z} x2={s.x+s.w/2-55} y2={s.z} stroke="#859791" strokeWidth="16" strokeDasharray="10 20"/>}
      </g>)}
      {draw.map(o=>{
        const moving=preview?.id===o.id?preview:o, active=selected===o.id
        const style={fill:o.color??colors[o.kind]??'#d8e1d6',stroke:active?'#167a61':'#748b81',strokeWidth:active?23:11}
        return <g key={o.id} transform={'translate('+moving.x+' '+moving.z+') rotate('+(-o.rot)+')'} onPointerDown={e=>begin(e,o)} className={measure?'':'drag-item'}>
          <title>{o.label+' · '+o.w+' × '+o.d+' мм'}</title>
          {o.kind==='oval'?<ellipse rx={o.w/2} ry={o.d/2} {...style}/>:
            <rect x={-o.w/2} y={-o.d/2} width={o.w} height={o.d} rx={o.kind==='sofa'?52:19} {...style}/>}
          {o.kind==='bed'&&[-1,1].map(s=><rect key={s} x={s*o.w*.235-o.w*.195} y={-o.d*.44} width={o.w*.39} height={o.d*.21} rx={42} fill="#faf8ed" stroke="#bcae99" strokeWidth="10"/>)}
          {o.kind==='sofa'&&<path d={'M '+(-o.w*.43)+' '+o.d*.38+' V '+(-o.d*.32)+' H '+o.w*.43+' V '+o.d*.38+' M 0 '+(-o.d*.32)+' V '+o.d*.38} stroke="#899f96" strokeWidth="17" fill="none"/>}
          {o.id==='sinkCab'&&<rect x={-o.w*.31} y={-o.d*.31} width={o.w*.62} height={o.d*.53} fill="#c3ceca" stroke="#7b9291" strokeWidth="11" rx="45"/>}
          {o.id==='ovenCab'&&<rect x={-126} y={-o.d*.37} width={252} height={o.d*.63} fill="#52615b" rx="22"/>}
          {labels[o.id]&&<text textAnchor="middle" dominantBaseline="central"
            y={o.kind==='bed'?80:o.id==='ovenCab'?o.d*.37:o.id==='sinkCab'?o.d*.35:0} fontSize={o.w<500?70:85} fontWeight="600" fill={ink} stroke="#faf9ef" strokeWidth="12" paintOrder="stroke">{labels[o.id]}</text>}
        </g>
      })}
      {items.filter(o=>o.opening>0).flatMap(o=>movingPanels(o).map((s,i)=><rect key={o.id+i} x={-s.w/2} y={-s.d/2} width={s.w} height={s.d}
        transform={'translate('+s.x+' '+s.z+') rotate('+(-s.rot)+')'} rx="9" fill="#9ecdbd" stroke="#258a70" strokeWidth="11" pointerEvents="none"/>))}
      {view.duct&&<polyline points={p.duct.map(pt=>pt[0]+','+pt[2]).join(' ')} stroke="#af7841" strokeWidth="23" strokeDasharray="38 25" fill="none" pointerEvents="none"/>}
      {layout.floors[2]&&plaque(v(p,'bathW')*.56,L+380,'Санузел')}
      {plaque(hallX+645,L+770,'Прихожая')}
      {plaque(W*.64,L*.58,'Кухня-гостиная')}
      {view.dimensions&&<>
        <Dimension x1={0} z1={-t-120} x2={W} z2={-t-120} title={W.toString()}/>
        <Dimension x1={-t-235} z1={0} x2={-t-235} z2={L} title={L.toString()}/>
        <Dimension x1={W+t+240} z1={L-kitchenLength} x2={W+t+240} z2={L} title={kitchenLength+' · кухня'}/>
        <Dimension x1={W+t+240} z1={L} x2={W+t+240} z2={end} title={v(p,'hallL').toString()}/>
        <Dimension x1={hallX} z1={L+columnZ+116} x2={columnX} z2={L+columnZ+116} title={(columnX-hallX)+' · проём'}/>
        <text x={2350} y={3990} textAnchor="middle" fontSize="84" fill={accent}>Свободно {freeWidth(p,layout,3800,'room')} мм</text>
      </>}
      {points.length===2&&<g pointerEvents="none"><line x1={points[0][0]} y1={points[0][2]} x2={points[1][0]} y2={points[1][2]} stroke="#147e61" strokeWidth={22} strokeDasharray="46 20"/>
        <text x={(points[0][0]+points[1][0])/2} y={(points[0][2]+points[1][2])/2-45} fontSize="125" textAnchor="middle" fill={accent} stroke="#f5f4e9" strokeWidth="25" paintOrder="stroke">{Math.round(pointDistance(points[0],points[1]))} мм</text></g>}
      {points.map((pt,i)=><circle key={i} cx={pt[0]} cy={pt[2]} r="39" fill={accent} stroke="#fffdf4" strokeWidth="11" pointerEvents="none"/>)}
      <g transform={'translate('+(-t)+' '+(end+505)+')'} fill={ink} fontSize="88">
        <path d="M 0 -85 V -27 H 1000 V -85 M 500 -85 V -27" fill="none" stroke={ink} strokeWidth="13"/>
        <text x="0">0</text><text x="1000" textAnchor="end">1 м</text>
      </g>
    </svg>
    <div className="zoom"><button type="button" aria-label="Уменьшить план" onClick={()=>setZoom(z=>Math.max(.65,z-.15))}>−</button><button type="button" onClick={()=>setZoom(1)} title="Вернуть масштаб">{Math.round(zoom*100)}%</button><button type="button" aria-label="Увеличить план" onClick={()=>setZoom(z=>Math.min(2,z+.15))}>+</button></div>
  </div>
}
