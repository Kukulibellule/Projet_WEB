import { useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import GamePhase from './GamePhase.jsx'
import './App.css'

const PSEUDO_STORAGE_KEY = 'gartic:pseudo'
const MODE_STORAGE_KEY = 'gartic:mode'

function App() {
  const [pseudoInput, setPseudoInput] = useState(() => localStorage.getItem(PSEUDO_STORAGE_KEY) ?? '')
  const [pseudo, setPseudo] = useState('')
  const [error, setError] = useState('')
  const [connected, setConnected] = useState(false)
  const [ws, setWs] = useState(null)
  const [messages, setMessages] = useState([])
  const [messageInput, setMessageInput] = useState('')
  const [drawMode, setDrawMode] = useState(() => localStorage.getItem(MODE_STORAGE_KEY) ?? 'pixel')

  const socket = useMemo(() => {
    const serverUrl = import.meta.env.VITE_CHAT_SERVER_URL ?? window.location.origin
    return io(serverUrl, { autoConnect: false })
  }, [])

  useEffect(() => {
    if (!pseudo) return

    let cancelled = false
    const loadMessages = async () => {
      try {
        const res = await fetch('/api/messages')
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setMessages(Array.isArray(data.messages) ? data.messages : [])
      } catch {
        // Keep current chat state if loading fails.
      }
    }

    loadMessages()
    return () => { cancelled = true }
  }, [pseudo])

  useEffect(() => {
    socket.connect()
    socket.on('connect', () => {
      setConnected(true); setError('')
      const saved = localStorage.getItem(PSEUDO_STORAGE_KEY)?.trim()
      if (saved) socket.emit('user_join_game', { pseudo: saved })
    })
    socket.on('disconnect', () => { setConnected(false); setError('Connexion perdue.') })
    socket.on('connect_error', (err) => { setConnected(false); setError(`Serveur indisponible (${err.message}).`) })
    socket.on('join_ok', ({ pseudo: p }) => {
      setPseudo(p); setPseudoInput(p)
      localStorage.setItem(PSEUDO_STORAGE_KEY, p)
      setError(''); setWs(socket)
      socket.emit('join_game', { name: p })
    })
    socket.on('join_error', (msg) => setError(msg))
    socket.on('new_message', (msg) => setMessages(prev => [...prev.slice(-100), msg]))
    socket.on('messages_cleared', () => setMessages([]))
    return () => {
      socket.off('connect'); socket.off('disconnect'); socket.off('connect_error')
      socket.off('join_ok'); socket.off('join_error'); socket.off('new_message'); socket.off('messages_cleared')
      socket.disconnect()
    }
  }, [socket])

  const handleJoin = (e) => {
    e.preventDefault()
    const t = pseudoInput.trim()
    if (!t) { setError('Entre un pseudo.'); return }
    if (!connected) { setError('Serveur indisponible.'); return }
    localStorage.setItem(MODE_STORAGE_KEY, drawMode)
    socket.emit('user_join_game', { pseudo: t })
  }

  const handleSend = async (e) => {
    e.preventDefault()
    const t = messageInput.trim()
    if (!t || !pseudo) return

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudo, content: t }),
      })

      if (res.ok) {
        setMessageInput('')
      } else {
        setError('Impossible d\'envoyer le message.')
      }
    } catch {
      setError('Erreur réseau pendant l\'envoi du message.')
    }
  }

  return (
    <main className="app">
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon">🎨</div>
          <div>
            <div className="logo-text">GraticPhone</div>
            <div className="logo-badge">✨ Pixel Edition</div>
          </div>
        </div>
        <div className="status-pill">
          <span className={`status-dot ${connected ? 'online' : ''}`} />
          {connected ? 'Connecté' : 'Hors ligne'}
        </div>
      </header>

      {!pseudo ? (
        <div className="join-screen">
          <div className="join-card">
            <span className="hero-emoji">🎨</span>
            <h2>Rejoindre la partie</h2>
            <p>Choisis ton pseudo et ton mode de dessin !</p>

            <form className="join-form" onSubmit={handleJoin}>
              <label htmlFor="pseudo">Ton pseudo</label>
              <input
                id="pseudo"
                type="text"
                maxLength={30}
                value={pseudoInput}
                onChange={(e) => setPseudoInput(e.target.value)}
                placeholder="Ex: PixelMaster99"
                autoFocus
              />

              {/* Mode selector */}
              <label style={{marginTop:'0.6rem'}}>Mode de dessin</label>
              <div className="mode-selector">
                <button
                  type="button"
                  className={`mode-btn ${drawMode === 'pixel' ? 'active' : ''}`}
                  onClick={() => setDrawMode('pixel')}
                >
                  <span className="mode-icon">🟦</span>
                  <span className="mode-label">Pixel Art</span>
                  <span className="mode-desc">Grille de pixels, formes géométriques, style rétro</span>
                </button>
                <button
                  type="button"
                  className={`mode-btn ${drawMode === 'normal' ? 'active' : ''}`}
                  onClick={() => setDrawMode('normal')}
                >
                  <span className="mode-icon">🖌️</span>
                  <span className="mode-label">Dessin libre</span>
                  <span className="mode-desc">Canvas fluide, trait lisse, style classique</span>
                </button>
              </div>

              <button className="btn-primary" type="submit">
                🎮 Rejoindre la partie
              </button>
              {!connected && <p style={{color:'var(--yellow)',fontSize:'0.85rem',marginTop:'0.3rem'}}>⚠️ Serveur non connecté</p>}
            </form>
            {error && <div className="error-banner">{error}</div>}
          </div>
        </div>
      ) : (
        <div className="game-layout">
          <GamePhase pseudo={pseudo} ws={ws} drawMode={drawMode} />
          <aside className="chat-panel">
            <h3>💬 Chat</h3>
            <div className="chat-messages">
              {messages.map((msg, i) => (
                <div key={i} className="chat-msg">
                  <strong>{msg.pseudo}:</strong> {msg.content}
                </div>
              ))}
              <div ref={el => { if(el) el.scrollIntoView({behavior:'smooth'}) }} />
            </div>
            <form className="chat-input-row" onSubmit={handleSend}>
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Message..."
                maxLength={400}
              />
              <button className="btn-send" type="submit">➤</button>
            </form>
          </aside>
        </div>
      )}

      {error && pseudo && <div className="error-banner" style={{marginTop:'1rem'}}>{error}</div>}
    </main>
  )
}

export default App
