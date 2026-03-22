import { useEffect, useRef, useState, useCallback } from 'react'

/* ═══════════════════════════════════════════════════════════
   PIXEL ENGINE — Bresenham algorithms
══════════════════════════════════════════════════════════════ */
const PIXEL_SIZE = 4
const CANVAS_W = 128
const CANVAS_H = 96

function hexToRgb(hex) {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)]
}

function bresenhamLine(x0,y0,x1,y1) {
  const pts=[]; let dx=Math.abs(x1-x0),dy=Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1,err=dx-dy
  while(true){pts.push([x0,y0]);if(x0===x1&&y0===y1)break;let e2=2*err;if(e2>-dy){err-=dy;x0+=sx};if(e2<dx){err+=dx;y0+=sy}}
  return pts
}

function bresenhamCircle(cx,cy,r) {
  const pts=[],plot8=(px,py)=>{[[cx+px,cy+py],[cx-px,cy+py],[cx+px,cy-py],[cx-px,cy-py],[cx+py,cy+px],[cx-py,cy+px],[cx+py,cy-px],[cx-py,cy-px]].forEach(p=>pts.push(p))}
  let x=0,y=r,d=3-2*r
  while(y>=x){plot8(x,y);if(d<0)d+=4*x+6;else{d+=4*(x-y)+10;y--};x++}
  return pts
}

function fillCircle(cx,cy,r){const p=[];for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++)if(x*x+y*y<=r*r)p.push([cx+x,cy+y]);return p}
function drawRect(x0,y0,x1,y1){return[...bresenhamLine(x0,y0,x1,y0),...bresenhamLine(x1,y0,x1,y1),...bresenhamLine(x1,y1,x0,y1),...bresenhamLine(x0,y1,x0,y0)]}
function fillRect(x0,y0,x1,y1){const p=[],lx=Math.min(x0,x1),rx=Math.max(x0,x1),ty=Math.min(y0,y1),by=Math.max(y0,y1);for(let y=ty;y<=by;y++)for(let x=lx;x<=rx;x++)p.push([x,y]);return p}
function drawTriangle(x0,y0,x1,y1,x2,y2){return[...bresenhamLine(x0,y0,x1,y1),...bresenhamLine(x1,y1,x2,y2),...bresenhamLine(x2,y2,x0,y0)]}
function fillTriangle(x0,y0,x1,y1,x2,y2){
  const pts=[],minY=Math.min(y0,y1,y2),maxY=Math.max(y0,y1,y2)
  for(let y=minY;y<=maxY;y++){
    const xs=[];const check=(ax,ay,bx,by)=>{if((ay<=y&&by>y)||(by<=y&&ay>y))xs.push(Math.round(ax+(y-ay)*(bx-ax)/(by-ay)))}
    check(x0,y0,x1,y1);check(x1,y1,x2,y2);check(x2,y2,x0,y0)
    if(xs.length>=2){xs.sort((a,b)=>a-b);for(let x=xs[0];x<=xs[xs.length-1];x++)pts.push([x,y])}
  }
  return pts
}

const PALETTE = ['#000000','#ffffff','#ff0000','#ff6600','#ffaa00','#ffff00','#00cc00','#00aaff','#0000ff','#8800ff','#ff00aa','#ff88aa','#8B4513','#808080','#c0c0c0','#00ffff']

/* ═══════════════════════════════════════════════════════════
   PIXEL TOOLBAR
══════════════════════════════════════════════════════════════ */
function PixelToolbar({ color, setColor, brushSize, setBrushSize, tool, setTool, onClear, onUndo, fillMode, setFillMode }) {
  const tools = [
    {id:'pen',label:'✏️',title:'Crayon'},
    {id:'eraser',label:'⬜',title:'Gomme'},
    {id:'line',label:'╱',title:'Ligne'},
    {id:'rect',label:'▭',title:'Rectangle'},
    {id:'circle',label:'○',title:'Cercle'},
    {id:'triangle',label:'△',title:'Triangle'},
  ]
  const S = (active, extra={}) => ({
    background: active ? 'linear-gradient(135deg,#a855f7,#3b82f6)' : 'rgba(255,255,255,0.06)',
    color:'#fff', border: active?'1.5px solid #a855f7':'1.5px solid transparent',
    borderRadius:'8px', padding:'0.45rem', fontSize:'0.95rem',
    boxShadow: active?'0 3px 12px rgba(168,85,247,0.35)':'none', ...extra
  })

  return (
    <div style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'12px',padding:'0.8rem',display:'flex',flexDirection:'column',gap:'0.75rem',width:'190px',flexShrink:0}}>
      <div>
        <div style={lbl}>Outils</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'0.3rem'}}>
          {tools.map(t=><button key={t.id} title={t.title} onClick={()=>setTool(t.id)} style={S(tool===t.id)}>{t.label}</button>)}
        </div>
      </div>

      {['rect','circle','triangle'].includes(tool) && (
        <div style={{display:'flex',gap:'0.3rem'}}>
          {[['Contour',false],['Rempli',true]].map(([lbl2,val])=>(
            <button key={lbl2} onClick={()=>setFillMode(val)} style={{...S(fillMode===val,{flex:1,fontSize:'0.72rem',padding:'0.3rem'})}}>
              {lbl2}
            </button>
          ))}
        </div>
      )}

      <div>
        <div style={lbl}>Taille : {brushSize}px</div>
        <input type="range" min="1" max="10" value={brushSize} onChange={e=>setBrushSize(Number(e.target.value))} style={{width:'100%',accentColor:'#a855f7',marginBottom:'0.35rem'}}/>
        <div style={{display:'flex',gap:'0.25rem'}}>
          {[1,2,4,7,10].map(s=><button key={s} onClick={()=>setBrushSize(s)} style={{...S(brushSize===s,{flex:1,fontSize:'0.7rem',padding:'0.2rem 0'})}}>{s}</button>)}
        </div>
      </div>

      <div>
        <div style={lbl}>Couleur</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'0.25rem',marginBottom:'0.35rem'}}>
          {PALETTE.map(c=>(
            <button key={c} onClick={()=>setColor(c)} style={{aspectRatio:'1',background:c,borderRadius:'5px',border:color===c?'2.5px solid #fff':'2px solid rgba(255,255,255,0.15)',padding:0,boxShadow:color===c?`0 0 8px ${c}80`:'none'}} />
          ))}
        </div>
        <input type="color" value={color} onChange={e=>setColor(e.target.value)} style={{width:'100%',height:'30px',borderRadius:'6px',border:'1px solid rgba(255,255,255,0.15)',cursor:'pointer',background:'none'}}/>
      </div>

      <div style={{display:'flex',gap:'0.3rem'}}>
        <button onClick={onUndo} style={{flex:1,background:'rgba(255,255,255,0.06)',color:'#fff',borderRadius:'7px',padding:'0.4rem',fontSize:'0.75rem',border:'1px solid rgba(255,255,255,0.1)'}}>↩ Annuler</button>
        <button onClick={onClear} style={{flex:1,background:'rgba(239,68,68,0.12)',color:'#fca5a5',borderRadius:'7px',padding:'0.4rem',fontSize:'0.75rem',border:'1px solid rgba(239,68,68,0.2)'}}>🗑 Effacer</button>
      </div>
    </div>
  )
}

