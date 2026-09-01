/* =====================================================================
   GRAND PARTY AUTO — SNEEK
   Een first-person open-world verjaardagsspel in de binnenstad van
   Sneek: de stadsgracht met de Kolk, de Waterpoort, het Grootzand,
   het Kleinzand (mét kanaal), de Marktstraat met het Stadhuis, de
   Martinikerk op de terp, de Oosterdijk en de pleinen.
   Gemaakt met Three.js. De spellen/missies volgen later.
   ===================================================================== */
(function () {
"use strict";

// ---------------------------------------------------------------------
// Hulpjes
// ---------------------------------------------------------------------
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rng = mulberry32(8715);           // vaste seed: de stad is elke keer hetzelfde
function rnd(a,b){return a+rng()*(b-a);}
function pick(arr){return arr[Math.floor(rng()*arr.length)];}
function clamp(v,a,b){return v<a?a:(v>b?b:v);}
function dist2d(ax,az,bx,bz){const dx=ax-bx,dz=az-bz;return Math.sqrt(dx*dx+dz*dz);}
const $ = (id)=>document.getElementById(id);

// punt-in-polygoon (raycast), poly = [[x,z],...]
function inPoly(x,z,poly){
  let binnen=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const xi=poly[i][0], zi=poly[i][1], xj=poly[j][0], zj=poly[j][1];
    if((zi>z)!==(zj>z) && x < (xj-xi)*(z-zi)/(zj-zi)+xi) binnen=!binnen;
  }
  return binnen;
}
// afstand van punt tot lijnsegment
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
scene.fog = new THREE.Fog(0xe8c9d8, 260, 1100);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth/window.innerHeight, 0.1, 2000);
camera.rotation.order = "YXZ";

window.addEventListener("resize", ()=>{
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Heldere namiddaglucht met warme horizon (Sneekweek-weer)
(function makeSky(){
  const geo = new THREE.SphereGeometry(1400, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite:false, fog:false,
    uniforms:{ top:{value:new THREE.Color(0x4a8fd9)}, mid:{value:new THREE.Color(0xa8c9ec)}, bot:{value:new THREE.Color(0xf6d9b0)} },
    vertexShader:"varying vec3 vP; void main(){vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader:
      "uniform vec3 top,mid,bot; varying vec3 vP;"+
      "void main(){float h=normalize(vP).y;"+
      "vec3 c = h>0.18 ? mix(mid,top,smoothstep(0.18,0.75,h)) : mix(bot,mid,smoothstep(-0.05,0.18,h));"+
      "gl_FragColor=vec4(c,1.0);}"
  });
  scene.add(new THREE.Mesh(geo, mat));
  const sun = new THREE.Mesh(new THREE.CircleGeometry(60,32),
    new THREE.MeshBasicMaterial({color:0xfff2cc, fog:false}));
  sun.position.set(-700, 320, -900); sun.lookAt(0,100,0);
  scene.add(sun);
  // een paar wolkjes
  for(let i=0;i<10;i++){
    const wolk=new THREE.Mesh(new THREE.SphereGeometry(rnd(20,45),10,8),
      new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.85, fog:false}));
    wolk.scale.y=0.35;
    wolk.position.set(rnd(-900,900), rnd(180,300), rnd(-900,900));
    scene.add(wolk);
  }
})();

scene.add(new THREE.HemisphereLight(0xcfe4ff, 0x5a6a55, 0.9));
const sunLight = new THREE.DirectionalLight(0xfff0d0, 1.15);
sunLight.position.set(-250, 320, -300);
scene.add(sunLight);
scene.add(new THREE.AmbientLight(0x8a8aa0, 0.35));

// ---------------------------------------------------------------------
// Plattegrond van Sneek (schematisch, herkenbaar)
// x = oost, z = zuid (noorden is -z). Alles in meters.
// ---------------------------------------------------------------------
// De binnenstad: een hart-/eivormig eiland omsloten door de stadsgracht
const eiland = [
  [0,150],[-60,130],[-95,95],[-115,45],[-120,-10],[-105,-70],[-70,-115],[-25,-140],
  [20,-145],[70,-125],[105,-85],[120,-30],[115,30],[90,85],[50,125]
];
// buitenrand van de gracht (het "vasteland" begint hier); bij de zuidkant
// is de gracht breder: dat is de Kolk, waar de Waterpoort over uitkijkt
const CZ = {x:0, z:0};
const buiten = eiland.map(p=>{
  const dx=p[0]-CZ.x, dz=p[1]-CZ.z;
  const len=Math.hypot(dx,dz)||1;
  const off = (p[1]>115) ? 52 : 22;   // Kolk = brede gracht in het zuiden
  return [p[0]+dx/len*off, p[1]+dz/len*off];
});

// Het Kleinzand heeft nog écht water: een kanaal dwars door het oosten
const kleinzandKanaal = {minX:38, maxX:98, minZ:23, maxZ:31};

// Straten: polylijnen met breedte. (voormalige grachten zijn extra breed)
const straten = [
  {naam:"Hoogend",            w:10, pts:[[0,146],[-4,112]]},
  {naam:"Grootzand",          w:16, pts:[[-4,112],[8,70],[20,28]]},
  {naam:"Waterpoortsgracht",  w:8,  pts:[[-4,112],[-46,100]]},
  {naam:"Singel",             w:9,  pts:[[-46,100],[-80,60],[-95,10],[-88,-45],[-106,-42]]},
  {naam:"Grote Kerkstraat",   w:7,  pts:[[0,8],[-32,-28]]},
  {naam:"Marktstraat",        w:9,  pts:[[-8,10],[45,2]]},
  {naam:"Kruizebroederstraat",w:7,  pts:[[14,40],[4,-12]]},
  {naam:"Wijde Burgstraat",   w:8,  pts:[[20,28],[45,14]]},
  {naam:"Nauwe Burgstraat",   w:6,  pts:[[24,44],[48,30]]},
  {naam:"Oosterdijk",         w:10, pts:[[45,14],[52,48],[58,88]]},
  {naam:"Kleinzand",          w:6,  pts:[[36,20],[98,18]]},
  {naam:"Kleinzand",          w:6,  pts:[[36,34],[98,34]]},
  {naam:"Leeuwenburg",        w:8,  pts:[[45,2],[38,-52]]},
  {naam:"Noordeinde",         w:8,  pts:[[38,-52],[30,-136]]},
  {naam:"Oude Koemarkt",      w:9,  pts:[[58,88],[74,102]]},
  {naam:"Kerkgracht",         w:7,  pts:[[-32,-28],[-42,-50]]},
];
// straten op het vasteland
const stratenBuiten = [
  {naam:"Lemmerweg",          w:12, pts:[[0,192],[0,330]],       asfalt:true},
  {naam:"Oppenhuizerweg",     w:10, pts:[[101,130],[150,175]],   asfalt:true},
  {naam:"Bolswarderbaan",     w:10, pts:[[-140,-49],[-230,-60]], asfalt:true},
  {naam:"Harinxmakade",       w:10, pts:[[34,-176],[40,-260]],   asfalt:true},
];

