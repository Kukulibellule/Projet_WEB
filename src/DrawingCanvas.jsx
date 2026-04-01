import { useEffect, useRef, useState } from 'react'

const COLORS = ['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500']
const SIZES = [2, 5, 10, 15, 20]
const AVATARS = ['😀', '😎', '🤖', '👽', '🐱', '🐶', '🦄', '🍕']

function DrawingCanvas({ pseudo }) {
  const canvasRef = useRef(null)
  const [ws, setWs] = useState(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 })
  const [players, setPlayers] = useState([])
  const [player, setPlayer] = useState(null)
  const [color, setColor] = useState('#000000')
  const [size, setSize] = useState(5)
  const [tool, setTool] = useState('pen')
  const [avatar, setAvatar] = useState('😀')
  const [joined, setJoined] = useState(false)

  useEffect(() => {
    if (!pseudo) return

    const serverUrl = `ws://localhost:3001`
    const websocket = new WebSocket(serverUrl)

    websocket.onopen = () => {
      console.log('Connected to drawing server')
      setWs(websocket)
      // Auto-join with the shared pseudo
      websocket.send(JSON.stringify({
        type: 'join',
        name: pseudo,
        color,
        avatar
      }))
      setJoined(true)
    }

    websocket.onmessage = (event) => {
      const msg = JSON.parse(event.data)

      if (msg.type === 'welcome') {
        setPlayer({ id: msg.id, name: pseudo, avatar })
        // Replay all strokes
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        msg.strokes.forEach(stroke => drawStroke(ctx, stroke))
        setPlayers(msg.players)
      } else if (msg.type === 'joined') {
        setPlayers(prev => [...prev, msg.player])
      } else if (msg.type === 'left') {
        setPlayers(prev => prev.filter(p => p.id !== msg.playerId))
      } else if (msg.type === 'players') {
        setPlayers(msg.players)
      } else if (msg.type === 'draw') {
        drawStroke(canvasRef.current.getContext('2d'), msg)
      } else if (msg.type === 'reset') {
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }

    websocket.onclose = () => {
      console.log('Disconnected from drawing server')
      setWs(null)
      setJoined(false)
    }

    return () => {
      websocket.close()
    }
  }, [pseudo])

  const drawStroke = (ctx, stroke) => {
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = stroke.size
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(stroke.x1, stroke.y1)
    ctx.lineTo(stroke.x2, stroke.y2)
    ctx.stroke()
  }

  const getMousePos = (canvas, event) => {
    const rect = canvas.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    }
  }

  const handleMouseDown = (event) => {
    if (!joined || tool === 'eraser') return
    const canvas = canvasRef.current
    const pos = getMousePos(canvas, event)
    setIsDrawing(true)
    setLastPos(pos)
  }

  const handleMouseMove = (event) => {
    if (!isDrawing || !joined) return
    const canvas = canvasRef.current
    const pos = getMousePos(canvas, event)

    const stroke = {
      type: 'draw',
      x1: lastPos.x,
      y1: lastPos.y,
      x2: pos.x,
      y2: pos.y,
      color,
      size,
      tool
    }

    drawStroke(canvas.getContext('2d'), stroke)
    ws.send(JSON.stringify(stroke))
    setLastPos(pos)
  }

  const handleMouseUp = () => {
    setIsDrawing(false)
  }

  const handleReset = () => {
    if (!ws) return
    ws.send(JSON.stringify({ type: 'reset' }))
  }

  return (
    <div className="drawing-app">
      <h2>🎨 Dessin </h2>
      <div className="toolbar">
        <div className="colors">
          {COLORS.map(c => (
            <button
              key={c}
              className={`color ${color === c ? 'selected' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        <div className="sizes">
          {SIZES.map(s => (
            <button
              key={s}
              className={size === s ? 'selected' : ''}
              onClick={() => setSize(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="avatars">
          {AVATARS.map(av => (
            <button
              key={av}
              className={avatar === av ? 'selected' : ''}
              onClick={() => setAvatar(av)}
            >
              {av}
            </button>
          ))}
        </div>
        <button onClick={handleReset}>Reset</button>
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ border: '1px solid #ccc', backgroundColor: 'white' }}
      />
      <div className="players">
        <h3>Joueurs ({players.length})</h3>
        <ul>
          {players.map(p => (
            <li key={p.id}>{p.avatar} {p.name}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default DrawingCanvas