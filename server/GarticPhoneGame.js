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
    this.chainSequence = 0

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
    this.chainSequence = 0

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
      
      if (this.currentRound > this.maxRounds) {
        this.state = 'showcase'
        this.stopTimer()
        this.buildShowcase()
        if (typeof this.onPhaseChange === 'function') this.onPhaseChange(this.getGameState())
        return
      }
      
      this.state = 'drawing'
      this.timeLeft = this.drawingTime
    } else if (this.state === 'drawing') {
      this.distributeDrawings()

      if (this.currentRound >= this.maxRounds) {
        this.state = 'showcase'
        this.stopTimer()
        this.buildShowcase()
        if (typeof this.onPhaseChange === 'function') this.onPhaseChange(this.getGameState())
        return
      }

      this.currentRound++
      this.state = 'phrase'
      this.timeLeft = this.phraseTime
    }

    if (typeof this.onPhaseChange === 'function') this.onPhaseChange(this.getGameState())
    this.startTimer()
  }

  buildShowcase() {
    const chainsById = new Map()

    for (const playerChain of Object.values(this.gameData)) {
      for (const item of playerChain) {
        if (!item.chainId) continue
        if (!chainsById.has(item.chainId)) chainsById.set(item.chainId, [])
        chainsById.get(item.chainId).push(item)
      }
    }

    this.showcaseChains = Array.from(chainsById.values())
      .map((items) => items.sort((a, b) => {
        if (a.round !== b.round) return a.round - b.round
        if (a.type === b.type) return 0
        return a.type === 'phrase' ? -1 : 1
      }))
      .filter(items => items.length > 0)

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

    this._assignWithoutSelf(phrases)
  }

  distributeDrawings() {
    const drawings = []
    for (const [playerId, chain] of Object.entries(this.gameData)) {
      const item = chain.find(i => i.type === 'drawing' && i.round === this.currentRound)
      if (item) drawings.push({ ...item, ownerId: playerId })
    }

    this._assignWithoutSelf(drawings)
  }

  _assignWithoutSelf(items) {
    const playerIds = Array.from(this.players.values()).map(p => p.id)
    const assignments = {}
    for (const playerId of playerIds) assignments[playerId] = []

    if (!items.length || !playerIds.length) {
      this.currentAssignment = assignments
      return
    }

    const players = [...playerIds].sort(() => Math.random() - 0.5)
    const pool = [...items].sort(() => Math.random() - 0.5)
    const used = new Set()
    const chosen = {}

    const solve = (idx) => {
      if (idx >= players.length) return true

      const playerId = players[idx]
      const candidates = []
      for (let i = 0; i < pool.length; i++) {
        if (used.has(i)) continue
        if (pool[i].author === playerId) continue
        if (pool[i].rootAuthor === playerId) continue
        candidates.push(i)
      }

      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const tmp = candidates[i]
        candidates[i] = candidates[j]
        candidates[j] = tmp
      }

      for (const itemIdx of candidates) {
        used.add(itemIdx)
        chosen[playerId] = pool[itemIdx]
        if (solve(idx + 1)) return true
        used.delete(itemIdx)
        delete chosen[playerId]
      }

      return false
    }

    const hasPerfectMatching = solve(0)

    if (hasPerfectMatching) {
      for (const playerId of playerIds) {
        if (chosen[playerId]) assignments[playerId].push(chosen[playerId])
      }
      this.currentAssignment = assignments
      return
    }

    // Safety fallback: do the best possible assignment without forcing self items.
    const remaining = [...pool]
    for (const playerId of players) {
      const idx = remaining.findIndex(item => item.author !== playerId && item.rootAuthor !== playerId)
      if (idx === -1) continue
      assignments[playerId].push(remaining.splice(idx, 1)[0])
    }

    this.currentAssignment = assignments
  }

  submitPhrase(playerId, content, basedOnAuthorId = null) {
    if (this.gameData[playerId]) {
      const assignment = this.currentAssignment[playerId]?.[0]
      const chainId = this.currentRound === 1
        ? this._nextChainId(playerId)
        : (assignment?.chainId || `orphan:${playerId}:${this.currentRound}`)
      const rootAuthor = this.currentRound === 1
        ? playerId
        : (assignment?.rootAuthor || null)
      const resolvedBasedOnAuthor = assignment?.author || basedOnAuthorId || null

      const item = { type: 'phrase', content, author: playerId, round: this.currentRound, chainId, rootAuthor }
      if (resolvedBasedOnAuthor) item.basedOnAuthor = resolvedBasedOnAuthor
      this.gameData[playerId].push(item)
    }
    this.submittedThisRound.add(playerId)
  }

  submitDrawing(playerId, drawingData, basedOnAuthorId = null) {
    if (this.gameData[playerId]) {
      const assignment = this.currentAssignment[playerId]?.[0]
      const chainId = assignment?.chainId || `orphan:${playerId}:${this.currentRound}`
      const rootAuthor = assignment?.rootAuthor || null
      const resolvedBasedOnAuthor = assignment?.author || basedOnAuthorId || null

      const item = { type: 'drawing', content: drawingData, author: playerId, round: this.currentRound, chainId, rootAuthor }
      if (resolvedBasedOnAuthor) item.basedOnAuthor = resolvedBasedOnAuthor
      this.gameData[playerId].push(item)
    }
    this.submittedThisRound.add(playerId)
  }

  _nextChainId(playerId) {
    this.chainSequence += 1
    return `${playerId}-${this.chainSequence}`
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