// Pleinen
const pleinen = [
  {naam:"Schaapmarktplein", cx:30,  cz:50,  hx:14, hz:11},
  {naam:"Martiniplein",     cx:-16, cz:-78, hx:19, hz:15},
];

// De terp waar de Martinikerk op staat
const terp = {x:-62, z:-58, r:32, h:1.8};

// Bruggen over de stadsgracht: [van-eiland] -> [naar-vasteland]
const bruggen = [
  {naam:"Waterpoortsbrug", a:[0,146],   b:[0,194],    w:7, h:1.6, waterpoort:true},
  {naam:"Oosterpoortsbrug",a:[74,102],  b:[96,126],   w:8, h:1.2},
  {naam:"Noorderbrug",     a:[30,-136], b:[35,-174],  w:8, h:1.2},
  {naam:"Westerbrug",      a:[-106,-42],b:[-138,-48], w:7, h:1.2},
  // kleine bruggetjes over het Kleinzand-kanaal
  {naam:"Kleinzandbrug",   a:[50,20.5], b:[50,33.5],  w:5, h:0.8},
  {naam:"Museumbrug",      a:[86,20.5], b:[86,33.5],  w:5, h:0.8},
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
  if(!inPoly(x,z,buiten)) return true;      // vasteland buiten de gracht
  return !!opBrug(x,z);                      // op het water: alleen op een brug
}
function heightAt(x,z){
  let h=0;
  // terp van de Martinikerk
  const dT=dist2d(x,z,terp.x,terp.z);
  if(dT<terp.r) h=Math.max(h, terp.h*0.5*(1+Math.cos(Math.PI*dT/terp.r)));
  // bruggen lopen in een boogje omhoog
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
const straatTex = steentjesTex("#6e4038","#7d4c42");   // rode klinkers
straatTex.wrapS=straatTex.wrapT=THREE.RepeatWrapping;
const pleinTex = steentjesTex("#7a7468","#8c857a");     // grijze keitjes
pleinTex.wrapS=pleinTex.wrapT=THREE.RepeatWrapping;

const winkelnamen=["Bakkerij van der Meer","Slagerij Hoekstra","IJssalon Fardau","Kapsalon Knip & Klaar",
  "Boekhandel De Lezer","Fietsen Jelle","Café De Vrolijke Fries","Snackbar 't Zeiltje",
  "Bloemen Botke","Kaashuis Frisia","Modehuis Antje","Speelgoed De Ballon","Drogisterij Sikma",
  "Juwelier Zilverberg","Sportshop De Start","Chocolaterie Sjoerd"];
let winkelIx=0;

// Gevel van een Hollands pandje, inclusief geveltop-silhouet (alpha)
function gevelTex(w,hLijf,gevelType,winkel){
  const S=36; // pixels per meter
  const gevelH = gevelType==="plat"?0.4:2.6;
  const W=Math.round(w*S), H=Math.round((hLijf+gevelH)*S);
  const bakst=pick(["#8a4534","#9c5540","#6e3a2c","#a05a3a","#7a4030","#5a4a42","#93604a"]);
  const tex=canvasTex(W,H,(g,c)=>{
    g.clearRect(0,0,W,H);
    // silhouet van de gevel
    g.beginPath();
    const topY=0, lijfY=gevelH*S;
    if(gevelType==="trap"){
      const st=4, sw=(W/2)/st, sh=lijfY/st;
      g.moveTo(0,lijfY);
      for(let i=0;i<st;i++){ g.lineTo(i*sw, lijfY-(i+1)*sh+sh); g.lineTo(i*sw, lijfY-(i+1)*sh); }
      g.lineTo(W/2- sw*0.0, 0);
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
    } else { // plat
      g.moveTo(0,0); g.lineTo(W,0); }
    g.lineTo(W,H); g.lineTo(0,H); g.closePath();
    g.fillStyle=bakst; g.fill();
    g.save(); g.clip();
    // metselwerk-suggestie
    g.strokeStyle="rgba(0,0,0,0.12)"; g.lineWidth=1;
    for(let y=0;y<H;y+=7){ g.beginPath(); g.moveTo(0,y); g.lineTo(W,y); g.stroke(); }
    // witte daklijst op de geveltop
    g.strokeStyle="#e8e2d0"; g.lineWidth=5; g.stroke();
    // raampjes
    const verdiepingen=Math.max(1,Math.round(hLijf/3)-0);
    const ramenPerVerd=Math.max(1,Math.round(w/2.4));
    const beganeGrondY=H-3.0*S;
    for(let v=0;v<verdiepingen;v++){
      const ry=H-(v+1)*3.0*S+0.55*S;
      if(ry<gevelH*S*0.4) continue;
      for(let r=0;r<ramenPerVerd;r++){
        const rx=(r+0.5)*(W/ramenPerVerd)-0.55*S;
        if(v===0) continue; // begane grond komt hieronder
        g.fillStyle="#f0ead8"; g.fillRect(rx-3,ry-3,1.1*S+6,1.7*S+6);
        g.fillStyle="#2a3548"; g.fillRect(rx,ry,1.1*S,1.7*S);
        g.strokeStyle="#f0ead8"; g.lineWidth=2;
        g.beginPath(); g.moveTo(rx+0.55*S,ry); g.lineTo(rx+0.55*S,ry+1.7*S);
        g.moveTo(rx,ry+0.85*S); g.lineTo(rx+1.1*S,ry+0.85*S); g.stroke();
      }
    }
    // topraampje in de gevel
    g.fillStyle="#2a3548"; g.fillRect(W/2-0.4*S, gevelH*S*0.35, 0.8*S, 1.0*S);
    g.strokeStyle="#f0ead8"; g.lineWidth=3; g.strokeRect(W/2-0.4*S, gevelH*S*0.35, 0.8*S, 1.0*S);
    // begane grond: winkelpui of voordeur
    if(winkel){
      const naam=winkelnamen[winkelIx++%winkelnamen.length];
      const puiKleur=pick(["#3d5a4a","#5a3d4a","#3d4a5a","#6b4a2a","#4a3d5a"]);
      g.fillStyle=puiKleur; g.fillRect(4,beganeGrondY,W-8,3.0*S-4);
      g.fillStyle="#bcd8e8"; g.fillRect(10,beganeGrondY+1.0*S,W-20,1.6*S); // etalage
      g.fillStyle="#f0ead8";
      g.font="bold "+Math.round(0.42*S)+"px Verdana";
      g.textAlign="center"; g.textBaseline="middle";
      g.fillText(naam, W/2, beganeGrondY+0.5*S, W-16);
      // deur
      g.fillStyle="#241a12"; g.fillRect(W/2-0.5*S, H-2.1*S, 1.0*S, 2.1*S);
    }else{
      g.fillStyle="#f0ead8"; g.fillRect(W/2-0.55*S-3, H-2.3*S-3, 1.1*S+6, 2.3*S+3);
      g.fillStyle=pick(["#25401f","#402525","#252540","#1a1a1a"]);
      g.fillRect(W/2-0.55*S, H-2.3*S, 1.1*S, 2.3*S);
      // raam naast de deur
      g.fillStyle="#f0ead8"; g.fillRect(W*0.16-3, H-2.2*S-3, 1.1*S+6, 1.7*S+6);
      g.fillStyle="#2a3548"; g.fillRect(W*0.16, H-2.2*S, 1.1*S, 1.7*S);
    }
    g.restore();
  });
  return {tex:tex, gevelH:gevelH, bakst:bakst};
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
const colliders=[];  // {cx,cz,hx,hz,cos,sin}
function addCollider(cx,cz,hx,hz,rot){
  colliders.push({cx:cx,cz:cz,hx:hx,hz:hz,cos:Math.cos(rot||0),sin:Math.sin(rot||0)});
}
// cirkel (x,z,r) uit alle colliders duwen
function botsCirkel(x,z,r){
  for(const c of colliders){
    // naar lokale ruimte van de box
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

// bouwverbod: hier mogen geen automatische pandjes komen
const verboden=[]; // {cx,cz,hx,hz,cos,sin} zelfde vorm
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
  // water
  const water=new THREE.Mesh(new THREE.PlaneGeometry(2600,2600),
    new THREE.MeshLambertMaterial({color:0x2e6577}));
  water.rotation.x=-Math.PI/2; water.position.y=-0.55;
  scene.add(water);

  const kadeZij=new THREE.MeshLambertMaterial({color:0x4a4038});
  const eilandTop=new THREE.MeshLambertMaterial({map:pleinTex});
  pleinTex.repeat.set(40,40);

  // eiland (met gat voor het Kleinzand-kanaal)
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
  eilandMesh.rotation.x=Math.PI/2;   // shape-y -> wereld-z, extrusie omlaag
  scene.add(eilandMesh);

  // vasteland: grote plaat met een gat in de vorm van de buitengracht
  const buitenShape=new THREE.Shape([
    new THREE.Vector2(-1300,-1300),new THREE.Vector2(1300,-1300),
    new THREE.Vector2(1300,1300),new THREE.Vector2(-1300,1300)]);
  const grachtGat=new THREE.Path(buiten.map(p=>new THREE.Vector2(p[0],p[1])));
  buitenShape.holes.push(grachtGat);
  const grasTop=new THREE.MeshLambertMaterial({color:0x4d7a42});
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
    m.rotation.x=-Math.PI/2; m.rotation.z=hoek;
    m.rotation.order="ZYX";
    // vlak plat leggen en om Y draaien: eerst yaw, dan plat
    m.rotation.set(0,hoek,0); m.rotateX(-Math.PI/2);
    m.position.set((a[0]+b[0])/2, y, (a[1]+b[1])/2);
    scene.add(m);
    // bouwverbod op de straat zelf
    addVerbod((a[0]+b[0])/2,(a[1]+b[1])/2, st.w/2, len/2+st.w/2, -hoek);
  }
}
straten.forEach(st=>legStraat(st,0.045));
stratenBuiten.forEach(st=>legStraat(st,0.05));

pleinen.forEach(p=>{
  const mat=new THREE.MeshLambertMaterial({map:pleinTex.clone()});
  mat.map.needsUpdate=true; mat.map.repeat.set(p.hx/2,p.hz/2);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(p.hx*2,p.hz*2),mat);
  m.rotation.x=-Math.PI/2; m.position.set(p.cx,0.04,p.cz);
  scene.add(m);
  addVerbod(p.cx,p.cz,p.hx+1,p.hz+1,0);
});

// terp (groene heuvel) — visueel: platte kegel
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
  // boogvormig wegdek: een licht gebogen doos volstaat visueel
  const dek=new THREE.Mesh(new THREE.BoxGeometry(b.w,0.5,len+2),
    new THREE.MeshLambertMaterial({color:0x6e6258}));
  dek.position.set(cx, b.h*0.62, cz);
  dek.rotation.y=hoek;
  scene.add(dek);
  // leuningen
  [-1,1].forEach(s=>{
    const leun=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.65,len-0.5),
      new THREE.MeshLambertMaterial({color:0xbfb9a8}));
    leun.position.set(cx+Math.cos(hoek)*s*(b.w/2-0.2), b.h*0.62+0.55, cz-Math.sin(hoek)*s*(b.w/2-0.2));
    leun.rotation.y=hoek;
    scene.add(leun);
  });
  addVerbod(cx,cz,b.w/2+2,len/2+3,-hoek);
});

