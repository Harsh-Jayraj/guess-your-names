// Game State Management
class CodenamesGame {
    constructor() {
        this.state = {
            board: [],
            redScore: 0,
            blueScore: 0,
            currentTurn: 'red',
            gameStarted: false,
            players: new Map(),
            spymasters: new Map(),
            currentClue: null,
            remainingGuesses: 0
        };

        this.wordBank = [
            'AFRICA', 'AGENT', 'AIR', 'ALIEN', 'ALPS', 'AMAZON', 'AMBULANCE', 'AMERICA', 'ANGEL', 'ANTARCTICA',
            'APPLE', 'ARM', 'ATLANTIS', 'AUSTRALIA', 'AZTEC', 'BACK', 'BALL', 'BAND', 'BANK', 'BAR',
            'BARK', 'BAT', 'BATTERY', 'BEACH', 'BEAR', 'BEAT', 'BED', 'BEIJING', 'BELL', 'BELT',
            'BERLIN', 'BERMUDA', 'BERRY', 'BILL', 'BLOCK', 'BOARD', 'BOLT', 'BOMB', 'BOND', 'BOOM',
            'BOOT', 'BOTTLE', 'BOW', 'BOX', 'BRIDGE', 'BRUSH', 'BUCK', 'BUFFALO', 'BUG', 'BUGLE',
            'BUTTON', 'CALF', 'CANADA', 'CAP', 'CAPITAL', 'CAR', 'CARD', 'CARROT', 'CASINO', 'CAST',
            'CAT', 'CELL', 'CENTAUR', 'CENTER', 'CHAIR', 'CHANGE', 'CHARGE', 'CHECK', 'CHEST', 'CHICK',
            'CHINA', 'CHOCOLATE', 'CHURCH', 'CIRCLE', 'CLIFF', 'CLOAK', 'CLUB', 'CODE', 'COLD', 'COMIC',
            'COMPOUND', 'CONCERT', 'CONDUCTOR', 'CONTRACT', 'COOK', 'COPPER', 'COTTON', 'COURT', 'COVER', 'CRANE',
            'CRASH', 'CRICKET', 'CROSS', 'CROWN', 'CYCLE', 'CZECH', 'DANCE', 'DATE', 'DAY', 'DEATH',
            'DECK', 'DEGREE', 'DIAMOND', 'DICE', 'DINOSAUR', 'DISEASE', 'DOCTOR', 'DOG', 'DRAFT', 'DRAGON',
            'DRESS', 'DRILL', 'DROP', 'DUCK', 'DUST', 'EARTH', 'EAST', 'EGG', 'EGYPT', 'ELEPHANT'
        ];
    }

    initializeBoard() {
        const words = this.getRandomWords(25);
        const assignments = this.generateAssignments();
        
        this.state.board = words.map((word, index) => ({
            word: word,
            type: assignments[index],
            revealed: false
        }));

        this.state.redScore = assignments.filter(a => a === 'red-agent').length;
        this.state.blueScore = assignments.filter(a => a === 'blue-agent').length;
    }