const lbl = {fontSize:'0.7rem',color:'rgba(255,255,255,0.4)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'0.4rem'}

/* ═══════════════════════════════════════════════════════════
   NORMAL DRAWING TOOLBAR
══════════════════════════════════════════════════════════════ */
function NormalToolbar({ color, setColor, brushSize, setBrushSize, tool, setTool, onClear, onUndo }) {
  const tools = [{id:'pen',label:'✏️'},{id:'eraser',label:'⬜'}]
  const S = active => ({background:active?'linear-gradient(135deg,#a855f7,#3b82f6)':'rgba(255,255,255,0.06)',color:'#fff',border:active?'1.5px solid #a855f7':'1.5px solid transparent',borderRadius:'8px',padding:'0.5rem 0.7rem',fontSize:'0.95rem'})
  return (
    <div style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'12px',padding:'0.8rem',display:'flex',flexDirection:'column',gap:'0.75rem',width:'190px',flexShrink:0}}>
      <div>
        <div style={lbl}>Outils</div>
        <div style={{display:'flex',gap:'0.4rem'}}>
          {tools.map(t=><button key={t.id} onClick={()=>setTool(t.id)} style={S(tool===t.id)}>{t.label}</button>)}
        </div>
      </div>
      <div>
        <div style={lbl}>Taille : {brushSize}px</div>
        <input type="range" min="1" max="30" value={brushSize} onChange={e=>setBrushSize(Number(e.target.value))} style={{width:'100%',accentColor:'#a855f7',marginBottom:'0.3rem'}}/>
        <div style={{display:'flex',gap:'0.25rem'}}>
          {[3,6,12,20,30].map(s=><button key={s} onClick={()=>setBrushSize(s)} style={{flex:1,background:brushSize===s?'linear-gradient(135deg,#a855f7,#3b82f6)':'rgba(255,255,255,0.06)',color:'#fff',borderRadius:'6px',padding:'0.2rem 0',fontSize:'0.7rem',border:'none'}}>{s}</button>)}
        </div>
      </div>
      <div>
        <div style={lbl}>Couleur</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'0.25rem',marginBottom:'0.35rem'}}>
          {PALETTE.map(c=><button key={c} onClick={()=>setColor(c)} style={{aspectRatio:'1',background:c,borderRadius:'5px',border:color===c?'2.5px solid #fff':'2px solid rgba(255,255,255,0.15)',padding:0}}/>)}
        </div>
        <input type="color" value={color} onChange={e=>setColor(e.target.value)} style={{width:'100%',height:'30px',borderRadius:'6px',border:'1px solid rgba(255,255,255,0.15)',cursor:'pointer',background:'none'}}/>
      </div>
      <div style={{display:'flex',gap:'0.3rem'}}>
        <button onClick={onUndo} style={{flex:1,background:'rgba(255,255,255,0.06)',color:'#fff',borderRadius:'7px',padding:'0.4rem',fontSize:'0.75rem',border:'1px solid rgba(255,255,255,0.1)'}}>↩ Annuler</button>
        <button onClick={onClear} style={{flex:1,background:'rgba(239,68,68,0.12)',color:'#fca5a5',borderRadius:'7px',padding:'0.4rem',fontSize:'0.75rem',border:'1px solid rgba(239,68,68,0.2)'}}>🗑 Effacer</button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   TIMER BAR
