/* =====================================================================
   GRAND PARTY AUTO — SNEEK
   First-person open-world verjaardagsspel in de binnenstad van Sneek,
   gebouwd op de echte plattegrond van het centrum: de Kolk met de
   Waterpoort, Grootzand, Kleinzand, Marktstraat, Oosterdijk, Singel,
   Kruizebroederstraat, de stadsgracht rondom en de kades.
   Gemaakt met Three.js. De spellen/missies volgen later.
   ===================================================================== */
(function () {
"use strict";

// ---------------------------------------------------------------------
// Hulpjes
// ---------------------------------------------------------------------
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rng = mulberry32(8715);
function rnd(a,b){return a+rng()*(b-a);}
function pick(arr){return arr[Math.floor(rng()*arr.length)];}
function clamp(v,a,b){return v<a?a:(v>b?b:v);}
function dist2d(ax,az,bx,bz){const dx=ax-bx,dz=az-bz;return Math.sqrt(dx*dx+dz*dz);}
const $ = (id)=>document.getElementById(id);

function inPoly(x,z,poly){
  let binnen=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const xi=poly[i][0], zi=poly[i][1], xj=poly[j][0], zj=poly[j][1];
    if((zi>z)!==(zj>z) && x < (xj-xi)*(z-zi)/(zj-zi)+xi) binnen=!binnen;
  }
  return binnen;
}
function distSeg(px,pz,ax,az,bx,bz){
  const dx=bx-ax, dz=bz-az;
  const l2=dx*dx+dz*dz;
  let t=l2>0 ? ((px-ax)*dx+(pz-az)*dz)/l2 : 0;
  t=clamp(t,0,1);
  return dist2d(px,pz,ax+dx*t,az+dz*t);
}

// ---------------------------------------------------------------------
// Renderer / scene / camera
// ---------------------------------------------------------------------
const canvas   = $("game");
const renderer = new THREE.WebGLRenderer({canvas:canvas, antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xdfe6ee, 320, 1400);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth/window.innerHeight, 0.1, 2400);
camera.rotation.order = "YXZ";

window.addEventListener("resize", ()=>{
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Heldere Friese lucht
(function makeSky(){
  const geo = new THREE.SphereGeometry(1700, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite:false, fog:false,
    uniforms:{ top:{value:new THREE.Color(0x3f7fc9)}, mid:{value:new THREE.Color(0xa9c8e6)}, bot:{value:new THREE.Color(0xe9e2cf)} },
    vertexShader:"varying vec3 vP; void main(){vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader:
      "uniform vec3 top,mid,bot; varying vec3 vP;"+
      "void main(){float h=normalize(vP).y;"+
      "vec3 c = h>0.16 ? mix(mid,top,smoothstep(0.16,0.7,h)) : mix(bot,mid,smoothstep(-0.04,0.16,h));"+
      "gl_FragColor=vec4(c,1.0);}"
  });
  scene.add(new THREE.Mesh(geo, mat));
  const sun = new THREE.Mesh(new THREE.CircleGeometry(65,32),
    new THREE.MeshBasicMaterial({color:0xfff6da, fog:false}));
  sun.position.set(-800, 400, -1000); sun.lookAt(0,100,0);
  scene.add(sun);
  for(let i=0;i<12;i++){
    const wolk=new THREE.Mesh(new THREE.SphereGeometry(rnd(22,50),10,8),
      new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.85, fog:false}));
    wolk.scale.y=0.32;
    wolk.position.set(rnd(-1100,1100), rnd(200,340), rnd(-1100,1100));
    scene.add(wolk);
  }
})();

scene.add(new THREE.HemisphereLight(0xd4e4f4, 0x5a6455, 0.95));
const sunLight = new THREE.DirectionalLight(0xfff2d8, 1.1);
sunLight.position.set(-260, 340, -280);
scene.add(sunLight);
scene.add(new THREE.AmbientLight(0x8a8a98, 0.32));

// ---------------------------------------------------------------------
// Plattegrond van het centrum van Sneek (naar de echte kaart)
// x = oost, z = zuid (noorden = -z). Alles in meters.
// De Waterpoort/Kolk ligt zuidwestelijk; de gracht omsluit de binnenstad.
// ---------------------------------------------------------------------
const eiland = [
  [-5,10],[55,2],[125,6],[195,-12],[232,-55],[243,-125],[238,-195],
  [214,-255],[168,-295],[85,-312],[-5,-298],[-58,-268],[-73,-218],
  [-68,-150],[-52,-80],[-30,-28]
];
const CZ = {x:85, z:-150};   // zwaartepunt van de binnenstad
// buitenrand van de gracht; bij de Waterpoort is het water breed (de Kolk)
const buiten = eiland.map(p=>{
  const dx=p[0]-CZ.x, dz=p[1]-CZ.z;
  const len=Math.hypot(dx,dz)||1;
  const kolk = (p[0]<60 && p[1]>-40);
  const off = kolk ? 42 : 20;
  return [p[0]+dx/len*off, p[1]+dz/len*off];
});

// Het Kleinzand heeft nog water: kanaal richting de oostelijke stadsgracht
const kleinzandKanaal = {minX:146, maxX:226, minZ:-203, maxZ:-195};

// Straten (breedte in meters), volgens de echte kaart
const straten = [
  {naam:"Hoogend",             w:9,  pts:[[-1,2],[20,-12],[61,-32]]},
  {naam:"Grootzand",           w:15, pts:[[61,-32],[104,-117]]},
  {naam:"Wijde Burgstraat",    w:8,  pts:[[104,-117],[110,-150]]},
  {naam:"Nauwe Burgstraat",    w:6,  pts:[[112,-170],[124,-200]]},
  {naam:"Oosterdijk",          w:9,  pts:[[124,-200],[112,-259]]},
  {naam:"Kleinzand",           w:8,  pts:[[124,-200],[148,-199]]},
  {naam:"Kleinzand",           w:6,  pts:[[146,-207],[230,-207]]},
  {naam:"Kleinzand",           w:6,  pts:[[146,-191],[230,-191]]},
  {naam:"Gedempte Pol",        w:7,  pts:[[104,-200],[112,-256]]},
  {naam:"Kruizebroederstraat", w:8,  pts:[[-11,-241],[60,-252],[112,-259]]},
  {naam:"Marktstraat",         w:12, pts:[[-15,-215],[78,-224]]},
  {naam:"Grote Kerkstraat",    w:6,  pts:[[-15,-215],[-45,-205]]},
  {naam:"Kerksteeg",           w:5,  pts:[[-41,-228],[-11,-241]]},
  {naam:"Kerkgracht",          w:8,  pts:[[-46,-202],[-45,-117]]},
  {naam:"Oude Koemarkt",       w:8,  pts:[[10,-190],[2,-66]]},
  {naam:"Wip",                 w:6,  pts:[[10,-190],[5,-213]]},
  {naam:"Zuidend",             w:8,  pts:[[2,-66],[-8,-25],[-1,2]]},
  {naam:"Westersingel",        w:9,  pts:[[-45,-117],[-30,-55],[-8,-25]]},
  {naam:"Singel",              w:10, pts:[[121,-24],[133,-70],[150,-125],[157,-177],[150,-195]]},
  {naam:"Harinxmakade",        w:9,  pts:[[61,-32],[121,-24],[190,-20]]},
  {naam:"Bothniakade",         w:8,  pts:[[190,-20],[228,-120],[232,-186]]},
  {naam:"Leeuwenburg",         w:7,  pts:[[38,-218],[35,-120]]},
  {naam:"Suupmarkt",           w:6,  pts:[[35,-120],[96,-95]]},
  {naam:"Prins Hendrikkade",   w:9,  pts:[[-5,-286],[85,-300],[166,-284]]},
  {naam:"Oosterom",            w:7,  pts:[[112,-259],[118,-296]]},
  {naam:"Kleine Kerkstraat",   w:6,  pts:[[-11,-241],[-7,-284]]},
];
// straten op het vasteland
const stratenBuiten = [
  {naam:"Lemmerweg",       w:10, pts:[[17,52],[30,140]],        asfalt:true},
  {naam:"Geeuwkade",       w:8,  pts:[[-38,52],[-100,25]],      asfalt:true},
  {naam:"Oppenhuizerweg",  w:10, pts:[[268,-150],[350,-115]],   asfalt:true},
  {naam:"Leeuwarderweg",   w:10, pts:[[88,-347],[122,-430]],    asfalt:true},
  {naam:"Bolswarderweg",   w:10, pts:[[-88,-287],[-175,-325]],  asfalt:true},
];

// Pleinen
const pleinen = [
  {naam:"Schaapmarktplein", cx:108, cz:-160, hx:12, hz:9},
  {naam:"Oud Kerkhof",      cx:8,   cz:-252, hx:8,  hz:6},
];

// De terp van de Martinikerk
const terp = {x:-18, z:-172, r:24, h:1.6};

// Bruggen: a = eiland-kant, b = overkant
const bruggen = [
  {naam:"Waterpoort",       a:[-3,6],     b:[-3,52],    w:6, h:1.4, poort:true},
  {naam:"Hoogendbrug",      a:[13,2],     b:[17,52],    w:8, h:1.2},
  {naam:"Oosterpoortsbrug", a:[188,-14],  b:[214,14],   w:8, h:1.2},
  {naam:"Oppenhuizerbrug",  a:[238,-152], b:[268,-150], w:8, h:1.2},
  {naam:"Noorderbrug",      a:[85,-310],  b:[88,-347],  w:8, h:1.2},
  {naam:"Westerbrug",       a:[-58,-266], b:[-88,-287], w:7, h:1.2},
  {naam:"Kleinzandbrug",    a:[186,-206], b:[186,-192], w:5, h:0.8},
];

// ---------------------------------------------------------------------
// Begaanbaarheid & hoogte
// ---------------------------------------------------------------------
function inKanaal(x,z){
  return x>kleinzandKanaal.minX-0.6 && x<kleinzandKanaal.maxX+0.6 &&
         z>kleinzandKanaal.minZ-0.6 && z<kleinzandKanaal.maxZ+0.6;
}
function opBrug(x,z){
  for(const b of bruggen){
    if(distSeg(x,z,b.a[0],b.a[1],b.b[0],b.b[1]) < b.w/2) return b;
  }
  return null;
}
function opLand(x,z){
  if(inPoly(x,z,eiland)) return inKanaal(x,z) ? !!opBrug(x,z) : true;
  if(!inPoly(x,z,buiten)) return true;   // vasteland
  return !!opBrug(x,z);                  // gracht: alleen op een brug
}
function heightAt(x,z){
  let h=0;
  const dT=dist2d(x,z,terp.x,terp.z);
  if(dT<terp.r) h=Math.max(h, terp.h*0.5*(1+Math.cos(Math.PI*dT/terp.r)));
  const b=opBrug(x,z);
  if(b){
    const dx=b.b[0]-b.a[0], dz=b.b[1]-b.a[1];
    const l2=dx*dx+dz*dz;
    const t=clamp(((x-b.a[0])*dx+(z-b.a[1])*dz)/l2,0,1);
    h=Math.max(h, b.h*Math.sin(Math.PI*t));
  }
  return h;
}

// ---------------------------------------------------------------------
// Canvas-texturen
// ---------------------------------------------------------------------
function canvasTex(w,h,teken){
  const c=document.createElement("canvas"); c.width=w; c.height=h;
  teken(c.getContext("2d"),c);
  return new THREE.CanvasTexture(c);
}
function steentjesTex(kleurA,kleurB){
  return canvasTex(128,128,(g)=>{
    g.fillStyle=kleurA; g.fillRect(0,0,128,128);
    g.fillStyle=kleurB;
    for(let y=0;y<16;y++)for(let x=0;x<8;x++){
      g.fillRect(x*16+(y%2?8:0)+1, y*8+1, 14, 6);
    }
  });
}
const straatTex = steentjesTex("#6e4038","#7d4c42");
straatTex.wrapS=straatTex.wrapT=THREE.RepeatWrapping;
const pleinTex = steentjesTex("#767066","#878076");
pleinTex.wrapS=pleinTex.wrapT=THREE.RepeatWrapping;

// dakpannen in een paar tinten
function dakpanTex(basis,donker){
  const t=canvasTex(128,128,(g)=>{
    g.fillStyle=basis; g.fillRect(0,0,128,128);
    for(let y=0;y<8;y++){
      g.fillStyle=donker;
      g.fillRect(0,y*16+12,128,4);
      for(let x=0;x<8;x++){
        g.beginPath();
        g.arc(x*16+8+(y%2?8:0),y*16+12,7,Math.PI,0);
        g.strokeStyle=donker; g.lineWidth=2; g.stroke();
      }
    }
  });
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  return t;
}
const dakTexturen=[
  dakpanTex("#b4552e","#8a3f22"), dakpanTex("#a04828","#7a361e"),
  dakpanTex("#54463c","#3a302a"), dakpanTex("#8a4028","#68301e"),
];
function dakMateriaal(){
  const m=new THREE.MeshLambertMaterial({map:pick(dakTexturen).clone()});
  m.map.needsUpdate=true; m.map.repeat.set(2.5,1.6);
  return m;
}

// baksteentextuur voor grote gebouwen
function baksteenTex(kleurA,kleurB){
  const t=canvasTex(128,128,(g)=>{
    g.fillStyle=kleurA; g.fillRect(0,0,128,128);
    g.strokeStyle=kleurB; g.lineWidth=1.5;
    for(let y=0;y<128;y+=6){ g.beginPath(); g.moveTo(0,y); g.lineTo(128,y); g.stroke(); }
  });
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  return t;
}

const winkelnamen=["Bakkerij van der Meer","Slagerij Hoekstra","IJssalon Fardau","Kapsalon Knip & Klaar",
  "Boekhandel De Lezer","Fietsen Jelle","Café De Vrolijke Fries","Snackbar 't Zeiltje",
  "Bloemen Botke","Kaashuis Frisia","Modehuis Antje","Speelgoed De Ballon","Drogisterij Sikma",
  "Juwelier Zilverberg","Sportshop De Start","Chocolaterie Sjoerd","Eetcafé De Waterpoort",
  "Grand Café Onder de Toren","De Friese Wol","Vishandel Zeldenrust","Optiek Helder",
  "Restaurant De Kolk","Lunchroom Suupmarkt","Brouwerij Het Sneker Bier"];