// ---------------------------------------------------------------------
// Landmarks
// ---------------------------------------------------------------------
const bakstMat=new THREE.MeshLambertMaterial({color:0x8a4534});
const donkerLei=new THREE.MeshLambertMaterial({color:0x2e3138});
const witMat=new THREE.MeshLambertMaterial({color:0xe8e2d0});

// --- DE WATERPOORT (over de gracht, hét icoon van Sneek) ---
(function maakWaterpoort(){
  const wp=new THREE.Group();
  const bx=0, bz=170;         // midden van de Waterpoortsbrug
  // twee achtkantige torens met hoge spitsen
  [-4.6,4.6].forEach(sx=>{
    const toren=new THREE.Mesh(new THREE.CylinderGeometry(2.1,2.3,11,8),bakstMat);
    toren.position.set(bx+sx,5.5,bz); wp.add(toren);
    // witte sierband
    const band=new THREE.Mesh(new THREE.CylinderGeometry(2.15,2.15,0.4,8),witMat);
    band.position.set(bx+sx,8.6,bz); wp.add(band);
    const spits=new THREE.Mesh(new THREE.ConeGeometry(2.2,7.5,8),donkerLei);
    spits.position.set(bx+sx,14.7,bz); wp.add(spits);
    const bol=new THREE.Mesh(new THREE.SphereGeometry(0.28,8,8),
      new THREE.MeshBasicMaterial({color:0xf0c040}));
    bol.position.set(bx+sx,18.6,bz); wp.add(bol);
    addCollider(bx+sx,bz,2.4,2.4,0);
  });
  // poortwachterswoning boven de doorgang, met trapgeveltjes
  const huis=new THREE.Mesh(new THREE.BoxGeometry(7.4,3.4,5.2),bakstMat);
  huis.position.set(bx,6.4,bz); wp.add(huis);
  // raampjes op de woning
  const raamT=canvasTex(128,64,(g)=>{
    g.fillStyle="#8a4534"; g.fillRect(0,0,128,64);
    g.fillStyle="#2a3548";
    [14,52,90].forEach(x=>{ g.fillRect(x,14,24,36); });
    g.strokeStyle="#e8e2d0"; g.lineWidth=3;
    [14,52,90].forEach(x=>{ g.strokeRect(x,14,24,36); });
  });
  const raamVlakN=new THREE.Mesh(new THREE.PlaneGeometry(7.2,3.2),
    new THREE.MeshLambertMaterial({map:raamT}));
  raamVlakN.position.set(bx,6.4,bz-2.62); raamVlakN.rotation.y=Math.PI; wp.add(raamVlakN);
  const raamVlakZ=raamVlakN.clone(); raamVlakZ.rotation.y=0; raamVlakZ.position.z=bz+2.62; wp.add(raamVlakZ);
  // zadeldak met trapgevels
  const dak=new THREE.Mesh(new THREE.CylinderGeometry(0.1,3.0,2.2,4,1),donkerLei);
  dak.rotation.y=Math.PI/4; dak.scale.set(1.35,1,0.95);
  dak.position.set(bx,9.2,bz); wp.add(dak);
  [-1,1].forEach(s=>{
    for(let i=0;i<3;i++){
      const trap=new THREE.Mesh(new THREE.BoxGeometry(5.4-i*1.6,0.55,0.4),bakstMat);
      trap.position.set(bx, 8.25+i*0.55, bz+s*2.5);
      wp.add(trap);
    }
  });
  // dubbele boog: middenpijler in het water
  const pijler=new THREE.Mesh(new THREE.BoxGeometry(1.4,4.5,5.4),bakstMat);
  pijler.position.set(bx,1.6,bz); wp.add(pijler);
  addCollider(bx,bz,0.8,2.8,0);
  scene.add(wp);
  addVerbod(bx,bz,10,7,0);
})();

