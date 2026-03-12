import { useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import './App.css'

const PSEUDO_STORAGE_KEY = 'chat:pseudo'

function App() {
  const [pseudoInput, setPseudoInput] = useState(() => localStorage.getItem(PSEUDO_STORAGE_KEY) ?? '')
  const [pseudo, setPseudo] = useState('')
  const [messageInput, setMessageInput] = useState('')
  const [messages, setMessages] = useState([])
  const [error, setError] = useState('')
  const [connected, setConnected] = useState(false)
  const messagesRef = useRef(null)

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
        socket.emit('user_join', { pseudo: savedPseudo })
      }
    })

    socket.on('disconnect', () => {
      setConnected(false)
      setError('Connexion au serveur perdue.')
    })

    socket.on('connect_error', (err) => {
      setConnected(false)
      setError(`Serveur de chat indisponible (${err.message}).`) 
    })

    socket.on('chat_history', (history) => {
      setMessages(history.map((message) => ({ ...message, kind: 'user' })))
    })

    socket.on('new_message', (message) => {
      setMessages((prev) => [...prev, { ...message, kind: 'user' }])
    })

    socket.on('system_message', (message) => {
      setMessages((prev) => [...prev, { ...message, kind: 'system' }])
    })

    socket.on('chat_error', (message) => {
      setError(message)
    })

    socket.on('join_error', (message) => {
      setError(message)
    })

    socket.on('join_ok', ({ pseudo: acceptedPseudo }) => {
      setPseudo(acceptedPseudo)
      setPseudoInput(acceptedPseudo)
      localStorage.setItem(PSEUDO_STORAGE_KEY, acceptedPseudo)
      setError('')
    })

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('connect_error')
      socket.off('chat_history')
      socket.off('new_message')
      socket.off('system_message')
      socket.off('chat_error')
      socket.off('join_error')
      socket.off('join_ok')
      socket.disconnect()
    }
  }, [socket])

  useEffect(() => {
    if (!messagesRef.current) return
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight
  }, [messages])

  const handleJoin = (event) => {
    event.preventDefault()
    const trimmedPseudo = pseudoInput.trim()

    if (!trimmedPseudo) {
      setError('Entre un pseudo avant de rejoindre le chat.')
      return
    }

    if (!connected) {
      setError('Pas de connexion serveur. Lance le backend et reessaie.')
      return
    }

    socket.emit('user_join', { pseudo: trimmedPseudo })
  }

  const handleSend = (event) => {
    event.preventDefault()

    const content = messageInput.trim()
    if (!content) return

    socket.emit('chat_message', { content })
    setMessageInput('')
    setError('')
  }

  return (
    <main className="chat-page">
      <section className="chat-card">
        <header className="chat-header">
          <h1>Chat de la partie</h1>
          <p>{connected ? 'Connecte au serveur' : 'Connexion en cours...'}</p>
        </header>

        {!pseudo ? (
          <form className="join-form" onSubmit={handleJoin}>
            <label htmlFor="pseudo">Choisis ton pseudo</label>
            <input
              id="pseudo"
              type="text"
              maxLength={30}
              value={pseudoInput}
              onChange={(event) => setPseudoInput(event.target.value)}
              placeholder="Ex: PixelNinja"
            />
            <button type="submit">Rejoindre le chat</button>
            {!connected ? <p className="hint">Le serveur de chat n'est pas connecte.</p> : null}
          </form>
        ) : (
          <>
            <p className="pseudo-line">
              Connecte en tant que <strong>{pseudo}</strong>
            </p>

            <div className="messages" ref={messagesRef}>
              {messages.length === 0 ? (
                <p className="empty">Aucun message pour le moment.</p>
              ) : (
                messages.map((message) => (
                  <article
                    key={message.id}
                    className={`message ${message.kind === 'system' ? 'system' : ''}`}
                  >
                    {message.kind === 'system' ? (
                      <p>{message.content}</p>
                    ) : (
                      <>
                        <p>
                          <strong>{message.pseudo}</strong> {message.content}
                        </p>
                        <time dateTime={message.sentAt}>
                          {new Date(message.sentAt).toLocaleTimeString()}
                        </time>
                      </>
                    )}
                  </article>
                ))
              )}
            </div>

            <form className="send-form" onSubmit={handleSend}>
              <input
                type="text"
                maxLength={400}
                value={messageInput}
                onChange={(event) => setMessageInput(event.target.value)}
                placeholder="Ecris ton message..."
              />
              <button type="submit">Envoyer</button>
            </form>
          </>
        )}

        {error ? <p className="error">{error}</p> : null}
      </section>
    </main>
  )
}

export default App