let winkelIx=0;

// Gevel van een pand: baksteen of gepleisterd, met geveltop-silhouet (alpha)
function gevelTex(w,hLijf,gevelType,winkel){
  const S=36;
  const gevelH = gevelType==="plat"?0.5:2.6;
  const W=Math.round(w*S), H=Math.round((hLijf+gevelH)*S);
  const pleister = rng()<0.28;
  const muur = pleister
    ? pick(["#e8e2d2","#ded6c0","#d9d9d0","#e2d9c2","#cfc9b8"])
    : pick(["#8a4534","#9c5540","#6e3a2c","#a05a3a","#7a4030","#5a4a42","#93604a","#7d5240"]);
  const kozijn = pleister ? "#4a4a42" : "#f0ead8";
  const tex=canvasTex(W,H,(g)=>{
    g.clearRect(0,0,W,H);
    // silhouet
    g.beginPath();
    const lijfY=gevelH*S;
    if(gevelType==="trap"){
      const st=4, sw=(W/2)/st, sh=lijfY/st;
      g.moveTo(0,lijfY);
      for(let i=0;i<st;i++){ g.lineTo(i*sw, lijfY-i*sh); g.lineTo(i*sw, lijfY-(i+1)*sh); }
      g.lineTo(W/2, 0);
      for(let i=st-1;i>=0;i--){ g.lineTo(W-i*sw, lijfY-(i+1)*sh); g.lineTo(W-i*sw, lijfY-i*sh); }
    } else if(gevelType==="klok"){
      g.moveTo(0,lijfY);
      g.quadraticCurveTo(W*0.15, lijfY, W*0.28, lijfY*0.55);
      g.quadraticCurveTo(W*0.38, 0, W*0.5, 0);
      g.quadraticCurveTo(W*0.62, 0, W*0.72, lijfY*0.55);
      g.quadraticCurveTo(W*0.85, lijfY, W, lijfY);
    } else if(gevelType==="tuit"){
      g.moveTo(0,lijfY);
      g.lineTo(W*0.38,lijfY*0.25); g.lineTo(W*0.38,0); g.lineTo(W*0.62,0);
      g.lineTo(W*0.62,lijfY*0.25); g.lineTo(W,lijfY);
    } else {
      g.moveTo(0,0); g.lineTo(W,0);
    }
    g.lineTo(W,H); g.lineTo(0,H); g.closePath();
    g.fillStyle=muur; g.fill();
    g.save(); g.clip();
    if(!pleister){
      g.strokeStyle="rgba(0,0,0,0.13)"; g.lineWidth=1;
      for(let y=0;y<H;y+=7){ g.beginPath(); g.moveTo(0,y); g.lineTo(W,y); g.stroke(); }
    }
    // witte daklijst
    g.strokeStyle="#eee8d8"; g.lineWidth=5; g.stroke();
    if(gevelType==="plat"){
      g.fillStyle="#eee8d8"; g.fillRect(0,lijfY-3,W,7); // kroonlijst
    }
    // ramen per verdieping
    const verdiepingen=Math.max(1,Math.round(hLijf/3));
    const ramenPerVerd=Math.max(1,Math.round(w/2.4));
    const beganeGrondY=H-3.0*S;
    for(let v=1;v<verdiepingen;v++){
      const ry=H-(v+1)*3.0*S+0.55*S;
      if(ry<gevelH*S*0.4) continue;
      for(let r=0;r<ramenPerVerd;r++){
        const rx=(r+0.5)*(W/ramenPerVerd)-0.55*S;
        g.fillStyle=kozijn; g.fillRect(rx-3,ry-3,1.1*S+6,1.7*S+6);
        g.fillStyle="#28323f"; g.fillRect(rx,ry,1.1*S,1.7*S);
        g.strokeStyle=kozijn; g.lineWidth=2;
        g.beginPath(); g.moveTo(rx+0.55*S,ry); g.lineTo(rx+0.55*S,ry+1.7*S);
        g.moveTo(rx,ry+0.85*S); g.lineTo(rx+1.1*S,ry+0.85*S); g.stroke();
        // onderdorpel
        g.fillStyle="#c9c2b0"; g.fillRect(rx-4,ry+1.7*S+3,1.1*S+8,4);
      }
    }
    // topraampje
    g.fillStyle="#28323f"; g.fillRect(W/2-0.4*S, gevelH*S*0.35, 0.8*S, 1.0*S);
    g.strokeStyle=kozijn; g.lineWidth=3; g.strokeRect(W/2-0.4*S, gevelH*S*0.35, 0.8*S, 1.0*S);
    // begane grond
    if(winkel){
      const naam=winkelnamen[winkelIx++%winkelnamen.length];
      const puiKleur=pick(["#3d5a4a","#5a3d4a","#3d4a5a","#6b4a2a","#4a3d5a","#2e3a30","#503828"]);
      g.fillStyle=puiKleur; g.fillRect(4,beganeGrondY,W-8,3.0*S-4);
      g.fillStyle="#b8d2e4"; g.fillRect(10,beganeGrondY+1.0*S,W-20,1.55*S);
      // etalage-inhoud (silhouetjes)
      g.fillStyle="rgba(40,50,60,0.5)";
      for(let e=0;e<Math.round(w/1.6);e++){
        g.fillRect(16+e*1.6*S, beganeGrondY+1.7*S, 0.7*S, 0.8*S);
      }
      g.fillStyle="#f0ead8";
      g.font="bold "+Math.round(0.4*S)+"px Verdana";
      g.textAlign="center"; g.textBaseline="middle";
      g.fillText(naam, W/2, beganeGrondY+0.5*S, W-16);
      g.fillStyle="#241a12"; g.fillRect(W/2-0.5*S, H-2.1*S, 1.0*S, 2.1*S);
    }else{
      // voordeur met stoepje en raam
      g.fillStyle=kozijn; g.fillRect(W*0.62-3, H-2.3*S-3, 1.1*S+6, 2.3*S+3);
      g.fillStyle=pick(["#25401f","#402525","#252540","#1a1a1a","#5a4632"]);
      g.fillRect(W*0.62, H-2.3*S, 1.1*S, 2.3*S);
      g.fillStyle=kozijn; g.fillRect(W*0.15-3, H-2.2*S-3, 1.3*S+6, 1.7*S+6);
      g.fillStyle="#28323f"; g.fillRect(W*0.15, H-2.2*S, 1.3*S, 1.7*S);
      g.strokeStyle=kozijn; g.lineWidth=2;
      g.beginPath(); g.moveTo(W*0.15+0.65*S,H-2.2*S); g.lineTo(W*0.15+0.65*S,H-0.5*S); g.stroke();
      g.fillStyle="#9a948a"; g.fillRect(W*0.6-6, H-6, 1.3*S, 6); // stoepje
    }
    g.restore();
  });
  return {tex:tex, gevelH:gevelH, muur:muur};
}

function tekstBord(tekst, bg, fg, w, h, fontpx){
  const t=canvasTex(1024,256,(g)=>{
    g.fillStyle=bg; g.fillRect(0,0,1024,256);
    g.strokeStyle=fg; g.lineWidth=10; g.strokeRect(8,8,1008,240);
    g.fillStyle=fg; g.font="bold "+(fontpx||110)+"px Impact, Arial";
    g.textAlign="center"; g.textBaseline="middle";
    g.fillText(tekst, 512, 136, 990);
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w,h),
    new THREE.MeshBasicMaterial({map:t}));
}

// ---------------------------------------------------------------------
// Botsers (gedraaide rechthoeken) en bouwverbodszones
// ---------------------------------------------------------------------
const colliders=[];
function addCollider(cx,cz,hx,hz,rot){
  colliders.push({cx:cx,cz:cz,hx:hx,hz:hz,cos:Math.cos(rot||0),sin:Math.sin(rot||0)});
}
function botsCirkel(x,z,r){
  for(const c of colliders){
    const dx=x-c.cx, dz=z-c.cz;
    let lx= dx*c.cos+dz*c.sin;
    let lz=-dx*c.sin+dz*c.cos;
    const qx=clamp(lx,-c.hx,c.hx), qz=clamp(lz,-c.hz,c.hz);
    let ox=lx-qx, oz=lz-qz;
    const d2=ox*ox+oz*oz;
    if(d2<r*r){
      let px,pz;
      if(d2>1e-9){
        const d=Math.sqrt(d2);
        px=qx+ox/d*r; pz=qz+oz/d*r;
      }else{
        const kl=c.hx-Math.abs(lx), kd=c.hz-Math.abs(lz);
        if(kl<kd){ px=(lx>0?c.hx+r:-c.hx-r); pz=lz; }
        else     { px=lx; pz=(lz>0?c.hz+r:-c.hz-r); }
      }
      x=c.cx + px*c.cos - pz*c.sin;
      z=c.cz + px*c.sin + pz*c.cos;
    }
  }
  return [x,z];
}
const verboden=[];
function addVerbod(cx,cz,hx,hz,rot){
  verboden.push({cx:cx,cz:cz,hx:hx,hz:hz,cos:Math.cos(rot||0),sin:Math.sin(rot||0)});
}
function puntInVerbod(x,z){
  for(const c of verboden){
    const dx=x-c.cx, dz=z-c.cz;
    const lx= dx*c.cos+dz*c.sin, lz=-dx*c.sin+dz*c.cos;
    if(Math.abs(lx)<=c.hx && Math.abs(lz)<=c.hz) return true;
  }
  return false;
}

// ---------------------------------------------------------------------
// Water & land
// ---------------------------------------------------------------------
(function bouwLand(){
  const water=new THREE.Mesh(new THREE.PlaneGeometry(3200,3200),
    new THREE.MeshLambertMaterial({color:0x33606e}));
  water.rotation.x=-Math.PI/2; water.position.set(85,-0.55,-150);
  scene.add(water);

  const kadeZij=new THREE.MeshLambertMaterial({color:0x4a4038});
  const eilandTop=new THREE.MeshLambertMaterial({map:pleinTex});
  pleinTex.repeat.set(60,60);

  const shape=new THREE.Shape(eiland.map(p=>new THREE.Vector2(p[0],p[1])));
  const gat=new THREE.Path();
  gat.moveTo(kleinzandKanaal.minX,kleinzandKanaal.minZ);
  gat.lineTo(kleinzandKanaal.maxX,kleinzandKanaal.minZ);
  gat.lineTo(kleinzandKanaal.maxX,kleinzandKanaal.maxZ);
  gat.lineTo(kleinzandKanaal.minX,kleinzandKanaal.maxZ);
  gat.closePath();
  shape.holes.push(gat);
  const eilandGeo=new THREE.ExtrudeGeometry(shape,{depth:1.3,bevelEnabled:false});
  const eilandMesh=new THREE.Mesh(eilandGeo,[eilandTop,kadeZij]);
  eilandMesh.rotation.x=Math.PI/2;
  scene.add(eilandMesh);

  const buitenShape=new THREE.Shape([
    new THREE.Vector2(-1500,-1650),new THREE.Vector2(1700,-1650),
    new THREE.Vector2(1700,1350),new THREE.Vector2(-1500,1350)]);
  buitenShape.holes.push(new THREE.Path(buiten.map(p=>new THREE.Vector2(p[0],p[1]))));
  const grasTop=new THREE.MeshLambertMaterial({color:0x557a44});
  const buitenGeo=new THREE.ExtrudeGeometry(buitenShape,{depth:1.3,bevelEnabled:false});
  const buitenMesh=new THREE.Mesh(buitenGeo,[grasTop,kadeZij]);
  buitenMesh.rotation.x=Math.PI/2;
  scene.add(buitenMesh);
})();

// ---------------------------------------------------------------------
// Straten, pleinen en bruggen
// ---------------------------------------------------------------------
function legStraat(st, y){
  for(let i=0;i<st.pts.length-1;i++){
    const a=st.pts[i], b=st.pts[i+1];
    const len=dist2d(a[0],a[1],b[0],b[1]);
    const hoek=Math.atan2(b[0]-a[0],b[1]-a[1]);
    let mat;
    if(st.asfalt){
      mat=new THREE.MeshLambertMaterial({color:0x4a4650});
    }else{
      mat=new THREE.MeshLambertMaterial({map:straatTex.clone()});
      mat.map.needsUpdate=true;
      mat.map.repeat.set(st.w/4, len/4);
    }
    const m=new THREE.Mesh(new THREE.PlaneGeometry(st.w,len+st.w*0.9),mat);
    m.rotation.set(0,hoek,0); m.rotateX(-Math.PI/2);
    m.position.set((a[0]+b[0])/2, y, (a[1]+b[1])/2);
    scene.add(m);
    addVerbod((a[0]+b[0])/2,(a[1]+b[1])/2, st.w/2, len/2+st.w/2, -hoek);
  }
}
straten.forEach(st=>legStraat(st,0.045));
stratenBuiten.forEach(st=>legStraat(st,0.05));

pleinen.forEach(p=>{
  const mat=new THREE.MeshLambertMaterial({map:pleinTex.clone()});
  mat.map.needsUpdate=true; mat.map.repeat.set(p.hx/2,p.hz/2);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(p.hx*2,p.hz*2),mat);
  m.rotation.x=-Math.PI/2; m.position.set(p.cx,0.05,p.cz);
  scene.add(m);
  addVerbod(p.cx,p.cz,p.hx+1,p.hz+1,0);
});

// terp
(function(){
  const m=new THREE.Mesh(new THREE.ConeGeometry(terp.r,terp.h*1.05,28,1,true),
    new THREE.MeshLambertMaterial({color:0x557a3f}));
  m.position.set(terp.x,terp.h*1.05/2-0.02,terp.z);
  scene.add(m);
  addVerbod(terp.x,terp.z,terp.r,terp.r,0);
})();