// --- MARTINIKERK op de terp ---
(function maakMartinikerk(){
  const k=new THREE.Group();
  const kx=terp.x, kz=terp.z, y0=terp.h;
  const rot=0.5; // een tikje gedraaid, zoals op de kaart
  k.position.set(kx,y0,kz); k.rotation.y=rot;
  // schip
  const schip=new THREE.Mesh(new THREE.BoxGeometry(13,10,30),bakstMat);
  schip.position.set(0,5,2); k.add(schip);
  // spitsboogramen langs het schip
  const raamKerk=canvasTex(512,256,(g)=>{
    g.fillStyle="#8a4534"; g.fillRect(0,0,512,256);
    for(let i=0;i<6;i++){
      const x=30+i*80;
      g.fillStyle="#2a3548";
      g.beginPath();
      g.moveTo(x,220); g.lineTo(x,120);
      g.quadraticCurveTo(x+20,70,x+40,70);
      g.quadraticCurveTo(x+60,70,x+80,120);
      g.lineTo(x+80,220); g.closePath(); g.fill();
      g.strokeStyle="#d8d2c0"; g.lineWidth=5; g.stroke();
    }
  });
  [-1,1].forEach(s=>{
    const vlak=new THREE.Mesh(new THREE.PlaneGeometry(29,9.6),
      new THREE.MeshLambertMaterial({map:raamKerk}));
    vlak.position.set(s*6.55,5.2,2); vlak.rotation.y=s>0?Math.PI/2:-Math.PI/2;
    k.add(vlak);
  });
  // steunberen
  for(let i=0;i<5;i++){
    [-1,1].forEach(s=>{
      const sb=new THREE.Mesh(new THREE.BoxGeometry(1,7,1.4),bakstMat);
      sb.position.set(s*7,3.5,-10+i*6); k.add(sb);
    });
  }
  // zadeldak
  const dakShape=new THREE.Shape([new THREE.Vector2(-7,0),new THREE.Vector2(7,0),new THREE.Vector2(0,5.5)]);
  const dak=new THREE.Mesh(new THREE.ExtrudeGeometry(dakShape,{depth:30,bevelEnabled:false}),donkerLei);
  dak.position.set(0,10,-13); k.add(dak);
  // koor (lager, achter)
  const koor=new THREE.Mesh(new THREE.CylinderGeometry(6,6,8,8,1),bakstMat);
  koor.position.set(0,4,19); k.add(koor);
  const koorDak=new THREE.Mesh(new THREE.ConeGeometry(6.3,4,8),donkerLei);
  koorDak.position.set(0,10,19); k.add(koorDak);
  // toren met spits
  const toren=new THREE.Mesh(new THREE.BoxGeometry(7,20,7),bakstMat);
  toren.position.set(0,10,-16.5); k.add(toren);
  // galmgaten + klok
  const klokT=canvasTex(256,256,(g)=>{
    g.fillStyle="#8a4534"; g.fillRect(0,0,256,256);
    g.fillStyle="#20242c"; g.fillRect(88,30,80,110);
    g.strokeStyle="#d8d2c0"; g.lineWidth=6; g.strokeRect(88,30,80,110);
    g.fillStyle="#f0ead8"; g.beginPath(); g.arc(128,195,38,0,7); g.fill();
    g.strokeStyle="#222"; g.lineWidth=5;
    g.beginPath(); g.moveTo(128,195); g.lineTo(128,168); g.moveTo(128,195); g.lineTo(148,195); g.stroke();
  });
  [[0,0,-3.52,0],[0,0,3.52,Math.PI],[-3.52,0,0,-Math.PI/2],[3.52,0,0,Math.PI/2]].forEach(p=>{
    const vlak=new THREE.Mesh(new THREE.PlaneGeometry(6.8,10),
      new THREE.MeshLambertMaterial({map:klokT}));
    vlak.position.set(p[0],13.5,-16.5+p[2]); vlak.rotation.y=p[3];
    k.add(vlak);
  });
  const torenSpits=new THREE.Mesh(new THREE.ConeGeometry(5.2,9,8),donkerLei);
  torenSpits.position.set(0,24.5,-16.5); k.add(torenSpits);
  const haan=new THREE.Mesh(new THREE.SphereGeometry(0.3,8,8),
    new THREE.MeshBasicMaterial({color:0xf0c040}));
  haan.position.set(0,29.3,-16.5); k.add(haan);
  scene.add(k);
  // botsers (in wereldruimte, gedraaid)
  addCollider(kx+Math.sin(rot)*2,kz+Math.cos(rot)*2,7.6,16,-rot);
  addCollider(kx+Math.sin(rot)*-16.5,kz+Math.cos(rot)*-16.5,4.2,4.2,-rot);
  addCollider(kx+Math.sin(rot)*19,kz+Math.cos(rot)*19,6.4,6.4,-rot);
})();