    getRandomWords(count) {
        const shuffled = [...this.wordBank].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    generateAssignments() {
        // Standard Codenames distribution: 9 red, 8 blue, 7 innocent, 1 assassin
        const assignments = [];
        
        // Add 9 red agents
        for (let i = 0; i < 9; i++) assignments.push('red-agent');
        // Add 8 blue agents
        for (let i = 0; i < 8; i++) assignments.push('blue-agent');
        // Add 7 innocent bystanders
        for (let i = 0; i < 7; i++) assignments.push('innocent');
        // Add 1 assassin
        assignments.push('assassin');
        
        // Shuffle
        return assignments.sort(() => 0.5 - Math.random());
    }

    addPlayer(playerId, name, team, isSpymaster) {
        this.state.players.set(playerId, { name, team, isSpymaster });
        if (isSpymaster) {
            this.state.spymasters.set(team, playerId);
        }
    }

    removePlayer(playerId) {
        const player = this.state.players.get(playerId);
        if (player) {
            if (player.isSpymaster) {
                this.state.spymasters.delete(player.team);
            }
            this.state.players.delete(playerId);
        }
    }

    canPlayerSeeColors(playerId) {
        const player = this.state.players.get(playerId);
        return player && player.isSpymaster;
    }

    giveClue(word, number, spymasterId) {
        const spymaster = this.state.players.get(spymasterId);
        if (!spymaster || !spymaster.isSpymaster) return false;
        if (spymaster.team !== this.state.currentTurn) return false;

        this.state.currentClue = { word, number };
        this.state.remainingGuesses = number + 1; // +1 for the bonus guess
        return true;
    }

    selectCard(index, playerId) {
        const player = this.state.players.get(playerId);
        if (!player) return { valid: false, reason: 'Player not found' };
        if (player.isSpymaster) return { valid: false, reason: 'Spymasters cannot guess' };
        if (player.team !== this.state.currentTurn) return { valid: false, reason: 'Not your turn' };
        if (this.state.remainingGuesses <= 0) return { valid: false, reason: 'No guesses remaining' };
        if (this.state.board[index].revealed) return { valid: false, reason: 'Card already revealed' };

        const card = this.state.board[index];
        card.revealed = true;
        this.state.remainingGuesses--;

        // Update scores
        if (card.type === 'red-agent') {
            this.state.redScore--;
        } else if (card.type === 'blue-agent') {
            this.state.blueScore--;
        }

        // Check game end conditions
        if (card.type === 'assassin') {
            this.endGame(player.team === 'red' ? 'blue' : 'red', 'assassin');
            return { valid: true, gameOver: true, reason: 'assassin' };
        }

        if (this.state.redScore === 0) {
            this.endGame('red', 'all-cards');
            return { valid: true, gameOver: true, reason: 'victory' };
        }

        if (this.state.blueScore === 0) {
            this.endGame('blue', 'all-cards');
            return { valid: true, gameOver: true, reason: 'victory' };
        }

        // Wrong team guess ends turn
        if (card.type !== player.team + '-agent') {
            this.endTurn();
        }

        // If no guesses left, end turn
        if (this.state.remainingGuesses === 0) {
            this.endTurn();
        }

        return { valid: true, gameOver: false };
    }

    endTurn() {
        this.state.currentTurn = this.state.currentTurn === 'red' ? 'blue' : 'red';
        this.state.currentClue = null;
        this.state.remainingGuesses = 0;
    }

    endGame(winningTeam, reason) {
        this.state.gameStarted = false;
        this.state.gameOver = {
            winningTeam,
            reason
        };
    }

    startGame() {
        if (this.state.players.size < 2) return false;
        if (!this.state.spymasters.has('red') || !this.state.spymasters.has('blue')) return false;
        
        this.initializeBoard();
        this.state.gameStarted = true;
        this.state.currentTurn = Math.random() < 0.5 ? 'red' : 'blue';
        this.state.currentClue = null;
        this.state.remainingGuesses = 0;
        return true;
    }
}

// UI Management
const game = new CodenamesGame();
let localPlayerId = null;

function createRoom() {
    const team = document.getElementById('team-select').value;
    const playerName = prompt('Enter your name:', 'Spymaster');
    if (!playerName) return;

    localPlayerId = peerManager.generatePlayerId();
    peerManager.createRoom(playerName, team, handleGameMessage).then(roomCode => {
        document.getElementById('setup-screen').classList.remove('active');
        document.getElementById('game-screen').classList.add('active');
        document.getElementById('display-room-code').textContent = roomCode;
        document.getElementById('team-indicator').textContent = team === 'red' ? 'Red Team' : 'Blue Team';
        document.getElementById('team-indicator').className = `team-indicator ${team}`;
        document.getElementById('player-role').textContent = 'Spymaster';
        document.getElementById('start-game-btn').style.display = 'block';
        
        game.addPlayer(localPlayerId, playerName, team, true);
        updatePlayersList();
    });
}

function joinRoom() {
    const roomCode = document.getElementById('room-code').value.toUpperCase();
    if (!roomCode) {
        alert('Please enter a room code');
        return;
    }

    const team = document.getElementById('team-select').value;
    const playerName = prompt('Enter your name:', 'Field Operative');
    if (!playerName) return;

    localPlayerId = peerManager.generatePlayerId();
    peerManager.joinRoom(roomCode, playerName, team, handleGameMessage).then(() => {
        document.getElementById('setup-screen').classList.remove('active');
        document.getElementById('game-screen').classList.add('active');
        document.getElementById('display-room-code').textContent = roomCode;
        document.getElementById('team-indicator').textContent = team === 'red' ? 'Red Team' : 'Blue Team';
        document.getElementById('team-indicator').className = `team-indicator ${team}`;
        document.getElementById('player-role').textContent = 'Field Operative';
        
        game.addPlayer(localPlayerId, playerName, team, false);
        updatePlayersList();
    });
}

function handleGameMessage(message, fromPeerId) {
    switch (message.type) {
        case 'game-state':
            // Sync full game state
            game.state = message.state;
            renderBoard();
            updateScores();
            updatePlayersList();
            break;

        case 'player-joined':
            game.addPlayer(message.player.id, message.player.name, message.player.team, message.player.isSpymaster);
            updatePlayersList();
            addChatMessage(`${message.player.name} joined the ${message.player.team} team`, 'system');
            break;

        case 'player-left':
            game.removePlayer(message.playerId);
            updatePlayersList();
            addChatMessage(`Player left`, 'system');
            break;

        case 'clue':
            if (game.state.currentTurn === message.team) {
                game.state.currentClue = { word: message.word, number: message.number };
                game.state.remainingGuesses = message.number + 1;
                addChatMessage(`Clue: ${message.word} ${message.number}`, 'system');
            }
            break;

        case 'card-selected':
            const result = game.selectCard(message.index, message.playerId);
            renderBoard();
            updateScores();
            
            if (result.gameOver) {
                addChatMessage(`Game Over! ${result.reason}`, 'system');
            }
            
            // Broadcast to all peers
            if (peerManager.isHost) {
                peerManager.broadcast({
                    type: 'game-state',
                    state: game.state
                });
            }
            break;

        case 'chat':
            addChatMessage(message.text, message.team);
            break;

        case 'start-game':
            if (game.startGame()) {
                renderBoard();
                addChatMessage('Game started!', 'system');
                peerManager.broadcast({
                    type: 'game-state',
                    state: game.state
                });
            }
            break;
    }
}

function renderBoard() {
    const board = document.getElementById('game-board');
    board.innerHTML = '';

    game.state.board.forEach((card, index) => {
        const cardElement = document.createElement('div');
        cardElement.className = `card`;
        
        if (card.revealed) {
            cardElement.classList.add('revealed', card.type);
        } else if (game.canPlayerSeeColors(localPlayerId)) {
            // Spymasters see colors even when not revealed
            cardElement.setAttribute('data-type', card.type);
        }
        
        cardElement.textContent = card.word;
        cardElement.onclick = () => selectCard(index);
        
        board.appendChild(cardElement);
    });
}

function selectCard(index) {
    if (!game.state.gameStarted) return;
    if (game.state.board[index].revealed) return;
    
    peerManager.broadcast({
        type: 'card-selected',
        index: index,
        playerId: localPlayerId
    });
}

function giveClue() {
    const word = document.getElementById('clue-word').value.toUpperCase();
    const number = parseInt(document.getElementById('clue-number').value);
    
    if (!word || isNaN(number)) {
        alert('Please enter a clue word and number');
        return;
    }

    peerManager.broadcast({
        type: 'clue',
        word: word,
        number: number,
        team: game.state.currentTurn
    });

    document.getElementById('clue-word').value = '';
    document.getElementById('clue-number').value = '';
}

function startGame() {
    if (!peerManager.isHost) {
        alert('Only the spymaster can start the game');
        return;
    }

    peerManager.broadcast({
        type: 'start-game'
    });
}

function sendChat() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    
    if (!text) return;