// bruggen
bruggen.forEach(b=>{
  const len=dist2d(b.a[0],b.a[1],b.b[0],b.b[1]);
  const hoek=Math.atan2(b.b[0]-b.a[0],b.b[1]-b.a[1]);
  const cx=(b.a[0]+b.b[0])/2, cz=(b.a[1]+b.b[1])/2;
  const dek=new THREE.Mesh(new THREE.BoxGeometry(b.w,0.5,len+2),
    new THREE.MeshLambertMaterial({color:0x6e6258}));
  dek.position.set(cx, b.h*0.62, cz);
  dek.rotation.y=hoek;
  scene.add(dek);
  [-1,1].forEach(s=>{
    const leun=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.65,len-0.5),
      new THREE.MeshLambertMaterial({color:0xbfb9a8}));
    leun.position.set(cx+Math.cos(hoek)*s*(b.w/2-0.2), b.h*0.62+0.55, cz-Math.sin(hoek)*s*(b.w/2-0.2));
    leun.rotation.y=hoek;
    scene.add(leun);
  });
  addVerbod(cx,cz,b.w/2+2,len/2+3,-hoek);
});

// vlaggetjeslijnen (gezellige winkelstraat-sfeer)
function vlaggenlijn(x1,z1,x2,z2){
  const midX=(x1+x2)/2, midZ=(z1+z2)/2;
  const len=dist2d(x1,z1,x2,z2);
  const hoek=Math.atan2(x2-x1,z2-z1);
  const t=canvasTex(512,64,(g)=>{
    g.clearRect(0,0,512,64);
    g.strokeStyle="#555"; g.lineWidth=3;
    g.beginPath(); g.moveTo(0,4); g.lineTo(512,4); g.stroke();
    const kleuren=["#e0484f","#f0c040","#4f8ad9","#59c96b","#e08acd","#f0f0f0"];
    for(let i=0;i<16;i++){
      g.fillStyle=kleuren[i%kleuren.length];
      g.beginPath();
      g.moveTo(i*32+2,6); g.lineTo(i*32+30,6); g.lineTo(i*32+16,56);
      g.closePath(); g.fill();
    }
  });
  const doek=new THREE.Mesh(new THREE.PlaneGeometry(len,1.4),
    new THREE.MeshBasicMaterial({map:t,transparent:true,side:THREE.DoubleSide,alphaTest:0.3}));
  doek.position.set(midX,4.6,midZ);
  doek.rotation.y=hoek+Math.PI/2;
  scene.add(doek);
}
// over het Grootzand, de Oosterdijk en de Wijde Burgstraat
vlaggenlijn(66,-53,82,-45); vlaggenlijn(80,-83,96,-75); vlaggenlijn(94,-110,109,-103);
vlaggenlijn(116,-220,131,-215); vlaggenlijn(110,-240,125,-236);
vlaggenlijn(99,-130,116,-127);

// ---------------------------------------------------------------------
// Landmarks
// ---------------------------------------------------------------------
const bakstWP=baksteenTex("#7d4434","#5f332a");
const bakstMat=new THREE.MeshLambertMaterial({map:bakstWP});
const donkerLei=new THREE.MeshLambertMaterial({color:0x2e3138});
const witMat=new THREE.MeshLambertMaterial({color:0xe8e2d0});

// --- DE WATERPOORT (over de gracht, naar de echte foto) ---
(function maakWaterpoort(){
  const wp=new THREE.Group();
  const bx=-3, bz=29;   // midden van de poortbrug
  [-4.4,4.4].forEach(sx=>{
    const toren=new THREE.Mesh(new THREE.CylinderGeometry(1.9,2.15,12,8),bakstMat);
    toren.position.set(bx+sx,6,bz); wp.add(toren);
    // twee witte natuursteenbanden zoals bij de echte poort
    [4.2,8.2].forEach(by=>{
      const band=new THREE.Mesh(new THREE.CylinderGeometry(2.0,2.0,0.35,8),witMat);
      band.position.set(bx+sx,by,bz); wp.add(band);
    });
    const rand=new THREE.Mesh(new THREE.CylinderGeometry(2.25,2.0,0.5,8),witMat);
    rand.position.set(bx+sx,12.1,bz); wp.add(rand);
    const spits=new THREE.Mesh(new THREE.ConeGeometry(2.15,7.8,8),donkerLei);
    spits.position.set(bx+sx,16.2,bz); wp.add(spits);
    const bol=new THREE.Mesh(new THREE.SphereGeometry(0.24,8,8),
      new THREE.MeshBasicMaterial({color:0xf0c040}));
    bol.position.set(bx+sx,20.3,bz); wp.add(bol);
    // windvaantje
    const vaan=new THREE.Mesh(new THREE.PlaneGeometry(0.5,0.3),
      new THREE.MeshBasicMaterial({color:0xf0c040,side:THREE.DoubleSide}));
    vaan.position.set(bx+sx+0.3,20.5,bz); wp.add(vaan);
    addCollider(bx+sx,bz,2.3,2.3,0);
  });
  // poortwachterswoning boven de doorgang
  const huis=new THREE.Mesh(new THREE.BoxGeometry(7.0,3.6,5.0),bakstMat);
  huis.position.set(bx,6.6,bz); wp.add(huis);
  const raamT=canvasTex(256,96,(g)=>{
    g.fillStyle="#7d4434"; g.fillRect(0,0,256,96);
    g.strokeStyle="rgba(0,0,0,0.15)";
    for(let y=0;y<96;y+=7){g.beginPath();g.moveTo(0,y);g.lineTo(256,y);g.stroke();}
    [24,104,184].forEach(x=>{
      g.fillStyle="#f0ead8"; g.fillRect(x-4,16,56,64);
      g.fillStyle="#28323f"; g.fillRect(x,20,48,56);
      g.strokeStyle="#f0ead8"; g.lineWidth=4;
      g.beginPath(); g.moveTo(x+24,20); g.lineTo(x+24,76); g.moveTo(x,48); g.lineTo(x+48,48); g.stroke();
    });
  });
  [-1,1].forEach(s=>{
    const vlak=new THREE.Mesh(new THREE.PlaneGeometry(6.8,3.4),
      new THREE.MeshLambertMaterial({map:raamT}));
    vlak.position.set(bx,6.6,bz+s*2.52); vlak.rotation.y=s>0?0:Math.PI;
    wp.add(vlak);
  });
  // zadeldak + trapgevels aan beide kanten
  const dakShape=new THREE.Shape([new THREE.Vector2(-3.5,0),new THREE.Vector2(3.5,0),new THREE.Vector2(0,2.4)]);
  const dak=new THREE.Mesh(new THREE.ExtrudeGeometry(dakShape,{depth:4.6,bevelEnabled:false}),donkerLei);
  dak.rotation.y=Math.PI/2;
  dak.position.set(bx+2.3,8.4,bz);
  dak.rotation.set(0,Math.PI/2,0);
  wp.add(dak);
  [-1,1].forEach(s=>{
    for(let i=0;i<4;i++){
      const trap=new THREE.Mesh(new THREE.BoxGeometry(6.4-i*1.7,0.5,0.4),bakstMat);
      trap.position.set(bx, 8.4+i*0.5, bz+s*2.4);
      wp.add(trap);
    }
  });
  // middenpijler met boogvormen (dubbele doorvaart)
  const pijler=new THREE.Mesh(new THREE.BoxGeometry(1.3,4.6,5.2),bakstMat);
  pijler.position.set(bx,1.7,bz); wp.add(pijler);
  addCollider(bx,bz,0.75,2.7,0);
  const boogT=canvasTex(256,128,(g)=>{
    g.fillStyle="#7d4434"; g.fillRect(0,0,256,128);
    g.fillStyle="#26313d";
    [10,134].forEach(x=>{
      g.beginPath();
      g.moveTo(x,128); g.lineTo(x,60);
      g.quadraticCurveTo(x+28,10,x+56,10);
      g.quadraticCurveTo(x+84,10,x+112,60);
      g.lineTo(x+112,128); g.closePath(); g.fill();
    });
    g.strokeStyle="#e8e2d0"; g.lineWidth=5;
    [10,134].forEach(x=>{
      g.beginPath(); g.moveTo(x,128); g.lineTo(x,60);
      g.quadraticCurveTo(x+28,10,x+56,10);
      g.quadraticCurveTo(x+84,10,x+112,60);
      g.lineTo(x+112,128); g.stroke();
    });
  });
  [-1,1].forEach(s=>{
    const boog=new THREE.Mesh(new THREE.PlaneGeometry(10.5,4.6),
      new THREE.MeshLambertMaterial({map:boogT,transparent:true}));
    boog.position.set(bx,2.3,bz+s*2.72); boog.rotation.y=s>0?0:Math.PI;
    wp.add(boog);
  });
  scene.add(wp);
  addVerbod(bx,bz,10,7,0);
})();

// --- MARTINIKERK op de terp ---
(function maakMartinikerk(){
  const k=new THREE.Group();
  const kx=terp.x, kz=terp.z, y0=terp.h;
  const rot=0.35;
  k.position.set(kx,y0,kz); k.rotation.y=rot;
  const schip=new THREE.Mesh(new THREE.BoxGeometry(14,10,28),bakstMat);
  schip.position.set(0,5,2); k.add(schip);
  const raamKerk=canvasTex(512,256,(g)=>{
    g.fillStyle="#7d4434"; g.fillRect(0,0,512,256);
    g.strokeStyle="rgba(0,0,0,0.15)";
    for(let y=0;y<256;y+=8){g.beginPath();g.moveTo(0,y);g.lineTo(512,y);g.stroke();}
    for(let i=0;i<6;i++){
      const x=30+i*80;
      g.fillStyle="#2a3548";
      g.beginPath();
      g.moveTo(x,220); g.lineTo(x,120);
      g.quadraticCurveTo(x+20,70,x+40,70);
      g.quadraticCurveTo(x+60,70,x+80,120);
      g.lineTo(x+80,220); g.closePath(); g.fill();
      g.strokeStyle="#d8d2c0"; g.lineWidth=5; g.stroke();
      // glas-in-lood suggestie
      g.strokeStyle="rgba(216,210,192,0.5)"; g.lineWidth=2;
      g.beginPath(); g.moveTo(x+40,70); g.lineTo(x+40,220);
      g.moveTo(x,150); g.lineTo(x+80,150); g.stroke();
    }
  });
  [-1,1].forEach(s=>{
    const vlak=new THREE.Mesh(new THREE.PlaneGeometry(27,9.6),
      new THREE.MeshLambertMaterial({map:raamKerk}));
    vlak.position.set(s*7.05,5.2,2); vlak.rotation.y=s>0?Math.PI/2:-Math.PI/2;
    k.add(vlak);
  });
  for(let i=0;i<5;i++){
    [-1,1].forEach(s=>{
      const sb=new THREE.Mesh(new THREE.BoxGeometry(1,7,1.4),bakstMat);
      sb.position.set(s*7.4,3.5,-10+i*6); k.add(sb);
    });
  }
  const dakShape=new THREE.Shape([new THREE.Vector2(-7.5,0),new THREE.Vector2(7.5,0),new THREE.Vector2(0,5.5)]);
  const dakMatKerk=new THREE.MeshLambertMaterial({map:dakTexturen[2].clone()});
  dakMatKerk.map.needsUpdate=true; dakMatKerk.map.repeat.set(6,3);
  const dak=new THREE.Mesh(new THREE.ExtrudeGeometry(dakShape,{depth:28,bevelEnabled:false}),dakMatKerk);
  dak.position.set(0,10,-12); k.add(dak);
  // dakruiter
  const ruiter=new THREE.Mesh(new THREE.BoxGeometry(1.6,2.2,1.6),witMat);
  ruiter.position.set(0,15.5,-2); k.add(ruiter);
  const ruiterSpits=new THREE.Mesh(new THREE.ConeGeometry(1.3,2.6,8),donkerLei);
  ruiterSpits.position.set(0,17.9,-2); k.add(ruiterSpits);
  // koor
  const koor=new THREE.Mesh(new THREE.CylinderGeometry(6,6,8,8,1),bakstMat);
  koor.position.set(0,4,19); k.add(koor);
  const koorDak=new THREE.Mesh(new THREE.ConeGeometry(6.3,4,8),donkerLei);
  koorDak.position.set(0,10,19); k.add(koorDak);
  // toren
  const toren=new THREE.Mesh(new THREE.BoxGeometry(7,19,7),bakstMat);
  toren.position.set(0,9.5,-15.5); k.add(toren);
  const klokT=canvasTex(256,256,(g)=>{
    g.fillStyle="#7d4434"; g.fillRect(0,0,256,256);
    g.strokeStyle="rgba(0,0,0,0.15)";
    for(let y=0;y<256;y+=7){g.beginPath();g.moveTo(0,y);g.lineTo(256,y);g.stroke();}
    g.fillStyle="#20242c"; g.fillRect(88,30,80,110);
    g.strokeStyle="#d8d2c0"; g.lineWidth=6; g.strokeRect(88,30,80,110);
    g.strokeStyle="#d8d2c0"; g.lineWidth=3;
    for(let y=45;y<135;y+=14){ g.beginPath(); g.moveTo(90,y); g.lineTo(166,y); g.stroke(); }
    g.fillStyle="#f0ead8"; g.beginPath(); g.arc(128,195,38,0,7); g.fill();
    g.strokeStyle="#222"; g.lineWidth=5;
    g.beginPath(); g.moveTo(128,195); g.lineTo(128,168); g.moveTo(128,195); g.lineTo(148,195); g.stroke();
  });
  [[0,-3.52,Math.PI],[0,3.52,0],[-3.52,0,-Math.PI/2],[3.52,0,Math.PI/2]].forEach(p=>{
    const vlak=new THREE.Mesh(new THREE.PlaneGeometry(6.8,9.5),
      new THREE.MeshLambertMaterial({map:klokT}));
    vlak.position.set(p[0],12.5,-15.5+p[1]); vlak.rotation.y=p[2];
    k.add(vlak);
  });
  const torenSpits=new THREE.Mesh(new THREE.ConeGeometry(5.2,8.5,8),donkerLei);
  torenSpits.position.set(0,23.2,-15.5); k.add(torenSpits);
  const haan=new THREE.Mesh(new THREE.SphereGeometry(0.28,8,8),
    new THREE.MeshBasicMaterial({color:0xf0c040}));
  haan.position.set(0,27.7,-15.5); k.add(haan);
  scene.add(k);
  addCollider(kx+Math.sin(rot)*2,kz+Math.cos(rot)*2,8,15,-rot);
  addCollider(kx+Math.sin(rot)*-15.5,kz+Math.cos(rot)*-15.5,4.2,4.2,-rot);
  addCollider(kx+Math.sin(rot)*19,kz+Math.cos(rot)*19,6.4,6.4,-rot);
})();

