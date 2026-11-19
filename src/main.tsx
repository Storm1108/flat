import {Component,StrictMode,Suspense,lazy,useEffect,useMemo,useRef,useState,type KeyboardEvent as ReactKey,type ReactNode} from 'react'
import {createRoot} from 'react-dom/client'
import {base,decodeProject,encodeProject,diagnostics,freeWidth,geometry,letters,pointDistance,v,type Item,type Project,type Room,type Vec} from './model'
import {useStudio} from './store'
import {applyHallFurniture,type WardrobeChoice,type LaundryChoice} from './hall-furniture'
import {Plan} from './plan'
import type {CameraMode,Display,WalkAction} from './scene'
const Scene=lazy(()=>import('./scene').then(m=>({default:m.Scene})))
import './style.css'

const options:Record<string,[string,number,number,number,string]>={
  wardrobe:['Шкаф',1000,1900,550,'white'],laundry:['Тумба',850,900,600,'white'],desk:['Стол',1200,750,600,'wood'],
  rack:['Стеллаж',500,1600,350,'white'],sofa:['Диван',1200,820,800,'fabric'],bed:['Кровать',1400,850,2000,'wood'],
  cabinet:['Кухонный модуль',600,768,560,'white'],
}
const materialNames:Record<string,string>={wall:'Стены',floor:'Ламинат',ceiling:'Потолок',wood:'Светлое дерево',white:'Матовый белый',black:'Чёрный',metal:'Металл',fabric:'Ткань',tile:'Плитка'}
const roomIds:Room[]=['room','hall','bath']
const walls:Record<string,string>={north:'У окна',east:'Правая',south:'У входа',west:'Левая',inner:'Перегородки'}
const statusNames={confirmed:'По источнику',provisional:'Предварительно',unknown:'Требует замера'}
const modes:{key:CameraMode;label:string}[]=[{key:'plan',label:'План'},{key:'orbit',label:'3D-вид'},{key:'walk',label:'Прогулка'}]
const groups:Record<string,string>={plan:'ПЛАН КВАРТИРЫ',orbit:'ОБЪЁМНЫЙ ВИД',walk:'ОТ ПЕРВОГО ЛИЦА'}
const fieldLabels:Partial<Record<keyof Item,string>>={w:'Ширина',h:'Высота',d:'Глубина',x:'X · поперёк',y:'Y · от пола',z:'Z · к входу',rot:'Угол, °'}
class SceneError extends Component<{children:ReactNode},{failed:boolean}>{
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  render(){return this.state.failed?<div className="scene-message">3D недоступно. Проверьте поддержку WebGL в браузере или откройте план.</div>:this.props.children}
}
const openings:Record<string,string>={fridge:'Открытие дверей',oven:'Открытие дверцы',laundry:'Открытие фасадов',laundryTall:'Открытие фасадов',hood:'Выдвижение панели',micro:'Открытие дверцы'}

