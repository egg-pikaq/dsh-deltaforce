const hudWidth = 680;
const hudHeight = 300;
const cyan = '#95edff';
const dim = '#4ba9d599';
const networkNodes = [[78,214],[166,112],[302,49],[430,134],[565,73],[599,203],[318,223]];
const networkLinks = [[0,1],[0,3],[1,2],[1,3],[2,3],[2,4],[3,4],[3,5],[3,6],[4,5],[5,6]];

function hudLine(ctx, points, color, width = 1) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function hudArc(ctx, x, y, rx, ry, start, end, color, width = 1) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, start, end);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function hudDot(ctx, x, y, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawCredential(ctx, phase) {
  for (let layer = 3; layer >= 0; layer--) {
    const x = 111 + layer * 20;
    const y = 55 - layer * 10;
    ctx.strokeStyle = layer ? '#609ec154' : '#8edafaad';
    ctx.fillStyle = '#18426b42';
    ctx.fillRect(x, y, 418, 174);
    ctx.strokeRect(x, y, 418, 174);
  }
  ctx.fillStyle = '#5ab4e329';
  ctx.fillRect(277, 79, 126, 126);
  ctx.strokeStyle = dim;
  ctx.strokeRect(277, 79, 126, 126);
  for (const [x,y,sx,sy] of [[269,71,1,1],[411,71,-1,1],[269,213,1,-1],[411,213,-1,-1]]) {
    hudLine(ctx, [[x,y+sy*18],[x,y],[x+sx*18,y]], cyan, 2);
  }
  for (let i=0;i<20;i++) {
    const x=140+i*19;
    hudLine(ctx, [[x,233],[x,233+(i%5===0?10:4)]], dim);
  }
  const y=70+145*phase;
  const light=ctx.createLinearGradient(85,0,590,0);
  light.addColorStop(0,'#44a8ff00');
  light.addColorStop(.45,cyan);
  light.addColorStop(1,'#44a8ff00');
  ctx.fillStyle=light;
  ctx.shadowColor=cyan;
  ctx.shadowBlur=14;
  ctx.fillRect(85,y,505,2);
  ctx.shadowBlur=0;
}

function drawUplink(ctx, phase) {
  hudArc(ctx, 345, 264, 320, 183, Math.PI, Math.PI*2, '#477aad59');
  hudArc(ctx, 345, 262, 301, 165, Math.PI, Math.PI*2, '#477aad33');
  for (const [a,b] of networkLinks) hudLine(ctx, [networkNodes[a],networkNodes[b]], '#5fbcf563');
  for (const [i,[x,y]] of networkNodes.entries()) {
    const active=i<=Math.floor(phase*networkNodes.length);
    hudArc(ctx,x,y,15,15,0,Math.PI*2,active?cyan:dim);
    hudArc(ctx,x,y,22,22,.25,Math.PI*1.65,dim);
    hudDot(ctx,x,y,active?4:2,active?cyan:dim);
  }
  const path=[0,3,4,5];
  const step=Math.min(path.length-2,Math.floor(phase*(path.length-1)));
  const [x,y]=networkNodes[path[step]];
  const [endX,endY]=networkNodes[path[step+1]];
  const f=phase*(path.length-1)-step;
  const point=[x+(endX-x)*f,y+(endY-y)*f];
  ctx.shadowColor=cyan;
  ctx.shadowBlur=15;
  hudLine(ctx,[[x,y],point],cyan,2);
  hudDot(ctx,...point,4,'#e4fbff');
  ctx.shadowBlur=0;
}

function drawSync(ctx, phase, locked) {
  const x=340, y=138, turn=phase*Math.PI*2;
  for (const [rx,ry,offset] of [[208,104,-22],[174,86,1],[125,60,25]]) {
    hudArc(ctx,x,y+offset,rx,ry,0,Math.PI*2,'#315777');
    hudArc(ctx,x,y+offset,rx+5,ry+3,turn,turn+1.1,cyan,2);
    for(let i=0;i<48;i++) {
      const a=i*Math.PI/24, size=i%6===0?12:5;
      hudLine(ctx,[[x+Math.cos(a)*rx,y+offset+Math.sin(a)*ry],
        [x+Math.cos(a)*(rx-size),y+offset+Math.sin(a)*(ry-size*.5)]],i%6===0?cyan:dim);
    }
  }
  ctx.strokeStyle=dim;
  ctx.strokeRect(253,105,174,66);
  hudLine(ctx,[[224,138],[456,138]],cyan);
  hudLine(ctx,[[340,82],[340,195]],dim);
  const indicator=locked?'#9aefde':'#ffce78';
  hudDot(ctx,x,y,5,indicator);
  if (locked) hudArc(ctx,x,y,238,126,0,Math.PI*2,'#82dcca80',2);
}

function prepareHud(canvas, reduced) {
  const ctx=canvas.getContext('2d');
  if (!ctx) return () => {};
  let lastFrame;
  return (kind, elapsed, span) => {
    const bounds=canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const phase = reduced ? 0.68 : Math.min(1, elapsed / span);
    const tick=reduced?0:Math.floor(elapsed/33);
    const pixelRatio=Math.min(window.devicePixelRatio||1,1.5);
    const w=Math.round(bounds.width*pixelRatio),h=Math.round(bounds.height*pixelRatio);
    const key=`${kind}:${tick}:${w}:${h}`;
    if (lastFrame===key) return;
    lastFrame=key;
    if(canvas.width!==w || canvas.height!==h){ canvas.width=w; canvas.height=h; }
    const scale=Math.min(w/hudWidth,h/hudHeight);
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,w,h);
    ctx.setTransform(scale,0,0,scale,(w-hudWidth*scale)/2,(h-hudHeight*scale)/2);
    if (kind==='identity') drawCredential(ctx,phase);
    else if(kind==='uplink') drawUplink(ctx,phase);
    else if(kind==='sync'||kind==='verified') drawSync(ctx,phase,kind==='verified');
  };
}