    const player = game.state.players.get(localPlayerId);
    peerManager.broadcast({
        type: 'chat',
        text: text,
        team: player.team
    });

    input.value = '';
}

function addChatMessage(text, team) {
    const messages = document.getElementById('chat-messages');
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${team}`;
    messageElement.textContent = text;
    messages.appendChild(messageElement);
    messages.scrollTop = messages.scrollHeight;
}

function updatePlayersList() {
    const redList = document.getElementById('red-players');
    const blueList = document.getElementById('blue-players');
    
    redList.innerHTML = '<h4>Red Team</h4>';
    blueList.innerHTML = '<h4>Blue Team</h4>';

    game.state.players.forEach((player, id) => {
        const playerElement = document.createElement('span');
        playerElement.className = `player-badge ${player.isSpymaster ? 'spymaster' : ''}`;
        playerElement.textContent = player.name + (player.isSpymaster ? ' (M)' : '');
        
        if (player.team === 'red') {
            redList.appendChild(playerElement);
        } else {
            blueList.appendChild(playerElement);
        }
    });
}

function updateScores() {
    document.getElementById('red-score').textContent = game.state.redScore;
    document.getElementById('blue-score').textContent = game.state.blueScore;
}

function copyRoomCode() {
    const roomCode = document.getElementById('display-room-code').textContent;
    navigator.clipboard.writeText(roomCode);
    alert('Room code copied to clipboard!');
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    peerManager.disconnect();
});