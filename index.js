const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const { Pool } = require('pg')
const path = require('path')

const app = express()
const server = http.createServer(app)
const io = new Server(server)
const port = process.env.PORT || 3000

// Database forbindelse
const db = new Pool({
  connectionString: process.env.DATABASE_URL
})

// Opret tabel hvis den ikke findes
async function initDB() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  console.log('Database klar')
}

app.use(express.static('public'))

// Socket.io
io.on('connection', async (socket) => {
  console.log('Bruger forbundet')

  // Send historik til den nye bruger
  const result = await db.query(`
    SELECT * FROM messages 
    ORDER BY created_at DESC 
    LIMIT 50
  `)
  socket.emit('historik', result.rows.reverse())

  // Modtag besked fra bruger
  socket.on('besked', async (data) => {
    const { username, message } = data

    if (!username?.trim() || !message?.trim()) return

    // Gem i database
    const saved = await db.query(
      'INSERT INTO messages (username, message) VALUES ($1, $2) RETURNING *',
      [username.trim(), message.trim()]
    )

    // Send til ALLE forbundne brugere øjeblikkeligt
    io.emit('besked', saved.rows[0])
  })

  socket.on('disconnect', () => {
    console.log('Bruger frakoblet')
  })
})

// Start server
initDB().then(() => {
  server.listen(port, '0.0.0.0', () => {
    console.log(`Chat-app kører på port ${port}`)
  })
})