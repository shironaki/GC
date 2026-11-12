const canvas=document.querySelector('#world');
const ctx=canvas.getContext('2d',{alpha:false});
const minimap=document.querySelector('#minimap');
const mapCtx=minimap.getContext('2d');
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const rand=(a,b)=>a+Math.random()*(b-a);
const SAVE_KEY='gcr-save-v2';
const WORLD={w:2100,h:1650};
const DISTRICTS=[
 {id:'east',name:'EAST SIDE',unlock:0,bounds:{x:0,y:0,w:1050,h:1650},color:'#293d34'},
 {id:'downtown',name:'DOWNTOWN',unlock:4,bounds:{x:1050,y:0,w:1050,h:1050},color:'#354047'},
 {id:'harbor',name:'HARBOR',unlock:8,bounds:{x:1050,y:1050,w:1050,h:600},color:'#30434a'}
];
const BUILDING_SEEDS=[
 ['garage','Автомастерская',300,270,180,130,'#78634b',0,0],
 ['warehouse','Восточный склад',710,530,190,145,'#6b6252',0,0],
 ['shop','Продуктовый магазин',440,1030,150,115,'#65745b',300,35],
 ['club','Ночной клуб',830,1160,190,145,'#5d5067',650,60],
 ['safehouse','Убежище',1330,300,175,135,'#56636b',500,0],
 ['bank','Банк',1740,360,190,150,'#777064',1200,0],
 ['docks','Портовый склад',1600,1320,210,145,'#53676b',900,80],
 ['dealer','Автосалон',1280,790,180,135,'#65716e',1500,0]
];
const MISSIONS=[
 {title:'ПЕРВОЕ ЗНАКОМСТВО',text:'Доберись до автомастерской. Подойди к зданию и нажми «Действие».',target:'garage',reward:180},
 {title:'ПРОПАВШАЯ ПОСЫЛКА',text:'Найди восточный склад и забери посылку.',target:'warehouse',reward:250},
 {title:'УЛИЧНЫЙ АВТОРИТЕТ',text:'Победи одного участника банды в восточном квартале.',target:'gang',reward:220},
 {title:'СВОЁ ДЕЛО',text:'Приобрети продуктовый магазин.',target:'shop',reward:300},
 {title:'НОВЫЕ ГОРИЗОНТЫ',text:'Набери 4 очка репутации. После этого откроется Downtown.',target:'rep',reward:400},
 {title:'ЧУЖАЯ ТЕРРИТОРИЯ',text:'Доберись до убежища в Downtown.',target:'safehouse',reward:350},
 {title:'ПОРТОВЫЙ КОНТРАКТ',text:'Открой район Harbor и найди портовый склад.',target:'docks',reward:450}
];
const state={
 version:2,money:650,health:100,stamina:100,ammo:18,medkits:2,rep:0,day:1,
 wanted:0,crew:0,kills:0,mission:0,carRepairs:0,owned:[],unlocked:['east'],
 inventory:['Пистолет','Телефон','Ключи'],equipped:'Пистолет'
};
const player={x:190,y:200,vx:0,vy:0,angle:0,walk:0,attack:0,attackCooldown:0,invulnerable:0,inCar:null};
const camera={x:player.x,y:player.y};
const world={buildings:[],cars:[],civilians:[],gangs:[],police:[],crew:[],decor:[],roads:[]};
let width=0,height=0,scale=1,lastTime=0,saveClock=0,toastClock=0,hudClock=0,gamePaused=false;
let joystick={active:false,pointer:null,x:0,y:0};
let sprintHeld=false;
const keys=new Set();

function makeWorld(){
 world.buildings=BUILDING_SEEDS.map(([id,name,x,y,w,h,color,cost,income])=>({id,name,x,y,w,h,color,cost,income,owned:state.owned.includes(id),level:1}));
 world.roads=[];
 for(let y=90;y<WORLD.h;y+=300)world.roads.push({x:0,y,w:WORLD.w,h:92});
 for(let x=100;x<WORLD.w;x+=350)world.roads.push({x,y:0,w:82,h:WORLD.h});
 world.cars=[];
 for(let i=0;i<22;i++)world.cars.push({id:'car-'+i,x:rand(100,2000),y:rand(100,1550),angle:i%2?0:Math.PI/2,color:['#8d4538','#405b70','#a28a55','#65735f','#7b7770'][i%5],occupied:false,hp:100,speed:0});
 world.civilians=[];
 for(let i=0;i<48;i++)world.civilians.push({x:rand(80,2020),y:rand(80,1580),phase:rand(0,7),shirt:['#8c9b91','#b28b62','#7a8290','#9c6557','#667e8b'][i%5],speed:rand(.12,.3)});
 world.gangs=[];
 for(let i=0;i<9;i++)world.gangs.push({id:'gang-'+i,x:520+(i%3)*95,y:690+Math.floor(i/3)*95,hp:65,maxHp:65,alive:true,phase:rand(0,7)});
 world.crew=[];
 for(let i=0;i<state.crew;i++)world.crew.push({x:player.x-24*(i+1),y:player.y+22,hp:100,cooldown:rand(0,.5)});
 world.police=[];
 world.decor=[];
 for(let i=0;i<90;i++)world.decor.push({x:rand(20,WORLD.w-20),y:rand(20,WORLD.h-20),type:i%3});
}
function resize(){scale=Math.min(devicePixelRatio||1,2);width=innerWidth;height=innerHeight;canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);ctx.setTransform(scale,0,0,scale,0,0)}
addEventListener('resize',resize);resize();