// --- STADHUIS aan de Marktstraat (rococo) ---
(function maakStadhuis(){
  const sx=16, sz=-6;   // noordzijde Marktstraat, gevel naar het zuiden
  const g=new THREE.Group();
  g.position.set(sx,0,sz);
  const romp=new THREE.Mesh(new THREE.BoxGeometry(16,9,11),
    new THREE.MeshLambertMaterial({color:0xd8cfae}));
  romp.position.set(0,4.5,-5.5+0); g.add(romp);
  // rococo-gevel (canvas)
  const gevelT=canvasTex(1024,640,(gg)=>{
    gg.fillStyle="#ddd4b4"; gg.fillRect(0,0,1024,640);
    // hoge vensters met sierlijsten
    gg.textAlign="center";
    for(let r=0;r<5;r++){
      const x=110+r*180;
      [[120,150],[330,140]].forEach(v=>{
        gg.fillStyle="#2a3548"; gg.fillRect(x,v[0],90,v[1]);
        gg.strokeStyle="#f4eede"; gg.lineWidth=8; gg.strokeRect(x,v[0],90,v[1]);
        gg.strokeStyle="#b09c60"; gg.lineWidth=4;
        gg.beginPath(); gg.arc(x+45,v[0],52,Math.PI,0); gg.stroke();
      });
    }
    // middenpartij + kuif
    gg.fillStyle="#c9b878"; gg.fillRect(432,60,160,60);
    gg.fillStyle="#8a6a20"; gg.font="bold 44px Georgia";
    gg.fillText("ANNO 1550",512,100);
    // deur met bordes
    gg.fillStyle="#3a2a18"; gg.fillRect(452,470,120,170);
    gg.strokeStyle="#f4eede"; gg.lineWidth=10; gg.strokeRect(452,470,120,170);
    // krullen (rococo-suggestie)
    gg.strokeStyle="#b09c60"; gg.lineWidth=6;
    gg.beginPath(); gg.arc(430,80,26,0.5,4.5); gg.stroke();
    gg.beginPath(); gg.arc(594,80,26,5,2.5); gg.stroke();
  });
  const gevel=new THREE.Mesh(new THREE.PlaneGeometry(15.8,9),
    new THREE.MeshLambertMaterial({map:gevelT}));
  gevel.position.set(0,4.5,0.06); g.add(gevel);
  // schilddak
  const dak=new THREE.Mesh(new THREE.CylinderGeometry(0.6,6.4,3.4,4,1),
    new THREE.MeshLambertMaterial({color:0x6e3a2c}));
  dak.rotation.y=Math.PI/4; dak.scale.set(1.9,1,1.0);
  dak.position.set(0,10.7,-6.0); g.add(dak);
  // bordes: dubbele trap + balustrade
  const trap=new THREE.Mesh(new THREE.BoxGeometry(6,1.1,2.6),witMat);
  trap.position.set(0,0.55,1.6); g.add(trap);
  const trapje1=new THREE.Mesh(new THREE.BoxGeometry(2.2,0.5,3.2),witMat);
  trapje1.position.set(-4,0.25,1.8); g.add(trapje1);
  const trapje2=trapje1.clone(); trapje2.position.x=4; g.add(trapje2);
  [-2.8,2.8].forEach(x=>{
    const bal=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.8,2.4),witMat);
    bal.position.set(x,1.5,1.6); g.add(bal);
  });
  // vlag
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
  addCollider(sx,sz-5.5+0,8.3,5.8,0);
  addCollider(sx,sz+1.6,3.4,1.6,0); // bordes
  addVerbod(sx,sz-4,11,10,0);
  // naambordje
  const bord=tekstBord("STADHUIS","#1c2340","#f0d060",6,1.1,120);
  bord.position.set(sx,9.4,sz+0.12); scene.add(bord);
})();

