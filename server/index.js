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
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/projet_web_chat'
const MAX_PSEUDO_LENGTH = 30
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

const onlineUsers = new Map()
let isMongoConnected = false

// Gartic Phone Game instance
const gameInstance = new GarticPhoneGame()

function sanitizeText(value, maxLength) {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/\s+/g, ' ').slice(0, maxLength)
}

// Broadcast game state to all connected players
function broadcastGameState() {
  const gameState = gameInstance.getGameState()
  for (const socket of gameInstance.players.keys()) {
    socket.emit('game_state', gameState)
  }
}

// Broadcast countdown timer
function broadcastCountdown() {
  for (const socket of gameInstance.players.keys()) {
    socket.emit('game_countdown', { timeLeft: gameInstance.timeLeft })
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Socket.IO: Authentication and Game
// ────────────────────────────────────────────────────────────────────────────
io.on('connection', async (socket) => {
  socket.on('user_join_game', (payload) => {
    const pseudo = sanitizeText(payload?.pseudo, MAX_PSEUDO_LENGTH)

    if (!pseudo) {
      socket.emit('join_error', 'Pseudo invalide.')
      return
    }

    onlineUsers.set(socket.id, pseudo)
    socket.emit('join_ok', { pseudo })
    console.log(`✅ User "${pseudo}" authenticated`)
  })

  // ── join_game ──────────────────────────────────────────────────────────
  socket.on('join_game', (data) => {
    const playerData = { id: socket.id, name: data.name, avatar: '😀' }
    gameInstance.addPlayer(socket, playerData)
    broadcastGameState()
    console.log(`✅ Player "${playerData.name}" [${socket.id}] joined game (${gameInstance.players.size} players)`)
  })

  // ── start_game ────────────────────────────────────────────────────────
  socket.on('start_game', () => {
    if (gameInstance.startGame()) {
      broadcastGameState()
      broadcastCountdown()
      console.log('🎮 Game started! 3 rounds: phrase → drawing → phrase...')
    }
  })

  // ── submit_phrase ──────────────────────────────────────────────────────
  socket.on('submit_phrase', (data) => {
    const player = gameInstance.players.get(socket)
    if (player) {
      gameInstance.submitPhrase(player.id, data.content)
      console.log(`📝 Phrase submitted by "${player.name}"`)
      broadcastGameState()
    }
  })

  // ── submit_drawing ────────────────────────────────────────────────────
  socket.on('submit_drawing', (data) => {
    const player = gameInstance.players.get(socket)
    if (player) {
      gameInstance.submitDrawing(player.id, data.drawing)
      console.log(`🎨 Drawing submitted by "${player.name}"`)
      broadcastGameState()
    }
  })

  socket.on('disconnect', () => {
    const pseudo = onlineUsers.get(socket.id)
    if (pseudo) {
      onlineUsers.delete(socket.id)
      console.log(`❌ User "${pseudo}" disconnected from Socket.IO`)
    }

    gameInstance.removePlayer(socket)
    console.log(`❌ Player disconnected (${gameInstance.players.size} players left)`)
    broadcastGameState()
  })
})



// ────────────────────────────────────────────────────────────────────────────
// MongoDB Connection
// ────────────────────────────────────────────────────────────────────────────
async function connectMongo() {
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 3000 })
    isMongoConnected = true
    console.log('✅ Connected to MongoDB')
  } catch (error) {
    isMongoConnected = false
    console.warn('⚠️  MongoDB unavailable, using in-memory storage.')
    console.warn(error.message)
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Server Startup
// ────────────────────────────────────────────────────────────────────────────
async function startServer() {
  httpServer.listen(PORT, HOST, () => {
    console.log(`\n🎮 Gartic Phone Server`)
    console.log(`📡 HTTP + Socket.IO: http://${HOST}:${PORT}`)
    console.log(`🌐 WebSocket Game:    ws://${HOST}:${PORT}\n`)
  })

  await connectMongo()
}

startServer()