function save(){
 try{localStorage.setItem(SAVE_KEY,JSON.stringify({state,player:{x:player.x,y:player.y},buildings:world.buildings.map(b=>({id:b.id,level:b.level,owned:b.owned})),cars:world.cars.slice(0,8).map(c=>({id:c.id,x:c.x,y:c.y,hp:c.hp}))}))}catch(error){console.warn('Save failed',error)}
}
function load(){
 try{const raw=localStorage.getItem(SAVE_KEY);if(!raw)return;const data=JSON.parse(raw);if(!data||!data.state)return;
 Object.assign(state,data.state);
 const numeric={money:[0,99999999],health:[0,100],stamina:[0,100],ammo:[0,9999],medkits:[0,99],rep:[0,999],day:[1,99999],wanted:[0,5],crew:[0,99],kills:[0,99999],mission:[0,MISSIONS.length],carRepairs:[0,99999]};
 for(const [key,[min,max]] of Object.entries(numeric)){const value=Number(state[key]);state[key]=clamp(Number.isFinite(value)?value:min,min,max)}
 const buildingIds=BUILDING_SEEDS.map(item=>item[0]);
 state.owned=Array.isArray(state.owned)?[...new Set(state.owned.filter(id=>buildingIds.includes(id)))]:[];
 state.unlocked=Array.isArray(state.unlocked)?[...new Set(state.unlocked.filter(id=>DISTRICTS.some(d=>d.id===id)))]:['east'];
 if(!state.unlocked.includes('east'))state.unlocked.unshift('east');
 state.inventory=Array.isArray(state.inventory)?state.inventory.filter(item=>typeof item==='string').slice(0,100):['Пистолет','Телефон','Ключи'];
 if(!state.inventory.includes('Пистолет'))state.inventory.unshift('Пистолет');
 if(!state.inventory.includes(state.equipped))state.equipped='Пистолет';
 if(data.player){player.x=clamp(Number(data.player.x)||190,20,WORLD.w-20);player.y=clamp(Number(data.player.y)||200,20,WORLD.h-20)}
 }catch(error){console.warn('Save data was ignored',error)}
}
load();makeWorld();
function applySavedWorld(){
 const raw=localStorage.getItem(SAVE_KEY);if(!raw)return;
 try{const data=JSON.parse(raw);for(const saved of data.buildings||[]){const b=world.buildings.find(v=>v.id===saved.id);if(b){b.owned=!!saved.owned;b.level=clamp(Number(saved.level)||1,1,10)}}
 for(const saved of data.cars||[]){const c=world.cars.find(v=>v.id===saved.id);if(c){c.x=clamp(Number(saved.x)||c.x,20,WORLD.w-20);c.y=clamp(Number(saved.y)||c.y,20,WORLD.h-20);c.hp=clamp(Number(saved.hp)||100,0,100)}}
 }catch{}
}
applySavedWorld();

