import { useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import GamePhase from './GamePhase.jsx'
import './App.css'

const PSEUDO_STORAGE_KEY = 'chat:pseudo'

function App() {
  const [pseudoInput, setPseudoInput] = useState(() => localStorage.getItem(PSEUDO_STORAGE_KEY) ?? '')
  const [pseudo, setPseudo] = useState('')
  const [error, setError] = useState('')
  const [connected, setConnected] = useState(false)
  const [ws, setWs] = useState(null)

  const socket = useMemo(() => {
    const serverUrl = import.meta.env.VITE_CHAT_SERVER_URL ?? window.location.origin
    return io(serverUrl, { autoConnect: false })
  }, [])

  useEffect(() => {
    socket.connect()

    socket.on('connect', () => {
      setConnected(true)
      setError('')

      const savedPseudo = localStorage.getItem(PSEUDO_STORAGE_KEY)?.trim()
      if (savedPseudo) {
        socket.emit('user_join_game', { pseudo: savedPseudo })
      }
    })

    socket.on('disconnect', () => {
      setConnected(false)
      setError('Connexion au serveur perdue.')
    })

    socket.on('connect_error', (err) => {
      setConnected(false)
      setError(`Serveur indisponible (${err.message}).`)
    })

    socket.on('join_ok', ({ pseudo: acceptedPseudo }) => {
      setPseudo(acceptedPseudo)
      setPseudoInput(acceptedPseudo)
      localStorage.setItem(PSEUDO_STORAGE_KEY, acceptedPseudo)
      setError('')

      // Use the same Socket.IO connection for game
      setWs(socket)
    })

    socket.on('join_error', (message) => {
      setError(message)
    })

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('connect_error')
      socket.off('join_ok')
      socket.off('join_error')
      socket.disconnect()
    }
  }, [socket])

  const handleJoin = (event) => {
    event.preventDefault()
    const trimmedPseudo = pseudoInput.trim()

    if (!trimmedPseudo) {
      setError('Entre un pseudo avant de rejoindre.')
      return
    }

    if (!connected) {
      setError('Pas de connexion serveur. Lance le backend et reessaie.')
      return
    }

    socket.emit('user_join_game', { pseudo: trimmedPseudo })
  }

  return (
    <main className="app">
      <header className="app-header">
        <h1>Gartic Phone 🎨</h1>
        <p>{connected ? 'Connecte au serveur' : 'Connexion en cours...'}</p>
      </header>

      {!pseudo ? (
        <section className="join-section">
          <form className="join-form" onSubmit={handleJoin}>
            <label htmlFor="pseudo">Choisis ton pseudo</label>
            <input
              id="pseudo"
              type="text"
              maxLength={30}
              value={pseudoInput}
              onChange={(event) => setPseudoInput(event.target.value)}
              placeholder="Ex: MonMeilleurPseudo"
            />
            <button type="submit">Rejoindre la partie</button>
            {!connected ? <p className="hint">Le serveur n'est pas connecte.</p> : null}
          </form>
        </section>
      ) : (
        <GamePhase pseudo={pseudo} ws={ws} />
      )}

      {error ? <p className="error">{error}</p> : null}
    </main>
  )
}

export default App