══════════════════════════════════════════════════════════════ */
function TimerBar({ timeLeft, maxTime }) {
  const pct = Math.max(0, Math.min(100, (timeLeft/maxTime)*100))
  const color = pct>50?'#22c55e':pct>25?'#eab308':'#ef4444'
  return (
    <div style={{background:'rgba(255,255,255,0.06)',borderRadius:'99px',height:'8px',overflow:'hidden',width:'100%',marginBottom:'0.5rem'}}>
      <div style={{width:`${pct}%`,height:'100%',background:color,borderRadius:'99px',transition:'width 1s linear, background 0.3s',boxShadow:`0 0 8px ${color}80`}}/>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   SUBMISSION COUNTER
══════════════════════════════════════════════════════════════ */
function SubmissionCounter({ count, total }) {
  if (!total) return null
  return (
    <div style={{display:'flex',alignItems:'center',gap:'0.5rem',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'8px',padding:'0.4rem 0.8rem',fontSize:'0.82rem',fontWeight:700,color:'rgba(255,255,255,0.6)'}}>
      <span>Soumissions :</span>
      <div style={{display:'flex',gap:'0.2rem'}}>
        {Array.from({length:total}).map((_,i)=>(
          <div key={i} style={{width:'10px',height:'10px',borderRadius:'50%',background:i<count?'#22c55e':'rgba(255,255,255,0.15)',boxShadow:i<count?'0 0 6px #22c55e':'none',transition:'all 0.3s'}}/>
        ))}
      </div>
      <span style={{color: count===total?'#86efac':'inherit'}}>{count}/{total}</span>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   NORMAL CANVAS HOOK
══════════════════════════════════════════════════════════════ */
function useNormalCanvas() {
  const canvasRef = useRef(null)
  const isDrawingRef = useRef(false)
  const lastPosRef = useRef(null)
  const historyRef = useRef([])
  const [color, setColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(6)
  const [tool, setTool] = useState('pen')

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = 600; canvas.height = 450
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    historyRef.current = []
  }, [])

  useEffect(() => { if (canvasRef.current) initCanvas() }, [initCanvas])

  const getPos = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const scaleX = canvasRef.current.width / rect.width
    const scaleY = canvasRef.current.height / rect.height
    const cx = e.touches ? e.touches[0].clientX : e.clientX
    const cy = e.touches ? e.touches[0].clientY : e.clientY
    return { x: (cx - rect.left)*scaleX, y: (cy - rect.top)*scaleY }
  }, [])

  const saveHistory = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    historyRef.current.push(canvas.toDataURL())
    if (historyRef.current.length > 20) historyRef.current.shift()
  }, [])

  const handleMouseDown = useCallback((e) => {
    saveHistory()
    isDrawingRef.current = true
    const pos = getPos(e)
    lastPosRef.current = pos
    const ctx = canvasRef.current.getContext('2d')
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y)
  }, [getPos, saveHistory])

  const handleMouseMove = useCallback((e) => {
    if (!isDrawingRef.current) return
    const pos = getPos(e)
    const ctx = canvasRef.current.getContext('2d')
    ctx.lineWidth = brushSize
    if (tool === 'eraser') {
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = brushSize * 2
    } else {
      ctx.strokeStyle = color
    }
    ctx.lineTo(pos.x, pos.y); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y)
    lastPosRef.current = pos
  }, [color, brushSize, tool, getPos])

  const handleMouseUp = useCallback(() => { isDrawingRef.current = false }, [])

  const handleClear = useCallback(() => {
    saveHistory()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [saveHistory])

  const handleUndo = useCallback(() => {
    if (!historyRef.current.length) return
    const prev = historyRef.current.pop()
    const img = new Image()
    img.src = prev
    img.onload = () => {
      const ctx = canvasRef.current.getContext('2d')
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      ctx.drawImage(img, 0, 0)
    }
  }, [])

  return { canvasRef, color, setColor, brushSize, setBrushSize, tool, setTool, handleMouseDown, handleMouseMove, handleMouseUp, handleClear, handleUndo, initCanvas }
}

