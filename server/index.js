import 'dotenv/config'
import http from 'node:http'
import cors from 'cors'
import express from 'express'
import mongoose from 'mongoose'
import { Server } from 'socket.io'
import { WebSocketServer } from 'ws'
import { Message } from './models/Message.js'

const PORT = Number(process.env.PORT ?? 3001)
const HOST = process.env.HOST ?? '0.0.0.0'
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGINS ?? 'http://localhost:5173,http://localhost:5174')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/projet_web_chat'
const MAX_MESSAGE_LENGTH = 400
const MAX_PSEUDO_LENGTH = 30
const HISTORY_LIMIT = 50
const LOCAL_IP_ORIGIN_REGEX = /^http:\/\/(\d{1,3}\.){3}\d{1,3}:(5173|5174)$/

const app = express()

function isOriginAllowed(origin) {
  if (!origin) return true
  return CLIENT_ORIGINS.includes(origin) || LOCAL_IP_ORIGIN_REGEX.test(origin)
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true)
        return
      }
      callback(new Error('Not allowed by CORS'))
    },
  }),
)
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    mongoConnected: isMongoConnected,
  })
})

const httpServer = http.createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true)
        return
      }
      callback(new Error('Not allowed by CORS'))
    },
  },
})

const wss = new WebSocketServer({ server: httpServer })

const onlineUsers = new Map()
const inMemoryMessages = []
let isMongoConnected = false

// Variables for drawing app
const clients = new Map()
let strokes = []

function sanitizeText(value, maxLength) {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/\s+/g, ' ').slice(0, maxLength)
}

// Helpers for drawing app
function send(ws, data) {
  if (ws.readyState === 1) ws.send(JSON.stringify(data))
}

function broadcast(data, excludeWs = null) {
  for (const [ws] of clients) {
    if (ws !== excludeWs) send(ws, data)
  }
}

function broadcastAll(data) {
  for (const [ws] of clients) send(ws, data)
}

function playerList() {
  return [...clients.values()]
}

io.on('connection', async (socket) => {
  try {
    const history = isMongoConnected
      ? await Message.find({}).sort({ createdAt: -1 }).limit(HISTORY_LIMIT).lean()
      : inMemoryMessages.slice(-HISTORY_LIMIT)

    socket.emit(
      'chat_history',
      history.reverse().map((message) => ({
        id: String(message._id),
        pseudo: message.pseudo,
        content: message.content,
        sentAt: message.createdAt,
      })),
    )
  } catch (error) {
    console.error('Failed to load chat history:', error)
    socket.emit('chat_error', 'Impossible de charger l\'historique.')
  }

  socket.on('user_join', (payload) => {
    const pseudo = sanitizeText(payload?.pseudo, MAX_PSEUDO_LENGTH)

    if (!pseudo) {
      socket.emit('join_error', 'Pseudo invalide.')
      return
    }

    onlineUsers.set(socket.id, pseudo)
    socket.emit('join_ok', { pseudo })
    io.emit('system_message', {
      id: `system-${Date.now()}-${socket.id}`,
      content: `${pseudo} a rejoint le chat.`,
      sentAt: new Date().toISOString(),
    })
  })

  socket.on('chat_message', async (payload) => {
    const pseudo = onlineUsers.get(socket.id)
    if (!pseudo) {
      socket.emit('chat_error', 'Tu dois d\'abord choisir un pseudo.')
      return
    }

    const content = sanitizeText(payload?.content, MAX_MESSAGE_LENGTH)
    if (!content) {
      socket.emit('chat_error', 'Message vide ou invalide.')
      return
    }

    try {
      const message = isMongoConnected
        ? await Message.create({ pseudo, content })
        : {
            _id: `mem-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            pseudo,
            content,
            createdAt: new Date().toISOString(),
          }

      if (!isMongoConnected) {
        inMemoryMessages.push(message)
        if (inMemoryMessages.length > HISTORY_LIMIT) {
          inMemoryMessages.shift()
        }
      }

      io.emit('new_message', {
        id: String(message._id),
        pseudo: message.pseudo,
        content: message.content,
        sentAt: message.createdAt,
      })
    } catch (error) {
      console.error('Failed to save message:', error)
      socket.emit('chat_error', 'Le message n\'a pas pu etre envoye.')
    }
  })

  socket.on('disconnect', () => {
    const pseudo = onlineUsers.get(socket.id)
    onlineUsers.delete(socket.id)

    if (pseudo) {
      io.emit('system_message', {
        id: `system-${Date.now()}-${socket.id}`,
        content: `${pseudo} a quitte le chat.`,
        sentAt: new Date().toISOString(),
      })
    }
  })
})

// WebSocket handler for drawing app
wss.on('connection', (ws) => {
  const id = Math.random().toString(36).slice(2, 9)

  ws.on('message', (raw) => {
    let msg
    try { msg = JSON.parse(raw) } catch { return }

    // ── join ───────────────────────────────────────────────────────────────
    if (msg.type === 'join') {
      const player = { id, name: msg.name, color: msg.color, avatar: msg.avatar }
      clients.set(ws, player)

      // Send full history + player list only to the newcomer
      send(ws, {
        type: 'welcome',
        id,
        strokes,
        players: playerList(),
      })

      // Tell everyone else a new player joined
      broadcast({ type: 'joined', player }, ws)

      // Sync updated player list to all
      broadcastAll({ type: 'players', players: playerList() })

      console.log(`✅  ${player.avatar} ${player.name} [${id}] connecté  (${clients.size} joueurs)`)
    }

    // ── draw ───────────────────────────────────────────────────────────────
    else if (msg.type === 'draw') {
      const player = clients.get(ws)
      if (!player) return

      const stroke = {
        type: 'draw',
        playerId: id,
        x1: msg.x1, y1: msg.y1,
        x2: msg.x2, y2: msg.y2,
        color: msg.color,
        size: msg.size,
        tool: msg.tool,
      }

      strokes.push(stroke)
      // broadcast to everyone EXCEPT the sender (they already drew locally)
      broadcast(stroke, ws)
    }

    // ── reset ──────────────────────────────────────────────────────────────
    else if (msg.type === 'reset') {
      strokes = []
      const player = clients.get(ws)
      broadcastAll({ type: 'reset', playerId: id, playerName: player?.name ?? '?' })
    }
  })

  ws.on('close', () => {
    const player = clients.get(ws)
    clients.delete(ws)
    if (player) {
      console.log(`❌  ${player.avatar} ${player.name} [${id}] déconnecté  (${clients.size} joueurs)`)
      broadcastAll({ type: 'left', playerId: id })
      broadcastAll({ type: 'players', players: playerList() })
    }
  })

  ws.on('error', (err) => console.error('WS error:', err.message))
})

async function connectMongo() {
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 3000 })
    isMongoConnected = true
    console.log('Connected to MongoDB')
  } catch (error) {
    isMongoConnected = false
    console.warn('MongoDB unavailable, using in-memory messages for now.')
    console.warn(error.message)
  }
}

async function startServer() {
  httpServer.listen(PORT, HOST, () => {
    console.log(`Chat server listening on http://${HOST}:${PORT}`)
    console.log(`🎨  Gartic Draw — serveur WebSocket intégré sur ws://${HOST}:${PORT}`)
  })

  await connectMongo()
}

startServer()
