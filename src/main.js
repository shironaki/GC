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
const world={buildings:[],cars:[],civilians:[],gangs:[],police:[],crew:[],decor:[],roads:[],cityProps:[]};
let width=0,height=0,scale=1,lastTime=0,saveClock=0,toastClock=0,hudClock=0,gamePaused=false;
let joystick={active:false,pointer:null,x:0,y:0};
let sprintHeld=false;
const keys=new Set();

function makeWorld(){
 world.buildings=BUILDING_SEEDS.map(([id,name,x,y,w,h,color,cost,income])=>({id,name,x,y,w,h,color,cost,income,owned:state.owned.includes(id),level:1}));
 world.roads=[];
 for(let y=90;y<WORLD.h;y+=300)world.roads.push({x:0,y,w:WORLD.w,h:112});
 for(let x=100;x<WORLD.w;x+=350)world.roads.push({x,y:0,w:100,h:WORLD.h});
 world.cityProps=[];
 for(let bx=200;bx<WORLD.w-180;bx+=350)for(let by=205;by<WORLD.h-170;by+=300){
   const seed=Math.abs(Math.sin(bx*12.9898+by*78.233)*43758.5453)%1;
   for(let n=0;n<2+(seed>.55?1:0);n++){
     const t=(seed+n*.371)%1,u=(seed*.73+n*.219)%1;
     world.cityProps.push({x:bx+28+t*190,y:by+20+u*145,w:62+t*58,d:58+u*52,h:78+((seed+n*.17)%1)*125,color:['#45484a','#55504b','#414b4d','#5a5149','#3c474b'][n%5],seed:seed+n*.31});
   }
 }
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

function project(x,y){
 const dy=y-camera.y,depth=clamp(1+dy*.00016,.72,1.34);
 return{x:width/2+(x-camera.x)*.78*depth,y:height*.49+dy*.48*depth,depth};
}
function polygon(points,fill,stroke=null){ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke()}}
function diamond(x,y,w,h,fill,stroke){polygon([{x,y:y-h/2},{x:x+w/2,y},{x,y:y+h/2},{x:x-w/2,y}],fill,stroke)}
function roundedRect(x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}
function drawGround(){
 const district=currentDistrict();
 ctx.fillStyle='#17201f';ctx.fillRect(0,0,width,height);
 const left=camera.x-width/1.1,right=camera.x+width/1.1,top=camera.y-height/0.65,bottom=camera.y+height/0.65;
 for(const r of world.roads){
   if(r.y>top-150&&r.y<bottom+150){
     const a=project(r.x,r.y),b=project(r.x+WORLD.w,r.y),c=project(r.x+WORLD.w,r.y+r.h),d=project(r.x,r.y+r.h);
     polygon([a,b,c,d],'#34383a');
     const sidewalk=13;
     for(const edge of [r.y+5,r.y+r.h-5]){
       const p=project(r.x,edge),q=project(r.x+WORLD.w,edge);
       ctx.strokeStyle='#8b8170';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();
     }
     for(let x=80;x<WORLD.w;x+=170){const p=project(x,r.y+r.h*.52),q=project(x+65,r.y+r.h*.52);ctx.strokeStyle='#d6c99c88';ctx.lineWidth=2* p.depth;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke()}
   }
   if(r.x>left-150&&r.x<right+150){
     const a=project(r.x,r.y),b=project(r.x+r.w,r.y),c=project(r.x+r.w,r.y+WORLD.h),d=project(r.x,r.y+WORLD.h);
     polygon([a,b,c,d],'#34383a');
     for(let y=100;y<WORLD.h;y+=170){const p=project(r.x+r.w*.5,y),q=project(r.x+r.w*.5,y+62);ctx.strokeStyle='#d6c99c88';ctx.lineWidth=2*p.depth;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke()}
   }
 }
 // Weathered asphalt patches, cracks and manhole covers.
 for(let i=0;i<105;i++){
   const wx=((i*173+Math.floor(camera.x/80)*37)%WORLD.w),wy=((i*97+Math.floor(camera.y/80)*53)%WORLD.h);
   const p=project(wx,wy);if(p.x<-20||p.x>width+20||p.y<-20||p.y>height+20)continue;
   ctx.fillStyle=i%3?'#b7ad9710':'#05090a24';ctx.beginPath();ctx.ellipse(p.x,p.y,3*p.depth,1.5*p.depth,-.3,0,Math.PI*2);ctx.fill();
   if(i%13===0){ctx.strokeStyle='#aaa18a55';ctx.lineWidth=p.depth;ctx.beginPath();ctx.arc(p.x,p.y,5*p.depth,0,Math.PI*2);ctx.stroke()}
 }
 // Crosswalks at street intersections.
 for(let y=90;y<WORLD.h;y+=300)for(let x=100;x<WORLD.w;x+=350){
   for(let k=0;k<7;k++){
     const p=project(x-30+k*10,y+126),q=project(x-30+k*10,y+148);
     ctx.strokeStyle='#e0d9c4a8';ctx.lineWidth=5*p.depth;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();
   }
 }
 // Street lamps cast warm pools of light onto the asphalt.
 for(let y=210;y<WORLD.h;y+=300)for(let x=245;x<WORLD.w;x+=350){
   const p=project(x,y),radius=105*p.depth;
   if(p.x<-radius||p.x>width+radius||p.y<-radius||p.y>height+radius)continue;
   const glow=ctx.createRadialGradient(p.x,p.y,2,p.x,p.y,radius);
   glow.addColorStop(0,'#f6c87535');glow.addColorStop(.45,'#dba95b16');glow.addColorStop(1,'#dba95b00');
   ctx.fillStyle=glow;ctx.fillRect(p.x-radius,p.y-radius,radius*2,radius*2);
   ctx.strokeStyle='#252b2a';ctx.lineWidth=2*p.depth;ctx.beginPath();ctx.moveTo(p.x,p.y-26*p.depth);ctx.lineTo(p.x,p.y);ctx.stroke();
   ctx.fillStyle='#ffe2a0';ctx.beginPath();ctx.arc(p.x,p.y-27*p.depth,3*p.depth,0,Math.PI*2);ctx.fill();
 }
 // Sidewalk curb accents and scattered street furniture.
 for(const o of world.decor){
   if(Math.abs(o.x-camera.x)>1050||Math.abs(o.y-camera.y)>900)continue;
   const p=project(o.x,o.y),z=p.depth;
   if(o.type===0){ctx.fillStyle='#080d0c88';ctx.beginPath();ctx.ellipse(p.x,p.y+5*z,8*z,3*z,0,0,7);ctx.fill();ctx.fillStyle='#263d32';ctx.fillRect(p.x-2*z,p.y-10*z,4*z,12*z);ctx.fillStyle='#3d6347';ctx.beginPath();ctx.arc(p.x,p.y-13*z,8*z,0,7);ctx.fill();ctx.fillStyle='#68845b';ctx.beginPath();ctx.arc(p.x-3*z,p.y-17*z,4*z,0,7);ctx.fill()}
   else if(o.type===1){ctx.fillStyle='#151c1b';ctx.fillRect(p.x-3*z,p.y-10*z,6*z,12*z);ctx.fillStyle='#f4d18a';ctx.shadowColor='#f4c36b';ctx.shadowBlur=9*z;ctx.fillRect(p.x-1.5*z,p.y-8*z,3*z,3*z);ctx.shadowBlur=0}
   else{ctx.strokeStyle='#817a6d';ctx.lineWidth=2*z;ctx.beginPath();ctx.moveTo(p.x-5*z,p.y);ctx.lineTo(p.x+5*z,p.y-7*z);ctx.stroke()}
 }
}
function drawBuilding(b){
 const corners=[[b.x,b.y],[b.x+b.w,b.y],[b.x+b.w,b.y+b.h],[b.x,b.y+b.h]].map(([x,y])=>project(x,y));
 const center=project(b.x+b.w/2,b.y+b.h/2),z=center.depth,high=(76+(b.h%4)*17)*z;
 const top=corners.map(p=>({x:p.x,y:p.y-high}));
 // Ground shadow, long and directional.
 ctx.fillStyle='#05070788';polygon(corners.map(p=>({x:p.x+13*z,y:p.y+8*z})), '#080b0b77');
 polygon([corners[0],corners[1],{x:corners[1].x,y:corners[1].y-high},{x:corners[0].x,y:corners[0].y-high}],shade(b.color,-24));
 polygon([corners[1],corners[2],{x:corners[2].x,y:corners[2].y-high},{x:corners[1].x,y:corners[1].y-high}],shade(b.color,-42));
 polygon(top,b.owned?'#75634b':shade(b.color,10),'#171d1c');
 // Repeating lit windows and dark shopfronts on both visible facades.
 for(let i=0;i<4;i++){
   const t=(i+1)/5;
   const x=corners[0].x+(corners[1].x-corners[0].x)*t;
   const y=corners[0].y+(corners[1].y-corners[0].y)*t-high*.62;
   ctx.fillStyle=(i+b.id.length)%3?'#d8b978':'#f3dca0';ctx.globalAlpha=.78;
   ctx.fillRect(x-5*z,y-8*z,9*z,13*z);ctx.globalAlpha=1;
   const x2=corners[1].x+(corners[2].x-corners[1].x)*t;
   const y2=corners[1].y+(corners[2].y-corners[1].y)*t-high*.62;
   ctx.fillStyle='#9eb8b4';ctx.fillRect(x2-4*z,y2-8*z,8*z,13*z);
 }
 const door=project(b.x+b.w*.52,b.y+b.h*.98);ctx.fillStyle='#171c1b';ctx.fillRect(door.x-6*z,door.y-29*z,12*z,29*z);
 ctx.fillStyle='#d8b46e';ctx.fillRect(door.x+3*z,door.y-16*z,2*z,2*z);
 // Business sign with warm/neon glow.
 const sign=project(b.x+b.w*.5,b.y+b.h*.05);
 ctx.save();ctx.shadowColor=b.id==='club'?'#d34baf':'#e7bd70';ctx.shadowBlur=12*z;
 ctx.fillStyle=b.id==='club'?'#c04b91':'#d5b66d';ctx.fillRect(sign.x-22*z,sign.y-high+13*z,44*z,12*z);ctx.restore();
 ctx.fillStyle='#1a2020';ctx.font='bold '+Math.max(6,7*z)+'px system-ui';ctx.textAlign='center';ctx.fillText(b.name.toUpperCase(),sign.x,sign.y-high+22*z,42*z);
 if(currentMission()?.target===b.id){ctx.strokeStyle='#f0c56c';ctx.lineWidth=2;ctx.setLineDash([4,5]);ctx.beginPath();ctx.arc(center.x,center.y-high-12*z,13*z+Math.sin(performance.now()/230)*3,0,7);ctx.stroke();ctx.setLineDash([])}
}
function shade(hex,amount){const n=parseInt(hex.slice(1),16);const r=clamp((n>>16)+amount,0,255),g=clamp(((n>>8)&255)+amount,0,255),b=clamp((n&255)+amount,0,255);return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1)}
function drawCar(car){
 const p=project(car.x,car.y),z=p.depth;
 ctx.save();ctx.translate(p.x,p.y);ctx.rotate(car.angle);
 // Ground shadow and four distinct wheels.
 ctx.fillStyle='#02040499';ctx.beginPath();ctx.ellipse(2*z,8*z,25*z,14*z,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#111516';
 for(const x of [-16,13])for(const y of [-10,7]){ctx.beginPath();ctx.roundRect(x*z,y*z,6*z,8*z,2*z);ctx.fill()}
 // Sculpted body, bumpers and bonnet.
 ctx.fillStyle=car.color;ctx.beginPath();ctx.moveTo(-23*z,-11*z);ctx.lineTo(-17*z,-16*z);ctx.lineTo(13*z,-16*z);ctx.lineTo(23*z,-9*z);ctx.lineTo(23*z,10*z);ctx.lineTo(15*z,14*z);ctx.lineTo(-18*z,13*z);ctx.lineTo(-23*z,7*z);ctx.closePath();ctx.fill();
 ctx.strokeStyle='#d8d0bd55';ctx.lineWidth=1*z;ctx.stroke();
 // Roof and windscreen.
 ctx.fillStyle='#25383d';ctx.beginPath();ctx.moveTo(-12*z,-12*z);ctx.lineTo(10*z,-12*z);ctx.lineTo(15*z,7*z);ctx.lineTo(-14*z,7*z);ctx.closePath();ctx.fill();
 ctx.fillStyle='#91aeb2';ctx.globalAlpha=.78;ctx.beginPath();ctx.moveTo(-10*z,-10*z);ctx.lineTo(8*z,-10*z);ctx.lineTo(11*z,-2*z);ctx.lineTo(-11*z,-2*z);ctx.closePath();ctx.fill();ctx.globalAlpha=1;
 ctx.fillStyle='#182225';ctx.fillRect(-2*z,-11*z,2*z,19*z);
 ctx.fillStyle='#f6dfaa';ctx.shadowColor='#ffe3a5';ctx.shadowBlur=10*z;ctx.fillRect(-20*z,-9*z,3*z,5*z);ctx.fillRect(-20*z,5*z,3*z,4*z);ctx.shadowBlur=0;
 ctx.fillStyle='#e85b48';ctx.fillRect(19*z,-8*z,3*z,5*z);ctx.fillRect(19*z,5*z,3*z,5*z);
 ctx.fillStyle='#d8d4c8';ctx.fillRect(-5*z,12*z,10*z,2*z);
 ctx.restore();
}
function drawHuman(entity,kind='civilian'){
 const p=project(entity.x,entity.y),z=p.depth,walking=entity===player?player.walk:performance.now()*.002+(entity.phase||0);
 const color=kind==='gang'?'#873f35':kind==='police'?'#354f70':kind==='crew'?'#637e56':entity.shirt||'#849187';
 ctx.fillStyle='#02040488';ctx.beginPath();ctx.ellipse(p.x,p.y+4*z,8*z,3*z,0,0,Math.PI*2);ctx.fill();
 // Legs animate independently; torso, shoulders and arms create a human silhouette.
 const stride=Math.sin(walking)*3*z;
 ctx.strokeStyle='#202323';ctx.lineWidth=3*z;ctx.lineCap='round';
 ctx.beginPath();ctx.moveTo(p.x-3*z,p.y-2*z);ctx.lineTo(p.x-4*z+stride,p.y+7*z);ctx.moveTo(p.x+3*z,p.y-2*z);ctx.lineTo(p.x+4*z-stride,p.y+7*z);ctx.stroke();
 ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(p.x-5*z,p.y-16*z);ctx.quadraticCurveTo(p.x,p.y-19*z,p.x+5*z,p.y-16*z);ctx.lineTo(p.x+6*z,p.y-2*z);ctx.quadraticCurveTo(p.x,p.y+1*z,p.x-6*z,p.y-2*z);ctx.closePath();ctx.fill();
 ctx.strokeStyle=shade(color,-25);ctx.lineWidth=2.5*z;ctx.beginPath();ctx.moveTo(p.x-5*z,p.y-14*z);ctx.lineTo(p.x-8*z,p.y-4*z+stride*.4);ctx.moveTo(p.x+5*z,p.y-14*z);ctx.lineTo(p.x+8*z,p.y-4*z-stride*.4);ctx.stroke();
 ctx.fillStyle='#b98263';ctx.beginPath();ctx.arc(p.x,p.y-21*z,5*z,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#242627';ctx.fillRect(p.x-3*z,p.y-22*z,2*z,1.5*z);ctx.fillRect(p.x+2*z,p.y-22*z,2*z,1.5*z);
 if(kind==='gang'||kind==='police'){ctx.fillStyle=kind==='gang'?'#d4a34e':'#b7c9d4';ctx.fillRect(p.x-7*z,p.y-29*z,14*z,3*z)}
 if(kind==='gang'){ctx.fillStyle='#f4d5a0';ctx.font=Math.max(7,9*z)+'px system-ui';ctx.textAlign='center';ctx.fillText(Math.ceil(entity.hp),p.x,p.y-33*z)}
 if(entity===player&&player.attack>0){ctx.strokeStyle='#f3cf83';ctx.lineWidth=3*z;ctx.beginPath();ctx.arc(p.x,p.y-8*z,25*z,-.9,.9);ctx.stroke()}
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
 for(const prop of world.cityProps||[])if(Math.abs(prop.x-camera.x)<1100&&Math.abs(prop.y-camera.y)<900)items.push({y:prop.y+prop.d,draw:()=>drawCityBuilding(prop)});
 for(const b of world.buildings)if(Math.abs(b.x-camera.x)<1000&&Math.abs(b.y-camera.y)<900)items.push({y:b.y+b.h,draw:()=>drawBuilding(b)});
 for(const c of world.cars)if(Math.abs(c.x-camera.x)<1000&&Math.abs(c.y-camera.y)<900)items.push({y:c.y,draw:()=>drawCar(c)});
 for(const p of world.civilians)if(Math.abs(p.x-camera.x)<900&&Math.abs(p.y-camera.y)<800)items.push({y:p.y,draw:()=>drawHuman(p)});
 for(const g of world.gangs)if(g.alive)items.push({y:g.y,draw:()=>drawHuman(g,'gang')});
 for(const cop of world.police)items.push({y:cop.y,draw:()=>drawHuman(cop,'police')});
 for(const mate of world.crew)items.push({y:mate.y,draw:()=>drawHuman(mate,'crew')});
 items.push({y:player.y,draw:()=>{if(player.inCar){const car=world.cars.find(c=>c.id===player.inCar);if(car)drawCar(car)}else drawHuman(player)}});
 items.sort((a,b)=>a.y-b.y);for(const item of items)item.draw();
 // Cinematic night grade and subtle edge falloff.
 const shade=ctx.createLinearGradient(0,0,0,height);shade.addColorStop(0,'#07101b28');shade.addColorStop(.55,'#11151a00');shade.addColorStop(1,'#080c0d48');ctx.fillStyle=shade;ctx.fillRect(0,0,width,height);
 const vignette=ctx.createRadialGradient(width/2,height*.48,Math.min(width,height)*.22,width/2,height*.48,Math.max(width,height)*.72);vignette.addColorStop(0,'#00000000');vignette.addColorStop(1,'#03060755');ctx.fillStyle=vignette;ctx.fillRect(0,0,width,height);
}
function drawCityBuilding(b){
 const c=[[b.x,b.y],[b.x+b.w,b.y],[b.x+b.w,b.y+b.d],[b.x,b.y+b.d]].map(([x,y])=>project(x,y));
 const z=project(b.x+b.w/2,b.y+b.d/2).depth,h=b.h*z;
 const roof=c.map(p=>({x:p.x,y:p.y-h}));
 polygon(c.map(p=>({x:p.x+10*z,y:p.y+7*z})),'#05070755');
 polygon([c[0],c[1],{x:c[1].x,y:c[1].y-h},{x:c[0].x,y:c[0].y-h}],shade(b.color,-20));
 polygon([c[1],c[2],{x:c[2].x,y:c[2].y-h},{x:c[1].x,y:c[1].y-h}],shade(b.color,-38));
 polygon(roof,shade(b.color,8),'#202626');
 for(let row=0;row<Math.max(2,Math.floor(b.h/38));row++)for(let col=0;col<3;col++){
   const t=(col+1)/4,yy=(row+1)/(Math.floor(b.h/38)+1);
   const x=c[0].x+(c[1].x-c[0].x)*t,y=c[0].y+(c[1].y-c[0].y)*t-h*yy;
   ctx.fillStyle=(Math.floor(b.seed*100+row*3+col)%4===0)?'#28383b':'#d9b978';ctx.globalAlpha=.82;ctx.fillRect(x-4*z,y-6*z,7*z,10*z);ctx.globalAlpha=1;
 }
 // Rooftop HVAC blocks and antennas break the repeated skyline.
 ctx.fillStyle='#242b2b';ctx.fillRect((roof[0].x+roof[2].x)/2-7*z,(roof[0].y+roof[2].y)/2-5*z,14*z,8*z);
 ctx.strokeStyle='#151b1b';ctx.lineWidth=1.5*z;ctx.beginPath();ctx.moveTo(roof[2].x,roof[2].y);ctx.lineTo(roof[2].x+2*z,roof[2].y-13*z);ctx.stroke();
}
function currentMission(){return MISSIONS[state.mission]||null}
function notify(message){const el=$('toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastClock);toastClock=setTimeout(()=>el.classList.remove('visible'),2300)}
function updateHud(){
 $('resources').innerHTML='💵 <b>$'+Math.floor(state.money)+'</b><br>❤️ '+Math.ceil(state.health)+' &nbsp; ⚡ '+Math.ceil(state.stamina)+'<br>⭐ '+state.rep+' &nbsp; 🔫 '+state.ammo+'<br>☠ '+state.wanted+' / 5';
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