// --- SINT-MARTINUSKERK (RK, neogotisch) aan de oostkant ---
(function maakMartinus(){
  const g=new THREE.Group();
  g.position.set(176,0,-64); g.rotation.y=-Math.PI/2;
  const schip=new THREE.Mesh(new THREE.BoxGeometry(10,9,22),bakstMat);
  schip.position.set(0,4.5,0); g.add(schip);
  const dakShape=new THREE.Shape([new THREE.Vector2(-5.5,0),new THREE.Vector2(5.5,0),new THREE.Vector2(0,5)]);
  const dak=new THREE.Mesh(new THREE.ExtrudeGeometry(dakShape,{depth:22,bevelEnabled:false}),donkerLei);
  dak.position.set(0,9,-11); g.add(dak);
  const ruiter=new THREE.Mesh(new THREE.BoxGeometry(1.4,3,1.4),donkerLei);
  ruiter.position.set(0,15,-4); g.add(ruiter);
  const spits=new THREE.Mesh(new THREE.ConeGeometry(1.4,5,8),donkerLei);
  spits.position.set(0,19,-4); g.add(spits);
  // topgevels
  [-1,1].forEach(s=>{
    const punt=new THREE.Mesh(new THREE.ConeGeometry(4.2,4.5,4),bakstMat);
    punt.rotation.y=Math.PI/4; punt.scale.set(1.7,1,0.15);
    punt.position.set(0,11,s*11); g.add(punt);
  });
  scene.add(g);
  addCollider(176,-64,11.5,5.5,Math.PI/2);
  addVerbod(176,-64,14,8,Math.PI/2);
})();

// --- STADHUIS aan de Marktstraat (rococo, naar de webcamfoto's) ---
(function maakStadhuis(){
  const sx=30, sz=-232;
  const g=new THREE.Group();
  g.position.set(sx,0,sz);
  const romp=new THREE.Mesh(new THREE.BoxGeometry(16,9,11),
    new THREE.MeshLambertMaterial({color:0xd8cfae}));
  romp.position.set(0,4.5,-5.5); g.add(romp);
  const gevelT=canvasTex(1024,640,(gg)=>{
    gg.fillStyle="#ddd4b4"; gg.fillRect(0,0,1024,640);
    gg.textAlign="center";
    for(let r=0;r<5;r++){
      const x=110+r*180;
      [[120,150],[330,140]].forEach(v=>{
        gg.fillStyle="#2a3548"; gg.fillRect(x,v[0],90,v[1]);
        gg.strokeStyle="#f4eede"; gg.lineWidth=8; gg.strokeRect(x,v[0],90,v[1]);
        gg.strokeStyle="#b09c60"; gg.lineWidth=4;
        gg.beginPath(); gg.arc(x+45,v[0],52,Math.PI,0); gg.stroke();
        // roedes
        gg.strokeStyle="#f4eede"; gg.lineWidth=3;
        gg.beginPath(); gg.moveTo(x+45,v[0]); gg.lineTo(x+45,v[0]+v[1]);
        gg.moveTo(x,v[0]+v[1]/2); gg.lineTo(x+90,v[0]+v[1]/2); gg.stroke();
      });
    }
    gg.fillStyle="#c9b878"; gg.fillRect(432,60,160,60);
    gg.fillStyle="#8a6a20"; gg.font="bold 44px Georgia";
    gg.fillText("ANNO 1550",512,100);
    gg.fillStyle="#3a2a18"; gg.fillRect(452,470,120,170);
    gg.strokeStyle="#f4eede"; gg.lineWidth=10; gg.strokeRect(452,470,120,170);
    gg.strokeStyle="#b09c60"; gg.lineWidth=6;
    gg.beginPath(); gg.arc(430,80,26,0.5,4.5); gg.stroke();
    gg.beginPath(); gg.arc(594,80,26,5,2.5); gg.stroke();
  });
  const gevel=new THREE.Mesh(new THREE.PlaneGeometry(15.8,9),
    new THREE.MeshLambertMaterial({map:gevelT}));
  gevel.position.set(0,4.5,0.06); g.add(gevel);
  const dak=new THREE.Mesh(new THREE.CylinderGeometry(0.6,6.4,3.4,4,1),
    new THREE.MeshLambertMaterial({color:0x5f3428}));
  dak.rotation.y=Math.PI/4; dak.scale.set(1.9,1,1.0);
  dak.position.set(0,10.7,-6.0); g.add(dak);
  const trap=new THREE.Mesh(new THREE.BoxGeometry(6,1.1,2.6),witMat);
  trap.position.set(0,0.55,1.6); g.add(trap);
  const trapje1=new THREE.Mesh(new THREE.BoxGeometry(2.2,0.5,3.2),witMat);
  trapje1.position.set(-4,0.25,1.8); g.add(trapje1);
  const trapje2=trapje1.clone(); trapje2.position.x=4; g.add(trapje2);
  [-2.8,2.8].forEach(x=>{
    const bal=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.8,2.4),witMat);
    bal.position.set(x,1.5,1.6); g.add(bal);
  });
  const stok=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,5),witMat);
  stok.rotation.z=-0.5; stok.position.set(0,10.5,0.4); g.add(stok);
  const vlagT=canvasTex(128,86,(gg)=>{
    gg.fillStyle="#ae1c28"; gg.fillRect(0,0,128,29);
    gg.fillStyle="#ffffff"; gg.fillRect(0,29,128,29);
    gg.fillStyle="#21468b"; gg.fillRect(0,58,128,28);
  });
  const vlag=new THREE.Mesh(new THREE.PlaneGeometry(2.2,1.4),
    new THREE.MeshBasicMaterial({map:vlagT,side:THREE.DoubleSide}));
  vlag.position.set(1.4,12.2,-0.8); g.add(vlag);
  scene.add(g);
  addCollider(sx,sz-5.5,8.3,5.8,0);
  addCollider(sx,sz+1.6,3.4,1.6,0);
  addVerbod(sx,sz-4,11,10,0);
  const bord=tekstBord("STADHUIS","#1c2340","#f0d060",6,1.1,120);
  bord.position.set(sx,9.4,sz+0.12); scene.add(bord);
})();

// --- FRIES SCHEEPVAART MUSEUM aan het Kleinzand ---
(function maakMuseum(){
  const mx=200, mz=-216;
  const g=new THREE.Group(); g.position.set(mx,0,mz);
  const romp=new THREE.Mesh(new THREE.BoxGeometry(18,8,9),
    new THREE.MeshLambertMaterial({color:0x7a4030}));
  romp.position.set(0,4,-4.5); g.add(romp);
  const dak=new THREE.Mesh(new THREE.CylinderGeometry(0.4,5.2,3,4,1),donkerLei);
  dak.rotation.y=Math.PI/4; dak.scale.set(2.2,1,1.0);
  dak.position.set(0,9.4,-4.8); g.add(dak);
  const gevelT=canvasTex(1024,470,(gg)=>{
    gg.fillStyle="#7a4030"; gg.fillRect(0,0,1024,470);
    gg.strokeStyle="rgba(0,0,0,0.15)";
    for(let y=0;y<470;y+=10){gg.beginPath();gg.moveTo(0,y);gg.lineTo(1024,y);gg.stroke();}
    for(let r=0;r<6;r++){
      const x=60+r*160;
      gg.fillStyle="#2a3548"; gg.fillRect(x,90,80,120);
      gg.strokeStyle="#e8e2d0"; gg.lineWidth=7; gg.strokeRect(x,90,80,120);
    }
    gg.fillStyle="#254a68"; gg.fillRect(380,300,264,170);
    gg.strokeStyle="#e8e2d0"; gg.lineWidth=8; gg.strokeRect(380,300,264,170);
    gg.strokeStyle="#f0d060"; gg.lineWidth=6;
    gg.beginPath(); gg.moveTo(460,290); gg.quadraticCurveTo(512,320,564,290); gg.stroke();
    gg.beginPath(); gg.moveTo(512,290); gg.lineTo(512,240); gg.lineTo(552,265); gg.closePath(); gg.stroke();
  });
  const gevel=new THREE.Mesh(new THREE.PlaneGeometry(17.8,8),
    new THREE.MeshLambertMaterial({map:gevelT}));
  gevel.position.set(0,4,0.06); g.add(gevel);
  scene.add(g);
  addCollider(mx,mz-4.5,9.2,4.8,0);
  addVerbod(mx,mz-3,11,8,0);
  const bord=tekstBord("FRIES SCHEEPVAART MUSEUM","#1c3040","#e8e2d0",12,1.3,72);
  bord.position.set(mx,8.6,mz+0.12); scene.add(bord);
})();

// --- THEATER SNEEK op het vasteland (westkant) ---
(function maakTheater(){
  const tx=-118, tz=-30;
  const romp=new THREE.Mesh(new THREE.BoxGeometry(30,12,20),
    new THREE.MeshLambertMaterial({color:0x3a3d44}));
  romp.position.set(tx,6,tz); scene.add(romp);
  const glas=new THREE.Mesh(new THREE.BoxGeometry(18,8,2),
    new THREE.MeshLambertMaterial({color:0x6a90a8}));
  glas.position.set(tx+4,4,tz+10.5); scene.add(glas);
  addCollider(tx,tz,15.3,10.3,0);
  addCollider(tx+4,tz+10.5,9.2,1.2,0);
  const bord=tekstBord("THEATER SNEEK","#14161c","#40c9e6",14,2,110);
  bord.position.set(tx,10.5,tz+10.15); scene.add(bord);
})();

// --- Parkeerterrein P-zuid Waterpoort (spawnplek) ---
const parkeerAuto=[]; // vulling volgt zodra de automaker bestaat
(function maakParkeerterrein(){
  const px=-34, pz=86;
  const vlak=new THREE.Mesh(new THREE.PlaneGeometry(46,26),
    new THREE.MeshLambertMaterial({color:0x4a4650}));
  vlak.rotation.x=-Math.PI/2; vlak.position.set(px,0.04,pz);
  scene.add(vlak);
  // witte vakken
  const streepMat=new THREE.MeshBasicMaterial({color:0xd8d8d8});
  for(let i=0;i<8;i++){
    const s=new THREE.Mesh(new THREE.PlaneGeometry(0.25,5),streepMat);
    s.rotation.x=-Math.PI/2; s.position.set(px-17+i*4.9,0.06,pz-6);
    scene.add(s);
  }
  const bord=tekstBord("P  ZUID — WATERPOORT","#1a3a6a","#ffffff",8,1.2,90);
  bord.position.set(px+5,2.4,pz-13); scene.add(bord);
  const paal=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,2.4),witMat);
  paal.position.set(px+5,1.2,pz-12.9); scene.add(paal);
})();

// ---------------------------------------------------------------------
// Gevelrijen: pandjes langs de straten
// ---------------------------------------------------------------------
const winkelstraten=new Set(["Oosterdijk","Wijde Burgstraat","Nauwe Burgstraat","Grootzand",
  "Kruizebroederstraat","Oude Koemarkt","Marktstraat","Suupmarkt","Wip","Gedempte Pol"]);
const huizen=[];

function maakPandje(cx,cz,rot,w,d,winkel,dorps){
  const gr=new THREE.Group();
  gr.position.set(cx,0,cz); gr.rotation.y=rot;

  if(dorps){
    // gewoon woonhuis: nok evenwijdig aan de straat, oranje pannen
    const hLijf=rnd(4.5,6);
    const muur=pick([0x9a5a42,0x8a4534,0xa06a4a,0xddd6c0,0x7a4030]);
    const zijMat=new THREE.MeshLambertMaterial({color:muur});
    const romp=new THREE.Mesh(new THREE.BoxGeometry(w,hLijf,d),zijMat);
    romp.position.set(0,hLijf/2,-d/2+0.15); gr.add(romp);
    // raampjes-vlak aan de straatkant
    const gevelT=canvasTex(256,128,(g)=>{
      g.fillStyle="#"+new THREE.Color(muur).getHexString(); g.fillRect(0,0,256,128);
      g.fillStyle="#f0ead8"; g.fillRect(28,30,60,60); g.fillRect(168,30,60,60);
      g.fillStyle="#28323f"; g.fillRect(32,34,52,52); g.fillRect(172,34,52,52);
      g.fillStyle="#3a2a20"; g.fillRect(118,50,36,78);
    });
    const vlak=new THREE.Mesh(new THREE.PlaneGeometry(w-0.2,hLijf-0.2),
      new THREE.MeshLambertMaterial({map:gevelT}));
    vlak.position.set(0,hLijf/2,0.17); gr.add(vlak);
    const dakShape=new THREE.Shape([new THREE.Vector2(-d/2-0.4,0),new THREE.Vector2(d/2+0.4,0),new THREE.Vector2(0,rnd(2.4,3.2))]);
    const dak=new THREE.Mesh(new THREE.ExtrudeGeometry(dakShape,{depth:w,bevelEnabled:false}),dakMateriaal());
    dak.rotation.y=Math.PI/2;
    dak.position.set(-w/2,hLijf,-d/2+0.15);
    gr.add(dak);
    const schoorsteen=new THREE.Mesh(new THREE.BoxGeometry(0.5,1.1,0.5),zijMat);
    schoorsteen.position.set(w*0.3,hLijf+2.2,-d/2); gr.add(schoorsteen);
    scene.add(gr);
    addCollider(cx,cz,w/2,d/2+0.2,-rot);
    return {cx:cx,cz:cz,w:w,d:d};
  }

  // stadspand met geveltop
  const hLijf=pick([6,6,9,9,9,12]);
  const type=pick(["trap","trap","klok","tuit","plat"]);
  const gevel=gevelTex(w,hLijf,type,winkel);
  const zijMat=new THREE.MeshLambertMaterial({color:new THREE.Color(gevel.muur).multiplyScalar(0.82)});
  const romp=new THREE.Mesh(new THREE.BoxGeometry(w,hLijf,d),zijMat);
  romp.position.set(0,hLijf/2,-d/2+0.15); gr.add(romp);

  const gevelMat=new THREE.MeshLambertMaterial({map:gevel.tex,transparent:true,alphaTest:0.4});
  const totH=hLijf+gevel.gevelH;
  const vlak=new THREE.Mesh(new THREE.BoxGeometry(w,totH,0.3),
    [zijMat,zijMat,zijMat,zijMat,gevelMat,zijMat]);
  vlak.position.set(0,totH/2,0.15); gr.add(vlak);

  // dak: nok haaks op de straat, met pannen
  const dakShape=new THREE.Shape([new THREE.Vector2(-w/2,0),new THREE.Vector2(w/2,0),new THREE.Vector2(0,gevel.gevelH)]);
  const dak=new THREE.Mesh(new THREE.ExtrudeGeometry(dakShape,{depth:d-0.4,bevelEnabled:false}),dakMateriaal());
  dak.position.set(0,hLijf,0); dak.rotation.y=Math.PI;
  gr.add(dak);

  // dakkapel op het zijdak bij hogere panden
  if(gevel.gevelH>1 && rng()<0.45){
    const kap=new THREE.Mesh(new THREE.BoxGeometry(1.3,1.0,1.0),witMat);
    const kant=rng()<0.5?1:-1;
    kap.position.set(kant*w*0.25,hLijf+gevel.gevelH*0.35,-d*0.45);
    gr.add(kap);
  }
  // schoorsteen
  if(rng()<0.6){
    const schoorsteen=new THREE.Mesh(new THREE.BoxGeometry(0.5,1.0,0.5),zijMat);
    schoorsteen.position.set(0,hLijf+gevel.gevelH+0.3,-d*0.6);
    gr.add(schoorsteen);
  }
  // luifel of markies bij winkels
  if(winkel && rng()<0.7){
    const luif=new THREE.Mesh(new THREE.BoxGeometry(w*0.9,0.12,1.3),
      new THREE.MeshLambertMaterial({color:pick([0xc94f4f,0x3f7a5a,0x4f6ac9,0xc9a03f,0x8a3a5a])}));
    luif.position.set(0,3.1,0.85); luif.rotation.x=0.25; gr.add(luif);
  }
  scene.add(gr);
  addCollider(cx,cz,w/2,d/2+0.2,-rot);
  return {cx:cx,cz:cz,w:w,d:d};
}

