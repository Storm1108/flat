import {create} from 'zustand'
import {base, decodeProject, type Item, type Project} from './model'

const storageKey='studio-23.5-v1'
type Saved={id:string;project:Project}
function load():{project:Project;variants:Saved[]}{
  try{
    const data=JSON.parse(localStorage.getItem(storageKey)??'null')
    if(data)return {project:decodeProject(JSON.stringify(data.project)),variants:data.variants.map((s:Saved)=>({id:s.id,project:decodeProject(JSON.stringify(s.project))}))}
  }catch{/* A damaged or unavailable cache leaves the reference layout accessible. */}
  return {project:structuredClone(base),variants:[]}
}
type State={
  project:Project;variants:Saved[];past:Project[];future:Project[];selected:string|null;
  commit:(p:Project)=>void; update:(id:string,patch:Partial<Item>)=>void; remove:(id:string)=>void;
  select:(id:string|null)=>void;undo:()=>void;redo:()=>void;
  save:(name:string)=>void;open:(id:string)=>void;forget:(id:string)=>void
}
export const useStudio=create<State>((set,get)=>({
  ...load(),past:[],future:[],selected:null,
  commit:(project)=>set(s=>({project,past:[...s.past.slice(-79),s.project],future:[]})),
  select:selected=>set({selected}),
  update:(id,patch)=>{
    const {project,commit}=get(), parent=project.items.find(o=>o.id===id)
    if(!parent)return
    const next={...parent,...patch}
    const turn=(next.rot-parent.rot)*Math.PI/180,c=Math.cos(turn),s=Math.sin(turn)
    commit({...project,items:project.items.map(o=>{
      if(o.id===id)return next
      if(o.parent!==id)return o
      const dx=o.x-parent.x,dz=o.z-parent.z
      return {...o,x:Math.round(next.x+c*dx+s*dz),y:o.y+next.y-parent.y,z:Math.round(next.z-s*dx+c*dz),rot:o.rot+next.rot-parent.rot}
    })})
  },
  remove:id=>{
    const {project,commit}=get()
    commit({...project,items:project.items.filter(o=>o.id!==id&&o.parent!==id)})
    set({selected:null})
  },
  undo:()=>set(s=>s.past.length?{project:s.past.at(-1)!,past:s.past.slice(0,-1),future:[s.project,...s.future]}:s),
  redo:()=>set(s=>s.future.length?{project:s.future[0],past:[...s.past,s.project],future:s.future.slice(1)}:s),
  save:name=>{
    const {project,commit}=get()
    const next={...project,name}
    commit(next)
    set(s=>({variants:[...s.variants,{id:crypto.randomUUID(),project:next}]}))
  },
  open:id=>{const {variants,commit}=get(), match=variants.find(s=>s.id===id);if(match)commit(match.project)},
  forget:id=>set(s=>({variants:s.variants.filter(o=>o.id!==id)})),
}))
export function activeItems(p:Project){
  return p.items.filter(o=>o.visible&&(!o.parent||p.items.some(x=>x.id===o.parent&&x.visible)))
}
useStudio.subscribe(({project,variants},previous)=>{
  if(project===previous.project&&variants===previous.variants)return
  try{localStorage.setItem(storageKey,JSON.stringify({project,variants}))}catch{/* JSON export remains available. */}
})
