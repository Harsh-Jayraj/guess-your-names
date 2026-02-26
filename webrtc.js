// WebRTC Peer-to-Peer Connection Manager
class PeerConnectionManager {
    constructor() {
        this.peers = new Map();
        this.dataChannels = new Map();
        this.roomCode = null;
        this.isHost = false;
        this.onMessageCallback = null;
        this.onPeerConnectCallback = null;
        this.onPeerDisconnectCallback = null;
    }

    async createRoom(playerName, team, onMessage) {
        this.isHost = true;
        this.onMessageCallback = onMessage;
        this.roomCode = this.generateRoomCode();
        
        // Store local player info
        this.localPlayer = {
            id: this.generatePlayerId(),
            name: playerName,
            team: team,
            isSpymaster: true
        };

        // Initialize signaling server (using Firebase for simplicity, but could use any pub/sub)
        await this.initSignaling();
        
        return this.roomCode;
    }

    async joinRoom(roomCode, playerName, team, onMessage) {
        this.isHost = false;
        this.roomCode = roomCode;
        this.onMessageCallback = onMessage;
        
        // Store local player info
        this.localPlayer = {
            id: this.generatePlayerId(),
            name: playerName,
            team: team,
            isSpymaster: false
        };

        await this.initSignaling();
        
        // Notify host to send current game state
        this.broadcast({
            type: 'join-request',
            player: this.localPlayer
        });
    }

    generateRoomCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    generatePlayerId() {
        return Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    async initSignaling() {
        // Simple signaling using Firebase Realtime Database (free tier)
        // This is the only server-dependent part, but Firebase free tier handles 200+ concurrent users easily
        const firebaseConfig = {
          apiKey: "AIzaSyAiuRDew6h1e2b3bqphrRIFksMkYu32h5M",
          authDomain: "codenames-f1b66.firebaseapp.com",
          projectId: "codenames-f1b66",
          storageBucket: "codenames-f1b66.firebasestorage.app",
          messagingSenderId: "618871090654",
          appId: "1:618871090654:web:7609cf959499236d8fc14f",
          measurementId: "G-SKTPHD9VGZ"
        };

        // Initialize Firebase (you'll need to create a free Firebase project)
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        this.signalingRef = firebase.database().ref(`rooms/${this.roomCode}`);
        
        // Listen for signaling messages
        this.signalingRef.child('signaling').on('child_added', (snapshot) => {
            const message = snapshot.val();
            if (message.target === this.localPlayer.id || message.target === 'broadcast') {
                this.handleSignalingMessage(message);
            }
            // Remove processed message
            snapshot.ref.remove();
        });

        // If host, listen for join requests
        if (this.isHost) {
            this.signalingRef.child('players').on('child_added', (snapshot) => {
                const player = snapshot.val();
                if (player.id !== this.localPlayer.id) {
                    this.connectToPeer(player);
                }
            });
        }
    }

    async connectToPeer(player) {
        const peerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        });

        // Create data channel
        const dataChannel = peerConnection.createDataChannel('game');
        this.setupDataChannel(dataChannel, player.id);

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignalingMessage({
                    type: 'ice-candidate',
                    target: player.id,
                    candidate: event.candidate
                });
            }
        };

        // Handle incoming data channels
        peerConnection.ondatachannel = (event) => {
            this.setupDataChannel(event.channel, player.id);
        };

        // Create offer if we're the host
        if (this.isHost) {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            
            this.sendSignalingMessage({
                type: 'offer',
                target: player.id,
                offer: offer
            });
        }

        this.peers.set(player.id, peerConnection);
    }

    setupDataChannel(dataChannel, peerId) {
        dataChannel.onopen = () => {
            console.log(`Data channel open with ${peerId}`);
            this.dataChannels.set(peerId, dataChannel);
            
            // Send current game state to new peer
            if (this.isHost && window.gameState) {
                this.sendToPeer(peerId, {
                    type: 'game-state',
                    state: window.gameState
                });
            }
        };

        dataChannel.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.onMessageCallback(message, peerId);
        };

        dataChannel.onclose = () => {
            console.log(`Data channel closed with ${peerId}`);
            this.dataChannels.delete(peerId);
        };
    }

    async handleSignalingMessage(message) {
        const peerConnection = this.peers.get(message.from);

        switch (message.type) {
            case 'offer':
                if (peerConnection) {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(message.offer));
                    const answer = await peerConnection.createAnswer();
                    await peerConnection.setLocalDescription(answer);
                    
                    this.sendSignalingMessage({
                        type: 'answer',
                        target: message.from,
                        answer: answer
                    });
                }
                break;

            case 'answer':
                if (peerConnection) {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer));
                }
                break;

            case 'ice-candidate':
                if (peerConnection) {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
                }
                break;

            case 'join-request':
                // Host receives join request, add player to room
                this.signalingRef.child('players').child(message.player.id).set(message.player);
                break;
        }
    }

    sendSignalingMessage(message) {
        message.from = this.localPlayer.id;
        message.timestamp = Date.now();
        this.signalingRef.child('signaling').push(message);
    }

    broadcast(message) {
        this.dataChannels.forEach((channel, peerId) => {
            if (channel.readyState === 'open') {
                channel.send(JSON.stringify(message));
            }
        });
    }

    sendToPeer(peerId, message) {
        const channel = this.dataChannels.get(peerId);
        if (channel && channel.readyState === 'open') {
            channel.send(JSON.stringify(message));
        }
    }

    disconnect() {
        this.dataChannels.forEach(channel => channel.close());
        this.peers.forEach(peer => peer.close());
        if (this.signalingRef) {
            this.signalingRef.off();
        }
    }
}

// Initialize global peer manager
const peerManager = new PeerConnectionManager();
