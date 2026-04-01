import 'dotenv/config'
import http from 'node:http'
import cors from 'cors'
import express from 'express'
import mongoose from 'mongoose'
import { Server } from 'socket.io'
import { Message } from './models/Message.js'
import GarticPhoneGame from './GarticPhoneGame.js'

const PORT = Number(process.env.PORT ?? 3001)
const HOST = process.env.HOST ?? '0.0.0.0'
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGINS ?? 'http://localhost:5173,http://localhost:5174')
  .split(',').map(o => o.trim()).filter(Boolean)
const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/projet_web_chat'
const MAX_PSEUDO_LENGTH = 30
const LOCAL_IP_ORIGIN_REGEX = /^http:\/\/(\d{1,3}\.){3}\d{1,3}:(5173|5174)$/

const app = express()

function isOriginAllowed(origin) {
  if (!origin) return true
  return CLIENT_ORIGINS.includes(origin) || LOCAL_IP_ORIGIN_REGEX.test(origin)
}

app.use(cors({ origin: (origin, cb) => isOriginAllowed(origin) ? cb(null, true) : cb(new Error('Not allowed by CORS')) }))
app.use(express.json())

app.get('/api/health', (_req, res) => res.json({ ok: true, mongoConnected: isMongoConnected }))

const httpServer = http.createServer(app)
const io = new Server(httpServer, {
  cors: { origin: (origin, cb) => isOriginAllowed(origin) ? cb(null, true) : cb(new Error('Not allowed by CORS')) },
  maxHttpBufferSize: 5e6  // 5MB for drawing data
})

const onlineUsers = new Map()
let isMongoConnected = false
let hasClearedMessagesAfterResults = false

const gameInstance = new GarticPhoneGame()

function sanitizeText(value, maxLength) {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/\s+/g, ' ').slice(0, maxLength)
}

function toClientMessage(messageDoc) {
  return {
    pseudo: messageDoc.pseudo,
    content: messageDoc.content,
    timestamp: messageDoc.createdAt,
  }
}

async function persistAndBroadcastMessage(pseudo, rawContent) {
  const safePseudo = sanitizeText(pseudo, MAX_PSEUDO_LENGTH)
  const safeContent = sanitizeText(rawContent, 400)
  if (!safePseudo || !safeContent) return null

  if (!isMongoConnected) {
    const fallbackMessage = { pseudo: safePseudo, content: safeContent, timestamp: new Date() }
    io.emit('new_message', fallbackMessage)
    return fallbackMessage
  }

  const created = await Message.create({ pseudo: safePseudo, content: safeContent })
  const payload = toClientMessage(created)
  io.emit('new_message', payload)
  return payload
}

async function clearMessagesAtGameEnd() {
  if (!isMongoConnected) return
  await Message.deleteMany({})
  io.emit('messages_cleared')
}

function broadcastGameState() {
  try {
    for (const socket of gameInstance.players.keys()) {
      const player = gameInstance.players.get(socket)
      const baseState = gameInstance.getGameState()
      socket.emit('game_state', {
        ...baseState,
        playerId: player?.id,
        assigned: gameInstance.getAssignmentFor(player?.id),
      })
    }
  } catch (err) { console.error('broadcastGameState error:', err) }
}

function broadcastCountdown() {
  try {
    for (const socket of gameInstance.players.keys()) {
      socket.emit('game_countdown', { timeLeft: gameInstance.timeLeft })
    }
  } catch (err) { console.error('broadcastCountdown error:', err) }
}

app.get('/api/messages', async (_req, res) => {
  try {
    if (!isMongoConnected) {
      res.json({ messages: [] })
      return
    }

    const docs = await Message.find({}).sort({ createdAt: 1 }).limit(400).lean()
    res.json({
      messages: docs.map(doc => ({
        pseudo: doc.pseudo,
        content: doc.content,
        timestamp: doc.createdAt,
      })),
    })
  } catch (err) {
    console.error('GET /api/messages error:', err)
    res.status(500).json({ error: 'Unable to fetch messages' })
  }
})