// --- FRIES SCHEEPVAART MUSEUM aan het Kleinzand ---
(function maakMuseum(){
  const mx=66, mz=12;  // noordzijde van het Kleinzand, gevel naar het water
  const g=new THREE.Group(); g.position.set(mx,0,mz);
  const romp=new THREE.Mesh(new THREE.BoxGeometry(18,8,9),
    new THREE.MeshLambertMaterial({color:0x7a4030}));
  romp.position.set(0,4,-4.5); g.add(romp);
  const dak=new THREE.Mesh(new THREE.CylinderGeometry(0.4,5.2,3,4,1),donkerLei);
  dak.rotation.y=Math.PI/4; dak.scale.set(2.2,1,1.15);
  dak.position.set(0,9.4,-4.5); g.add(dak);
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
    // scheepje boven de deur
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

// ---------------------------------------------------------------------
// Automatische gevelrijen langs de straten
// ---------------------------------------------------------------------
const winkelstraten=new Set(["Oosterdijk","Wijde Burgstraat","Nauwe Burgstraat","Grootzand","Kruizebroederstraat","Oude Koemarkt"]);
function maakPandje(cx,cz,rot,w,d,winkel){
  const hLijf=pick([6,6,9,9,9,12]);
  const type=pick(["trap","trap","klok","tuit","plat"]);
  const gevel=gevelTex(w,hLijf,type,winkel);
  const gr=new THREE.Group();
  gr.position.set(cx,0,cz); gr.rotation.y=rot;

  const zijMat=new THREE.MeshLambertMaterial({color:new THREE.Color(gevel.bakst).multiplyScalar(0.82)});
  const romp=new THREE.Mesh(new THREE.BoxGeometry(w,hLijf,d),zijMat);
  romp.position.set(0,hLijf/2,-d/2+0.15); gr.add(romp);

  // gevel met geveltop (dun plakje met alpha-textuur aan de straatkant)
  const gevelMat=new THREE.MeshLambertMaterial({map:gevel.tex,transparent:true,alphaTest:0.4});
  const totH=hLijf+gevel.gevelH;
  const vlak=new THREE.Mesh(new THREE.BoxGeometry(w,totH,0.3),
    [zijMat,zijMat,zijMat,zijMat,gevelMat,zijMat]);
  vlak.position.set(0,totH/2,0.15); gr.add(vlak);

  // dak: nok haaks op de straat, verscholen achter de geveltop
  const dakShape=new THREE.Shape([new THREE.Vector2(-w/2,0),new THREE.Vector2(w/2,0),new THREE.Vector2(0,gevel.gevelH)]);
  const dak=new THREE.Mesh(new THREE.ExtrudeGeometry(dakShape,{depth:d-0.4,bevelEnabled:false}),
    new THREE.MeshLambertMaterial({color:pick([0xb4552e,0xa04828,0x50423a,0x8a4028])}));
  dak.position.set(0,hLijf,0); dak.rotation.y=Math.PI;
  gr.add(dak);

  // luifel voor winkels
  if(winkel && rng()<0.7){
    const luif=new THREE.Mesh(new THREE.BoxGeometry(w*0.9,0.12,1.3),
      new THREE.MeshLambertMaterial({color:pick([0xc94f4f,0x3f7a5a,0x4f6ac9,0xc9a03f])}));
    luif.position.set(0,3.1,0.85); luif.rotation.x=0.25; gr.add(luif);
  }
  scene.add(gr);
  addCollider(cx,cz,w/2,d/2+0.2,-rot);
  return {cx:cx,cz:cz,w:w,d:d,rot:rot};
}

function bouwGevelrijen(){
  straten.forEach(st=>{
    for(let i=0;i<st.pts.length-1;i++){
      const a=st.pts[i], b=st.pts[i+1];
      const len=dist2d(a[0],a[1],b[0],b[1]);
      const dirX=(b[0]-a[0])/len, dirZ=(b[1]-a[1])/len;
      // rechts van de looprichting = (-dirZ, dirX)
      [-1,1].forEach(kant=>{
        const nx=-dirZ*kant, nz=dirX*kant;
        let s=4;
        while(s<len-4){
          const w=rnd(5.5,8.5);
          if(s+w>len-2) break;
          const midS=s+w/2;
          const diepte=rnd(7,9.5);
          const off=st.w/2+1.1+diepte/2;
          const cx=a[0]+dirX*midS+nx*off;
          const cz=a[1]+dirZ*midS+nz*off;
          // gevel kijkt naar de straat
          const rot=Math.atan2(-nx,-nz);
          // controle: hoekpunten + middens binnen het eiland en buiten verbodszones
          let ok=true;
          const hx=w/2+0.5, hz=diepte/2+0.5;
          for(const p of [[0,0],[hx,hz],[-hx,hz],[hx,-hz],[-hx,-hz],[0,hz],[0,-hz]]){
            const wx=cx+p[0]*Math.cos(rot)+p[1]*Math.sin(rot);
            const wz=cz-p[0]*Math.sin(rot)+p[1]*Math.cos(rot);
            if(!inPoly(wx,wz,eiland)||inKanaal(wx,wz)||puntInVerbod(wx,wz)){ok=false;break;}
          }
          // niet op een andere gevelrij
          if(ok){
            for(const h of huizen){
              const d=dist2d(cx,cz,h.cx,h.cz);
              if(d<(w+h.w)/2+1 && d<(diepte+h.d)/2+1){ok=false;break;}
            }
          }
          if(ok){
            huizen.push(maakPandje(cx,cz,rot,w,diepte,winkelstraten.has(st.naam)));
            s+=w+rnd(0.2,1.2);
          }else{
            s+=3;
          }
        }
      });
    }
  });
}
const huizen=[];
bouwGevelrijen();

// ---------------------------------------------------------------------
// Aankleding: bomen, lantaarns, bankjes, terrasjes, bootjes, spandoek
// ---------------------------------------------------------------------
const boomPos=[];
// bomen op de pleinen, de terp en het vasteland
pleinen.forEach(p=>{ for(let i=0;i<4;i++) boomPos.push([p.cx+rnd(-p.hx+2,p.hx-2), p.cz+rnd(-p.hz+2,p.hz-2)]); });
for(let i=0;i<10;i++){
  const hoek=rnd(0,Math.PI*2), r=rnd(terp.r*0.55,terp.r*0.9);
  boomPos.push([terp.x+Math.cos(hoek)*r, terp.z+Math.sin(hoek)*r]);
}
for(let i=0;i<70;i++){
  const x=rnd(-420,420), z=rnd(-420,420);
  if(!inPoly(x,z,buiten) && Math.abs(x)>40 || z>240 || z<-220){
    if(opLand(x,z)&&!inPoly(x,z,eiland)&&!puntInVerbod(x,z)) boomPos.push([x,z]);
  }
}
(function plaatsBomen(){
  const stamGeo=new THREE.CylinderGeometry(0.28,0.4,2.4);
  const stamMat=new THREE.MeshLambertMaterial({color:0x5a3d2a});
  const kroonGeo=new THREE.SphereGeometry(2.3,9,7);
  const kroonMat=new THREE.MeshLambertMaterial({color:0x3f7a35});
  const stam=new THREE.InstancedMesh(stamGeo,stamMat,boomPos.length);
  const kroon=new THREE.InstancedMesh(kroonGeo,kroonMat,boomPos.length);
  const m=new THREE.Matrix4();
  boomPos.forEach((bp,i)=>{
    const y=heightAt(bp[0],bp[1]);
    m.makeTranslation(bp[0],y+1.2,bp[1]); stam.setMatrixAt(i,m);
    const sc=rnd(0.8,1.3);
    m.makeScale(sc,sc,sc).setPosition(bp[0],y+3.6,bp[1]); kroon.setMatrixAt(i,m);
  });
  scene.add(stam); scene.add(kroon);
})();

// lantaarns langs de straten
(function lantaarns(){
  const posL=[];
  straten.concat(stratenBuiten).forEach(st=>{
    for(let i=0;i<st.pts.length-1;i++){
      const a=st.pts[i],b=st.pts[i+1];
      const len=dist2d(a[0],a[1],b[0],b[1]);
      const dirX=(b[0]-a[0])/len, dirZ=(b[1]-a[1])/len;
      for(let s=10;s<len-4;s+=24){
        const kant=(Math.floor(s/24)%2)?1:-1;
        const x=a[0]+dirX*s -dirZ*kant*(st.w/2+0.6);
        const z=a[1]+dirZ*s +dirX*kant*(st.w/2+0.6);
        if(opLand(x,z)) posL.push([x,z]);
      }
    }
  });
  const paalGeo=new THREE.CylinderGeometry(0.09,0.13,4.6);
  const paalMat=new THREE.MeshLambertMaterial({color:0x1e3328});
  const bolGeo=new THREE.SphereGeometry(0.28,8,8);
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

// terrasjes met parasols op de pleinen
(function terrassen(){
  const spots=[[24,44],[36,54],[-24,-72],[-8,-84],[12,66]];
  spots.forEach(sp=>{
    if(!opLand(sp[0],sp[1])) return;
    const y=heightAt(sp[0],sp[1]);
    const voet=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,2.4),witMat);
    voet.position.set(sp[0],y+1.2,sp[1]); scene.add(voet);
    const doek=new THREE.Mesh(new THREE.ConeGeometry(2.2,1.0,8),
      new THREE.MeshLambertMaterial({color:pick([0xd94f4f,0xf0d060,0x4f8ad9])}));
    doek.position.set(sp[0],y+2.5,sp[1]); scene.add(doek);
    const tafel=new THREE.Mesh(new THREE.CylinderGeometry(0.7,0.7,0.08,10),witMat);
    tafel.position.set(sp[0],y+0.78,sp[1]); scene.add(tafel);
    for(let i=0;i<3;i++){
      const hoek=i*2.1;
      const stoel=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.5,0.5),
        new THREE.MeshLambertMaterial({color:0x6a4a30}));
      stoel.position.set(sp[0]+Math.cos(hoek)*1.3,y+0.25,sp[1]+Math.sin(hoek)*1.3);
      scene.add(stoel);
    }
  });
})();

// bootjes in de gracht, de Kolk en het Kleinzand — Sneek is een zeilstad!
const boten=[];
function maakBoot(x,z,rot,zeil){
  const gr=new THREE.Group();
  const romp=new THREE.Mesh(new THREE.CylinderGeometry(0.9,0.55,5.6,7,1),
    new THREE.MeshLambertMaterial({color:pick([0xffffff,0x2a3548,0x6e3a2c,0x3f5a7a])}));
  romp.rotation.x=Math.PI/2; romp.rotation.z=Math.PI/2;
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
}
// in de ring van de gracht
for(let i=0;i<eiland.length;i+=2){
  const p=eiland[i];
  const dx=p[0]-CZ.x, dz=p[1]-CZ.z, len=Math.hypot(dx,dz)||1;
  const off=(p[1]>115)?26:11;
  maakBoot(p[0]+dx/len*off, p[1]+dz/len*off, rnd(0,6.28), false);
}
// zeilboten in de Kolk (Sneekweek!)
maakBoot(-16,178,0.6,true); maakBoot(22,184,-0.9,true); maakBoot(-24,196,2.2,true);
// kleine bootjes in het Kleinzand
maakBoot(58,27,Math.PI/2,false); maakBoot(74,27,Math.PI/2,false); maakBoot(93,27,Math.PI/2,false);

// spandoek over het Grootzand (naam wordt bij de start ingevuld)
const spandoekMats=[];
(function maakSpandoek(){
  const a=[-5,91], b=[10,89]; // dwars over het Grootzand
  const midX=(a[0]+b[0])/2, midZ=(a[1]+b[1])/2;
  const hoek=Math.atan2(b[0]-a[0],b[1]-a[1]);
  [a,b].forEach(p=>{
    const paal=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.14,7),
      new THREE.MeshLambertMaterial({color:0x30281e}));
    paal.position.set(p[0],3.5,p[1]); scene.add(paal);
  });
  // twee vlakken rug-aan-rug zodat de tekst van beide kanten leesbaar is
  [0,Math.PI].forEach(draai=>{
    const doek=tekstBord("🎉 HOERA! 🎉","#c9285a","#ffe97a",14,2.2,110);
    doek.position.set(midX,5.4,midZ);
    doek.rotation.y=hoek+Math.PI/2+draai;
    scene.add(doek);
    spandoekMats.push(doek.material);
  });
})();

