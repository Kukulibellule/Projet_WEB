import 'dotenv/config'
import http from 'node:http'
import cors from 'cors'
import express from 'express'
import mongoose from 'mongoose'
import { Server } from 'socket.io'
import { Message } from './models/Message.js'

const PORT = Number(process.env.PORT ?? 3001)
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGINS ?? 'http://localhost:5173,http://localhost:5174')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/projet_web_chat'
const MAX_MESSAGE_LENGTH = 400
const MAX_PSEUDO_LENGTH = 30
const HISTORY_LIMIT = 50

const app = express()
app.use(cors({ origin: CLIENT_ORIGINS }))
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
    origin: CLIENT_ORIGINS,
  },
})

const onlineUsers = new Map()
const inMemoryMessages = []
let isMongoConnected = false

function sanitizeText(value, maxLength) {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/\s+/g, ' ').slice(0, maxLength)
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
  httpServer.listen(PORT, () => {
    console.log(`Chat server listening on http://localhost:${PORT}`)
  })

  await connectMongo()
}

startServer()
