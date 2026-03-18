// Game state management for Gartic Phone

class GarticPhoneGame {
  constructor() {
    this.state = 'waiting' // waiting, phrase, drawing, results
    this.players = new Map() // ws -> {id, name}
    this.currentRound = 0
    this.maxRounds = 3
    this.timeLeft = 0
    this.phraseTime = 30
    this.drawingTime = 120

    // Game data: playerId -> [{type: 'phrase'|'drawing', content, author, round}, ...]
    this.gameData = {}
    this.currentContent = null // what to draw or phrase to illustrate
    this.currentAssignment = {} // playerId -> contentToWorkOn

    this.timer = null

    // Callbacks
    this.onTick = null
    this.onPhaseChange = null
  }

  addPlayer(ws, playerData) {
    this.players.set(ws, playerData)
    this.gameData[playerData.id] = []
  }

  removePlayer(ws) {
    const player = this.players.get(ws)
    if (player) {
      this.players.delete(ws)
      if (Object.keys(this.gameData).length > 0 && this.gameData[player.id]) {
        // Keep the data, just remove player reference
      }
    }
  }

  startGame() {
    if (this.players.size < 2) {
      return false
    }

    this.currentRound = 1
    this.state = 'phrase'
    this.timeLeft = this.phraseTime
    this.currentContent = null
    this.currentAssignment = {}

    // Initialize chains for each player
    for (const player of this.players.values()) {
      if (!this.gameData[player.id]) {
        this.gameData[player.id] = []
      }
    }

    this.startTimer()
    return true
  }

  startTimer() {
    if (this.timer) clearInterval(this.timer)

    this.timer = setInterval(() => {
      this.timeLeft--
      if (typeof this.onTick === 'function') {
        this.onTick(this.timeLeft)
      }

      if (this.timeLeft <= 0) {
        clearInterval(this.timer)
        this.advancePhase()
      }
    }, 1000)
  }

  advancePhase() {
    if (this.state === 'phrase') {
      // Distribute phrases to random players for drawing
      this.distributePhrases()
      this.state = 'drawing'
      this.timeLeft = this.drawingTime
    } else if (this.state === 'drawing') {
      // Distribute drawings to random players for next phrase
      this.distributeDrawings()

      if (this.currentRound >= this.maxRounds) {
        this.state = 'results'
        clearInterval(this.timer)
        if (typeof this.onPhaseChange === 'function') {
          this.onPhaseChange(this.getGameState())
        }
        return
      }

      this.currentRound++
      this.state = 'phrase'
      this.timeLeft = this.phraseTime
    }

    if (typeof this.onPhaseChange === 'function') {
      this.onPhaseChange(this.getGameState())
    }
    this.startTimer()
  }

  distributePhrases() {
    // Collect all submitted phrases for this round
    const phrases = []
    for (const [playerId, chain] of Object.entries(this.gameData)) {
      const phraseItem = chain.find(
        (item) => item.type === 'phrase' && item.round === this.currentRound
      )
      if (phraseItem) {
        phrases.push(phraseItem)
      }
    }

    // Randomly assign each phrase to a player (not the author)
    const playerIds = Array.from(this.players.values()).map((p) => p.id)
    const assignments = {}

    for (const phrase of phrases) {
      // Find a random player who isn't the author
      let assignedPlayer
      do {
        assignedPlayer = playerIds[Math.floor(Math.random() * playerIds.length)]
      } while (assignedPlayer === phrase.author && playerIds.length > 1)

      if (!assignments[assignedPlayer]) {
        assignments[assignedPlayer] = []
      }
      assignments[assignedPlayer].push(phrase)
    }

    this.currentAssignment = assignments
  }

  distributeDrawings() {
    // Collect all submitted drawings for this round
    const drawings = []
    for (const [playerId, chain] of Object.entries(this.gameData)) {
      const drawingItem = chain.find(
        (item) => item.type === 'drawing' && item.round === this.currentRound
      )
      if (drawingItem) {
        drawings.push(drawingItem)
      }
    }

    // Randomly assign each drawing to a player (not the author)
    const playerIds = Array.from(this.players.values()).map((p) => p.id)
    const assignments = {}

    for (const drawing of drawings) {
      // Find a random player who isn't the author
      let assignedPlayer
      do {
        assignedPlayer = playerIds[Math.floor(Math.random() * playerIds.length)]
      } while (assignedPlayer === drawing.author && playerIds.length > 1)

      if (!assignments[assignedPlayer]) {
        assignments[assignedPlayer] = []
      }
      assignments[assignedPlayer].push(drawing)
    }

    this.currentAssignment = assignments
  }

  submitPhrase(playerId, content) {
    for (const [playerId2, chain] of Object.entries(this.gameData)) {
      if (playerId2 === playerId) {
        chain.push({
          type: 'phrase',
          content,
          author: playerId,
          round: this.currentRound
        })
        break
      }
    }
  }

  submitDrawing(playerId, drawingData) {
    for (const [playerId2, chain] of Object.entries(this.gameData)) {
      if (playerId2 === playerId) {
        chain.push({
          type: 'drawing',
          content: drawingData,
          author: playerId,
          round: this.currentRound
        })
        break
      }
    }
  }

  getGameState() {
    const playerList = Array.from(this.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar
    }))

    return {
      state: this.state,
      round: this.currentRound,
      timeLeft: this.timeLeft,
      players: playerList,
      content: this.currentContent,
      allChains: this.gameData,
      assignment: this.currentAssignment
    }
  }

  getAllChains() {
    return this.gameData
  }

  getAssignmentFor(playerId) {
    return this.currentAssignment[playerId] || []
  }
}


export default GarticPhoneGame
