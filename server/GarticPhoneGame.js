  // Game state management for Gartic game

class GarticPhoneGame {
  constructor() {
    this.state = 'waiting' // waiting, phrase, drawing, showcase, results
    this.players = new Map() // socket -> {id, name, avatar}
    this.currentRound = 0
    this.maxRounds = 1
    this.timeLeft = 0
    this.phraseTime = 60
    this.drawingTime = 120

    // Tracks who submitted this round
    this.submittedThisRound = new Set()

    // Game data: playerId -> [{type, content, author, round}, ...]
    this.gameData = {}
    this.currentContent = null
    this.currentAssignment = {} // playerId -> contentToWorkOn

    // Showcase state
    this.showcaseChains = []   // array of chains to show
    this.showcaseIndex = 0     // current chain being shown

    this.timer = null
    this.onTick = null
    this.onPhaseChange = null
  }

  addPlayer(socket, playerData) {
    this.players.set(socket, playerData)
    this.gameData[playerData.id] = []
  }

  removePlayer(socket) {
    const player = this.players.get(socket)
    if (player) {
      this.players.delete(socket)
      this.submittedThisRound.delete(player.id)
    }
  }

  startGame() {
    if (this.players.size < 2) return false

    this.maxRounds = this.players.size
    this.currentRound = 1
    this.state = 'phrase'
    this.timeLeft = this.phraseTime
    this.currentContent = null
    this.currentAssignment = {}
    this.submittedThisRound = new Set()

    // Reset game data
    this.gameData = {}
    for (const player of this.players.values()) {
      this.gameData[player.id] = []
    }

    this.startTimer()
    return true
  }

  startTimer() {
    if (this.timer) clearInterval(this.timer)
    this.timer = setInterval(() => {
      this.timeLeft--
      if (typeof this.onTick === 'function') this.onTick(this.timeLeft)
      if (this.timeLeft <= 0) {
        clearInterval(this.timer)
        this.advancePhase()
      }
    }, 1000)
  }

  stopTimer() {
    if (this.timer) { clearInterval(this.timer); this.timer = null }
  }

  // Called after each submission — check if all players submitted
  checkAllSubmitted() {
    if (this.state !== 'phrase' && this.state !== 'drawing') return
    const activePlayers = Array.from(this.players.values()).map(p => p.id)
    const allDone = activePlayers.every(id => this.submittedThisRound.has(id))
    if (allDone && activePlayers.length >= 1) {
      this.stopTimer()
      this.timeLeft = 0
      this.advancePhase()
    }
  }

  advancePhase() {
    // Auto-submit empty content for players who didn't submit this round
    const activePlayers = Array.from(this.players.values()).map(p => p.id)
    for (const playerId of activePlayers) {
      if (!this.submittedThisRound.has(playerId)) {
        // Get the basedOnAuthorId from the current assignment
        const assignment = this.currentAssignment[playerId]?.[0]
        const basedOnAuthorId = assignment?.author || null

        if (this.state === 'phrase') {
          this.submitPhrase(playerId, '[Non soumis]', basedOnAuthorId)
        } else if (this.state === 'drawing') {
          // Submit blank white drawing for consistency
          const blankCanvas = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAFggJ/wlseKgAAAABJRU5ErkJggg=='
          this.submitDrawing(playerId, blankCanvas, basedOnAuthorId)
        }
      }
    }

    this.submittedThisRound = new Set()

    if (this.state === 'phrase') {
      this.distributePhrases()
      this.currentRound++
      this.state = 'drawing'
      this.timeLeft = this.drawingTime
    } else if (this.state === 'drawing') {
      this.distributeDrawings()
      this.currentRound++

      if (this.currentRound > this.maxRounds) {
        // Go to showcase before results
        this.state = 'showcase'
        this.stopTimer()
        this.buildShowcase()
        if (typeof this.onPhaseChange === 'function') this.onPhaseChange(this.getGameState())
        return
      }

      this.state = 'phrase'
      this.timeLeft = this.phraseTime
    }

    if (typeof this.onPhaseChange === 'function') this.onPhaseChange(this.getGameState())
    this.startTimer()
  }

  buildShowcase() {
    // Build chains by following basedOnAuthor links from each first author's phrase
    this.showcaseChains = []

    const processed = new Set()

    for (const startPlayerId of Object.keys(this.gameData)) {
      const r1Phrase = this._findItem('phrase', startPlayerId, 1)
      if (!r1Phrase || processed.has(startPlayerId)) continue

      const chain = []
      let currentItem = r1Phrase
      let currentAuthor = startPlayerId

      for (let round = 1; round <= this.currentRound; round++) {
        // Add phrase for this round
        if (currentItem?.type === 'phrase') {
          chain.push(currentItem)
          processed.add(currentItem.author)
        }

        // Find drawing based on current phrase
        const drawing = this._findDrawingForPhrase(currentItem)
        if (drawing) {
          chain.push(drawing)
          const nextPhrase = this._findItem('phrase', drawing.author, round + 1)
          currentItem = nextPhrase
          if (nextPhrase) currentAuthor = nextPhrase.author
        } else {
          break
        }
      }

      if (chain.length > 0) this.showcaseChains.push(chain)
    }

    // Fallback for orphaned chains
    if (this.showcaseChains.length === 0) {
      this.showcaseChains = Object.values(this.gameData).filter(c => c.length > 0)
    }

    this.showcaseIndex = 0
  }

