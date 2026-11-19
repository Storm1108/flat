import {applyHallFurniture} from '../src/hall-furniture'
import assert from 'node:assert/strict'
import {test} from 'node:test'
import {base,decodeProject,encodeProject,diagnostics,freeWidth,geometry,intersects,movingPanels,pointDistance,roomContours,v} from '../src/model'

const layout=geometry(base)
const item=(id:string)=>base.items.find(o=>o.id===id)!
const floor=(id:string)=>layout.floors.find(f=>f.id===id)!
const shell=(id:string)=>layout.shell.find(s=>s.id===id)!
const close=(a:number,b:number,tolerance=1)=>assert.ok(Math.abs(a-b)<=tolerance,a+' ≠ '+b)

test('Размеры чистых контуров и высоты помещений',()=>{
  assert.deepEqual(layout.floors.map(({w,d,h})=>[w,d,h]),[[3670,4460,2570],[1940,2230,2470],[1510,2160,2470]])
  close((floor('room').w*floor('room').d)/1e6,16.4,.05)
  close((floor('hall').w*floor('hall').d-shell('column').w*shell('column').d)/1e6,4.1,.05)
  close((floor('bath').w*floor('bath').d-shell('pier').w*shell('pier').d)/1e6,3,.05)
})
test('Контуры замкнуты, углы различны, площадь положительна',()=>{
  for(const points of Object.values(roomContours(layout))){
    assert.deepEqual(points[0],points.at(-1))
    assert.equal(new Set(points.slice(0,-1).map(p=>p.join(','))).size,4)
    assert.ok(points.slice(0,-1).reduce((n,[x,z],i)=>n+x*points[i+1][1]-z*points[i+1][0],0)>0)
  }
})
test('Стыки наружных стен и перекрытие над окном',()=>{
  close(shell('north-left').z+shell('north-left').d/2,shell('west').z-shell('west').d/2)
  close(shell('east-room').z+shell('east-room').d/2,shell('east-hall').z-shell('east-hall').d/2)
  close(shell('east-hall').z+shell('east-hall').d/2,shell('entry-right').z-shell('entry-right').d/2)
  const window=layout.openings.find(o=>o.id==='window')!
  close(shell('north-sill').h,window.y)
  close(shell('north-lintel').y,window.y+window.h)
  close(shell('bath-north').z+shell('bath-north').d/2,floor('bath').z-floor('bath').d/2)
})
test('Мебель и подтверждённые внешние габариты техники',()=>{
  for(const [id,dims] of Object.entries({hallwardrobe:[802,2216,509],laundry:[650,900,500],bed:[1400,860,2000],
    fridge:[595,2000,675],oven:[448,595,550],micro:[450,300,315],hood:[450,175,305]})){
    const {w,h,d}=item(id);assert.deepEqual([w,h,d],dims)
  }
})
test('Кухня от колонны, включая холодильник и резерв',()=>{
  assert.equal(v(base,'kitchen_total_length'),2620)
  assert.deepEqual(base.kitchen.map(s=>s.w),[600,450,450,400,600,120])
  assert.equal(base.kitchen.reduce((n,s)=>n+s.w,0),2620)
  close(item('sinkCab').z+item('sinkCab').w/2,shell('column').z-shell('column').d/2)
  const bad=structuredClone(base);bad.items.find(o=>o.id==='sinkCab')!.w+=50
  assert.ok(diagnostics(bad).some(i=>i.text.includes('расходится с размерной цепью кухни')))
})
test('Коллизии учитывают вращение и допуск 1 мм',()=>{
  assert.ok(!intersects(item('laundry'),shell('column')))
  assert.ok(intersects(item('upper13'),item('fridge')))
  assert.ok(!intersects(item('sinkCab'),shell('column')))
  assert.ok(!intersects(item('bed'),shell('west')))
  assert.ok(!intersects({...item('bed'),x:999.5},shell('west')))
  assert.ok(intersects({...item('bed'),x:998},shell('west')))
  assert.ok(!diagnostics(base).some(i=>i.id==='laundry'))
})
test('Проёмы, контроль подходов и открывание холодильника',()=>{
  const check=layout.passages.find(s=>s.id==='entry-clear')!
  assert.ok(!base.items.some(o=>intersects(o,check)))
  const p=structuredClone(base)
  Object.assign(p.items.find(o=>o.id==='sofa')!,{x:check.x,z:check.z,rot:0,room:'hall'})
  assert.ok(diagnostics(p).some(i=>i.text.includes('Подход к входной двери')))
  const fridge={...item('fridge'),opening:100}
  const leaf=movingPanels(fridge)[0]
  close(leaf.d,28)
  close(Math.abs(leaf.rot-fridge.rot),90)
})
test('Расстояние и ширина прохода',()=>{
  assert.equal(pointDistance([0,0,0],[300,400,1200]),1300)
  assert.equal(freeWidth(base,layout,v(base,'roomL')+100,'hall'),1350)
  assert.ok(freeWidth(base,layout,3800,'room')>900)
})
test('Проект сохраняется и загружается, некорректный файл отклоняется',()=>{
  assert.deepEqual(decodeProject(encodeProject(base)),base)
  assert.deepEqual(JSON.parse(encodeProject(base)).geometry.contours,roomContours(layout))
  assert.throws(()=>decodeProject(JSON.stringify({...base,version:2})))
  assert.throws(()=>decodeProject(JSON.stringify({...base,items:[...base.items,base.items[0]]})))
  assert.throws(()=>decodeProject(JSON.stringify({...base,duct:[[1,2,3],['x',0,0]]})))
})

test('Четыре сочетания мебели: колонна, стиральный шкаф, затем платяной шкаф',()=>{
  const start=v(base,'roomL')+v(base,'columnZ')
  for(const w of ['narrow','wide'] as const)for(const l of ['low','tall'] as const){
    const p=applyHallFurniture(base,w,l)
    const cabinet=p.items.find(o=>o.id==='laundry')!
    const wardrobe=p.items.find(o=>o.id==='hallwardrobe')!
    const washer=p.items.find(o=>o.id==='washer')!
    assert.equal(cabinet.w,650)
    assert.equal(cabinet.z-cabinet.w/2,start)
    assert.equal(wardrobe.z-wardrobe.w/2,start+650)
    assert.equal(washer.z,cabinet.z)
    assert.equal(washer.parent,'laundry')
    assert.equal(v(p,'roomL')+v(p,'hallL')-wardrobe.z-wardrobe.w/2,w==='wide'?-22:378)
    assert.equal(diagnostics(p).some(i=>i.text.includes('22 мм')),w==='wide')
    assert.equal(movingPanels({...cabinet,opening:100}).length,2)
    assert.deepEqual(decodeProject(encodeProject(p)),p)
  }
})
