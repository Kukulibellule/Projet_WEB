import { useEffect, useRef, useState } from 'react'

const AVATARS = ['😀', '😎', '🤖', '👽', '🐱', '🐶', '🦄', '🍕']
const COLORS = ['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500']
const SIZES = [2, 5, 10, 15, 20]

function GamePhase({ pseudo, ws }) {
  const [gameState, setGameState] = useState('waiting') // waiting, phrase, drawing, results
  const [currentRound, setCurrentRound] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [content, setContent] = useState('') // current phrase or drawing
  const [players, setPlayers] = useState([])
  const [currentContent, setCurrentContent] = useState(null) // what to draw or phrase to illustrate
  const [drawing, setDrawing] = useState(null) // canvas data for drawing phase
  const [allChains, setAllChains] = useState({}) // results: {playerId: [{type, content, author}, ...]}

  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 })
  const [drawColor, setDrawColor] = useState('#000000')
  const [drawSize, setDrawSize] = useState(5)
  const timerRef = useRef(null)

  // Initialize Socket.IO listeners
  useEffect(() => {
    if (!ws) return

    const handleGameState = (msg) => {
      // Server sends `state`, client expects `gameState`
      setGameState(msg.phase ?? msg.state ?? 'waiting')
      setCurrentRound(msg.round || 0)
      setTimeLeft(msg.timeLeft || 0)
      setPlayers(msg.players || [])
      setCurrentContent(msg.content ?? msg.currentContent)
      setAllChains(msg.allChains || {})
    }

    const handleCountdown = (msg) => {
      setTimeLeft(msg.timeLeft)
    }

    ws.on('game_state', handleGameState)
    ws.on('game_countdown', handleCountdown)

    // Send join_game message
    ws.emit('join_game', { name: pseudo })

    return () => {
      ws.off('game_state', handleGameState)
      ws.off('game_countdown', handleCountdown)
    }
  }, [ws, pseudo])

  const handleStartGame = () => {
    if (ws) {
      ws.emit('start_game')
    }
  }

  const handleSubmitPhrase = () => {
    if (content.trim() && ws) {
      ws.emit('submit_phrase', {
        content: content.trim()
      })
      setContent('')
    }
  }

  const getMousePos = (canvas, event) => {
    const rect = canvas.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    }
  }

  const drawStroke = (ctx, x1, y1, x2, y2, color, size) => {
    ctx.strokeStyle = color
    ctx.lineWidth = size
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }

  const handleMouseDown = (event) => {
    const canvas = canvasRef.current
    const pos = getMousePos(canvas, event)
    setIsDrawing(true)
    setLastPos(pos)
  }

  const handleMouseMove = (event) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const pos = getMousePos(canvas, event)

    drawStroke(ctx, lastPos.x, lastPos.y, pos.x, pos.y, drawColor, drawSize)
    setLastPos(pos)
  }

  const handleMouseUp = () => {
    setIsDrawing(false)
  }

  const handleSubmitDrawing = () => {
    const canvas = canvasRef.current
    const drawingData = canvas.toDataURL()
    if (ws) {
      ws.emit('submit_drawing', {
        drawing: drawingData
      })
    }
  }

  const handleClearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  if (gameState === 'waiting') {
    return (
      <div className="game-lobby">
        <h2>Gartic Phone - En attente</h2>
        <p>Joueurs connectés: {players.length}</p>
        <ul className="player-list">
          {players.map(p => (
            <li key={p.id}>{p.avatar} {p.name}</li>
          ))}
        </ul>
        <button onClick={handleStartGame} className="start-button">
          Lancer la partie
        </button>
      </div>
    )
  }

  if (gameState === 'phrase') {
    return (
      <div className="game-phase phrase-phase">
        <h2>Écris une phrase 🤔</h2>
        <p className="timer">Temps: {timeLeft}s</p>
        {currentContent && (
          <div className="current-content">
            <p>Basé sur le dessin précédent:</p>
            <img src={currentContent} alt="Drawing to inspire" style={{ maxWidth: '200px' }} />
          </div>
        )}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Écris une phrase..."
          maxLength={200}
        />
        <button onClick={handleSubmitPhrase} disabled={!content.trim()}>
          Soumettre
        </button>
      </div>
    )
  }

  if (gameState === 'drawing') {
    return (
      <div className="game-phase drawing-phase">
        <h2>Dessine cette phrase 🎨</h2>
        <p className="timer">Temps: {timeLeft}s</p>
        {currentContent && (
          <div className="current-content">
            <p><strong>"{currentContent}"</strong></p>
          </div>
        )}
        <div className="draw-toolbar">
          <div className="colors">
            {COLORS.map(c => (
              <button
                key={c}
                className={`color ${drawColor === c ? 'selected' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setDrawColor(c)}
              />
            ))}
          </div>
          <div className="sizes">
            {SIZES.map(s => (
              <button
                key={s}
                className={drawSize === s ? 'selected' : ''}
                onClick={() => setDrawSize(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <button onClick={handleClearCanvas}>Effacer</button>
        </div>
        <canvas
          ref={canvasRef}
          width={600}
          height={400}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ border: '2px solid #333', backgroundColor: 'white', display: 'block', margin: '1rem 0' }}
        />
        <button onClick={handleSubmitDrawing} className="submit-button">
          Soumettre le dessin
        </button>
      </div>
    )
  }

  if (gameState === 'results') {
    return (
      <div className="game-results">
        <h2>Résultats 🎉</h2>
        <div className="chains-container">
          {Object.entries(allChains).map(([playerId, chain]) => {
            const player = players.find(p => p.id === playerId)
            return (
              <div key={playerId} className="player-chain">
                <h3>{player?.avatar || '😀'} {player?.name || 'Unknown'}</h3>
                <div className="chain-items">
                  {chain && chain.length > 0 ? (
                    chain.map((item, idx) => (
                      <div key={idx} className="chain-item">
                        {item.type === 'phrase' ? (
                          <div className="phrase-item">
                            <p>"{item.content}"</p>
                            <p className="author">par {item.author}</p>
                          </div>
                        ) : (
                          <div className="drawing-item">
                            <p>Dessin par {item.author}:</p>
                            <img src={item.content} alt="Drawing" />
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p>Pas de contenu</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return null
}

export default GamePhase