/* ═══════════════════════════════════════════════════════════
   PIXEL CANVAS HOOK
══════════════════════════════════════════════════════════════ */
function usePixelCanvas() {
  const canvasRef = useRef(null)
  const pixelsRef = useRef(null)
  const historyRef = useRef([])
  const isDrawingRef = useRef(false)
  const startPixelRef = useRef(null)
  const previewRef = useRef(null)
  const [color, setColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(2)
  const [tool, setTool] = useState('pen')
  const [fillMode, setFillMode] = useState(false)

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !pixelsRef.current) return
    const ctx = canvas.getContext('2d')
    const imgData = new ImageData(new Uint8ClampedArray(pixelsRef.current), CANVAS_W, CANVAS_H)
    const off = new OffscreenCanvas(CANVAS_W, CANVAS_H)
    const octx = off.getContext('2d')
    octx.putImageData(imgData, 0, 0)
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, CANVAS_W*PIXEL_SIZE, CANVAS_H*PIXEL_SIZE)
    ctx.drawImage(off, 0, 0, CANVAS_W*PIXEL_SIZE, CANVAS_H*PIXEL_SIZE)
    // subtle grid
    ctx.strokeStyle = 'rgba(0,0,0,0.04)'; ctx.lineWidth = 0.5
    for(let x=0;x<CANVAS_W;x+=8){ctx.beginPath();ctx.moveTo(x*PIXEL_SIZE,0);ctx.lineTo(x*PIXEL_SIZE,CANVAS_H*PIXEL_SIZE);ctx.stroke()}
    for(let y=0;y<CANVAS_H;y+=8){ctx.beginPath();ctx.moveTo(0,y*PIXEL_SIZE);ctx.lineTo(CANVAS_W*PIXEL_SIZE,y*PIXEL_SIZE);ctx.stroke()}
  }, [])

  const initPixels = useCallback(() => {
    const buf = new Uint8ClampedArray(CANVAS_W*CANVAS_H*4)
    for(let i=0;i<CANVAS_W*CANVAS_H;i++){buf[i*4]=255;buf[i*4+1]=255;buf[i*4+2]=255;buf[i*4+3]=255}
    pixelsRef.current = buf
    historyRef.current = []
    renderCanvas()
  }, [renderCanvas])

  useEffect(() => { if (canvasRef.current) initPixels() }, [initPixels])

  const setPixel = useCallback((buf, px, py, r, g, b) => {
    if(px<0||py<0||px>=CANVAS_W||py>=CANVAS_H) return
    const i=(py*CANVAS_W+px)*4; buf[i]=r;buf[i+1]=g;buf[i+2]=b;buf[i+3]=255
  }, [])

  const paintPoints = useCallback((pts, hexColor, buf) => {
    const [r,g,b] = hexToRgb(hexColor), target=buf||pixelsRef.current
    for(const [px,py] of pts) for(let dy=0;dy<brushSize;dy++) for(let dx=0;dx<brushSize;dx++) setPixel(target,px+dx-(brushSize>>1),py+dy-(brushSize>>1),r,g,b)
  }, [brushSize, setPixel])

  const erasePoints = useCallback((pts, buf) => {
    const target=buf||pixelsRef.current
    for(const [px,py] of pts) for(let dy=0;dy<brushSize*2;dy++) for(let dx=0;dx<brushSize*2;dx++) setPixel(target,px+dx-brushSize,py+dy-brushSize,255,255,255)
  }, [brushSize, setPixel])

  const getPixelPos = useCallback((e) => {
    const canvas=canvasRef.current, rect=canvas.getBoundingClientRect()
    const scaleX=CANVAS_W/rect.width, scaleY=CANVAS_H/rect.height
    return {px:Math.floor((e.clientX-rect.left)*scaleX), py:Math.floor((e.clientY-rect.top)*scaleY)}
  }, [])

  const saveHistory = useCallback(() => {
    if(!pixelsRef.current) return
    historyRef.current.push(new Uint8ClampedArray(pixelsRef.current))
    if(historyRef.current.length>20) historyRef.current.shift()
  }, [])

  const handleMouseDown = useCallback((e) => {
    if(!pixelsRef.current) return
    const {px,py}=getPixelPos(e); isDrawingRef.current=true; startPixelRef.current={px,py}; saveHistory()
    if(tool==='pen'){paintPoints([[px,py]],color);renderCanvas()}
    else if(tool==='eraser'){erasePoints([[px,py]]);renderCanvas()}
    else{previewRef.current=new Uint8ClampedArray(pixelsRef.current)}
  }, [tool,color,getPixelPos,paintPoints,erasePoints,renderCanvas,saveHistory])

  const handleMouseMove = useCallback((e) => {
    if(!isDrawingRef.current||!pixelsRef.current) return
    const {px,py}=getPixelPos(e), start=startPixelRef.current
    if(tool==='pen'){
      if(start){paintPoints(bresenhamLine(start.px,start.py,px,py),color);startPixelRef.current={px,py};renderCanvas()}
    } else if(tool==='eraser'){
      erasePoints([[px,py]]);startPixelRef.current={px,py};renderCanvas()
    } else if(previewRef.current&&start){
      pixelsRef.current.set(previewRef.current)
      let pts=[]
      if(tool==='line') pts=bresenhamLine(start.px,start.py,px,py)
      else if(tool==='rect') pts=fillMode?fillRect(start.px,start.py,px,py):drawRect(start.px,start.py,px,py)
      else if(tool==='circle'){const r=Math.round(Math.hypot(px-start.px,py-start.py));pts=fillMode?fillCircle(start.px,start.py,r):bresenhamCircle(start.px,start.py,r)}
      else if(tool==='triangle'){const mx=Math.round((start.px+px)/2);pts=fillMode?fillTriangle(mx,start.py,px,py,start.px,py):drawTriangle(mx,start.py,px,py,start.px,py)}
      paintPoints(pts,color);renderCanvas()
    }
  }, [tool,color,fillMode,getPixelPos,paintPoints,erasePoints,renderCanvas])

  const handleMouseUp = useCallback(() => { isDrawingRef.current=false; startPixelRef.current=null; previewRef.current=null }, [])

  const handleClear = useCallback(() => { saveHistory(); initPixels() }, [initPixels, saveHistory])
  const handleUndo = useCallback(() => {
    if(!historyRef.current.length) return
    pixelsRef.current=new Uint8ClampedArray(historyRef.current.pop()); renderCanvas()
  }, [renderCanvas])

  return { canvasRef, color, setColor, brushSize, setBrushSize, tool, setTool, fillMode, setFillMode, handleMouseDown, handleMouseMove, handleMouseUp, handleClear, handleUndo, initPixels }
}