// welkomstbord bij de Lemmerweg
(function(){
  const bord=tekstBord("WELKOM IN SNEEK","#123a5a","#ffffff",10,1.8,110);
  bord.position.set(-8,2.2,230); bord.rotation.y=Math.PI;
  scene.add(bord);
  const paal=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,2.4),witMat);
  paal.position.set(-8,1.1,230.1); scene.add(paal);
})();

// onzichtbare wereldranden
addCollider(0,-460,470,10,0); addCollider(0,460,470,10,0);
addCollider(-460,0,10,470,0); addCollider(460,0,10,470,0);

// ---------------------------------------------------------------------
// Auto's
// ---------------------------------------------------------------------
const autoKleuren=[0xd94f4f,0x4f8ad9,0xd9c24f,0x59c96b,0xe08acd,0xf0f0f0,0x8a6adf,0xff8a3d,0x50d9c9];
function maakAutoMesh(kleur, politieAuto){
  const gr=new THREE.Group();
  const bodyMat=new THREE.MeshLambertMaterial({color:kleur});
  const body=new THREE.Mesh(new THREE.BoxGeometry(2.0,0.7,4.4),bodyMat);
  body.position.y=0.65; gr.add(body);
  const cab=new THREE.Mesh(new THREE.BoxGeometry(1.8,0.6,2.2),
    new THREE.MeshLambertMaterial({color:0x1a2030}));
  cab.position.set(0,1.25,-0.3); gr.add(cab);
  const wielGeo=new THREE.CylinderGeometry(0.38,0.38,0.3,10);
  const wielMat=new THREE.MeshLambertMaterial({color:0x14121a});
  [[-1.0,1.4],[1.0,1.4],[-1.0,-1.4],[1.0,-1.4]].forEach(w=>{
    const wl=new THREE.Mesh(wielGeo,wielMat);
    wl.rotation.z=Math.PI/2; wl.position.set(w[0],0.38,w[1]); gr.add(wl);
  });
  const kopMat=new THREE.MeshBasicMaterial({color:0xfff2c9});
  [-0.6,0.6].forEach(k=>{
    const kp=new THREE.Mesh(new THREE.BoxGeometry(0.35,0.2,0.1),kopMat);
    kp.position.set(k,0.7,2.22); gr.add(kp);
  });
  if(politieAuto){
    bodyMat.color.set(0xf2f2f8);
    const streep=new THREE.Mesh(new THREE.BoxGeometry(2.02,0.3,4.42),
      new THREE.MeshLambertMaterial({color:0x2255cc}));
    streep.position.y=0.72; gr.add(streep);
    const zw=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.25,0.4),
      new THREE.MeshBasicMaterial({color:0xff3333}));
    zw.position.set(0,1.68,-0.3); gr.add(zw);
    gr.userData.zwaailicht=zw;
  }
  return gr;
}

// rondrijdend verkeer op de rondweg om de gracht (aankleding)
const ringAutos=[];
const RING={cx:0,cz:5,rx:195,rz:235};
(function(){
  for(let i=0;i<7;i++){
    const a={hoek:i*(Math.PI*2/7), speed:rnd(0.028,0.042)*(i%2?1:-1),
      mesh:maakAutoMesh(pick(autoKleuren),false)};
    scene.add(a.mesh);
    ringAutos.push(a);
  }
})();
function updateRing(dt){
  ringAutos.forEach(a=>{
    a.hoek+=a.speed*dt*10;
    const x=RING.cx+Math.cos(a.hoek)*RING.rx;
    const z=RING.cz+Math.sin(a.hoek)*RING.rz;
    const vx=-Math.sin(a.hoek)*RING.rx*Math.sign(a.speed);
    const vz= Math.cos(a.hoek)*RING.rz*Math.sign(a.speed);
    a.x=x; a.z=z;
    a.mesh.position.set(x,0,z);
    a.mesh.rotation.y=Math.atan2(vx,vz);
  });
}
// de rondweg zelf (visueel): korte asfaltstukjes langs de ellips
(function(){
  const stukken=64;
  const mat=new THREE.MeshLambertMaterial({color:0x4a4650});
  for(let i=0;i<stukken;i++){
    const h1=i/stukken*Math.PI*2;
    const l=2*Math.PI*((RING.rx+RING.rz)/2)/stukken;
    const m=new THREE.Mesh(new THREE.PlaneGeometry(10,l+3),mat);
    const x=RING.cx+Math.cos(h1)*RING.rx, z=RING.cz+Math.sin(h1)*RING.rz;
    m.rotation.set(0,Math.atan2(-Math.sin(h1)*RING.rx,Math.cos(h1)*RING.rz),0);
    m.rotateX(-Math.PI/2);
    m.position.set(x,0.03,z);
    scene.add(m);
  }
})();

// geparkeerde auto's (de speler kan zo instappen)
const geparkeerd=[];
(function spawnGeparkeerd(){
  const plekken=[
    [6,138,0.05],[-14,120,1.2],[-52,88,0.9],[-86,40,1.5],[-14,-84,0],[6,-70,0],
    [42,-30,0.15],[70,96,2.2],[10,210,0],[ -6,250,0],[14,250,0],[38,-150,0.4],
  ];
  plekken.forEach(p=>{
    if(!opLand(p[0],p[1])) return;
    const auto={mesh:maakAutoMesh(pick(autoKleuren),false), x:p[0], z:p[1], heading:p[2]};
    auto.mesh.position.set(auto.x,heightAt(auto.x,auto.z),auto.z);
    auto.mesh.rotation.y=auto.heading;
    scene.add(auto.mesh); geparkeerd.push(auto);
  });
})();

// ---------------------------------------------------------------------
// Voetgangers
// ---------------------------------------------------------------------
const npcs=[];
function maakNpcMesh(){
  const gr=new THREE.Group();
  const kleding=pick([0xd94f4f,0x4f8ad9,0xd9c24f,0x59c96b,0xe08acd,0xffffff,0x8a6adf,0x444455]);
  const body=new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.34,1.15,8),
    new THREE.MeshLambertMaterial({color:kleding}));
  body.position.y=0.85; gr.add(body);
  const hoofd=new THREE.Mesh(new THREE.SphereGeometry(0.24,8,8),
    new THREE.MeshLambertMaterial({color:pick([0xf2c9a0,0xc98a5a,0x8a5a3d,0xf2d9c0])}));
  hoofd.position.y=1.66; gr.add(hoofd);
  return gr;
}
// wandelaars: heen en weer over een straatsegment
(function spawnNpcs(){
  const looproutes=[];
  straten.forEach(st=>{
    for(let i=0;i<st.pts.length-1;i++) looproutes.push({a:st.pts[i],b:st.pts[i+1],w:st.w});
  });
  pleinen.forEach(p=>{
    looproutes.push({a:[p.cx-p.hx+2,p.cz],b:[p.cx+p.hx-2,p.cz],w:p.hz});
  });
  for(let k=0;k<34;k++){
    const r=looproutes[Math.floor(rng()*looproutes.length)];
    const npc={
      mesh:maakNpcMesh(), a:r.a, b:r.b,
      t:rng(), richting:rng()<0.5?1:-1, speed:rnd(0.35,0.75),
      zij:rnd(-r.w/2+0.8, r.w/2-0.8),
      omver:0,
    };
    scene.add(npc.mesh); npcs.push(npc);
  }
})();
function updateNpcs(dt){
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
  });
}