function download(name:string,data:Blob){
  const url=URL.createObjectURL(data)
  const link=document.createElement('a')
  link.href=url;link.download=name;link.click()
  setTimeout(()=>URL.revokeObjectURL(url),3000)
}
function Num({label,value,onChange,min,max=20000,step=1,unit='мм'}:{
  label:string;value:number|null;onChange:(n:number)=>void;min?:number;max?:number;step?:number;unit?:string
}){
  const [text,setText]=useState('')
  const [editing,setEditing]=useState(false)
  function commit(){
    if(text.trim()){
      const n=Number(text)
      if(Number.isFinite(n)&&n>=(min??-20000)&&n<=max&&n!==value)onChange(n)
    }
    setEditing(false)
  }
  function key(e:ReactKey<HTMLInputElement>){
    if(e.key==='Enter')e.currentTarget.blur()
    if(e.key==='Escape'){setText('');setEditing(false);e.preventDefault()}
  }
  return <label className="number"><span>{label}</span><div><input type="number" min={min} max={max} step={step} value={editing?text:(value??'')} placeholder="—"
    onFocus={()=>{setText(value?.toString()??'');setEditing(true)}} onChange={e=>setText(e.target.value)} onBlur={()=>{if(editing)commit()}} onKeyDown={key}/><small>{unit}</small></div></label>
}
function Toggle({checked,action,children}:{checked:boolean;action:(v:boolean)=>void;children:ReactNode}){
  return <label className="toggle"><input type="checkbox" checked={checked} onChange={e=>action(e.target.checked)}/>{children}</label>
}
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){
  const ref=useRef<HTMLDialogElement>(null)
  useEffect(()=>{ref.current?.showModal()},[])
  return <dialog ref={ref} onCancel={e=>{e.preventDefault();onClose()}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
    <div className="modal-content"><header><h2>{title}</h2><button aria-label="Закрыть" onClick={onClose}>×</button></header>{children}</div>
  </dialog>
}

function App(){
  const {project:p,variants,selected,select,commit,update,remove,past,future,undo,redo,save,open,forget}=useStudio()
  const [mode,setMode]=useState<CameraMode>('plan')
  const [view,setView]=useState<Display>({walls:Object.keys(walls),ceiling:false,cutaway:true,duct:false,dimensions:true,collision:true,eye:1650})
  const [measure,setMeasure]=useState(false), [points,setPoints]=useState<Vec[]>([])
  const [modal,setModal]=useState<'issues'|'params'|'view'|'variants'|'add'|null>(null)
  const [hallWardrobe,setHallWardrobe]=useState<WardrobeChoice>('narrow'),[hallLaundry,setHallLaundry]=useState<LaundryChoice>('tall')
  const [name,setName]=useState(''),[kind,setKind]=useState('wardrobe'),[room,setRoom]=useState<Room>('room')
  const [onlyUncertain,setOnlyUncertain]=useState(true),[constructionEdit,setConstructionEdit]=useState(false)
  const [message,setMessage]=useState(''),[query,setQuery]=useState('')
  const svg=useRef<SVGSVGElement|null>(null),canvas=useRef<HTMLCanvasElement|null>(null),file=useRef<HTMLInputElement>(null)
  const l=useMemo(()=>geometry(p),[p]),issues=useMemo(()=>diagnostics(p,l),[p,l])
  const picked=p.items.find(o=>o.id===selected)
  const fixed=[...l.fixed,...l.walls,...l.openings].find(o=>o.id===selected)
  const uncertain=Object.values(p.params).filter(s=>s.status!=='confirmed').length
  const width=v(p,'roomW'),length=v(p,'roomL'), kitchen=v(p,'kitchen_total_length')
  const setViewPart=<K extends keyof Display>(key:K,value:Display[K])=>setView(old=>({...old,[key]:value}))
  const setPoint=(pt:Vec)=>setPoints(old=>old.length===1?[old[0],pt]:[pt])
  const settings=(patch:Partial<Project['settings']>)=>commit({...p,settings:{...p.settings,...patch}})
  function param(key:string,value:number|null){
    const old=p.params[key]
    commit({...p,params:{...p.params,[key]:{...old,value,status:value===null?'unknown':'provisional',source:old.source.includes('правка')?old.source:'Ручная правка · '+old.source}}})
  }
  const walkActions=useRef<WalkAction[]>([])
  function switchMode(next:CameraMode){walkActions.current=[];setMode(next);setPoints([]);if(next==='walk')setMeasure(false)}
  function duplicate(o:Item){
    const id=crypto.randomUUID()
    const copy={...o,id,label:o.label+' · копия',x:o.x-100,z:o.z+100,parent:undefined,kitchen:false}
    const children=p.items.filter(x=>x.parent===o.id).map(x=>({...x,id:crypto.randomUUID(),x:x.x-100,z:x.z+100,parent:id}))
    commit({...p,items:[...p.items,copy,...children]});select(id)
  }
  function add(){
    const [label,w,h,d,material]=options[kind],f=l.floors.find(f=>f.id===room)!,id=crypto.randomUUID()
    commit({...p,items:[...p.items,{id,label,kind,room,w,h,d,material,x:f.x,y:0,z:f.z,rot:0,visible:true,status:'provisional',source:'Добавлено в редакторе',opening:0}]})
    select(id);setModal(null)
  }
  async function exportImage(){
    try{
      if(mode!=='plan'){
        const target=canvas.current
        if(!target)throw new Error('3D-сцена ещё загружается.')
        const blob=await new Promise<Blob|null>(resolve=>target.toBlob(resolve,'image/png'))
        if(!blob)throw new Error('Кадр недоступен.')
        download('studio-3d.png',blob);setMessage('Кадр сохранён.');return
      }
      if(!svg.current)throw new Error('План ещё загружается.')
      const copy=svg.current.cloneNode(true) as SVGSVGElement
      copy.setAttribute('width','1380');copy.setAttribute('height','1650')
      const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)],{type:'image/svg+xml;charset=utf-8'}))
      try{
        const img=new Image();img.src=url;await img.decode()
        const target=document.createElement('canvas');target.width=1380;target.height=1650
        const ctx=target.getContext('2d')!;ctx.fillStyle='#eeefe8';ctx.fillRect(0,0,target.width,target.height);ctx.drawImage(img,0,0)
        const blob=await new Promise<Blob|null>(resolve=>target.toBlob(resolve,'image/png'))
        if(!blob)throw new Error('Кадр недоступен.')
        download('studio-plan.png',blob);setMessage('План сохранён.')
      }finally{URL.revokeObjectURL(url)}
    }catch(e){setMessage(e instanceof Error?e.message:'Ошибка экспорта.')}
  }
  useEffect(()=>{
    if(!message)return
    const timer=setTimeout(()=>setMessage(''),3500)
    return ()=>clearTimeout(timer)
  },[message])
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      if((e.target as Element).closest('input,textarea,select,dialog'))return
      if((e.metaKey||e.ctrlKey)&&e.code==='KeyZ'){e.preventDefault();if(e.shiftKey)redo();else undo()}
    }
    window.addEventListener('keydown',key)
    return ()=>window.removeEventListener('keydown',key)
  },[undo,redo])
  return <div className="app">
    <header className="masthead">
      <div className="brand"><span aria-hidden="true" className="brandmark"><i/><i/><i/></span><div><h1>Студия 23,5</h1><p>Планировщик квартиры</p></div></div>
      <div className="filebar">
        <button onClick={()=>{
          setHallWardrobe(p.items.find(o=>o.id==='hallwardrobe')?.doors===3?'wide':'narrow')
          setHallLaundry(p.items.find(o=>o.id==='laundry')?.kind==='laundry'?'low':'tall')
          setName(p.name==='Исходная расстановка'?'':p.name);setModal('variants')
        }}>Варианты <span className="count">{variants.length}</span></button>
        <button onClick={()=>file.current?.click()}>Импорт JSON</button>
        <button onClick={()=>download('apartment.json',new Blob([encodeProject(p)],{type:'application/json'}))}>Экспорт JSON</button>
        <button className="primary" onClick={()=>void exportImage()}>Скачать PNG</button>
        <input type="file" accept=".json,application/json" ref={file} hidden onChange={async e=>{
          const item=e.target.files?.[0];e.target.value='';if(!item)return
          try{commit(decodeProject(await item.text()));select(null);setPoints([]);setMessage('Проект загружен.')}catch(err){setMessage(err instanceof Error?err.message:'Ошибка импорта.')}
        }}/>
      </div>
    </header>
    <div className="workbar">
      <div className="segmented" aria-label="Камера">{modes.map(m=><button key={m.key} aria-pressed={m.key===mode} onClick={()=>switchMode(m.key)}>{m.label}</button>)}</div>
      <div className="tools">
        <button className="square" aria-label="Отменить" title="Отменить" disabled={!past.length} onClick={undo}>↶</button>
        <button className="square" aria-label="Повторить" title="Повторить" disabled={!future.length} onClick={redo}>↷</button>
        <button aria-pressed={measure} disabled={mode==='walk'} onClick={()=>{setMeasure(!measure);setPoints([])}}>Измерить</button>
        <button aria-pressed={view.dimensions} onClick={()=>setViewPart('dimensions',!view.dimensions)}>Размеры</button>
        <button onClick={()=>setModal('view')}>Вид и свет</button>
      </div>
      <button className={'warn '+(!issues.length?'clear':'')} onClick={()=>setModal('issues')}>{issues.length?'Проверки · '+issues.length:'Проверки пройдены'}</button>
    </div>
    <main className={'workspace '+(mode==='walk'?'walking':'')}>
      <aside className="navigator">
        <div className="panel-head"><h2>Объекты</h2><button className="square" title="Добавить мебель" aria-label="Добавить мебель" onClick={()=>setModal('add')}>＋</button></div>
        <div className="search"><input type="search" placeholder="Найти объект" value={query} onChange={e=>setQuery(e.target.value)}/></div>
        <div className="tree">
          {roomIds.map(r=>{
            const items=p.items.filter(o=>o.room===r&&o.label.toLowerCase().includes(query.toLowerCase()))
            return <details key={r} open={r==='room'||Boolean(query)}>
              <summary>{letters[r]}<span>{v(p,r==='room'?'roomArea':r==='hall'?'hallArea':'bathArea').toLocaleString('ru-RU')} м²</span></summary>
              {items.map(o=><button key={o.id} className={'row'+(selected===o.id?' current':'')+(o.visible?'':' muted')+(o.parent?' nested':'')} onClick={()=>select(o.id)}>
                <span className="dot" style={{background:o.color??p.materials[o.material]}}/><span>{o.label}</span>{issues.some(i=>i.id===o.id)&&<i title="Есть предупреждение"/>}
              </button>)}
            </details>
          })}
          <details><summary>Конструкции<span>⌑</span></summary>
            {[...l.fixed,...l.openings,...l.walls].filter(o=>o.label.toLowerCase().includes(query.toLowerCase())).map(o=><button key={o.id} className={'row'+(selected===o.id?' current':'')} onClick={()=>select(o.id)}><span className="dot structural"/><span>{o.label}</span></button>)}
          </details>
        </div>
        <div className="panel-foot"><button onClick={()=>setModal('params')}>Исходные размеры <span className="count">{uncertain}</span></button></div>
      </aside>
      <section className={'viewport '+mode} aria-label="Рабочая область">
        <div className="view-tag"><span>{groups[mode]}</span><small>{p.name}</small></div>
        {mode==='plan'?<Plan p={p} view={view} selected={selected} measure={measure} points={points} setPoint={setPoint} select={select} update={update} svg={el=>{svg.current=el}}/>:
          <SceneError key={mode}><Suspense fallback={<div className="scene-message">Загрузка 3D…</div>}><Scene p={p} walkActions={walkActions} mode={mode} view={view} selected={selected} measure={measure} points={points} setPoint={setPoint} select={select} canvas={el=>{canvas.current=el}}/></Suspense></SceneError>}
        {mode==='walk'&&<div className="walk-controls" aria-label="Управление прогулкой" role="group">
          <div className="walk-move">
            {([['forward','↑','Шаг вперёд'],['left','←','Шаг влево'],['back','↓','Шаг назад'],['right','→','Шаг вправо']] as const).map(([action,icon,label])=>
              <button key={action} className={action} aria-label={label} title={label} onClick={()=>{if(walkActions.current.length<3)walkActions.current.push(action)}}>{icon}</button>)}
          </div>
          <div className="walk-turn">
            {([['turnLeft','↶','Повернуть налево'],['turnRight','↷','Повернуть направо']] as const).map(([action,icon,label])=>
              <button key={action} aria-label={label} title={label} onClick={()=>{if(walkActions.current.length<3)walkActions.current.push(action)}}>{icon}</button>)}
          </div>
        </div>}
        <div className="view-help">
          {measure?(points.length===2?Math.round(pointDistance(points[0],points[1]))+' мм · нажмите для нового замера':points.length?'Укажите вторую точку':'Укажите первую точку'):
            mode==='plan'?'Перетащите предмет, чтобы изменить его положение':mode==='walk'?'Стрелки — шаг · ведите пальцем по сцене для обзора':'Перетащите сцену для вращения · колесо для масштаба'}
        </div>
      </section>
      <aside className="inspector">
        <div className="panel-head"><h2>Свойства</h2>{(picked||fixed)&&<button className="square" onClick={()=>select(null)} aria-label="Снять выбор">×</button>}</div>
        {picked?<div className="properties" key={picked.id}>
          <div className="object-title"><h3>{picked.label}</h3><p>{letters[picked.room]}</p></div>
          <div className={'status '+picked.status}>{statusNames[picked.status]}</div>
          <p className="source">{picked.source}</p>
          <section><h4>Габариты</h4><div className="fields">{(['w','h','d'] as const).map(key=><Num key={key} label={fieldLabels[key]!} value={picked[key]} min={20} onChange={n=>update(picked.id,{[key]:n})}/>)}</div></section>
          <section><h4>Положение</h4><div className="fields">{(['x','z','y','rot'] as const).map(key=><Num key={key} label={fieldLabels[key]!} value={picked[key]} unit={key==='rot'?'°':'мм'}
            onChange={n=>update(picked.id,{[key]:n})}/>)}</div></section>
          <section><h4>Отделка</h4><div className="picker">
            <select aria-label="Материал объекта" value={picked.material} onChange={e=>update(picked.id,{material:e.target.value,color:undefined})}>
              {Object.entries(p.materials).map(([id])=><option key={id} value={id}>{materialNames[id]??id}</option>)}
            </select>
            <input type="color" aria-label="Цвет объекта" value={picked.color??p.materials[picked.material]} onChange={e=>update(picked.id,{color:e.target.value})}/>
          </div></section>
          {openings[picked.kind]&&<section><h4>{openings[picked.kind]}</h4>
            <input aria-label={openings[picked.kind]} type="range" min="0" max="100" value={picked.opening} onChange={e=>update(picked.id,{opening:Number(e.target.value)})}/>
            {picked.kind==='fridge'&&<label className="stack">Сторона навески<select value={picked.hinge??-1} onChange={e=>update(picked.id,{hinge:Number(e.target.value)})}><option value="-1">Слева</option><option value="1">Справа</option></select></label>}
          </section>}
          <Toggle checked={picked.visible} action={visible=>update(picked.id,{visible})}>Показывать объект</Toggle>
          <div className="edit-actions"><button onClick={()=>duplicate(picked)}>Дублировать</button><button className="delete" onClick={()=>remove(picked.id)}>Удалить</button></div>
        </div>:fixed?<div className="properties">
          <div className="object-title"><h3>{fixed.label}</h3><p>Конструктивный элемент</p></div>
          <dl className="facts"><div><dt>Поперёк X</dt><dd>{fixed.w} мм</dd></div><div><dt>Вдоль Z</dt><dd>{fixed.d} мм</dd></div><div><dt>Высота</dt><dd>{fixed.h} мм</dd></div></dl>
          <button onClick={()=>setModal('params')}>Открыть исходные размеры</button>
        </div>:<div className="properties overview">
          <div className="object-title"><h3>{p.name}</h3><p>Квартира-студия</p></div>
          <dl className="facts"><div><dt>Комната</dt><dd>{width} × {length} мм</dd></div><div><dt>Кухня с холодильником</dt><dd>{kitchen} мм</dd></div><div><dt>Проём из прихожей</dt><dd>{v(p,'hallW')-v(p,'columnX')} мм</dd></div></dl>
          <p className="hint">Выберите предмет на плане или в списке, чтобы изменить его параметры.</p>
          {view.dimensions&&<><h4>Свободная ширина</h4><dl className="facts"><div><dt>У дивана · Z 3800</dt><dd>{freeWidth(p,l,3800,'room')} мм</dd></div><div><dt>В створе колонны</dt><dd>{freeWidth(p,l,length+100,'hall')} мм</dd></div><div><dt>Перед входом</dt><dd>{freeWidth(p,l,length+v(p,'hallL')-300,'hall')} мм</dd></div></dl></>}
        </div>}
      </aside>
    </main>
    <footer className="statusbar"><span><i/> {p.name}</span><span>Единицы · мм</span><span>{p.settings.light==='day'?'Дневной свет':'Вечерний свет'}</span></footer>
    {message&&<div className="toast" role="status">{message}</div>}
    {modal==='issues'&&<Modal title="Проверки геометрии" onClose={()=>setModal(null)}>
      <p className="hint">Проверки используют габаритные объёмы. Открывание проверяется от закрытого положения до выбранного угла.</p>
      <ul className="issues">{issues.map((i,n)=><li key={n} className={i.level}>{i.id?<button onClick={()=>{select(i.id!);setModal(null)}}>{i.text}</button>:i.text}</li>)}</ul>
      {!issues.length&&<p>Пересечений по заданным габаритам не найдено.</p>}
      <button onClick={()=>setModal('params')}>Неподтверждённые размеры · {uncertain}</button>
    </Modal>}
    {modal==='params'&&<Modal title="Исходные размеры" onClose={()=>setModal(null)}>
      <div className="modal-options"><Toggle checked={onlyUncertain} action={setOnlyUncertain}>Только неподтверждённые</Toggle>
        <Toggle checked={constructionEdit} action={setConstructionEdit}>Редактировать размеры конструкций</Toggle></div>
      <div className="spec-table"><table><thead><tr><th>Параметр</th><th>Значение</th><th>Источник</th><th>Статус</th></tr></thead><tbody>
        {Object.entries(p.params).filter(([,s])=>!onlyUncertain||s.status!=='confirmed').map(([id,s])=><tr key={id}>
          <td>{s.label}</td><td>{constructionEdit?<Num label={s.label} value={s.value} unit={s.unit} min={1} step={s.unit==='м²'?.01:1} onChange={n=>param(id,n)}/>:s.value===null?'—':s.value+' '+s.unit}</td>
          <td>{s.source}</td><td>{statusNames[s.status]}</td>
        </tr>)}
      </tbody></table></div>
      <p className="hint">При изменении конструкций координаты мебели сохраняются. Изменения можно отменить.</p>
    </Modal>}
    {modal==='view'&&<Modal title="Вид и освещение" onClose={()=>setModal(null)}>
      <div className="modal-columns">
        <section><h4>Стены в плане и 3D</h4>{Object.entries(walls).map(([id,label])=><Toggle key={id} checked={view.walls.includes(id)}
          action={visible=>setViewPart('walls',visible?[...view.walls,id]:view.walls.filter(s=>s!==id))}>{label}</Toggle>)}
          <Toggle checked={view.cutaway} action={b=>setViewPart('cutaway',b)}>Срез ближних стен в 3D</Toggle>
          <Toggle checked={view.ceiling} action={b=>setViewPart('ceiling',b)}>Потолок в 3D</Toggle>
          <Toggle checked={view.duct} action={b=>setViewPart('duct',b)}>Трасса воздуховода</Toggle>
          <Toggle checked={view.collision} action={b=>setViewPart('collision',b)}>Коллизии с мебелью при прогулке</Toggle>
          <Num label="Высота глаз" value={view.eye} min={900} max={2150} onChange={n=>setViewPart('eye',n)}/>
        </section>
        <section><h4>Освещение и материалы</h4><div className="segmented"><button aria-pressed={p.settings.light==='day'} onClick={()=>settings({light:'day'})}>День</button><button aria-pressed={p.settings.light==='evening'} onClick={()=>settings({light:'evening'})}>Вечер</button></div>
          <Toggle checked={p.settings.quality} action={b=>settings({quality:b})}>Повышенное качество 3D</Toggle>
          <Num label="Экспозиция" value={p.settings.exposure} unit="×" min={.25} max={3} step={.05} onChange={n=>settings({exposure:n})}/>
          {Object.entries(p.materials).map(([id,color])=><label className="material" key={id}>{materialNames[id]??id}<input type="color" value={color}
            onChange={e=>commit({...p,materials:{...p.materials,[id]:e.target.value}})}/></label>)}
        </section>
      </div>
      <section className="duct-edit"><h4>Узлы воздуховода</h4>
        {p.duct.map((pt,i)=><div key={i} className="duct-row"><span>Узел {i+1}</span>{(['X','Y','Z']).map((axis,ix)=><Num key={axis} label={axis} value={pt[ix]} onChange={n=>{
          const duct=p.duct.map((old,j)=>i===j?old.map((a,k)=>k===ix?n:a) as Vec:old)
          commit({...p,duct})
        }}/>)}
        <button aria-label={'Удалить узел '+(i+1)} disabled={p.duct.length<=2} onClick={()=>commit({...p,duct:p.duct.filter((_,j)=>i!==j)})}>×</button></div>)}
        <button onClick={()=>{const end=p.duct.at(-1)!;commit({...p,duct:[...p.duct,[end[0],end[1],end[2]+100]]})}}>Добавить узел</button>
      </section>
    </Modal>}
    {modal==='variants'&&<Modal title="Варианты расстановки" onClose={()=>setModal(null)}>
      <form onSubmit={e=>{e.preventDefault();commit(applyHallFurniture(p,hallWardrobe,hallLaundry));setPoints([]);setModal(null)}}>
        <div className="modal-columns">
          <label className="stack">От колонны · шкаф под стиральную машину
            <select value={hallLaundry} onChange={e=>setHallLaundry(e.target.value as LaundryChoice)}>
              <option value="tall">Высокий закрытый · 65 × 200 × 70 см</option><option value="low">Низкий · 65 × 90 × 50 см</option>
            </select>
          </label>
          <label className="stack">Дальше к входу · платяной шкаф
            <select value={hallWardrobe} onChange={e=>setHallWardrobe(e.target.value as WardrobeChoice)}>
              <option value="narrow">80 см · Hoff «Кежуал»</option><option value="wide">120 см · Hoff «Кежуал»</option>
            </select>
          </label>
        </div>
        <button className="primary">Применить к прихожей</button>
      </form>
      <hr/>
      <form className="save-form" onSubmit={e=>{e.preventDefault();if(name.trim()){save(name.trim());setMessage('Вариант сохранён.');setModal(null)}}}>
        <input aria-label="Название варианта" placeholder="Название варианта" value={name} onChange={e=>setName(e.target.value)} maxLength={70} required/>
        <button className="primary">Сохранить снимок</button></form>
      <ul className="variants">{variants.map(o=><li key={o.id}><button onClick={()=>{open(o.id);select(null);setModal(null)}}>{o.project.name}</button><button className="delete" aria-label={'Удалить вариант '+o.project.name} onClick={()=>forget(o.id)}>×</button></li>)}</ul>
      <button onClick={()=>{commit(structuredClone(base));select(null);setPoints([]);setModal(null)}}>Загрузить исходную расстановку</button>
    </Modal>}
    {modal==='add'&&<Modal title="Добавить мебель" onClose={()=>setModal(null)}>
      <div className="modal-columns"><label className="stack">Вид предмета<select value={kind} onChange={e=>setKind(e.target.value)}>{Object.entries(options).map(([id,[label]])=><option key={id} value={id}>{label}</option>)}</select></label>
      <label className="stack">Помещение<select value={room} onChange={e=>setRoom(e.target.value as Room)}>{roomIds.map(id=><option key={id} value={id}>{letters[id]}</option>)}</select></label></div>
      <button className="primary" onClick={add}>Добавить</button>
    </Modal>}
  </div>
}
createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>)