function bouwGevelrijen(lijst,dorps){
  lijst.forEach(st=>{
    if(st.geenHuizen) return;
    for(let i=0;i<st.pts.length-1;i++){
      const a=st.pts[i], b=st.pts[i+1];
      const len=dist2d(a[0],a[1],b[0],b[1]);
      const dirX=(b[0]-a[0])/len, dirZ=(b[1]-a[1])/len;
      [-1,1].forEach(kant=>{
        const nx=-dirZ*kant, nz=dirX*kant;
        let s=3;
        while(s<len-3){
          const w=dorps?rnd(6.5,9):rnd(5.5,8.5);
          if(s+w>len-1.5) break;
          const midS=s+w/2;
          const diepte=rnd(7,9.5);
          const off=st.w/2+1.1+diepte/2;
          const cx=a[0]+dirX*midS+nx*off;
          const cz=a[1]+dirZ*midS+nz*off;
          const rot=Math.atan2(-nx,-nz);
          let ok=true;
          const hx=w/2+0.5, hz=diepte/2+0.5;
          for(const p of [[0,0],[hx,hz],[-hx,hz],[hx,-hz],[-hx,-hz],[0,hz],[0,-hz]]){
            const wx=cx+p[0]*Math.cos(rot)+p[1]*Math.sin(rot);
            const wz=cz-p[0]*Math.sin(rot)+p[1]*Math.cos(rot);
            const opEiland=inPoly(wx,wz,eiland)&&!inKanaal(wx,wz);
            const opVasteland=!inPoly(wx,wz,buiten);
            if(dorps ? !opVasteland : !opEiland){ok=false;break;}
            if(puntInVerbod(wx,wz)){ok=false;break;}
          }
          if(ok){
            for(const h of huizen){
              const dd=dist2d(cx,cz,h.cx,h.cz);
              if(dd<(w+h.w)/2+1 && dd<(diepte+h.d)/2+1){ok=false;break;}
            }
          }
          if(ok){
            huizen.push(maakPandje(cx,cz,rot,w,diepte,!dorps&&winkelstraten.has(st.naam),dorps));
            s+=w+rnd(0.2,1.0);
          }else{
            s+=2.5;
          }
        }
      });
    }
  });
}
bouwGevelrijen(straten,false);
bouwGevelrijen(stratenBuiten,true);

// binnenterreinen vullen: tuinen met bomen en schuurtjes
const boomPos=[];
(function vulBinnenterreinen(){
  let geplaatst=0, pogingen=0;
  while(geplaatst<90 && pogingen<3000){
    pogingen++;
    const x=rnd(-70,240), z=rnd(-310,5);
    if(!inPoly(x,z,eiland)||inKanaal(x,z)||puntInVerbod(x,z)) continue;
    let vrij=true;
    for(const c of colliders){
      const dx=x-c.cx, dz=z-c.cz;
      const lx=dx*c.cos+dz*c.sin, lz=-dx*c.sin+dz*c.cos;
      if(Math.abs(lx)<c.hx+2.5&&Math.abs(lz)<c.hz+2.5){vrij=false;break;}
    }
    if(!vrij) continue;
    if(rng()<0.75){ boomPos.push([x,z]); }
    else{
      const schuur=new THREE.Mesh(new THREE.BoxGeometry(3,2.2,2.4),
        new THREE.MeshLambertMaterial({color:pick([0x5a4632,0x4a5242,0x54463c])}));
      schuur.position.set(x,1.1,z); schuur.rotation.y=rnd(0,3.14);
      scene.add(schuur);
      addCollider(x,z,1.6,1.3,-schuur.rotation.y);
    }
    geplaatst++;
  }
})();

// ---------------------------------------------------------------------
// Aankleding: bomen, lantaarns, terrassen, fietsen, boten
// ---------------------------------------------------------------------
pleinen.forEach(p=>{ for(let i=0;i<3;i++) boomPos.push([p.cx+rnd(-p.hx+2,p.hx-2), p.cz+rnd(-p.hz+2,p.hz-2)]); });
for(let i=0;i<8;i++){
  const hoek=rnd(0,Math.PI*2), r=rnd(terp.r*0.6,terp.r*0.92);
  boomPos.push([terp.x+Math.cos(hoek)*r, terp.z+Math.sin(hoek)*r]);
}
// kade-bomen langs de gracht (zoals op de luchtfoto)
for(let i=0;i<eiland.length;i++){
  const p=eiland[i];
  const dx=p[0]-CZ.x, dz=p[1]-CZ.z, l=Math.hypot(dx,dz)||1;
  const bx=p[0]-dx/l*6, bz=p[1]-dz/l*6;
  if(opLand(bx,bz)&&!puntInVerbod(bx,bz)) boomPos.push([bx,bz]);
}
// vasteland-bomen
for(let i=0;i<180;i++){
  const x=rnd(-380,500), z=rnd(-560,300);
  if(!opLand(x,z)||inPoly(x,z,eiland)||puntInVerbod(x,z)) continue;
  let vrij=true;
  for(const c of colliders){
    if(Math.abs(x-c.cx)<c.hx+3&&Math.abs(z-c.cz)<c.hz+3){vrij=false;break;}
  }
  if(vrij) boomPos.push([x,z]);
}
(function plaatsBomen(){
  const stamGeo=new THREE.CylinderGeometry(0.28,0.4,2.4);
  const stamMat=new THREE.MeshLambertMaterial({color:0x5a3d2a});
  const kroonGeo=new THREE.SphereGeometry(2.3,9,7);
  const kroonMat=new THREE.MeshLambertMaterial({color:0x3f7a35});
  const kroonMat2=new THREE.MeshLambertMaterial({color:0x5a8a3a});
  const stam=new THREE.InstancedMesh(stamGeo,stamMat,boomPos.length);
  const helft=Math.ceil(boomPos.length/2);
  const kroonA=new THREE.InstancedMesh(kroonGeo,kroonMat,helft);
  const kroonB=new THREE.InstancedMesh(kroonGeo,kroonMat2,boomPos.length-helft);
  const m=new THREE.Matrix4();
  boomPos.forEach((bp,i)=>{
    const y=heightAt(bp[0],bp[1]);
    m.makeTranslation(bp[0],y+1.2,bp[1]); stam.setMatrixAt(i,m);
    const sc=rnd(0.8,1.4);
    m.makeScale(sc,sc*rnd(0.9,1.2),sc).setPosition(bp[0],y+3.6,bp[1]);
    if(i<helft) kroonA.setMatrixAt(i,m); else kroonB.setMatrixAt(i-helft,m);
  });
  scene.add(stam); scene.add(kroonA); scene.add(kroonB);
})();

// lantaarns
(function lantaarns(){
  const posL=[];
  straten.concat(stratenBuiten).forEach(st=>{
    for(let i=0;i<st.pts.length-1;i++){
      const a=st.pts[i],b=st.pts[i+1];
      const len=dist2d(a[0],a[1],b[0],b[1]);
      const dirX=(b[0]-a[0])/len, dirZ=(b[1]-a[1])/len;
      for(let s=10;s<len-4;s+=22){
        const kant=(Math.floor(s/22)%2)?1:-1;
        const x=a[0]+dirX*s -dirZ*kant*(st.w/2+0.6);
        const z=a[1]+dirZ*s +dirX*kant*(st.w/2+0.6);
        if(opLand(x,z)) posL.push([x,z]);
      }
    }
  });
  const paalGeo=new THREE.CylinderGeometry(0.09,0.13,4.6);
  const paalMat=new THREE.MeshLambertMaterial({color:0x1e3328});
  const bolGeo=new THREE.SphereGeometry(0.26,8,8);
  const bolMat=new THREE.MeshBasicMaterial({color:0xfff0c0});
  const paal=new THREE.InstancedMesh(paalGeo,paalMat,posL.length);
  const bol=new THREE.InstancedMesh(bolGeo,bolMat,posL.length);
  const m=new THREE.Matrix4();
  posL.forEach((p,i)=>{
    const y=heightAt(p[0],p[1]);
    m.makeTranslation(p[0],y+2.3,p[1]); paal.setMatrixAt(i,m);
    m.makeTranslation(p[0],y+4.7,p[1]); bol.setMatrixAt(i,m);
  });
  scene.add(paal); scene.add(bol);
})();

// zittende mensen worden hieronder bij de NPC-code gemaakt;
// eerst de terrassen zelf (Marktstraat + Schaapmarktplein, zoals op de webcam)
const zitplekken=[];
(function terrassen(){
  const spots=[
    // Marktstraat: terrasjes aan beide kanten
    [8,-211],[20,-212],[44,-214],[58,-215],[14,-224],[34,-226],[52,-227],
    // Schaapmarktplein
    [102,-156],[112,-164],[108,-152],
    // Oud Kerkhof en Grootzand
    [6,-249],[78,-62],[86,-80],
  ];
  spots.forEach(sp=>{
    if(!opLand(sp[0],sp[1])) return;
    const y=heightAt(sp[0],sp[1]);
    const voet=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,2.5),witMat);
    voet.position.set(sp[0],y+1.25,sp[1]); scene.add(voet);
    const doek=new THREE.Mesh(new THREE.ConeGeometry(2.1,0.9,8),
      new THREE.MeshLambertMaterial({color:pick([0xd9d3c4,0xd9d3c4,0x3f6a4a,0x8a3a3a])}));
    doek.position.set(sp[0],y+2.6,sp[1]); scene.add(doek);
    const tafel=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.55,0.07,10),
      new THREE.MeshLambertMaterial({color:0x6a5a48}));
    tafel.position.set(sp[0],y+0.75,sp[1]); scene.add(tafel);
    const tafelpoot=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.75),donkerLei);
    tafelpoot.position.set(sp[0],y+0.37,sp[1]); scene.add(tafelpoot);
    const nStoel=2+Math.floor(rng()*3);
    for(let i=0;i<nStoel;i++){
      const hoek=rnd(0,6.28);
      const sx=sp[0]+Math.cos(hoek)*1.1, sz=sp[1]+Math.sin(hoek)*1.1;
      const stoel=new THREE.Mesh(new THREE.BoxGeometry(0.45,0.45,0.45),
        new THREE.MeshLambertMaterial({color:0x5a4a38}));
      stoel.position.set(sx,y+0.23,sz); scene.add(stoel);
      if(rng()<0.6) zitplekken.push([sx,y+0.45,sz,Math.atan2(sp[0]-sx,sp[1]-sz)]);
    }
  });
})();

// fietsen (het is tenslotte Nederland)
function maakFiets(x,z,rot){
  const gr=new THREE.Group();
  const frameMat=new THREE.MeshLambertMaterial({color:pick([0x1a1a1a,0x333a44,0x5a2a2a,0x2a4a3a])});
  const wielGeo=new THREE.TorusGeometry(0.32,0.03,6,14);
  [-0.55,0.55].forEach(o=>{
    const wiel=new THREE.Mesh(wielGeo,frameMat);
    wiel.rotation.y=Math.PI/2;
    wiel.position.set(0,0.32,o); gr.add(wiel);
  });
  const buis=new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,1.1),frameMat);
  buis.rotation.x=Math.PI/2.6; buis.position.set(0,0.55,0); gr.add(buis);
  const stuur=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.4),frameMat);
  stuur.rotation.z=Math.PI/2; stuur.position.set(0,0.95,0.5); gr.add(stuur);
  const zadel=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.06,0.26),donkerLei);
  zadel.position.set(0,0.92,-0.35); gr.add(zadel);
  gr.position.set(x,heightAt(x,z),z); gr.rotation.y=rot;
  scene.add(gr);
}
[[66,-40],[68,-42],[70,-44],[110,-152],[112,-154],[0,-220],[2,-222],
 [150,-197],[152,-198],[124,-206],[24,-247],[26,-248],[-40,-210],[90,-292]].forEach((f,i)=>{
  maakFiets(f[0],f[1],rnd(0,6.28));
});