function project(x,y){const dx=x-camera.x,dy=y-camera.y;return{x:width/2+(dx-dy)*.72,y:height/2+(dx+dy)*.38}}
function polygon(points,fill,stroke=null){ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke()}}
function diamond(x,y,w,h,fill,stroke){polygon([{x,y:y-h/2},{x:x+w/2,y},{x,y:y+h/2},{x:x-w/2,y}],fill,stroke)}
function roundedRect(x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}
function drawGround(){
 const district=DISTRICTS.find(d=>player.x>=d.bounds.x&&player.x<d.bounds.x+d.bounds.w&&player.y>=d.bounds.y&&player.y<d.bounds.y+d.bounds.h)||DISTRICTS[0];
 ctx.fillStyle=district.color;ctx.fillRect(0,0,width,height);
 const minX=Math.max(0,Math.floor((camera.x-950)/100)*100),maxX=Math.min(WORLD.w,Math.ceil((camera.x+950)/100)*100);
 const minY=Math.max(0,Math.floor((camera.y-950)/100)*100),maxY=Math.min(WORLD.h,Math.ceil((camera.y+950)/100)*100);
 for(let x=minX;x<=maxX;x+=100)for(let y=minY;y<=maxY;y+=100){const p=project(x,y);diamond(p.x,p.y,144,76,((x/100+y/100)%2?'#ffffff04':'#00000005'))}
 for(const r of world.roads){const corners=[project(r.x,r.y),project(r.x+r.w,r.y),project(r.x+r.w,r.y+r.h),project(r.x,r.y+r.h)];polygon(corners,'#333a3d');}
 for(let y=90;y<WORLD.h;y+=300)for(let x=60;x<WORLD.w;x+=130){const p=project(x,y+45);ctx.fillStyle='#cbbd9a44';ctx.fillRect(p.x-9,p.y-1,18,2)}
 for(let x=100;x<WORLD.w;x+=350)for(let y=60;y<WORLD.h;y+=130){const p=project(x+40,y);ctx.fillStyle='#cbbd9a44';ctx.fillRect(p.x-1,p.y-9,2,18)}
 for(const d of DISTRICTS){const p=project(d.bounds.x+80,d.bounds.y+80);if(p.x>-150&&p.x<width+150&&p.y>-80&&p.y<height+80){ctx.fillStyle='#ffffff0b';ctx.font='bold 15px system-ui';ctx.fillText(d.name,p.x,p.y)}}
 for(const o of world.decor){if(Math.abs(o.x-camera.x)>950||Math.abs(o.y-camera.y)>950)continue;const p=project(o.x,o.y);if(o.type===0){ctx.fillStyle='#1c2b24';ctx.beginPath();ctx.arc(p.x,p.y,5,0,7);ctx.fill();ctx.fillStyle='#49634a';ctx.beginPath();ctx.arc(p.x,p.y-6,8,0,7);ctx.fill()}else if(o.type===1){ctx.fillStyle='#4e5550';ctx.fillRect(p.x-4,p.y-10,8,13);ctx.fillStyle='#e4c987';ctx.fillRect(p.x-2,p.y-8,4,3)}else{ctx.strokeStyle='#7c786a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x-5,p.y);ctx.lineTo(p.x+5,p.y-7);ctx.stroke()}}
}
function drawBuilding(b){
 const p=project(b.x+b.w/2,b.y+b.h/2),w=(b.w+b.h)*.36,h=(b.w+b.h)*.19,wall=62;
 diamond(p.x,p.y+wall,w,h,b.owned?'#665b45':'#414b47','#19221e');
 polygon([{x:p.x-w/2,y:p.y},{x:p.x,y:p.y-h/2},{x:p.x,y:p.y-h/2-wall},{x:p.x-w/2,y:p.y-wall}],b.color);
 polygon([{x:p.x+w/2,y:p.y},{x:p.x,y:p.y-h/2},{x:p.x,y:p.y-h/2-wall},{x:p.x+w/2,y:p.y-wall}],shade(b.color,-30));
 polygon([{x:p.x-w/2,y:p.y-wall},{x:p.x,y:p.y-h/2-wall-19},{x:p.x+w/2,y:p.y-wall},{x:p.x,y:p.y-h/2-19}],shade(b.color,20));
 ctx.fillStyle='#d7c6a0';ctx.fillRect(p.x-5,p.y+12,10,21);ctx.fillStyle='#b7d0c7';ctx.fillRect(p.x-34,p.y-26,13,12);ctx.fillRect(p.x+20,p.y-26,13,12);
 ctx.textAlign='center';ctx.font='bold 9px system-ui';ctx.fillStyle='#f1d9a7';ctx.fillText(b.name.toUpperCase(),p.x,p.y+wall+18);
 if(currentMission()?.target===b.id){ctx.strokeStyle='#e8bb61';ctx.lineWidth=2;ctx.setLineDash([4,5]);ctx.beginPath();ctx.arc(p.x,p.y-wall-28,13+Math.sin(performance.now()/230)*3,0,7);ctx.stroke();ctx.setLineDash([])}
}
function shade(hex,amount){const n=parseInt(hex.slice(1),16);const r=clamp((n>>16)+amount,0,255),g=clamp(((n>>8)&255)+amount,0,255),b=clamp((n&255)+amount,0,255);return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1)}
function drawCar(car){
 const p=project(car.x,car.y);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(car.angle);
 ctx.fillStyle='#0008';ctx.fillRect(-22,2,46,18);ctx.fillStyle=car.color;ctx.fillRect(-21,-11,42,20);ctx.fillStyle='#9eb4b6';ctx.fillRect(-12,-9,23,8);ctx.fillStyle='#1a2021';ctx.fillRect(-16,7,9,6);ctx.fillRect(9,7,9,6);ctx.fillStyle='#e4d4a5';ctx.fillRect(17,-7,3,4);ctx.restore();
}
function drawHuman(entity,kind='civilian'){
 const p=project(entity.x,entity.y);ctx.fillStyle='#0007';ctx.beginPath();ctx.ellipse(p.x,p.y+7,8,4,0,0,7);ctx.fill();
 const color=kind==='gang'?'#a54c3e':kind==='police'?'#476887':kind==='crew'?'#789b70':entity.shirt||'#849187';
 ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(p.x-6,p.y-13,12,19,4);ctx.fill();
 ctx.fillStyle='#c99673';ctx.beginPath();ctx.arc(p.x,p.y-17,5,0,7);ctx.fill();
 if(kind==='gang'||kind==='police'){ctx.fillStyle=kind==='gang'?'#e5b65b':'#b9c8d3';ctx.fillRect(p.x-7,p.y-25,14,3)}
 if(kind==='gang'){ctx.fillStyle='#f4d5a0';ctx.font='9px system-ui';ctx.textAlign='center';ctx.fillText(Math.ceil(entity.hp),p.x,p.y-29)}
 if(entity===player){ctx.strokeStyle='#252a28';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(p.x-4,p.y+4);ctx.lineTo(p.x-6,p.y+12);ctx.moveTo(p.x+4,p.y+4);ctx.lineTo(p.x+6,p.y+12);ctx.stroke();if(player.attack>0){ctx.strokeStyle='#e8c078';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y-4,25,-.9,.9);ctx.stroke()}}
}
function drawMinimap(){
 const w=132,h=100,sx=w/WORLD.w,sy=h/WORLD.h;
 mapCtx.setTransform(2,0,0,2,0,0);mapCtx.clearRect(0,0,w,h);
 mapCtx.fillStyle='#172421';mapCtx.fillRect(0,0,w,h);
 for(const d of DISTRICTS){mapCtx.fillStyle=state.unlocked.includes(d.id)?'#42594b':'#262d30';mapCtx.fillRect(d.bounds.x*sx,d.bounds.y*sy,d.bounds.w*sx,d.bounds.h*sy);mapCtx.strokeStyle='#a9b3a455';mapCtx.strokeRect(d.bounds.x*sx,d.bounds.y*sy,d.bounds.w*sx,d.bounds.h*sy)}
 mapCtx.fillStyle='#737b78';for(const r of world.roads)mapCtx.fillRect(r.x*sx,r.y*sy,Math.max(1,r.w*sx),Math.max(1,r.h*sy));
 for(const b of world.buildings){mapCtx.fillStyle=b.owned?'#e2b969':'#b6c0b4';mapCtx.fillRect(b.x*sx,b.y*sy,Math.max(2,b.w*sx),Math.max(2,b.h*sy))}
 const mission=currentMission();if(mission){const target=world.buildings.find(b=>b.id===mission.target);if(target){mapCtx.strokeStyle='#ffe18a';mapCtx.lineWidth=1.5;mapCtx.beginPath();mapCtx.arc((target.x+target.w/2)*sx,(target.y+target.h/2)*sy,4,0,Math.PI*2);mapCtx.stroke()}else if(mission.target==='gang'){const enemy=world.gangs.find(g=>g.alive);if(enemy){mapCtx.strokeStyle='#ffe18a';mapCtx.lineWidth=1.5;mapCtx.beginPath();mapCtx.arc(enemy.x*sx,enemy.y*sy,4,0,Math.PI*2);mapCtx.stroke()}}}
 for(const c of world.cars){mapCtx.fillStyle='#7e9aa4';mapCtx.fillRect(c.x*sx-1,c.y*sy-1,2,2)}
 for(const g of world.gangs)if(g.alive){mapCtx.fillStyle='#d56c55';mapCtx.fillRect(g.x*sx-1,g.y*sy-1,3,3)}
 for(const mate of world.crew){mapCtx.fillStyle='#8dbb79';mapCtx.fillRect(mate.x*sx-1,mate.y*sy-1,3,3)}
 mapCtx.fillStyle='#f3d27f';mapCtx.beginPath();mapCtx.arc(player.x*sx,player.y*sy,3,0,Math.PI*2);mapCtx.fill();
 mapCtx.strokeStyle='#f3d27f';mapCtx.lineWidth=1;mapCtx.strokeRect(Math.max(0,(camera.x-360)*sx),Math.max(0,(camera.y-360)*sy),Math.min(w,720*sx),Math.min(h,720*sy));
}
function render(){
 drawGround();
 const items=[];
 for(const b of world.buildings)if(Math.abs(b.x-camera.x)<1000&&Math.abs(b.y-camera.y)<1000)items.push({y:b.y+b.h,draw:()=>drawBuilding(b)});
 for(const c of world.cars)if(Math.abs(c.x-camera.x)<1000&&Math.abs(c.y-camera.y)<1000)items.push({y:c.y,draw:()=>drawCar(c)});
 for(const p of world.civilians)if(Math.abs(p.x-camera.x)<900&&Math.abs(p.y-camera.y)<900)items.push({y:p.y,draw:()=>drawHuman(p)});
 for(const g of world.gangs)if(g.alive)items.push({y:g.y,draw:()=>drawHuman(g,'gang')});
 for(const cop of world.police)items.push({y:cop.y,draw:()=>drawHuman(cop,'police')});
 for(const mate of world.crew)items.push({y:mate.y,draw:()=>drawHuman(mate,'crew')});
 items.push({y:player.y,draw:()=>drawHuman(player)});items.sort((a,b)=>a.y-b.y);for(const item of items)item.draw();
}
function currentMission(){return MISSIONS[state.mission]||null}
function notify(message){const el=$('toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastClock);toastClock=setTimeout(()=>el.classList.remove('visible'),2300)}
function updateHud(){
 $('resources').innerHTML='💵 <b>
 const m=currentMission();$('mission-card').innerHTML=m?'<strong>'+m.title+'</strong>'+m.text:'<strong>СВОБОДНАЯ ИГРА</strong>Город открыт. Зарабатывай, развивай бизнес и исследуй районы.';
 const d=DISTRICTS.find(v=>state.unlocked.includes(v.id)&&player.x>=v.bounds.x&&player.x<v.bounds.x+v.bounds.w&&player.y>=v.bounds.y&&player.y<v.bounds.y+v.bounds.h)||DISTRICTS[0];$('district-tag').textContent=d.name;
}
function currentDistrict(){return DISTRICTS.find(d=>player.x>=d.bounds.x&&player.x<d.bounds.x+d.bounds.w&&player.y>=d.bounds.y&&player.y<d.bounds.y+d.bounds.h)||DISTRICTS[0]}
function unlockedAt(x,y){const d=DISTRICTS.find(v=>x>=v.bounds.x&&x<v.bounds.x+v.bounds.w&&y>=v.bounds.y&&y<v.bounds.y+v.bounds.h);return !d||state.unlocked.includes(d.id)}
function collides(x,y){for(const b of world.buildings){if(x>b.x-12&&x<b.x+b.w+12&&y>b.y-12&&y<b.y+b.h+12)return true}return false}
function nearestTarget(max=105){const candidates=[];for(const b of world.buildings)candidates.push({type:'building',object:b,d:dist(player,{x:b.x+b.w/2,y:b.y+b.h/2})});for(const c of world.cars)candidates.push({type:'car',object:c,d:dist(player,c)});for(const g of world.gangs)if(g.alive)candidates.push({type:'gang',object:g,d:dist(player,g)});return candidates.filter(v=>v.d<max).sort((a,b)=>a.d-b.d)[0]||null}
function finishMission(){const m=currentMission();state.money+=m.reward;state.rep++;state.mission=Math.min(state.mission+1,MISSIONS.length);if(state.rep>=4&&!state.unlocked.includes('downtown')){state.unlocked.push('downtown');notify('Downtown открыт! +$'+m.reward)}else notify('Задание выполнено · +$'+m.reward);if(state.mission===4&&state.rep>=4){state.money+=MISSIONS[4].reward;state.rep++;state.mission=5;notify('Downtown открыт · задание репутации выполнено')}if(state.rep>=6&&!state.unlocked.includes('harbor')){state.unlocked.push('harbor');notify('Harbor открыт!')}save();updateHud()}
function interact(){
 const target=nearestTarget();if(!target){notify('Подойди ближе к объекту');return}
 if(target.type==='car'){if(!player.inCar){player.inCar=target.object.id;target.object.occupied=true;player.x=target.object.x;player.y=target.object.y;notify('Ты за рулём')}else exitCar();return}
 if(target.type==='gang'){melee(target.object);return}
 const b=target.object;
 if(b.id==='garage'&&state.mission===0){finishMission();return}
 if(b.id==='warehouse'&&state.mission===1){finishMission();return}
 if(b.id==='safehouse'&&state.mission===5){finishMission();return}
 if(b.id==='docks'&&state.mission===6){finishMission();return}
 openBusiness(b);
}
function exitCar(){const car=world.cars.find(v=>v.id===player.inCar);if(!car)return;player.inCar=null;car.occupied=false;player.x=clamp(car.x+28,20,WORLD.w-20);player.y=car.y+18;notify('Ты вышел из машины')}
function melee(g){if(dist(player,g)>100||player.attackCooldown>0)return;g.hp-=34;player.attack=.24;player.attackCooldown=.42;state.wanted=Math.min(5,state.wanted+1);if(g.hp<=0){g.alive=false;state.kills++;state.money+=75;state.ammo+=2;notify('Противник повержен · +$75');if(state.mission===2)finishMission();else state.rep++;}else notify('Удар попал');save()}
function attack(){
 if(player.inCar){notify('Выйди из машины, чтобы атаковать');return}
 if(player.attackCooldown>0)return;
 const gang=world.gangs.filter(g=>g.alive&&dist(player,g)<115).sort((a,b)=>dist(player,a)-dist(player,b))[0];
 if(gang){melee(gang);return}
 if(state.equipped==='Пистолет'&&state.ammo>0){state.ammo--;player.attackCooldown=.36;state.wanted=Math.min(5,state.wanted+1);const target=world.gangs.filter(g=>g.alive&&dist(player,g)<320).sort((a,b)=>dist(player,a)-dist(player,b))[0];if(target){target.hp-=48;if(target.hp<=0){target.alive=false;state.kills++;state.money+=75;if(state.mission===2)finishMission();else state.rep++}notify('Выстрел произведён')}else notify('Выстрел в воздух');save()}else notify('Нет патронов или оружие не экипировано')
}
function openModal(content){$('modal-content').innerHTML=content;$('modal').hidden=false;gamePaused=true}
function closeModal(){$('modal').hidden=true;gamePaused=false}
$('modal-close').addEventListener('click',closeModal);
$('modal').addEventListener('click',e=>{if(e.target===$('modal'))closeModal()});
function openBusiness(b){
 const owned=b.owned,cost=b.cost,upgrade=250*b.level;
 openModal('<h2>'+b.name+'</h2><p>'+(owned?'Ты владеешь этим объектом. Уровень '+b.level+'.':'Приобрети объект, чтобы открыть источник дохода.')+'</p>'+(b.income?'<p>Доход: <b>$'+(b.income*b.level)+'</b> за игровой день.</p>':'')+
 '<div class="choice-grid">'+(!owned&&cost?'<button class="choice" id="buy"><strong>Купить · $'+cost+'</strong><small>Оформить собственность</small></button>':'')+(owned?'<button class="choice" id="upgrade"><strong>Улучшить · $'+upgrade+'</strong><small>Повысить уровень и доход</small></button>':'')+
 (b.id==='garage'?'<button class="choice" id="repair"><strong>Ремонт · $100</strong><small>Восстановить ближайшую машину</small></button>':'')+'<button class="choice" id="back"><strong>Закрыть</strong><small>Вернуться на улицу</small></button></div>');
 $('back').onclick=closeModal;
 if($('buy'))$('buy').onclick=()=>{if(state.money<cost){notify('Недостаточно денег');return}state.money-=cost;b.owned=true;state.owned.push(b.id);if(state.mission===3&&b.id==='shop')finishMission();save();notify('Бизнес приобретён');openBusiness(b)};
 if($('upgrade'))$('upgrade').onclick=()=>{if(state.money<upgrade){notify('Недостаточно денег');return}state.money-=upgrade;b.level++;save();notify('Уровень повышен');openBusiness(b)};
 if($('repair'))$('repair').onclick=()=>{if(state.money<100){notify('Недостаточно денег');return}const car=world.cars.find(c=>dist(player,c)<180);if(!car){notify('Рядом нет машины');return}state.money-=100;car.hp=100;save();notify('Машина отремонтирована')};
}
function openMenu(){
 const owned=world.buildings.filter(b=>b.owned),income=owned.reduce((n,b)=>n+b.income*b.level,0);
 openModal('<h2>ГОРОД · ПАУЗА</h2><p>День '+state.day+' · '+currentDistrict().name+' · Репутация '+state.rep+' · Убийства '+state.kills+'</p><div class="section-label">ПРОГРЕСС</div><div class="meter"><i style="width:'+Math.min(100,state.rep/8*100)+'%"></i></div><p>Розыск: '+state.wanted+'/5 · Команда: '+state.crew+' · Бизнесов: '+owned.length+'</p><div class="choice-grid">'+
 '<button class="choice" id="businesses"><strong>Мои бизнесы</strong><small>'+owned.length+' объектов · $'+income+' за день</small></button>'+
 '<button class="choice" id="crew"><strong>Нанять бойца · $200</strong><small>Пополнить уличную команду</small></button>'+
 '<button class="choice" id="medkit"><strong>Использовать аптечку</strong><small>В запасе: '+state.medkits+' · восстановить до 45 здоровья</small></button>'+
 '<button class="choice" id="buy-medkit"><strong>Купить аптечку · $80</strong><small>Добавить одну в запас</small></button>'+
 '<button class="choice" id="day"><strong>Следующий день</strong><small>Получить доход и восстановиться</small></button>'+
 '<button class="choice" id="inventory"><strong>Инвентарь</strong><small>'+state.inventory.join(', ')+'</small></button>'+
 '<button class="choice" id="save"><strong>Сохранить игру</strong><small>Сохранение на этом устройстве</small></button>'+
 '<button class="choice" id="continue"><strong>Продолжить</strong><small>Вернуться в город</small></button>'+
 '<button class="choice" id="reset"><strong>Сбросить прогресс</strong><small>Начать новую игру</small></button></div>');
 $('continue').onclick=closeModal;$('save').onclick=()=>{save();notify('Игра сохранена')};
 $('crew').onclick=()=>{if(state.money<200){notify('Недостаточно денег');return}state.money-=200;state.crew++;world.crew.push({x:player.x-28,y:player.y+26,hp:100,cooldown:.4});state.inventory.push('Наёмник');save();notify('Боец нанят и присоединился к отряду');openMenu()};
 $('medkit').onclick=()=>{if(state.medkits<1){notify('В запасе нет аптечек');return}if(state.health>=100){notify('Здоровье уже полное');return}state.medkits--;state.health=Math.min(100,state.health+45);save();notify('Аптечка использована');openMenu()};
 $('buy-medkit').onclick=()=>{if(state.money<80){notify('Недостаточно денег');return}state.money-=80;state.medkits++;save();notify('Аптечка куплена');openMenu()};
 $('day').onclick=()=>{const amount=world.buildings.filter(b=>b.owned).reduce((n,b)=>n+b.income*b.level,0);state.money+=amount;state.day++;state.health=Math.min(100,state.health+10);state.stamina=100;state.wanted=Math.max(0,state.wanted-1);save();notify('Новый день · доход $'+amount);openMenu()};
 $('businesses').onclick=()=>{const rows=owned.length?owned.map(b=>'<p>'+b.name+' · уровень '+b.level+' · $'+(b.income*b.level)+'/день</p>').join(''):'<p>Пока нет недвижимости.</p>';openModal('<h2>МОЯ НЕДВИЖИМОСТЬ</h2>'+rows+'<button class="choice" id="back"><strong>Назад</strong></button>');$('back').onclick=openMenu};
 $('inventory').onclick=()=>{openModal('<h2>ИНВЕНТАРЬ</h2><p>'+state.inventory.map(item=>'• '+item).join('<br>')+'</p><p>Экипировано: '+state.equipped+'</p><button class="choice" id="pistol"><strong>Экипировать пистолет</strong><small>Патроны: '+state.ammo+'</small></button><button class="choice" id="back"><strong>Назад</strong></button>');$('pistol').onclick=()=>{state.equipped='Пистолет';notify('Пистолет экипирован');openMenu()};$('back').onclick=openMenu};
 $('reset').onclick=()=>{if(!confirm('Удалить локальное сохранение и начать заново?'))return;localStorage.removeItem(SAVE_KEY);location.reload()};
}
$('menu-open').addEventListener('click',openMenu);

function update(dt){
 let ix=joystick.x,iy=joystick.y;if(keys.has('w')||keys.has('arrowup'))iy=-1;if(keys.has('s')||keys.has('arrowdown'))iy=1;if(keys.has('a')||keys.has('arrowleft'))ix=-1;if(keys.has('d')||keys.has('arrowright'))ix=1;
 const length=Math.hypot(ix,iy);if(length>1){ix/=length;iy/=length}
 const car=player.inCar?world.cars.find(c=>c.id===player.inCar):null;
 const sprinting=!car&&sprintHeld&&length>.05&&state.stamina>1;
 const speed=car?3.8:(sprinting?3.05:2.1);
 const nx=player.x+ix*speed*dt*60,ny=player.y+iy*speed*dt*60;
 if(length>.05){player.angle=Math.atan2(iy,ix);player.walk+=dt*(sprinting?15:10)}
 if(sprinting)state.stamina=Math.max(0,state.stamina-dt*24);else state.stamina=Math.min(100,state.stamina+dt*13);
 if(!collides(nx,player.y)&&unlockedAt(nx,player.y))player.x=clamp(nx,15,WORLD.w-15);
 if(!collides(player.x,ny)&&unlockedAt(player.x,ny))player.y=clamp(ny,15,WORLD.h-15);
 if(car){car.x=player.x;car.y=player.y;car.angle=player.angle;car.speed=length*speed}
 player.attack=Math.max(0,player.attack-dt);player.attackCooldown=Math.max(0,player.attackCooldown-dt);player.invulnerable=Math.max(0,player.invulnerable-dt);
 for(const civilian of world.civilians){civilian.phase+=dt;if(Math.sin(civilian.phase)>.98){civilian.x=clamp(civilian.x+Math.cos(civilian.phase)*civilian.speed*8,30,WORLD.w-30);civilian.y=clamp(civilian.y+Math.sin(civilian.phase)*civilian.speed*8,30,WORLD.h-30)}}
 for(const g of world.gangs){if(!g.alive)continue;const d=dist(player,g);if(d<240&&!car){const a=Math.atan2(player.y-g.y,player.x-g.x);g.x+=Math.cos(a)*.7;g.y+=Math.sin(a)*.7;if(d<25&&player.invulnerable<=0){state.health-=6;player.invulnerable=.8;if(state.health<=0)knockOut()}}}
 for(const mate of world.crew){mate.cooldown=Math.max(0,mate.cooldown-dt);const follow=dist(player,mate);if(follow>48){const a=Math.atan2(player.y-mate.y,player.x-mate.x);const step=Math.min(follow-38,1.05)*dt*60;mate.x+=Math.cos(a)*step;mate.y+=Math.sin(a)*step}const enemy=world.gangs.filter(g=>g.alive&&dist(mate,g)<105).sort((a,b)=>dist(mate,a)-dist(mate,b))[0];if(enemy&&mate.cooldown<=0){enemy.hp-=18;mate.cooldown=1.1;if(enemy.hp<=0){enemy.alive=false;state.kills++;state.money+=50;if(state.mission===2)finishMission();else state.rep++;notify('Твой боец победил противника · +$50');save()}}}
 updatePolice(dt,car);
 camera.x+=(player.x-camera.x)*Math.min(1,dt*5);camera.y+=(player.y-camera.y)*Math.min(1,dt*5);
 saveClock+=dt;if(saveClock>18){saveClock=0;save()}
}
function updatePolice(dt,car){
 if(state.wanted>0&&Math.random()<dt*.22&&world.police.length<state.wanted*2){world.police.push({x:clamp(player.x+rand(-380,380),20,WORLD.w-20),y:clamp(player.y+rand(-380,380),20,WORLD.h-20),hp:70,phase:0})}
 for(let i=world.police.length-1;i>=0;i--){const cop=world.police[i],d=dist(player,cop),a=Math.atan2(player.y-cop.y,player.x-cop.x);cop.x+=Math.cos(a)*(car?1.3:.55);cop.y+=Math.sin(a)*(car?1.3:.55);cop.phase+=dt;if(d<24&&player.invulnerable<=0){state.health-=4;player.invulnerable=1;if(state.health<=0)knockOut()}if(state.wanted===0&&d>500)world.police.splice(i,1)}
}
function knockOut(){state.health=40;state.money=Math.max(0,state.money-120);state.wanted=0;if(player.inCar)exitCar();player.x=190;player.y=200;world.police=[];notify('Тебя вырубили. Потеряно $120');save()}
function frame(time){const dt=Math.min(.04,(time-lastTime)/1000||0);lastTime=time;if(!gamePaused)update(dt);render();hudClock+=dt;if(hudClock>=.2){hudClock=0;updateHud();drawMinimap()}requestAnimationFrame(frame)}
function setupJoystick(){
 const pad=$('joystick'),knob=$('joystick-knob');
 const set=(x,y)=>{const max=39,len=Math.hypot(x,y)||1,k=Math.min(1,max/len);joystick.x=x*k/max;joystick.y=y*k/max;knob.style.transform='translate('+x*k+'px,'+y*k+'px)'};
 pad.addEventListener('pointerdown',e=>{joystick.active=true;joystick.pointer=e.pointerId;pad.setPointerCapture(e.pointerId);const r=pad.getBoundingClientRect();set(e.clientX-r.left-r.width/2,e.clientY-r.top-r.height/2)});
 pad.addEventListener('pointermove',e=>{if(!joystick.active||joystick.pointer!==e.pointerId)return;const r=pad.getBoundingClientRect();set(e.clientX-r.left-r.width/2,e.clientY-r.top-r.height/2)});
 const release=e=>{if(joystick.pointer!==e.pointerId)return;joystick.active=false;joystick.pointer=null;set(0,0)};
 pad.addEventListener('pointerup',release);pad.addEventListener('pointercancel',release);
}
setupJoystick();
const sprintButton=$('sprint');
sprintButton.addEventListener('pointerdown',e=>{e.preventDefault();sprintHeld=true;sprintButton.setPointerCapture(e.pointerId)});
const stopSprint=()=>{sprintHeld=false};
sprintButton.addEventListener('pointerup',stopSprint);sprintButton.addEventListener('pointercancel',stopSprint);sprintButton.addEventListener('lostpointercapture',stopSprint);
$('interact').addEventListener('click',interact);$('attack').addEventListener('click',attack);
addEventListener('keydown',e=>{const key=e.key.toLowerCase();keys.add(key);if(key==='e')interact();if(key===' '){e.preventDefault();attack()}if(key==='escape')closeModal()});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
addEventListener('blur',()=>keys.clear());
document.addEventListener('visibilitychange',()=>{if(document.hidden)save()});
if('serviceWorker' in navigator&&location.protocol!=='file:'){addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(error=>console.warn('Offline mode unavailable',error)))}
$('loading').classList.add('done');setTimeout(()=>$('loading').remove(),400);
updateHud();requestAnimationFrame(frame);
+Math.floor(state.money)+'</b><br>❤️ '+Math.ceil(state.health)+' &nbsp; ⚡ '+Math.ceil(state.stamina)+'<br>⭐ '+state.rep+' &nbsp; 🔫 '+state.ammo+'<br>☠ '+state.wanted+' / 5';
 const m=currentMission();$('mission-card').innerHTML=m?'<strong>'+m.title+'</strong>'+m.text:'<strong>СВОБОДНАЯ ИГРА</strong>Город открыт. Зарабатывай, развивай бизнес и исследуй районы.';
 const d=DISTRICTS.find(v=>state.unlocked.includes(v.id)&&player.x>=v.bounds.x&&player.x<v.bounds.x+v.bounds.w&&player.y>=v.bounds.y&&player.y<v.bounds.y+v.bounds.h)||DISTRICTS[0];$('district-tag').textContent=d.name;
}
function currentDistrict(){return DISTRICTS.find(d=>player.x>=d.bounds.x&&player.x<d.bounds.x+d.bounds.w&&player.y>=d.bounds.y&&player.y<d.bounds.y+d.bounds.h)||DISTRICTS[0]}
function unlockedAt(x,y){const d=DISTRICTS.find(v=>x>=v.bounds.x&&x<v.bounds.x+v.bounds.w&&y>=v.bounds.y&&y<v.bounds.y+v.bounds.h);return !d||state.unlocked.includes(d.id)}
function collides(x,y){for(const b of world.buildings){if(x>b.x-12&&x<b.x+b.w+12&&y>b.y-12&&y<b.y+b.h+12)return true}return false}
function nearestTarget(max=105){const candidates=[];for(const b of world.buildings)candidates.push({type:'building',object:b,d:dist(player,{x:b.x+b.w/2,y:b.y+b.h/2})});for(const c of world.cars)candidates.push({type:'car',object:c,d:dist(player,c)});for(const g of world.gangs)if(g.alive)candidates.push({type:'gang',object:g,d:dist(player,g)});return candidates.filter(v=>v.d<max).sort((a,b)=>a.d-b.d)[0]||null}
function finishMission(){const m=currentMission();state.money+=m.reward;state.rep++;state.mission=Math.min(state.mission+1,MISSIONS.length);if(state.rep>=4&&!state.unlocked.includes('downtown')){state.unlocked.push('downtown');notify('Downtown открыт! +$'+m.reward)}else notify('Задание выполнено · +$'+m.reward);if(state.mission===4&&state.rep>=4){state.money+=MISSIONS[4].reward;state.rep++;state.mission=5;notify('Downtown открыт · задание репутации выполнено')}if(state.rep>=6&&!state.unlocked.includes('harbor')){state.unlocked.push('harbor');notify('Harbor открыт!')}save();updateHud()}
function interact(){
 const target=nearestTarget();if(!target){notify('Подойди ближе к объекту');return}
 if(target.type==='car'){if(!player.inCar){player.inCar=target.object.id;target.object.occupied=true;player.x=target.object.x;player.y=target.object.y;notify('Ты за рулём')}else exitCar();return}
 if(target.type==='gang'){melee(target.object);return}
 const b=target.object;
 if(b.id==='garage'&&state.mission===0){finishMission();return}
 if(b.id==='warehouse'&&state.mission===1){state.money+=250;finishMission();return}
 if(b.id==='safehouse'&&state.mission===5){finishMission();return}
 if(b.id==='docks'&&state.mission===6){finishMission();return}
 openBusiness(b);
}
function exitCar(){const car=world.cars.find(v=>v.id===player.inCar);if(!car)return;player.inCar=null;car.occupied=false;player.x=clamp(car.x+28,20,WORLD.w-20);player.y=car.y+18;notify('Ты вышел из машины')}
function melee(g){if(dist(player,g)>100)return;g.hp-=34;player.attack=.24;state.wanted=Math.min(5,state.wanted+1);if(g.hp<=0){g.alive=false;state.kills++;state.money+=75;state.ammo+=2;notify('Противник повержен · +$75');if(state.mission===2)finishMission();else state.rep++;}else notify('Удар попал');save()}
function attack(){
 if(player.inCar){notify('Выйди из машины, чтобы атаковать');return}
 const gang=world.gangs.filter(g=>g.alive&&dist(player,g)<115).sort((a,b)=>dist(player,a)-dist(player,b))[0];
 if(gang){melee(gang);return}
 if(state.equipped==='Пистолет'&&state.ammo>0){state.ammo--;state.wanted=Math.min(5,state.wanted+1);const target=world.gangs.filter(g=>g.alive&&dist(player,g)<320).sort((a,b)=>dist(player,a)-dist(player,b))[0];if(target){target.hp-=48;if(target.hp<=0){target.alive=false;state.kills++;state.money+=75;if(state.mission===2)finishMission();else state.rep++}notify('Выстрел произведён')}else notify('Выстрел в воздух');save()}else notify('Нет патронов или оружие не экипировано')
}
function openModal(content){$('modal-content').innerHTML=content;$('modal').hidden=false;gamePaused=true}
function closeModal(){$('modal').hidden=true;gamePaused=false}
$('modal-close').addEventListener('click',closeModal);
$('modal').addEventListener('click',e=>{if(e.target===$('modal'))closeModal()});
function openBusiness(b){
 const owned=b.owned,cost=b.cost,upgrade=250*b.level;
 openModal('<h2>'+b.name+'</h2><p>'+(owned?'Ты владеешь этим объектом. Уровень '+b.level+'.':'Приобрети объект, чтобы открыть источник дохода.')+'</p>'+(b.income?'<p>Доход: <b>$'+(b.income*b.level)+'</b> за игровой день.</p>':'')+
 '<div class="choice-grid">'+(!owned&&cost?'<button class="choice" id="buy"><strong>Купить · $'+cost+'</strong><small>Оформить собственность</small></button>':'')+(owned?'<button class="choice" id="upgrade"><strong>Улучшить · $'+upgrade+'</strong><small>Повысить уровень и доход</small></button>':'')+
 (b.id==='garage'?'<button class="choice" id="repair"><strong>Ремонт · $100</strong><small>Восстановить ближайшую машину</small></button>':'')+'<button class="choice" id="back"><strong>Закрыть</strong><small>Вернуться на улицу</small></button></div>');
 $('back').onclick=closeModal;
 if($('buy'))$('buy').onclick=()=>{if(state.money<cost){notify('Недостаточно денег');return}state.money-=cost;b.owned=true;state.owned.push(b.id);if(state.mission===3&&b.id==='shop')finishMission();save();notify('Бизнес приобретён');openBusiness(b)};
 if($('upgrade'))$('upgrade').onclick=()=>{if(state.money<upgrade){notify('Недостаточно денег');return}state.money-=upgrade;b.level++;save();notify('Уровень повышен');openBusiness(b)};
 if($('repair'))$('repair').onclick=()=>{if(state.money<100){notify('Недостаточно денег');return}const car=world.cars.find(c=>dist(player,c)<180);if(!car){notify('Рядом нет машины');return}state.money-=100;car.hp=100;save();notify('Машина отремонтирована')};
}
function openMenu(){
 const owned=world.buildings.filter(b=>b.owned),income=owned.reduce((n,b)=>n+b.income*b.level,0);
 openModal('<h2>ГОРОД · ПАУЗА</h2><p>День '+state.day+' · '+currentDistrict().name+' · Репутация '+state.rep+' · Убийства '+state.kills+'</p><div class="section-label">ПРОГРЕСС</div><div class="meter"><i style="width:'+Math.min(100,state.rep/8*100)+'%"></i></div><p>Розыск: '+state.wanted+'/5 · Команда: '+state.crew+' · Бизнесов: '+owned.length+'</p><div class="choice-grid">'+
 '<button class="choice" id="businesses"><strong>Мои бизнесы</strong><small>'+owned.length+' объектов · $'+income+' за день</small></button>'+
 '<button class="choice" id="crew"><strong>Нанять бойца · $200</strong><small>Пополнить уличную команду</small></button>'+
 '<button class="choice" id="medkit"><strong>Аптечка · $80</strong><small>Восстановить до 45 здоровья</small></button>'+
 '<button class="choice" id="day"><strong>Следующий день</strong><small>Получить доход и восстановиться</small></button>'+
 '<button class="choice" id="inventory"><strong>Инвентарь</strong><small>'+state.inventory.join(', ')+'</small></button>'+
 '<button class="choice" id="save"><strong>Сохранить игру</strong><small>Сохранение на этом устройстве</small></button>'+
 '<button class="choice" id="continue"><strong>Продолжить</strong><small>Вернуться в город</small></button>'+
 '<button class="choice" id="reset"><strong>Сбросить прогресс</strong><small>Начать новую игру</small></button></div>');
 $('continue').onclick=closeModal;$('save').onclick=()=>{save();notify('Игра сохранена')};
 $('crew').onclick=()=>{if(state.money<200){notify('Недостаточно денег');return}state.money-=200;state.crew++;state.inventory.push('Наёмник');save();notify('Боец нанят');openMenu()};
 $('medkit').onclick=()=>{if(state.money<80){notify('Недостаточно денег');return}state.money-=80;state.health=Math.min(100,state.health+45);state.medkits++;save();notify('Аптечка использована');openMenu()};
 $('day').onclick=()=>{const amount=world.buildings.filter(b=>b.owned).reduce((n,b)=>n+b.income*b.level,0);state.money+=amount;state.day++;state.health=Math.min(100,state.health+10);state.stamina=100;state.wanted=Math.max(0,state.wanted-1);save();notify('Новый день · доход $'+amount);openMenu()};
 $('businesses').onclick=()=>{const rows=owned.length?owned.map(b=>'<p>'+b.name+' · уровень '+b.level+' · $'+(b.income*b.level)+'/день</p>').join(''):'<p>Пока нет недвижимости.</p>';openModal('<h2>МОЯ НЕДВИЖИМОСТЬ</h2>'+rows+'<button class="choice" id="back"><strong>Назад</strong></button>');$('back').onclick=openMenu};
 $('inventory').onclick=()=>{openModal('<h2>ИНВЕНТАРЬ</h2><p>'+state.inventory.map(item=>'• '+item).join('<br>')+'</p><p>Экипировано: '+state.equipped+'</p><button class="choice" id="pistol"><strong>Экипировать пистолет</strong><small>Патроны: '+state.ammo+'</small></button><button class="choice" id="back"><strong>Назад</strong></button>');$('pistol').onclick=()=>{state.equipped='Пистолет';notify('Пистолет экипирован');openMenu()};$('back').onclick=openMenu};
 $('reset').onclick=()=>{if(!confirm('Удалить локальное сохранение и начать заново?'))return;localStorage.removeItem(SAVE_KEY);location.reload()};
}
$('menu-open').addEventListener('click',openMenu);