  _findItem(type, authorId, round) {
    const chain = this.gameData[authorId]
    if (!chain) return null
    return chain.find(item => item.type === type && item.round === round) || null
  }

  _findDrawingForPhrase(phraseItem) {
    if (!phraseItem) return null
    for (const chain of Object.values(this.gameData)) {
      const drawing = chain.find(item =>
        item.type === 'drawing' &&
        item.round === phraseItem.round &&
        item.basedOnAuthor === phraseItem.author
      )
      if (drawing) return drawing
    }
    return null
  }

  nextShowcase() {
    this.showcaseIndex++
    if (this.showcaseIndex >= this.showcaseChains.length) {
      this.state = 'results'
      if (typeof this.onPhaseChange === 'function') this.onPhaseChange(this.getGameState())
    } else {
      if (typeof this.onPhaseChange === 'function') this.onPhaseChange(this.getGameState())
    }
  }

  distributePhrases() {
    const phrases = []
    for (const [playerId, chain] of Object.entries(this.gameData)) {
      const item = chain.find(i => i.type === 'phrase' && i.round === this.currentRound)
      if (item) phrases.push({ ...item, ownerId: playerId })
    }

    const playerIds = Array.from(this.players.values()).map(p => p.id)
    const assignments = {}

    // Ensure each player gets exactly one phrase (not their own if possible)
    const shuffled = [...playerIds].sort(() => Math.random() - 0.5)
    const phraseQueue = [...phrases].sort(() => Math.random() - 0.5)

    for (let i = 0; i < shuffled.length; i++) {
      const assignee = shuffled[i]
      // find a phrase not authored by assignee
      let phraseIdx = phraseQueue.findIndex(p => p.author !== assignee)
      if (phraseIdx === -1) phraseIdx = 0
      const phrase = phraseQueue.splice(phraseIdx, 1)[0]
      if (phrase) {
        if (!assignments[assignee]) assignments[assignee] = []
        assignments[assignee].push(phrase)
      }
    }

    this.currentAssignment = assignments
  }

  distributeDrawings() {
    const drawings = []
    for (const [playerId, chain] of Object.entries(this.gameData)) {
      const item = chain.find(i => i.type === 'drawing' && i.round === this.currentRound)
      if (item) drawings.push({ ...item, ownerId: playerId })
    }

    const playerIds = Array.from(this.players.values()).map(p => p.id)
    const assignments = {}

    const shuffled = [...playerIds].sort(() => Math.random() - 0.5)
    const drawingQueue = [...drawings].sort(() => Math.random() - 0.5)

    for (let i = 0; i < shuffled.length; i++) {
      const assignee = shuffled[i]
      let drawingIdx = drawingQueue.findIndex(d => d.author !== assignee)
      if (drawingIdx === -1) drawingIdx = 0
      const drawing = drawingQueue.splice(drawingIdx, 1)[0]
      if (drawing) {
        if (!assignments[assignee]) assignments[assignee] = []
        assignments[assignee].push(drawing)
      }
    }

    this.currentAssignment = assignments
  }

  submitPhrase(playerId, content, basedOnAuthorId = null) {
    if (this.gameData[playerId]) {
      const item = { type: 'phrase', content, author: playerId, round: this.currentRound }
      if (basedOnAuthorId) item.basedOnAuthor = basedOnAuthorId
      this.gameData[playerId].push(item)
    }
    this.submittedThisRound.add(playerId)
  }

  submitDrawing(playerId, drawingData, basedOnAuthorId = null) {
    if (this.gameData[playerId]) {
      const item = { type: 'drawing', content: drawingData, author: playerId, round: this.currentRound }
      if (basedOnAuthorId) item.basedOnAuthor = basedOnAuthorId
      this.gameData[playerId].push(item)
    }
    this.submittedThisRound.add(playerId)
  }

  getSubmissionCount() {
    return this.submittedThisRound.size
  }

  getGameState() {
    const playerList = Array.from(this.players.values()).map(p => ({
      id: p.id, name: p.name, avatar: p.avatar
    }))

    return {
      state: this.state,
      round: this.currentRound,
      maxRounds: this.maxRounds,
      timeLeft: this.timeLeft,
      players: playerList,
      content: this.currentContent,
      allChains: this.gameData,
      assignment: this.currentAssignment,
      submittedCount: this.submittedThisRound.size,
      totalPlayers: this.players.size,
      // Showcase
      showcaseChains: this.showcaseChains,
      showcaseIndex: this.showcaseIndex,
      currentShowcaseChain: this.showcaseChains[this.showcaseIndex] || null,
    }
  }

  getAssignmentFor(playerId) {
    return this.currentAssignment[playerId] || []
  }
}

export default GarticPhoneGame