/* ═══════════════════════════════════════════════════════════
   DRAWING PHASE (mode-aware)
══════════════════════════════════════════════════════════════ */
function DrawingPhase({ currentContent, timeLeft, maxTime, hasSubmitted, onSubmit, submittedCount, totalPlayers, drawMode }) {
  const pixel = usePixelCanvas()
  const normal = useNormalCanvas()

  const isPixel = drawMode === 'pixel'
  const canvasRef = isPixel ? pixel.canvasRef : normal.canvasRef
  const color = isPixel ? pixel.color : normal.color
  const setColor = isPixel ? pixel.setColor : normal.setColor
  const brushSize = isPixel ? pixel.brushSize : normal.brushSize
  const setBrushSize = isPixel ? pixel.setBrushSize : normal.setBrushSize
  const tool = isPixel ? pixel.tool : normal.tool
  const setTool = isPixel ? pixel.setTool : normal.setTool

  const handleSubmit = () => {
    if (hasSubmitted || !canvasRef.current) return
    onSubmit(canvasRef.current.toDataURL())
  }

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.8rem',flexWrap:'wrap',gap:'0.5rem'}}>
        <h2 style={{fontFamily:"'Fredoka One',cursive",fontSize:'1.5rem',color:'#fff',margin:0}}>🎨 Dessine !</h2>
        <div style={{display:'flex',alignItems:'center',gap:'0.6rem',flexWrap:'wrap'}}>
          <SubmissionCounter count={submittedCount} total={totalPlayers} />
          <TimerChip timeLeft={timeLeft} />
        </div>
      </div>
      <TimerBar timeLeft={timeLeft} maxTime={maxTime} />

      {currentContent && (
        <div style={{background:'rgba(168,85,247,0.1)',border:'1px solid rgba(168,85,247,0.3)',borderRadius:'10px',padding:'0.7rem 1rem',marginBottom:'1rem',textAlign:'center'}}>
          <span style={{color:'rgba(255,255,255,0.5)',fontSize:'0.78rem',display:'block',marginBottom:'0.2rem'}}>Dessine cette phrase :</span>
          <strong style={{fontSize:'1.05rem',color:'#e9d5ff'}}>"{currentContent}"</strong>
        </div>
      )}

      {hasSubmitted ? (
        <SubmittedBanner label="dessin" submittedCount={submittedCount} totalPlayers={totalPlayers} />
      ) : (
        <div style={{display:'flex',gap:'1rem',alignItems:'flex-start',flexWrap:'wrap'}}>
          {isPixel ? (
            <PixelToolbar color={color} setColor={setColor} brushSize={brushSize} setBrushSize={setBrushSize} tool={tool} setTool={setTool} onClear={pixel.handleClear} onUndo={pixel.handleUndo} fillMode={pixel.fillMode} setFillMode={pixel.setFillMode} />
          ) : (
            <NormalToolbar color={color} setColor={setColor} brushSize={brushSize} setBrushSize={setBrushSize} tool={tool} setTool={setTool} onClear={normal.handleClear} onUndo={normal.handleUndo} />
          )}

          <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:'0.8rem',alignItems:'center'}}>
            {isPixel ? (
              <div style={{display:'inline-block',border:'3px solid rgba(255,255,255,0.15)',borderRadius:'8px',overflow:'hidden',cursor:'crosshair',boxShadow:'0 8px 32px rgba(0,0,0,0.5)',flexShrink:0}}>
                <canvas
                  ref={pixel.canvasRef}
                  width={CANVAS_W*PIXEL_SIZE} height={CANVAS_H*PIXEL_SIZE}
                  style={{display:'block',imageRendering:'pixelated',touchAction:'none'}}
                  onMouseDown={pixel.handleMouseDown} onMouseMove={pixel.handleMouseMove}
                  onMouseUp={pixel.handleMouseUp} onMouseLeave={pixel.handleMouseUp}
                />
              </div>
            ) : (
              <div style={{border:'3px solid rgba(255,255,255,0.15)',borderRadius:'8px',overflow:'hidden',cursor:'crosshair',boxShadow:'0 8px 32px rgba(0,0,0,0.5)',width:'100%',maxWidth:'600px'}}>
                <canvas
                  ref={normal.canvasRef}
                  style={{display:'block',width:'100%',touchAction:'none'}}
                  onMouseDown={normal.handleMouseDown} onMouseMove={normal.handleMouseMove}
                  onMouseUp={normal.handleMouseUp} onMouseLeave={normal.handleMouseUp}
                />
              </div>
            )}

            <div style={{display:'flex',alignItems:'center',gap:'0.8rem',width:'100%',maxWidth: isPixel?`${CANVAS_W*PIXEL_SIZE}px`:'600px'}}>
              <span style={{fontSize:'0.72rem',color:'rgba(255,255,255,0.25)',fontWeight:600}}>
                {isPixel ? `${CANVAS_W}×${CANVAS_H}px · Zoom ×${PIXEL_SIZE}` : '600×450px · Libre'}
              </span>
              <button onClick={handleSubmit} style={{marginLeft:'auto',background:'linear-gradient(135deg,#22c55e,#16a34a)',color:'#fff',padding:'0.65rem 1.4rem',borderRadius:'10px',fontWeight:800,fontSize:'0.9rem',border:'none',boxShadow:'0 4px 15px rgba(34,197,94,0.3)'}}>
                ✅ Soumettre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TimerChip({ timeLeft }) {
  const color = timeLeft > 30 ? '#86efac' : timeLeft > 10 ? '#fde68a' : '#fca5a5'
  const bg = timeLeft > 30 ? 'rgba(34,197,94,0.15)' : timeLeft > 10 ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.15)'
  const border = timeLeft > 30 ? 'rgba(34,197,94,0.3)' : timeLeft > 10 ? 'rgba(234,179,8,0.3)' : 'rgba(239,68,68,0.3)'
  return (
    <div style={{background:bg,border:`1px solid ${border}`,borderRadius:'8px',padding:'0.35rem 0.8rem',fontSize:'1.1rem',fontWeight:900,color,fontVariantNumeric:'tabular-nums'}}>
      ⏱ {timeLeft}s
    </div>
  )
}