// bootjes: langs de gracht, in de Kolk, in het Kleinzand
const boten=[];
function maakBoot(x,z,rot,zeil){
  const gr=new THREE.Group();
  const romp=new THREE.Mesh(new THREE.CylinderGeometry(0.9,0.55,5.6,7,1),
    new THREE.MeshLambertMaterial({color:pick([0xffffff,0x2a3548,0x6e3a2c,0x3f5a7a,0xe8e2d0])}));
  romp.rotation.set(Math.PI/2,0,Math.PI/2);
  romp.scale.set(1,1,0.42);
  gr.add(romp);
  const rand=new THREE.Mesh(new THREE.BoxGeometry(1.6,0.25,5.4),
    new THREE.MeshLambertMaterial({color:0x8a6a45}));
  rand.position.y=0.35; gr.add(rand);
  if(zeil){
    const mast=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.08,7),
      new THREE.MeshLambertMaterial({color:0x8a6a45}));
    mast.position.set(0,3.6,0.4); gr.add(mast);
    const zeilShape=new THREE.Shape([new THREE.Vector2(0,0),new THREE.Vector2(2.6,0),new THREE.Vector2(0,5.4)]);
    const zeilM=new THREE.Mesh(new THREE.ShapeGeometry(zeilShape),
      new THREE.MeshLambertMaterial({color:pick([0xf7f2e0,0xf7f2e0,0x8a3a2a]),side:THREE.DoubleSide}));
    zeilM.position.set(0,0.6,0.5); zeilM.rotation.y=0.35;
    gr.add(zeilM);
  }
  gr.position.set(x,-0.35,z); gr.rotation.y=rot;
  scene.add(gr);
  boten.push(gr);
  return gr;
}
// afgemeerd langs de gracht
for(let i=0;i<eiland.length;i+=2){
  const p=eiland[i];
  const dx=p[0]-CZ.x, dz=p[1]-CZ.z, len=Math.hypot(dx,dz)||1;
  const kolk=(p[0]<60&&p[1]>-40);
  const off=kolk?24:10;
  maakBoot(p[0]+dx/len*off, p[1]+dz/len*off, rnd(0,6.28), false);
}
// zeilboten in de Kolk (Sneekweek!)
maakBoot(-30,60,0.6,true); maakBoot(-42,44,-0.9,true); maakBoot(-16,74,2.2,true);
// Kleinzand
maakBoot(160,-199,Math.PI/2,false); maakBoot(172,-199,Math.PI/2,false);
maakBoot(206,-199,Math.PI/2,false); maakBoot(218,-199,Math.PI/2,false);

// twee rondvarende bootjes in de stadsgracht
const vaarboten=[];
(function(){
  const pad=[];
  for(let i=0;i<eiland.length;i++){
    const p=eiland[i];
    const dx=p[0]-CZ.x, dz=p[1]-CZ.z, l=Math.hypot(dx,dz)||1;
    const kolk=(p[0]<60&&p[1]>-40);
    pad.push([p[0]+dx/l*(kolk?20:10), p[1]+dz/l*(kolk?20:10)]);
  }
  let totaal=0;
  const lengtes=[];
  for(let i=0;i<pad.length;i++){
    const q=pad[(i+1)%pad.length];
    const l=dist2d(pad[i][0],pad[i][1],q[0],q[1]);
    lengtes.push(l); totaal+=l;
  }
  [0,0.5].forEach(startT=>{
    const boot=maakBoot(pad[0][0],pad[0][1],0,false);
    vaarboten.push({mesh:boot,pad:pad,lengtes:lengtes,totaal:totaal,afst:startT*totaal,snelheid:2.2});
  });
})();
function updateVaarboten(dt){
  vaarboten.forEach(v=>{
    v.afst=(v.afst+v.snelheid*dt)%v.totaal;
    let rest=v.afst, i=0;
    while(rest>v.lengtes[i]){rest-=v.lengtes[i];i=(i+1)%v.pad.length;}
    const a=v.pad[i], b=v.pad[(i+1)%v.pad.length];
    const t=rest/v.lengtes[i];
    const x=a[0]+(b[0]-a[0])*t, z=a[1]+(b[1]-a[1])*t;
    v.mesh.rotation.y=Math.atan2(b[0]-a[0],b[1]-a[1]);
    v.mesh.position.x=x; v.mesh.position.z=z;
  });
}

// spandoek over het Grootzand (naam van de jarige komt er bij de start op)
const spandoekMats=[];
(function maakSpandoek(){
  const a=[74,-78], b=[90,-70];
  const midX=(a[0]+b[0])/2, midZ=(a[1]+b[1])/2;
  const hoek=Math.atan2(b[0]-a[0],b[1]-a[1]);
  [a,b].forEach(p=>{
    const paal=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.14,7),
      new THREE.MeshLambertMaterial({color:0x30281e}));
    paal.position.set(p[0],3.5,p[1]); scene.add(paal);
  });
  [0,Math.PI].forEach(draai=>{
    const doek=tekstBord("🎉 HOERA! 🎉","#c9285a","#ffe97a",14,2.2,110);
    doek.position.set(midX,5.4,midZ);
    doek.rotation.y=hoek+Math.PI/2+draai;
    scene.add(doek);
    spandoekMats.push(doek.material);
  });
})();

// welkomstbord bij de parkeerplaats
(function(){
  const bord=tekstBord("WELKOM IN SNEEK","#123a5a","#ffffff",10,1.8,110);
  bord.position.set(10,2.2,62);
  scene.add(bord);
  const paal=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,2.4),witMat);
  paal.position.set(10,1.1,62.1); scene.add(paal);
})();

// onzichtbare wereldranden
addCollider(85,-700,700,10,0); addCollider(85,400,700,10,0);
addCollider(-500,-150,10,700,0); addCollider(660,-150,10,700,0);

// ---------------------------------------------------------------------
// Auto's — realistischer: carrosserie, ruiten, gele kentekens
// ---------------------------------------------------------------------
const autoKleuren=[0x22252a,0xc9cbd0,0xf2f3f5,0x8a1f24,0x1f3a6e,0x2e4a35,0x6b6f76,0x8a6adf,0xb84a10];
function maakAutoMesh(kleur, opties){
  opties=opties||{};
  const gr=new THREE.Group();
  const politieAuto=opties.politie;
  const type=opties.type||pick(["sedan","sedan","hatch","hatch","van"]);
  const bodyMat=new THREE.MeshLambertMaterial({color:politieAuto?0xf2f2f8:kleur});
  const glasMat=new THREE.MeshLambertMaterial({color:0x18222e});
  const zwart=new THREE.MeshLambertMaterial({color:0x14141a});

  if(type==="van"){
    const body=new THREE.Mesh(new THREE.BoxGeometry(2.0,1.0,5.0),bodyMat);
    body.position.y=0.85; gr.add(body);
    const cab=new THREE.Mesh(new THREE.BoxGeometry(1.96,0.85,4.94),glasMat);
    cab.position.set(0,1.65,0); cab.scale.set(0.99,1,0.55); gr.add(cab);
    const dakje=new THREE.Mesh(new THREE.BoxGeometry(2.0,0.5,5.0),bodyMat);
    dakje.position.set(0,1.85,-0.6); dakje.scale.set(1,1,0.74); gr.add(dakje);
  }else{
    const body=new THREE.Mesh(new THREE.BoxGeometry(1.85,0.62,4.3),bodyMat);
    body.position.y=0.62; gr.add(body);
    // glaspartij
    const glas=new THREE.Mesh(new THREE.BoxGeometry(1.7,0.55,type==="hatch"?2.4:2.1),glasMat);
    glas.position.set(0,1.18,type==="hatch"?-0.55:-0.25); gr.add(glas);
    // dak
    const dakje=new THREE.Mesh(new THREE.BoxGeometry(1.74,0.1,type==="hatch"?2.2:1.9),bodyMat);
    dakje.position.set(0,1.48,type==="hatch"?-0.55:-0.25); gr.add(dakje);
    // motorkap-lijn
    const kap=new THREE.Mesh(new THREE.BoxGeometry(1.85,0.1,1.2),bodyMat);
    kap.position.set(0,0.95,1.6); gr.add(kap);
  }
  // wielen
  const wielGeo=new THREE.CylinderGeometry(0.34,0.34,0.26,12);
  [[-0.95,1.35],[0.95,1.35],[-0.95,-1.35],[0.95,-1.35]].forEach(w=>{
    const wl=new THREE.Mesh(wielGeo,zwart);
    wl.rotation.z=Math.PI/2; wl.position.set(w[0],0.34,w[1]); gr.add(wl);
  });
  // verlichting + kentekens
  const kop=new THREE.Mesh(new THREE.BoxGeometry(1.5,0.14,0.06),
    new THREE.MeshBasicMaterial({color:0xfff2c9}));
  kop.position.set(0,0.72,type==="van"?2.52:2.16); gr.add(kop);
  const achter=new THREE.Mesh(new THREE.BoxGeometry(1.5,0.12,0.06),
    new THREE.MeshBasicMaterial({color:0xc92222}));
  achter.position.set(0,0.72,type==="van"?-2.52:-2.16); gr.add(achter);
  const plaatMat=new THREE.MeshBasicMaterial({color:0xf0c020});
  [ [0,0.5,(type==="van"?2.53:2.17)], [0,0.5,-(type==="van"?2.53:2.17)] ].forEach(p=>{
    const plaat=new THREE.Mesh(new THREE.BoxGeometry(0.46,0.11,0.05),plaatMat);
    plaat.position.set(p[0],p[1],p[2]); gr.add(plaat);
  });
  if(politieAuto){
    const streep=new THREE.Mesh(new THREE.BoxGeometry(1.87,0.26,4.32),
      new THREE.MeshLambertMaterial({color:0xdd6a10}));
    streep.position.y=0.62; streep.scale.z=0.999; gr.add(streep);
    const zw=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.22,0.4),
      new THREE.MeshBasicMaterial({color:0x2255ff}));
    zw.position.set(0,1.62,-0.25); gr.add(zw);
    gr.userData.zwaailicht=zw;
  }
  return gr;
}

// rondrijdend verkeer: waypoint-lus over de echte straten (Singel-route)
const verkeersLus=[
  [1,-2],[20,-12],[61,-32],[121,-24],[190,-20],[228,-120],[232,-186],
  [230,-207],[146,-207],[104,-200],[112,-256],[60,-252],[-11,-241],
  [-46,-202],[-45,-117],[-30,-55],[-8,-25]
];
const lusAutos=[];
(function(){
  let totaal=0; const lengtes=[];
  for(let i=0;i<verkeersLus.length;i++){
    const q=verkeersLus[(i+1)%verkeersLus.length];
    const l=dist2d(verkeersLus[i][0],verkeersLus[i][1],q[0],q[1]);
    lengtes.push(l); totaal+=l;
  }
  for(let k=0;k<8;k++){
    const a={mesh:maakAutoMesh(pick(autoKleuren)),afst:k/8*totaal,snelheid:rnd(6,9),
      basis:0,lengtes:lengtes,totaal:totaal,x:0,z:0};
    a.basis=a.snelheid;
    scene.add(a.mesh);
    lusAutos.push(a);
  }
})();
function updateLusAutos(dt){
  lusAutos.forEach(a=>{
    // afremmen voor de speler
    const px=speler.x, pz=speler.z;
    const remmen=dist2d(a.x,a.z,px,pz)<9;
    const doel=remmen?0:a.basis;
    a.snelheid+=(doel-a.snelheid)*clamp(dt*3,0,1);
    a.afst=(a.afst+a.snelheid*dt)%a.totaal;
    let rest=a.afst, i=0;
    while(rest>a.lengtes[i]){rest-=a.lengtes[i];i=(i+1)%verkeersLus.length;}
    const p=verkeersLus[i], q=verkeersLus[(i+1)%verkeersLus.length];
    const t=rest/a.lengtes[i];
    const dirX=(q[0]-p[0])/a.lengtes[i], dirZ=(q[1]-p[1])/a.lengtes[i];
    // rechts rijden: iets naar rechts van de rijrichting
    a.x=p[0]+(q[0]-p[0])*t - dirZ*-1.8;
    a.z=p[1]+(q[1]-p[1])*t + dirX*-1.8;
    a.mesh.position.set(a.x,heightAt(a.x,a.z),a.z);
    a.mesh.rotation.y=Math.atan2(dirX,dirZ);
  });
}
// pendelende auto's op de uitvalswegen
const pendel=[];
stratenBuiten.forEach(st=>{
  const a=st.pts[0], b=st.pts[st.pts.length-1];
  for(let k=0;k<2;k++){
    const auto={mesh:maakAutoMesh(pick(autoKleuren)),a:a,b:b,t:rng(),richting:k?1:-1,snelheid:rnd(8,11),x:0,z:0};
    scene.add(auto.mesh);
    pendel.push(auto);
  }
});
function updatePendel(dt){
  pendel.forEach(p=>{
    const len=dist2d(p.a[0],p.a[1],p.b[0],p.b[1]);
    p.t+=p.richting*p.snelheid*dt/len;
    if(p.t>1){p.t=1;p.richting=-1;}
    if(p.t<0){p.t=0;p.richting=1;}
    const dirX=(p.b[0]-p.a[0])/len, dirZ=(p.b[1]-p.a[1])/len;
    p.x=p.a[0]+(p.b[0]-p.a[0])*p.t - dirZ*-1.7*p.richting;
    p.z=p.a[1]+(p.b[1]-p.a[1])*p.t + dirX*-1.7*p.richting;
    p.mesh.position.set(p.x,heightAt(p.x,p.z),p.z);
    p.mesh.rotation.y=Math.atan2(dirX*p.richting,dirZ*p.richting);
  });
}

// geparkeerde auto's (instappen met E)
const geparkeerd=[];
(function spawnGeparkeerd(){
  const plekken=[
    // parkeerterrein P-zuid
    [-51,84,0],[-46,84,0],[-41,84,0],[-31,84,0],[-26,84,0],[-16,84,0],
    // in de stad
    [6,-30,0.5],[-2,-52,0.3],[128,-40,2.6],[140,-90,2.9],[152,-160,3.0],
    [-40,-160,0.05],[-40,-130,0.05],[90,-294,1.75],[8,-278,0.1],[214,-100,2.7],
    [30,120,0.2],[24,100,0.2],
  ];
  plekken.forEach(p=>{
    if(!opLand(p[0],p[1])) return;
    const auto={mesh:maakAutoMesh(pick(autoKleuren)), x:p[0], z:p[1], heading:p[2]};
    auto.mesh.position.set(auto.x,heightAt(auto.x,auto.z),auto.z);
    auto.mesh.rotation.y=auto.heading;
    scene.add(auto.mesh); geparkeerd.push(auto);
  });
})();