app.post('/api/messages', async (req, res) => {
  try {
    const pseudo = req.body?.pseudo
    const content = req.body?.content
    const created = await persistAndBroadcastMessage(pseudo, content)
    if (!created) {
      res.status(400).json({ error: 'Pseudo or message content invalid' })
      return
    }

    res.status(201).json({ message: created })
  } catch (err) {
    console.error('POST /api/messages error:', err)
    res.status(500).json({ error: 'Unable to save message' })
  }
})

io.on('connection', async (socket) => {
  try {
    socket.on('user_join_game', (payload) => {
      const pseudo = sanitizeText(payload?.pseudo, MAX_PSEUDO_LENGTH)
      if (!pseudo) { socket.emit('join_error', 'Pseudo invalide.'); return }
      onlineUsers.set(socket.id, pseudo)
      socket.emit('join_ok', { pseudo })
      console.log(`✅ User "${pseudo}" authenticated`)
    })

      socket.on('join_game', (data) => {
      const playerData = { id: socket.id, name: data.name, avatar: '😀' }
      gameInstance.addPlayer(socket, playerData)
      broadcastGameState()
      console.log(`✅ Player "${playerData.name}" joined (${gameInstance.players.size} players)`)
    })

    socket.on('start_game', () => {
      hasClearedMessagesAfterResults = false
      gameInstance.onTick = () => broadcastCountdown()
      gameInstance.onPhaseChange = async (gameState) => {
        broadcastGameState()
        broadcastCountdown()

        if (gameState?.state === 'results' && !hasClearedMessagesAfterResults) {
          hasClearedMessagesAfterResults = true
          try {
            await clearMessagesAtGameEnd()
          } catch (err) {
            console.error('Failed to clear messages after game:', err)
          }
        }
      }
      if (gameInstance.startGame()) {
        broadcastGameState()
        broadcastCountdown()
        console.log('🎮 Game started!')
      }
    })

    socket.on('submit_phrase', (data) => {
      const player = gameInstance.players.get(socket)
      if (player) {
        gameInstance.submitPhrase(player.id, data.content, data.basedOnAuthorId)
        console.log(`📝 Phrase by "${player.name}" (${gameInstance.getSubmissionCount()}/${gameInstance.players.size})`)
        broadcastGameState()
        // Check if everyone submitted
        gameInstance.checkAllSubmitted()
      }
    })

    socket.on('submit_drawing', (data) => {
      const player = gameInstance.players.get(socket)
      if (player) {
        gameInstance.submitDrawing(player.id, data.drawing, data.basedOnAuthorId)
        console.log(`🎨 Drawing by "${player.name}" (${gameInstance.getSubmissionCount()}/${gameInstance.players.size})`)
        broadcastGameState()
        gameInstance.checkAllSubmitted()
      }
    })

    // Showcase navigation — any player can advance (or just the host)
    socket.on('next_showcase', () => {
      if (gameInstance.state === 'showcase') {
        gameInstance.nextShowcase()
        broadcastGameState()
      }
    })

    socket.on('send_message', (data) => {
      const pseudo = onlineUsers.get(socket.id)
      if (pseudo) {
        persistAndBroadcastMessage(pseudo, data?.content).catch((err) => {
          console.error('send_message persistence error:', err)
        })
      }
    })

    socket.on('disconnect', () => {
      const pseudo = onlineUsers.get(socket.id)
      if (pseudo) { onlineUsers.delete(socket.id); console.log(`❌ "${pseudo}" disconnected`) }
      gameInstance.removePlayer(socket)
      broadcastGameState()
    })
  } catch (err) { console.error('Socket error:', err) }
})

async function connectMongo() {
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 3000 })
    isMongoConnected = true
    console.log('✅ Connected to MongoDB')
  } catch (err) {
    isMongoConnected = false
    console.warn('⚠️  MongoDB unavailable, using in-memory storage.')
  }
}

async function startServer() {
  httpServer.listen(PORT, HOST, () => {
    console.log(`\n🎮 Gartic Phone Server`)
    console.log(`📡 HTTP + Socket.IO: http://${HOST}:${PORT}\n`)
  })
  await connectMongo()
}

startServer()