function SubmittedBanner({ label, submittedCount, totalPlayers }) {
  return (
    <div style={{textAlign:'center',padding:'2.5rem',background:'rgba(34,197,94,0.08)',border:'1px solid rgba(34,197,94,0.22)',borderRadius:'12px',color:'#86efac',fontWeight:700,fontSize:'1rem'}}>
      <div style={{fontSize:'2.5rem',marginBottom:'0.5rem'}}>✅</div>
      <div style={{fontSize:'1.1rem',marginBottom:'0.5rem'}}>Ton {label} a été envoyé !</div>
      <div style={{fontSize:'0.85rem',color:'rgba(255,255,255,0.4)'}}>
        En attente des autres... ({submittedCount}/{totalPlayers})
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   SHOWCASE PHASE
══════════════════════════════════════════════════════════════ */
function ShowcasePhase({ showcaseChains, showcaseIndex, players, onNext, ws }) {
  const chain = showcaseChains?.[showcaseIndex]
  const total = showcaseChains?.length || 0

  // Find the first phrase author to label the chain
  const firstItem = chain?.[0]
  const startPlayer = players.find(p => p.id === firstItem?.author)

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.2rem',flexWrap:'wrap',gap:'0.8rem'}}>
        <div>
          <h2 style={{fontFamily:"'Fredoka One',cursive",fontSize:'1.6rem',color:'#fff',margin:'0 0 0.2rem'}}>
            🎭 Showcase des dessins
          </h2>
          <p style={{color:'rgba(255,255,255,0.4)',fontSize:'0.85rem',margin:0}}>
            Chaîne {showcaseIndex+1} sur {total}
          </p>
        </div>
        <button
          onClick={onNext}
          style={{background:'linear-gradient(135deg,#a855f7,#3b82f6)',color:'#fff',padding:'0.75rem 1.5rem',borderRadius:'12px',fontWeight:800,fontSize:'0.95rem',border:'none',boxShadow:'0 4px 16px rgba(168,85,247,0.35)'}}>
          {showcaseIndex + 1 >= total ? '🏆 Voir les résultats' : 'Suivant →'}
        </button>
      </div>

      {/* Progress dots */}
      <div style={{display:'flex',gap:'0.4rem',marginBottom:'1.2rem'}}>
        {Array.from({length:total}).map((_,i)=>(
          <div key={i} style={{flex:1,height:'4px',borderRadius:'99px',background:i<=showcaseIndex?'linear-gradient(90deg,#a855f7,#3b82f6)':'rgba(255,255,255,0.1)',transition:'background 0.3s'}}/>
        ))}
      </div>

      {startPlayer && (
        <div style={{textAlign:'center',marginBottom:'1rem'}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:'0.5rem',background:'linear-gradient(135deg,rgba(168,85,247,0.25),rgba(59,130,246,0.2))',border:'1px solid rgba(168,85,247,0.4)',borderRadius:'99px',padding:'0.4rem 1rem',fontWeight:800,fontSize:'0.9rem'}}>
            {startPlayer.avatar || '😀'} Chaîne de <strong style={{color:'#e9d5ff'}}>{startPlayer.name}</strong>
          </div>
        </div>
      )}

      {/* Chain items */}
      <div style={{display:'flex',flexDirection:'column',gap:'0.8rem',maxWidth:'700px',margin:'0 auto'}}>
        {chain?.map((item, idx) => {
          const author = players.find(p => p.id === item.author)
          return (
            <div key={idx} style={{
              background: item.type==='phrase' ? 'rgba(168,85,247,0.1)' : 'rgba(255,107,53,0.08)',
              border: `1px solid ${item.type==='phrase'?'rgba(168,85,247,0.25)':'rgba(255,107,53,0.2)'}`,
              borderRadius:'12px', padding:'1rem',
              animation: 'fadeUp 0.4s ease both',
              animationDelay: `${idx*0.08}s`,
            }}>
              <div style={{fontSize:'0.72rem',color:'rgba(255,255,255,0.4)',marginBottom:'0.5rem',textTransform:'uppercase',letterSpacing:'0.06em',display:'flex',alignItems:'center',gap:'0.4rem'}}>
                {item.type==='phrase' ? '✍️ Phrase' : '🎨 Dessin'} — par
                <span style={{color:item.type==='phrase'?'#d8b4fe':'#fdba74',fontWeight:700}}>
                  {author?.name || 'Joueur'} {author?.avatar || '😀'}
                </span>
              </div>
              {item.type==='phrase' ? (
                <div style={{fontStyle:'italic',color:'#e9d5ff',fontWeight:700,fontSize:'1.05rem'}}>"{item.content}"</div>
              ) : (
                <img src={item.content} alt="Dessin" style={{width:'100%',maxWidth:'400px',borderRadius:'6px',imageRendering:'pixelated',border:'1px solid rgba(255,255,255,0.1)',display:'block',margin:'0 auto'}}/>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   MAIN GAME PHASE
══════════════════════════════════════════════════════════════ */
const MAX_PHRASE_TIME = 60
const MAX_DRAW_TIME = 120

function GamePhase({ pseudo, ws, drawMode }) {
  const [gameState, setGameState] = useState('waiting')
  const [currentRound, setCurrentRound] = useState(0)
  const [maxRounds, setMaxRounds] = useState(3)
  const [timeLeft, setTimeLeft] = useState(0)
  const [content, setContent] = useState('')
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [players, setPlayers] = useState([])
  const [currentContent, setCurrentContent] = useState(null)
  const [allChains, setAllChains] = useState({})
  const [submittedCount, setSubmittedCount] = useState(0)
  const [showcaseChains, setShowcaseChains] = useState([])
  const [showcaseIndex, setShowcaseIndex] = useState(0)
  const [maxTime, setMaxTime] = useState(MAX_DRAW_TIME)
  const prevState = useRef(null)

  useEffect(() => {
    if (!ws) return
    const handleGameState = (msg) => {
      const resolvedState = msg.phase ?? msg.state ?? 'waiting'
      const prev = prevState.current

      // Reset submission on phase change
      if (prev && prev !== resolvedState) {
        setHasSubmitted(false)
        setContent('')
      }
      prevState.current = resolvedState

      setGameState(resolvedState)
      setCurrentRound(msg.round || 0)
      setMaxRounds(msg.maxRounds || 3)
      setTimeLeft(msg.timeLeft || 0)
      setPlayers(msg.players || [])
      setCurrentContent(msg.content ?? msg.currentContent ?? null)
      setAllChains(msg.allChains || {})
      setSubmittedCount(msg.submittedCount || 0)
      setShowcaseChains(msg.showcaseChains || [])
      setShowcaseIndex(msg.showcaseIndex || 0)

      if (resolvedState === 'phrase') setMaxTime(MAX_PHRASE_TIME)
      if (resolvedState === 'drawing') setMaxTime(MAX_DRAW_TIME)

      if (msg.assigned?.length > 0) {
        setCurrentContent(msg.assigned[0]?.content ?? null)
      }
    }
    const handleCountdown = (msg) => setTimeLeft(msg.timeLeft)
    ws.on('game_state', handleGameState)
    ws.on('game_countdown', handleCountdown)
    return () => { ws.off('game_state', handleGameState); ws.off('game_countdown', handleCountdown) }
  }, [ws])

  const handleStartGame = () => ws?.emit('start_game')

  const card = {background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'1.5rem',boxShadow:'var(--shadow)',width:'100%'}

  /* WAITING */
  if (gameState === 'waiting') {
    return (
      <div style={{...card, maxWidth:'700px', margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:'1.5rem'}}>
          <div style={{fontSize:'3rem',marginBottom:'0.4rem'}}>🎮</div>
          <h2 style={{fontFamily:"'Fredoka One',cursive",fontSize:'1.8rem',color:'#fff',margin:'0 0 0.3rem'}}>Salle d'attente</h2>
          <p style={{color:'rgba(255,255,255,0.4)',fontSize:'0.88rem'}}>Il faut au moins 2 joueurs pour démarrer</p>
        </div>

        <div style={{background:'rgba(255,255,255,0.03)',borderRadius:'12px',padding:'1rem',marginBottom:'1.2rem',minHeight:'80px'}}>
          <div style={{fontSize:'0.72rem',fontWeight:700,color:'rgba(255,255,255,0.35)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'0.6rem'}}>
            Joueurs ({players.length})
          </div>
          {players.length === 0 ? (
            <p style={{color:'rgba(255,255,255,0.2)',fontSize:'0.9rem',textAlign:'center',padding:'0.5rem 0'}}>Personne encore...</p>
          ) : (
            <div style={{display:'flex',flexWrap:'wrap',gap:'0.5rem'}}>
              {players.map(p=>(
                <div key={p.id} style={{
                  background: p.name===pseudo?'linear-gradient(135deg,rgba(168,85,247,0.3),rgba(59,130,246,0.3))':'rgba(255,255,255,0.06)',
                  border: `1px solid ${p.name===pseudo?'rgba(168,85,247,0.4)':'rgba(255,255,255,0.08)'}`,
                  borderRadius:'20px',padding:'0.35rem 0.85rem',fontSize:'0.85rem',fontWeight:700,
                  color:p.name===pseudo?'#fff':'rgba(255,255,255,0.7)',
                }}>
                  {p.avatar||'😀'} {p.name} {p.name===pseudo&&'(toi)'}
                </div>
              ))}
            </div>
          )}
        </div>

        <button onClick={handleStartGame} disabled={players.length<2} style={{
          width:'100%',padding:'1rem',
          background:players.length>=2?'linear-gradient(135deg,#a855f7,#3b82f6)':'rgba(255,255,255,0.06)',
          color:players.length>=2?'#fff':'rgba(255,255,255,0.25)',
          borderRadius:'12px',fontSize:'1.05rem',fontWeight:800,border:'none',
          boxShadow:players.length>=2?'0 8px 25px rgba(168,85,247,0.3)':'none',
          cursor:players.length>=2?'pointer':'not-allowed',
        }}>
          {players.length>=2?'🚀 Lancer la partie !': `⏳ En attente de joueurs... (${players.length}/2)`}
        </button>
      </div>
    )
  }

  /* PHRASE */
  if (gameState === 'phrase') {
    return (
      <div style={card}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.8rem',flexWrap:'wrap',gap:'0.5rem'}}>
          <div>
            <h2 style={{fontFamily:"'Fredoka One',cursive",fontSize:'1.5rem',color:'#fff',margin:'0 0 0.15rem'}}>✍️ Écris une phrase !</h2>
            <div style={{fontSize:'0.78rem',color:'rgba(255,255,255,0.3)'}}>Tour {currentRound}/{maxRounds}</div>
          </div>
          <div style={{display:'flex',gap:'0.6rem',alignItems:'center',flexWrap:'wrap'}}>
            <SubmissionCounter count={submittedCount} total={players.length} />
            <TimerChip timeLeft={timeLeft} />
          </div>
        </div>
        <TimerBar timeLeft={timeLeft} maxTime={maxTime} />

        {currentContent && (
          <div style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'10px',padding:'1rem',marginBottom:'1rem',textAlign:'center'}}>
            <p style={{color:'rgba(255,255,255,0.4)',fontSize:'0.75rem',marginBottom:'0.5rem',textTransform:'uppercase',letterSpacing:'0.05em'}}>Basé sur le dessin :</p>
            <img src={currentContent} alt="Dessin précédent" style={{maxWidth:'100%',maxHeight:'200px',borderRadius:'6px',imageRendering:'pixelated'}}/>
          </div>
        )}

        {hasSubmitted ? (
          <SubmittedBanner label="phrase" submittedCount={submittedCount} totalPlayers={players.length} />
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:'0.8rem'}}>
            <textarea value={content} onChange={e=>setContent(e.target.value)} placeholder="Décris quelque chose d'original... 🤪" maxLength={200} rows={3}
              style={{resize:'vertical',minHeight:'80px'}}/>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:'0.8rem',color:'rgba(255,255,255,0.3)'}}>{content.length}/200</span>
              <button onClick={()=>{if(content.trim()&&ws&&!hasSubmitted){ws.emit('submit_phrase',{content:content.trim()});setHasSubmitted(true)}}}
                disabled={!content.trim()}
                style={{background:content.trim()?'linear-gradient(135deg,#a855f7,#3b82f6)':'rgba(255,255,255,0.06)',color:'#fff',padding:'0.7rem 1.4rem',borderRadius:'10px',fontWeight:800,fontSize:'0.9rem',border:'none',cursor:content.trim()?'pointer':'not-allowed'}}>
                📤 Envoyer
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  /* DRAWING */
  if (gameState === 'drawing') {
    return (
      <div style={card}>
        <DrawingPhase
          currentContent={currentContent}
          timeLeft={timeLeft}
          maxTime={maxTime}
          hasSubmitted={hasSubmitted}
          submittedCount={submittedCount}
          totalPlayers={players.length}
          drawMode={drawMode}
          onSubmit={(dataUrl) => {
            if (!hasSubmitted && ws) {
              ws.emit('submit_drawing', { drawing: dataUrl })
              setHasSubmitted(true)
            }
          }}
        />
      </div>
    )
  }

  /* SHOWCASE */
  if (gameState === 'showcase') {
    return (
      <div style={card}>
        <ShowcasePhase
          showcaseChains={showcaseChains}
          showcaseIndex={showcaseIndex}
          players={players}
          ws={ws}
          onNext={() => ws?.emit('next_showcase')}
        />
      </div>
    )
  }

  /* RESULTS */
  if (gameState === 'results') {
    return (
      <div style={card}>
        <div style={{textAlign:'center',marginBottom:'2rem'}}>
          <div style={{fontSize:'3rem',marginBottom:'0.5rem'}}>🏆</div>
          <h2 style={{fontFamily:"'Fredoka One',cursive",fontSize:'2rem',color:'#fff',margin:'0 0 0.3rem'}}>Résultats finaux</h2>
          <p style={{color:'rgba(255,255,255,0.4)'}}>Toutes les chaînes de la partie !</p>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:'1.2rem',marginBottom:'2rem'}}>
          {Object.entries(allChains).map(([playerId, chain]) => {
            const player = players.find(p=>p.id===playerId)
            return (
              <div key={playerId} style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'12px',overflow:'hidden'}}>
                <div style={{background:'linear-gradient(135deg,rgba(168,85,247,0.3),rgba(59,130,246,0.2))',padding:'0.7rem 1rem',fontWeight:800,fontSize:'0.95rem',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
                  {player?.avatar||'😀'} {player?.name||'Joueur'}
                </div>
                <div style={{padding:'0.8rem',display:'flex',flexDirection:'column',gap:'0.6rem'}}>
                  {chain?.length>0?chain.map((item,idx)=>{
                    const auth=players.find(p=>p.id===item.author)
                    return (
                      <div key={idx} style={{background:item.type==='phrase'?'rgba(168,85,247,0.1)':'rgba(255,107,53,0.08)',border:`1px solid ${item.type==='phrase'?'rgba(168,85,247,0.2)':'rgba(255,107,53,0.18)'}`,borderRadius:'8px',padding:'0.6rem'}}>
                        <div style={{fontSize:'0.68rem',color:'rgba(255,255,255,0.35)',marginBottom:'0.3rem',textTransform:'uppercase'}}>
                          {item.type==='phrase'?'✍️':'🎨'} {auth?.name||'?'}
                        </div>
                        {item.type==='phrase'
                          ?<div style={{fontStyle:'italic',color:'#e9d5ff',fontSize:'0.9rem'}}>"{item.content}"</div>
                          :<img src={item.content} alt="" style={{width:'100%',borderRadius:'4px',imageRendering:'pixelated',border:'1px solid rgba(255,255,255,0.08)'}}/>
                        }
                      </div>
                    )
                  }):<p style={{color:'rgba(255,255,255,0.2)',textAlign:'center',padding:'0.5rem',fontSize:'0.85rem'}}>Aucun contenu</p>}
                </div>
              </div>
            )
          })}
        </div>
        <div style={{textAlign:'center'}}>
          <button onClick={handleStartGame} style={{background:'linear-gradient(135deg,#a855f7,#3b82f6)',color:'#fff',padding:'0.9rem 2rem',borderRadius:'12px',fontWeight:800,fontSize:'1.05rem',border:'none',boxShadow:'0 6px 20px rgba(168,85,247,0.35)'}}>
            🎮 Rejouer !
          </button>
        </div>
      </div>
    )
  }

  return null
}

export default GamePhase