// ---------------------------------------------------------------------
// Mensen — met benen, armen en een wandelanimatie
// ---------------------------------------------------------------------
const huidskleuren=[0xf2c9a0,0xc98a5a,0x8a5a3d,0xf2d9c0,0xa06a42];
const kledingkleuren=[0x3a4a5a,0x8a2a2a,0x2a5a3a,0x4a3a6a,0xd9d3c4,0x2a2a30,0xc9a03f,0x5a7a9a,0xe08acd,0xf0d040];
const broekkleuren=[0x2a3040,0x3a3a3a,0x4a4238,0x30404a,0x5a5a62];
function maakMensMesh(){
  const gr=new THREE.Group();
  const huid=pick(huidskleuren);
  const trui=new THREE.MeshLambertMaterial({color:pick(kledingkleuren)});
  const broek=new THREE.MeshLambertMaterial({color:pick(broekkleuren)});
  const been1=new THREE.Mesh(new THREE.BoxGeometry(0.15,0.55,0.17),broek);
  been1.geometry.translate(0,-0.27,0);
  been1.position.set(-0.1,0.82,0); gr.add(been1);
  const been2=been1.clone(); been2.position.x=0.1; gr.add(been2);
  const torso=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.58,0.24),trui);
  torso.position.y=1.12; gr.add(torso);
  const arm1=new THREE.Mesh(new THREE.BoxGeometry(0.11,0.5,0.13),trui);
  arm1.geometry.translate(0,-0.22,0);
  arm1.position.set(-0.27,1.36,0); gr.add(arm1);
  const arm2=arm1.clone(); arm2.position.x=0.27; gr.add(arm2);
  const hoofd=new THREE.Mesh(new THREE.SphereGeometry(0.16,9,8),
    new THREE.MeshLambertMaterial({color:huid}));
  hoofd.position.y=1.6; gr.add(hoofd);
  const haar=new THREE.Mesh(new THREE.SphereGeometry(0.165,9,6,0,Math.PI*2,0,Math.PI/2.2),
    new THREE.MeshLambertMaterial({color:pick([0x2a2018,0x4a3018,0x8a6a3a,0x999088,0x1a1a1a,0x6a3a1a])}));
  haar.position.y=1.63; gr.add(haar);
  gr.userData.ledematen={b1:been1,b2:been2,a1:arm1,a2:arm2};
  return gr;
}
// zittende gasten op de terrasstoelen
zitplekken.forEach(zp=>{
  if(rng()<0.75){
    const m=maakMensMesh();
    m.position.set(zp[0],zp[1]-0.6,zp[2]);
    m.rotation.y=zp[3];
    const l=m.userData.ledematen;
    l.b1.rotation.x=-1.35; l.b2.rotation.x=-1.35;
    l.a1.rotation.x=-0.6; l.a2.rotation.x=-0.6;
    scene.add(m);
  }
});

// wandelaars op de winkelstraten en kades
const npcs=[];
(function spawnNpcs(){
  const looproutes=[];
  straten.forEach(st=>{
    for(let i=0;i<st.pts.length-1;i++){
      const extra=winkelstraten.has(st.naam)?3:1;   // drukte in de winkelstraten
      for(let e=0;e<extra;e++) looproutes.push({a:st.pts[i],b:st.pts[i+1],w:st.w});
    }
  });
  pleinen.forEach(p=>{
    looproutes.push({a:[p.cx-p.hx+2,p.cz],b:[p.cx+p.hx-2,p.cz],w:p.hz});
  });
  for(let k=0;k<52;k++){
    const r=looproutes[Math.floor(rng()*looproutes.length)];
    const npc={
      mesh:maakMensMesh(), a:r.a, b:r.b,
      t:rng(), richting:rng()<0.5?1:-1, speed:rnd(0.5,1.1),
      zij:rnd(-r.w/2+0.8, r.w/2-0.8),
      fase:rnd(0,6.28), omver:0,
    };
    scene.add(npc.mesh); npcs.push(npc);
  }
})();
function updateNpcs(dt,t){
  npcs.forEach(n=>{
    if(n.omver>0){
      n.omver-=dt;
      n.mesh.rotation.x=-Math.PI/2;
      if(n.omver<=0) n.mesh.rotation.x=0;
      return;
    }
    const len=dist2d(n.a[0],n.a[1],n.b[0],n.b[1]);
    n.t+=n.richting*n.speed*dt/len;
    if(n.t>1){n.t=1;n.richting=-1;}
    if(n.t<0){n.t=0;n.richting=1;}
    const dirX=(n.b[0]-n.a[0])/len, dirZ=(n.b[1]-n.a[1])/len;
    const x=n.a[0]+(n.b[0]-n.a[0])*n.t - dirZ*n.zij;
    const z=n.a[1]+(n.b[1]-n.a[1])*n.t + dirX*n.zij;
    n.mesh.rotation.y=Math.atan2(dirX*n.richting,dirZ*n.richting);
    n.mesh.position.set(x,heightAt(x,z),z);
    // wandelanimatie
    const zwaai=Math.sin(t*6*n.speed+n.fase)*0.55;
    const l=n.mesh.userData.ledematen;
    l.b1.rotation.x=zwaai; l.b2.rotation.x=-zwaai;
    l.a1.rotation.x=-zwaai*0.7; l.a2.rotation.x=zwaai*0.7;
  });
}

// ---------------------------------------------------------------------
// Speler
// ---------------------------------------------------------------------
const speler={
  x:-3, z:64, jumpY:0, vy:0, yaw:0, pitch:0,   // bij P-zuid, kijkend naar de Waterpoort
  inAuto:false, punten:0, sterren:0, sterTimer:0,
};
const spelerAuto={ actief:false, mesh:null, x:0, z:0, heading:0, v:0 };

const toetsen={};
document.addEventListener("keydown",e=>{
  toetsen[e.code]=true;
  if(e.code==="KeyE") probeerInUitstappen();
  if(e.code==="KeyR") claxon();
});
document.addEventListener("keyup",e=>{toetsen[e.code]=false;});

let muisLocked=false, ooitLocked=false;
document.addEventListener("mousemove",e=>{
  if(!muisLocked) return;
  speler.yaw   -= e.movementX*0.0023;
  speler.pitch -= e.movementY*0.0023;
  speler.pitch = clamp(speler.pitch,-1.35,1.35);
});

function beweeg(x,z,nx,nz,r){
  [nx,nz]=botsCirkel(nx,nz,r);
  if(opLand(nx,nz)) return [nx,nz];
  if(opLand(nx,z))  return [nx,z];
  if(opLand(x,nz))  return [x,nz];
  return [x,z];
}

function updateSpelerTeVoet(dt){
  const sprint=toetsen["ShiftLeft"]||toetsen["ShiftRight"];
  const sp=(sprint?9.5:5.5);
  let mx=0,mz=0;
  if(toetsen["KeyW"]||toetsen["ArrowUp"])   {mx+=-Math.sin(speler.yaw); mz+=-Math.cos(speler.yaw);}
  if(toetsen["KeyS"]||toetsen["ArrowDown"]) {mx+= Math.sin(speler.yaw); mz+= Math.cos(speler.yaw);}
  if(toetsen["KeyA"]||toetsen["ArrowLeft"]) {mx+=-Math.cos(speler.yaw); mz+= Math.sin(speler.yaw);}
  if(toetsen["KeyD"]||toetsen["ArrowRight"]){mx+= Math.cos(speler.yaw); mz+=-Math.sin(speler.yaw);}
  const l=Math.hypot(mx,mz);
  if(l>0){mx/=l;mz/=l;}
  const nx=speler.x+mx*sp*dt, nz=speler.z+mz*sp*dt;
  [speler.x,speler.z]=beweeg(speler.x,speler.z,nx,nz,0.5);
  if((toetsen["Space"])&&speler.jumpY<=0.001){speler.vy=5.2;}
  speler.vy-=14*dt; speler.jumpY+=speler.vy*dt;
  if(speler.jumpY<0){speler.jumpY=0;speler.vy=0;}
  const grondY=heightAt(speler.x,speler.z);
  camera.position.set(speler.x, grondY+1.7+speler.jumpY, speler.z);
  camera.rotation.set(speler.pitch, speler.yaw, 0);
}

function updateSpelerAuto(dt){
  const a=spelerAuto;
  const gas =(toetsen["KeyW"]||toetsen["ArrowUp"])?1:0;
  const rem =(toetsen["KeyS"]||toetsen["ArrowDown"])?1:0;
  const links=(toetsen["KeyA"]||toetsen["ArrowLeft"])?1:0;
  const rechts=(toetsen["KeyD"]||toetsen["ArrowRight"])?1:0;
  const handrem=toetsen["Space"]?1:0;

  const MAX=28, MAXR=-9;
  if(gas)  a.v += 13*dt*(1-Math.max(0,a.v)/MAX);
  if(rem)  a.v += (a.v>0.5? -22 : -8)*dt;
  if(!gas&&!rem) a.v *= Math.pow(0.35,dt);
  if(handrem) a.v *= Math.pow(0.02,dt);
  a.v=clamp(a.v,MAXR,MAX);

  const stuur=(links-rechts);
  const stuurKracht = 1.9*clamp(Math.abs(a.v)/9,0,1)*(handrem?1.7:1);
  a.heading += stuur*stuurKracht*dt*Math.sign(a.v||1);

  const fx=Math.sin(a.heading), fz=Math.cos(a.heading);
  let nx=a.x+fx*a.v*dt, nz=a.z+fz*a.v*dt;

  const rx=Math.cos(a.heading), rz=-Math.sin(a.heading);
  let raak=false;
  for(const h of [[1.0,2.1],[-1.0,2.1],[1.0,-2.1],[-1.0,-2.1]]){
    const wx=nx+fx*h[1]+rx*h[0], wz=nz+fz*h[1]+rz*h[0];
    const [cx2,cz2]=botsCirkel(wx,wz,0.35);
    if(cx2!==wx||cz2!==wz){ nx+=cx2-wx; nz+=cz2-wz; raak=true; }
  }
  let teWater=false;
  for(const h of [[1.0,2.3],[-1.0,2.3],[1.0,-2.3],[-1.0,-2.3],[0,0]]){
    const wx=nx+fx*h[1]+rx*h[0], wz=nz+fz*h[1]+rz*h[0];
    if(!opLand(wx,wz)){teWater=true;break;}
  }
  if(teWater){
    let ok=false;
    for(const p of [[nx,a.z],[a.x,nz]]){
      let vrij=true;
      for(const h of [[1.0,2.3],[-1.0,2.3],[1.0,-2.3],[-1.0,-2.3]]){
        if(!opLand(p[0]+fx*h[1]+rx*h[0], p[1]+fz*h[1]+rz*h[0])){vrij=false;break;}
      }
      if(vrij){nx=p[0];nz=p[1];ok=true;break;}
    }
    if(!ok){nx=a.x;nz=a.z;raak=Math.abs(a.v)>4;a.v*=0.2;}
  }
  if(raak){ if(Math.abs(a.v)>6) audioBots(); a.v*=-0.25; }

  for(const o of geparkeerd.concat(lusAutos,pendel)){
    if(o.x===undefined) continue;
    const d=dist2d(nx,nz,o.x,o.z);
    if(d<3.2){
      const dx=(nx-o.x)/(d||1), dz=(nz-o.z)/(d||1);
      nx=o.x+dx*3.2; nz=o.z+dz*3.2;
      if(Math.abs(a.v)>6) audioBots();
      a.v*=0.35;
    }
  }
  a.x=nx; a.z=nz;
  const grondY=heightAt(a.x,a.z);
  a.mesh.position.set(a.x,grondY,a.z);
  a.mesh.rotation.y=a.heading;

  npcs.forEach(n=>{
    if(n.omver>0) return;
    if(dist2d(a.x,a.z,n.mesh.position.x,n.mesh.position.z)<2.0 && Math.abs(a.v)>3){
      n.omver=6;
      wijzigPunten(-25);
      toast("Oeps! 😅","Sorry! (-€25, en de politie is boos...)");
      speler.sterren=Math.min(3,speler.sterren+1);
      speler.sterTimer=14;
    }
  });

  speler.x=a.x; speler.z=a.z;
  camera.position.set(a.x - fx*0.3, grondY+1.45, a.z - fz*0.3);
  camera.rotation.set(speler.pitch, speler.yaw, 0);
}

function probeerInUitstappen(){
  if(!gestart||pauze) return;
  if(speler.inAuto){
    const a=spelerAuto;
    a.v=0;
    const rx=Math.cos(a.heading), rz=-Math.sin(a.heading);
    let ux=a.x+rx*2.4, uz=a.z+rz*2.4;
    [ux,uz]=botsCirkel(ux,uz,0.5);
    if(!opLand(ux,uz)){ux=a.x-rx*2.4;uz=a.z-rz*2.4;}
    speler.x=ux; speler.z=uz; speler.jumpY=0; speler.vy=0;
    speler.inAuto=false;
    geparkeerd.push({mesh:a.mesh,x:a.x,z:a.z,heading:a.heading});
    a.mesh=null; a.actief=false;
    audioStopMotor();
    $("snelheid").style.display="none";
    return;
  }
  let best=null, bestD=4.5, bestIx=-1;
  geparkeerd.forEach((o,ix)=>{
    const d=dist2d(speler.x,speler.z,o.x,o.z);
    if(d<bestD){bestD=d;best=o;bestIx=ix;}
  });
  if(!best) return;
  geparkeerd.splice(bestIx,1);
  spelerAuto.actief=true;
  spelerAuto.mesh=best.mesh;
  spelerAuto.x=best.x; spelerAuto.z=best.z;
  spelerAuto.heading=best.heading;
  spelerAuto.v=0;
  speler.inAuto=true;
  speler.yaw=spelerAuto.heading+Math.PI;
  speler.pitch=0;
  audioStartMotor();
  $("snelheid").style.display="block";
  toast("Auto geleend 🚗","We geven hem écht terug hoor...");
}