// ---------------------------------------------------------------------
// Speler
// ---------------------------------------------------------------------
const speler={
  x:0, z:210, jumpY:0, vy:0, yaw:0, pitch:0,   // start op de Lemmerweg, kijkend naar de Waterpoort
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

// probeer te bewegen met botsing + waterrand (glijden langs de kade)
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

  // botsing met gebouwen en de waterkant (4 hoekpunten van de auto)
  const rx=Math.cos(a.heading), rz=-Math.sin(a.heading);
  let raak=false;
  for(const h of [[1.0,2.1],[-1.0,2.1],[1.0,-2.1],[-1.0,-2.1]]){
    const wx=nx+fx*h[1]+rx*h[0], wz=nz+fz*h[1]+rz*h[0];
    const [cx2,cz2]=botsCirkel(wx,wz,0.35);
    if(cx2!==wx||cz2!==wz){ nx+=cx2-wx; nz+=cz2-wz; raak=true; }
  }
  // niet het water in rijden
  let teWater=false;
  for(const h of [[1.0,2.3],[-1.0,2.3],[1.0,-2.3],[-1.0,-2.3],[0,0]]){
    const wx=nx+fx*h[1]+rx*h[0], wz=nz+fz*h[1]+rz*h[0];
    if(!opLand(wx,wz)){teWater=true;break;}
  }
  if(teWater){
    // glijden langs de kade
    if(!isNaN(nx)){
      let ok=false;
      const px=a.x+fx*a.v*dt, pz=a.z;
      // probeer alleen-x en alleen-z
      const paden=[[nx,a.z],[a.x,nz]];
      for(const p of paden){
        let vrij=true;
        for(const h of [[1.0,2.3],[-1.0,2.3],[1.0,-2.3],[-1.0,-2.3]]){
          if(!opLand(p[0]+fx*h[1]+rx*h[0], p[1]+fz*h[1]+rz*h[0])){vrij=false;break;}
        }
        if(vrij){nx=p[0];nz=p[1];ok=true;break;}
      }
      if(!ok){nx=a.x;nz=a.z;a.v*=0.2;raak=Math.abs(a.v)>4;}
    }
  }
  if(raak){ if(Math.abs(a.v)>6) audioBots(); a.v*=-0.25; }

  // botsing met andere auto's
  for(const o of geparkeerd.concat(ringAutos)){
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

  // voetgangers omver rijden geeft gedoe met de politie
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
  speler.yaw=spelerAuto.heading+Math.PI;   // camera kijkt met de neus mee
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
      politie={mesh:maakAutoMesh(0xffffff,true),x:speler.x+70,z:speler.z+40,heading:0};
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
let AC=null, motorOsc=null, motorGain=null, sireneOsc=null, sireneLfo=null;
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
  motorOsc=AC.createOscillator(); motorGain=AC.createGain();
  const filt=AC.createBiquadFilter(); filt.type="lowpass"; filt.frequency.value=400;
  motorOsc.type="sawtooth"; motorOsc.frequency.value=55;
  motorGain.gain.value=0.035;
  motorOsc.connect(filt); filt.connect(motorGain); motorGain.connect(AC.destination);
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
// waar ben ik? (straatnaam onder in beeld)
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
  // straatnaam
  locTimer-=dt;
  if(locTimer<=0){
    locTimer=0.5;
    const loc=huidigeLocatie();
    if(loc&&loc!==huidigeLoc){ huidigeLoc=loc; $("straat").textContent=loc; $("straat").style.display="block"; }
    else if(!loc){ huidigeLoc=""; $("straat").style.display="none"; }
  }
}

// Minimap: een echte plattegrond van Sneek
const mm=$("minimap"), mmC=mm.getContext("2d");
const MMS=220, MMF=MMS/560, MMOX=MMS/2, MMOZ=MMS/2-10*MMF;
function mmX(x){return MMOX+x*MMF;}
function mmZ(z){return MMOZ+z*MMF;}
function tekenMinimap(){
  mmC.clearRect(0,0,MMS,MMS);
  // water
  mmC.fillStyle="#1d4552"; mmC.fillRect(0,0,MMS,MMS);
  // vasteland
  mmC.fillStyle="#3a5a35";
  mmC.beginPath(); mmC.rect(0,0,MMS,MMS);
  mmC.moveTo(mmX(buiten[0][0]),mmZ(buiten[0][1]));
  for(let i=buiten.length-1;i>=0;i--) mmC.lineTo(mmX(buiten[i][0]),mmZ(buiten[i][1]));
  mmC.closePath(); mmC.fill("evenodd");
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
  mmC.strokeStyle="#a89c8a";
  straten.concat(stratenBuiten).forEach(st=>{
    mmC.lineWidth=Math.max(1.2,st.w*MMF*0.8);
    mmC.beginPath();
    mmC.moveTo(mmX(st.pts[0][0]),mmZ(st.pts[0][1]));
    for(let i=1;i<st.pts.length;i++) mmC.lineTo(mmX(st.pts[i][0]),mmZ(st.pts[i][1]));
    mmC.stroke();
  });
  // bruggen
  mmC.strokeStyle="#c9bfa8"; mmC.lineWidth=2;
  bruggen.forEach(b=>{
    mmC.beginPath(); mmC.moveTo(mmX(b.a[0]),mmZ(b.a[1])); mmC.lineTo(mmX(b.b[0]),mmZ(b.b[1])); mmC.stroke();
  });
  // landmarks
  function stip(x,z,kleur){ mmC.fillStyle=kleur; mmC.beginPath(); mmC.arc(mmX(x),mmZ(z),3.4,0,7); mmC.fill(); }
  stip(0,170,"#ffd944");        // Waterpoort
  stip(terp.x,terp.z,"#e8e2d0");// Martinikerk
  stip(16,-6,"#f0a040");        // Stadhuis
  stip(66,12,"#40b0f0");        // Museum
  // politie
  if(politie){ stip(politie.x,politie.z,"#4f8aff"); }
  // speler
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
  // spandoek boven het Grootzand krijgt de naam van de jarige
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
// Debug-haakjes voor screenshots/tests (geen invloed op het spel)
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

  // bootjes deinen zachtjes
  for(let i=0;i<boten.length;i++){
    boten[i].position.y=-0.35+0.08*Math.sin(t*1.2+i*1.7);
    boten[i].rotation.z=0.03*Math.sin(t*0.9+i);
  }

  if(gestart&&!pauze){
    if(speler.inAuto) updateSpelerAuto(dt); else updateSpelerTeVoet(dt);
    updateRing(dt);
    updateNpcs(dt);
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