function update(dt){
 let ix=joystick.x,iy=joystick.y;if(keys.has('w')||keys.has('arrowup'))iy=-1;if(keys.has('s')||keys.has('arrowdown'))iy=1;if(keys.has('a')||keys.has('arrowleft'))ix=-1;if(keys.has('d')||keys.has('arrowright'))ix=1;
 const length=Math.hypot(ix,iy);if(length>1){ix/=length;iy/=length}
 const car=player.inCar?world.cars.find(c=>c.id===player.inCar):null;
 const speed=car?3.8:2.1;
 const nx=player.x+ix*speed*dt*60,ny=player.y+iy*speed*dt*60;
 if(length>.05){player.angle=Math.atan2(iy,ix);player.walk+=dt*10;player.stamina=Math.max(0,player.stamina-dt*1.5)}else player.stamina=Math.min(100,player.stamina+dt*5);
 if(!collides(nx,player.y)&&unlockedAt(nx,player.y))player.x=clamp(nx,15,WORLD.w-15);
 if(!collides(player.x,ny)&&unlockedAt(player.x,ny))player.y=clamp(ny,15,WORLD.h-15);
 if(car){car.x=player.x;car.y=player.y;car.angle=player.angle;car.speed=length*speed}
 player.attack=Math.max(0,player.attack-dt);player.invulnerable=Math.max(0,player.invulnerable-dt);
 for(const civilian of world.civilians){civilian.phase+=dt;if(Math.sin(civilian.phase)>.98){civilian.x=clamp(civilian.x+Math.cos(civilian.phase)*civilian.speed*8,30,WORLD.w-30);civilian.y=clamp(civilian.y+Math.sin(civilian.phase)*civilian.speed*8,30,WORLD.h-30)}}
 for(const g of world.gangs){if(!g.alive)continue;const d=dist(player,g);if(d<240&&!car){const a=Math.atan2(player.y-g.y,player.x-g.x);g.x+=Math.cos(a)*.7;g.y+=Math.sin(a)*.7;if(d<25&&player.invulnerable<=0){state.health-=6;player.invulnerable=.8;if(state.health<=0)knockOut()}}}
 updatePolice(dt,car);
 camera.x+=(player.x-camera.x)*Math.min(1,dt*5);camera.y+=(player.y-camera.y)*Math.min(1,dt*5);
 saveClock+=dt;if(saveClock>18){saveClock=0;save()}
}
function updatePolice(dt,car){
 if(state.wanted>0&&Math.random()<dt*.22&&world.police.length<state.wanted*2){world.police.push({x:clamp(player.x+rand(-380,380),20,WORLD.w-20),y:clamp(player.y+rand(-380,380),20,WORLD.h-20),hp:70,phase:0})}
 for(let i=world.police.length-1;i>=0;i--){const cop=world.police[i],d=dist(player,cop),a=Math.atan2(player.y-cop.y,player.x-cop.x);cop.x+=Math.cos(a)*(car?1.3:.55);cop.y+=Math.sin(a)*(car?1.3:.55);cop.phase+=dt;if(d<24&&player.invulnerable<=0){state.health-=4;player.invulnerable=1;if(state.health<=0)knockOut()}if(state.wanted===0&&d>500)world.police.splice(i,1)}
}
function knockOut(){state.health=40;state.money=Math.max(0,state.money-120);state.wanted=0;if(player.inCar)exitCar();player.x=190;player.y=200;world.police=[];notify('Тебя вырубили. Потеряно $120');save()}
function frame(time){const dt=Math.min(.04,(time-lastTime)/1000||0);lastTime=time;if(!gamePaused)update(dt);render();updateHud();requestAnimationFrame(frame)}
function setupJoystick(){
 const pad=$('joystick'),knob=$('joystick-knob');
 const set=(x,y)=>{const max=39,len=Math.hypot(x,y)||1,k=Math.min(1,max/len);joystick.x=x*k/max;joystick.y=y*k/max;knob.style.transform='translate('+x*k+'px,'+y*k+'px)'};
 pad.addEventListener('pointerdown',e=>{joystick.active=true;joystick.pointer=e.pointerId;pad.setPointerCapture(e.pointerId);const r=pad.getBoundingClientRect();set(e.clientX-r.left-r.width/2,e.clientY-r.top-r.height/2)});
 pad.addEventListener('pointermove',e=>{if(!joystick.active||joystick.pointer!==e.pointerId)return;const r=pad.getBoundingClientRect();set(e.clientX-r.left-r.width/2,e.clientY-r.top-r.height/2)});
 const release=e=>{if(joystick.pointer!==e.pointerId)return;joystick.active=false;joystick.pointer=null;set(0,0)};
 pad.addEventListener('pointerup',release);pad.addEventListener('pointercancel',release);
}
setupJoystick();
$('interact').addEventListener('click',interact);$('attack').addEventListener('click',attack);
addEventListener('keydown',e=>{const key=e.key.toLowerCase();keys.add(key);if(key==='e')interact();if(key===' '){e.preventDefault();attack()}if(key==='escape')closeModal()});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
addEventListener('blur',()=>keys.clear());
document.addEventListener('visibilitychange',()=>{if(document.hidden)save()});
if('serviceWorker' in navigator&&location.protocol!=='file:'){addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(error=>console.warn('Offline mode unavailable',error)))}
$('loading').classList.add('done');setTimeout(()=>$('loading').remove(),400);
updateHud();requestAnimationFrame(frame);
