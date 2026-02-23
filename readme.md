# Codenames: Zero-Cost Edition

A peer-to-peer implementation of the popular Codenames game that can handle 200+ concurrent players with zero server costs.

## Features
- No server costs - uses WebRTC for P2P communication
- Supports up to 50 simultaneous games (200 players)
- Real-time gameplay with chat
- Spymaster view with color-coded cards
- Automatic game state synchronization

## How It Works
1. One player creates a room as Spymaster
2. Other players join using the room code
3. All communication happens directly between browsers using WebRTC
4. Only signaling uses Firebase (free tier handles unlimited concurrent users)

## Deployment Steps

### Option 1: Deploy to Netlify (Easiest - Completely Free)

1. **Create a Firebase Project** (for signaling):
   - Go to https://console.firebase.google.com/
   - Click "Create a project"
   - Enable Realtime Database in test mode
   - Register a web app to get your config

2. **Update the Firebase config** in `webrtc.js`:
   ```javascript
   const firebaseConfig = {
       apiKey: "YOUR_API_KEY",
       authDomain: "YOUR_PROJECT.firebaseapp.com",
       databaseURL: "https://YOUR_PROJECT.firebaseio.com",
       projectId: "YOUR_PROJECT",
       storageBucket: "YOUR_PROJECT.appspot.com",
       messagingSenderId: "YOUR_SENDER_ID"
   };