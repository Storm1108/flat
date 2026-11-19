import {base,v,type Item,type Project} from './model'

type FurniturePreset=Pick<Item,'label'|'kind'|'w'|'h'|'d'|'status'|'source'|'doors'>
export const hallWardrobes={
  narrow:{label:'Hoff «Кежуал» · 80 см',kind:'wardrobe',w:802,h:2216,d:509,doors:2,status:'confirmed',
    source:'Карточка Hoff, арт. 80816546'},
  wide:{label:'Hoff «Кежуал» · 120 см',kind:'wardrobe',w:1202,h:2216,d:506,doors:3,status:'confirmed',
    source:'Карточка Hoff, арт. 80816547'},
} satisfies Record<string,FurniturePreset>
export const hallLaundry={
  tall:{label:'Высокий шкаф под стиральную машину · Мебель Булгар',kind:'laundryTall',w:650,h:2000,d:700,status:'confirmed',
    source:'Яндекс Маркет, арт. 5626919489. Наружные размеры по карточке.'},
  low:{label:'Низкий шкаф под стиральную машину · 65 см',kind:'laundry',w:650,h:900,d:500,status:'provisional',
    source:'Ширина 650 мм и глубина 500 мм по заданию. Высота из исходной модели.'},
} satisfies Record<string,FurniturePreset>
export type WardrobeChoice=keyof typeof hallWardrobes
export type LaundryChoice=keyof typeof hallLaundry

export function applyHallFurniture(p:Project,wardrobeId:WardrobeChoice,laundryId:LaundryChoice):Project{
  const wardrobe=hallWardrobes[wardrobeId], laundry=hallLaundry[laundryId]
  const wall=v(p,'roomW'), start=v(p,'roomL')+v(p,'columnZ')
  const current=(id:string)=>p.items.find(o=>o.id===id)??base.items.find(o=>o.id===id)!
  const front=wall-Math.max(laundry.d,wardrobe.d)
  const laundryZ=start+laundry.w/2
  const washer=current('washer')
  const replacements:Item[]=[
    {...current('laundry'),...laundry,x:front+laundry.d/2,y:0,z:laundryZ,rot:-90,visible:true,opening:0},
    {...current('hallwardrobe'),...wardrobe,x:front+wardrobe.d/2,y:0,z:start+laundry.w+wardrobe.w/2,rot:-90,visible:true,opening:0},
    {...washer,x:front+laundry.d-washer.d/2-20,y:0,z:laundryZ,rot:-90,parent:'laundry'},
  ]
  return {...p,items:[...p.items.map(o=>replacements.find(r=>r.id===o.id)??o),
    ...replacements.filter(o=>!p.items.some(old=>old.id===o.id))]}
}