// ---------------------------------------------------------------------
// Politie
// ---------------------------------------------------------------------
let politie=null;
function updatePolitie(dt,t){
  if(speler.sterren>0){
    speler.sterTimer-=dt;
    if(speler.sterTimer<=0){ speler.sterren=Math.max(0,speler.sterren-1); speler.sterTimer=12; }
    if(!politie){
      politie={mesh:maakAutoMesh(0xffffff,{politie:true,type:"sedan"}),x:speler.x+70,z:speler.z+40,heading:0};
      scene.add(politie.mesh);
      audioSirene(true);
    }
  }
  if(!politie) return;
  if(speler.sterren===0){
    scene.remove(politie.mesh); politie=null; audioSirene(false);
    toast("Ontsnapt! 😎","De politie is je kwijt.");
    return;
  }
  const doelH=Math.atan2(speler.x-politie.x, speler.z-politie.z);
  let dh=doelH-politie.heading;
  while(dh>Math.PI)dh-=2*Math.PI; while(dh<-Math.PI)dh+=2*Math.PI;
  politie.heading+=clamp(dh,-1.6*dt,1.6*dt);
  const snelheid=13+3*speler.sterren;
  let nx=politie.x+Math.sin(politie.heading)*snelheid*dt;
  let nz=politie.z+Math.cos(politie.heading)*snelheid*dt;
  [nx,nz]=beweeg(politie.x,politie.z,nx,nz,1.2);
  politie.x=nx; politie.z=nz;
  politie.mesh.position.set(nx,heightAt(nx,nz),nz);
  politie.mesh.rotation.y=politie.heading;
  politie.mesh.userData.zwaailicht.material.color.set(Math.floor(t*4)%2?0xff3333:0x3355ff);
  if(dist2d(nx,nz,speler.x,speler.z)<3.6){
    wijzigPunten(-200);
    speler.sterren=0;
    toast("Boete! 👮","€200 'administratiekosten'. Rustig aan!");
  }
}

// ---------------------------------------------------------------------
// Audio (WebAudio, geen bestanden nodig)
// ---------------------------------------------------------------------
let AC=null, motorOsc=null, sireneOsc=null, sireneLfo=null;
function audioInit(){
  if(AC) return;
  try{ AC=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ AC=null; }
}
function toon(freq,duur,type,vol,startNa){
  if(!AC) return;
  const o=AC.createOscillator(), g=AC.createGain();
  o.type=type||"sine"; o.frequency.value=freq;
  g.gain.setValueAtTime(0,AC.currentTime+(startNa||0));
  g.gain.linearRampToValueAtTime(vol||0.08,AC.currentTime+(startNa||0)+0.02);
  g.gain.exponentialRampToValueAtTime(0.0001,AC.currentTime+(startNa||0)+duur);
  o.connect(g); g.connect(AC.destination);
  o.start(AC.currentTime+(startNa||0)); o.stop(AC.currentTime+(startNa||0)+duur+0.05);
}
function audioStartMotor(){
  if(!AC) return;
  audioStopMotor();
  motorOsc=AC.createOscillator();
  const g=AC.createGain();
  const filt=AC.createBiquadFilter(); filt.type="lowpass"; filt.frequency.value=400;
  motorOsc.type="sawtooth"; motorOsc.frequency.value=55;
  g.gain.value=0.035;
  motorOsc.connect(filt); filt.connect(g); g.connect(AC.destination);
  motorOsc.start();
}
function audioStopMotor(){ if(motorOsc){try{motorOsc.stop();}catch(e){} motorOsc=null;} }
function audioMotorUpdate(){ if(motorOsc) motorOsc.frequency.value=55+Math.abs(spelerAuto.v)*5.5; }
function audioSirene(aan){
  if(!AC) return;
  if(aan&&!sireneOsc){
    sireneOsc=AC.createOscillator(); const g=AC.createGain(); sireneLfo=AC.createOscillator();
    const lfoGain=AC.createGain();
    sireneOsc.type="triangle"; sireneOsc.frequency.value=650;
    sireneLfo.frequency.value=2.2; lfoGain.gain.value=180;
    sireneLfo.connect(lfoGain); lfoGain.connect(sireneOsc.frequency);
    g.gain.value=0.03;
    sireneOsc.connect(g); g.connect(AC.destination);
    sireneOsc.start(); sireneLfo.start();
  }else if(!aan&&sireneOsc){
    try{sireneOsc.stop(); sireneLfo.stop();}catch(e){}
    sireneOsc=null;
  }
}
function claxon(){ if(speler.inAuto){ toon(392,0.28,"square",0.09); toon(494,0.28,"square",0.07);} }
function audioBots(){ toon(90,0.2,"sawtooth",0.12); }

// ---------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------
function wijzigPunten(n){
  speler.punten=Math.max(0,speler.punten+n);
  $("punten").textContent="€ "+speler.punten;
}
let toastTimer=null;
function toast(titel,sub){
  $("toastTekst").textContent=titel;
  $("subtoast").textContent=sub||"";
  $("toast").style.opacity=1;
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{$("toast").style.opacity=0;},3200);
}
function huidigeLocatie(){
  for(const p of pleinen){
    if(Math.abs(speler.x-p.cx)<p.hx+2&&Math.abs(speler.z-p.cz)<p.hz+2) return p.naam;
  }
  for(const b of bruggen){
    if(distSeg(speler.x,speler.z,b.a[0],b.a[1],b.b[0],b.b[1])<b.w/2+1) return b.naam;
  }
  if(dist2d(speler.x,speler.z,terp.x,terp.z)<terp.r) return "Martinikerk";
  let best=null,bestD=1e9;
  for(const st of straten.concat(stratenBuiten)){
    for(let i=0;i<st.pts.length-1;i++){
      const d=distSeg(speler.x,speler.z,st.pts[i][0],st.pts[i][1],st.pts[i+1][0],st.pts[i+1][1]);
      if(d<st.w/2+2&&d<bestD){bestD=d;best=st.naam;}
    }
  }
  return best;
}
let locTimer=0, huidigeLoc="";
function updateHud(dt){
  $("sterren").textContent="★".repeat(speler.sterren);
  if(speler.inAuto) $("snelheid").innerHTML=Math.round(Math.abs(spelerAuto.v)*3.6)+" <span>km/u</span>";
  let hint="";
  if(!speler.inAuto){
    for(const o of geparkeerd){ if(dist2d(speler.x,speler.z,o.x,o.z)<4.5){hint="Druk op E om in te stappen";break;} }
  }
  $("hint").style.display=hint?"block":"none";
  $("hint").textContent=hint;
  locTimer-=dt;
  if(locTimer<=0){
    locTimer=0.5;
    const loc=huidigeLocatie();
    if(loc&&loc!==huidigeLoc){ huidigeLoc=loc; $("straat").textContent=loc; $("straat").style.display="block"; }
    else if(!loc){ huidigeLoc=""; $("straat").style.display="none"; }
  }
}

// Minimap: de echte plattegrond van Sneek
const mm=$("minimap"), mmC=mm.getContext("2d");
const MMS=220, MMF=MMS/600;
function mmX(x){return MMS/2+(x-85)*MMF;}
function mmZ(z){return MMS/2+(z+140)*MMF;}
function tekenMinimap(){
  mmC.clearRect(0,0,MMS,MMS);
  mmC.fillStyle="#3a5a35"; mmC.fillRect(0,0,MMS,MMS);
  // gracht (buitenrand)
  mmC.fillStyle="#1d4552";
  mmC.beginPath();
  mmC.moveTo(mmX(buiten[0][0]),mmZ(buiten[0][1]));
  for(let i=1;i<buiten.length;i++) mmC.lineTo(mmX(buiten[i][0]),mmZ(buiten[i][1]));
  mmC.closePath(); mmC.fill();
  // eiland
  mmC.fillStyle="#6a635a";
  mmC.beginPath();
  mmC.moveTo(mmX(eiland[0][0]),mmZ(eiland[0][1]));
  for(let i=1;i<eiland.length;i++) mmC.lineTo(mmX(eiland[i][0]),mmZ(eiland[i][1]));
  mmC.closePath(); mmC.fill();
  // Kleinzand-kanaal
  mmC.fillStyle="#1d4552";
  mmC.fillRect(mmX(kleinzandKanaal.minX),mmZ(kleinzandKanaal.minZ),
    (kleinzandKanaal.maxX-kleinzandKanaal.minX)*MMF,(kleinzandKanaal.maxZ-kleinzandKanaal.minZ)*MMF);
  // straten
  mmC.strokeStyle="#a89c8a"; mmC.lineCap="round";
  straten.concat(stratenBuiten).forEach(st=>{
    mmC.lineWidth=Math.max(1.1,st.w*MMF*0.8);
    mmC.beginPath();
    mmC.moveTo(mmX(st.pts[0][0]),mmZ(st.pts[0][1]));
    for(let i=1;i<st.pts.length;i++) mmC.lineTo(mmX(st.pts[i][0]),mmZ(st.pts[i][1]));
    mmC.stroke();
  });
  mmC.strokeStyle="#c9bfa8"; mmC.lineWidth=2;
  bruggen.forEach(b=>{
    mmC.beginPath(); mmC.moveTo(mmX(b.a[0]),mmZ(b.a[1])); mmC.lineTo(mmX(b.b[0]),mmZ(b.b[1])); mmC.stroke();
  });
  function stip(x,z,kleur){ mmC.fillStyle=kleur; mmC.beginPath(); mmC.arc(mmX(x),mmZ(z),3.2,0,7); mmC.fill(); }
  stip(-3,29,"#ffd944");         // Waterpoort
  stip(terp.x,terp.z,"#e8e2d0"); // Martinikerk
  stip(30,-232,"#f0a040");       // Stadhuis
  stip(200,-216,"#40b0f0");      // Museum
  if(politie) stip(politie.x,politie.z,"#4f8aff");
  const px=mmX(speler.x), pz=mmZ(speler.z);
  const hoek = speler.inAuto? spelerAuto.heading : speler.yaw+Math.PI;
  mmC.save(); mmC.translate(px,pz); mmC.rotate(Math.PI-hoek);
  mmC.fillStyle="#fff"; mmC.strokeStyle="#000"; mmC.lineWidth=1;
  mmC.beginPath(); mmC.moveTo(0,-6); mmC.lineTo(4,5); mmC.lineTo(-4,5); mmC.closePath();
  mmC.fill(); mmC.stroke();
  mmC.restore();
}

// ---------------------------------------------------------------------
// Start / pauze / pointer lock
// ---------------------------------------------------------------------
let naam="Jarige";
let gestart=false, pauze=false;

const naamInput=$("naam");
try{ naamInput.value = localStorage.getItem("gpa_naam")||""; }catch(e){}

$("startknop").addEventListener("click",()=>{
  naam=(naamInput.value.trim()||"Jarige");
  try{ localStorage.setItem("gpa_naam",naam); }catch(e){}
  const t=canvasTex(1024,256,(g)=>{
    g.fillStyle="#c9285a"; g.fillRect(0,0,1024,256);
    g.strokeStyle="#ffe97a"; g.lineWidth=10; g.strokeRect(8,8,1008,240);
    g.fillStyle="#ffe97a"; g.font="bold 100px Impact, Arial";
    g.textAlign="center"; g.textBaseline="middle";
    g.fillText("🎉 HOERA "+naam.toUpperCase()+"! 🎉",512,136,990);
  });
  spandoekMats.forEach(m=>{ m.map=t; m.needsUpdate=true; });

  $("start").style.display="none";
  $("hud").style.display="block";
  audioInit();
  gestart=true;
  wijzigPunten(0);
  $("missieTitel").textContent="Verken Sneek";
  $("missieTekst").textContent="Loop door de Waterpoort de stad in en kijk rond. Missies volgen binnenkort!";
  canvas.requestPointerLock();
  toast("Welkom in Sneek, "+naam+"! 🎂","Loop door de Waterpoort de binnenstad in");
});

$("verderknop").addEventListener("click",()=>{
  $("pauze").style.display="none";
  canvas.requestPointerLock();
});
canvas.addEventListener("click",()=>{
  if(gestart&&!muisLocked){ $("pauze").style.display="none"; canvas.requestPointerLock(); }
});
document.addEventListener("pointerlockchange",()=>{
  muisLocked = document.pointerLockElement===canvas;
  if(muisLocked) ooitLocked=true;
  if(gestart&&!muisLocked&&ooitLocked){
    pauze=true;
    $("pauze").style.display="flex";
  }else{
    pauze=false;
    $("pauze").style.display="none";
  }
});

// ---------------------------------------------------------------------
// Debug-haakjes voor screenshots/tests
// ---------------------------------------------------------------------
let vrijeCam=null;
window.__sneek={
  teleport:(x,z,yaw,pitch)=>{speler.x=x;speler.z=z;if(yaw!==undefined)speler.yaw=yaw;if(pitch!==undefined)speler.pitch=pitch;},
  setCam:(px,py,pz,tx,ty,tz)=>{vrijeCam={p:[px,py,pz],t:[tx,ty,tz]};},
  clearCam:()=>{vrijeCam=null;},
  status:()=>({gestart:gestart,x:speler.x,z:speler.z,inAuto:speler.inAuto,huizen:huizen.length}),
};

// ---------------------------------------------------------------------
// Hoofdlus
// ---------------------------------------------------------------------
let vorige=performance.now();
function lus(nu){
  requestAnimationFrame(lus);
  const dt=clamp((nu-vorige)/1000,0,0.05);
  vorige=nu;
  const t=nu/1000;

  for(let i=0;i<boten.length;i++){
    boten[i].position.y=-0.35+0.08*Math.sin(t*1.2+i*1.7);
    boten[i].rotation.z=0.03*Math.sin(t*0.9+i);
  }
  updateVaarboten(dt);

  if(gestart&&!pauze){
    if(speler.inAuto) updateSpelerAuto(dt); else updateSpelerTeVoet(dt);
    updateLusAutos(dt);
    updatePendel(dt);
    updateNpcs(dt,t);
    updatePolitie(dt,t);
    audioMotorUpdate();
    updateHud(dt);
    tekenMinimap();
  }
  if(vrijeCam){
    camera.position.set(vrijeCam.p[0],vrijeCam.p[1],vrijeCam.p[2]);
    camera.lookAt(vrijeCam.t[0],vrijeCam.t[1],vrijeCam.t[2]);
  }
  renderer.render(scene,camera);
}
requestAnimationFrame(lus);

})();
