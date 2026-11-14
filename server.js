const path = require('path')
const http = require('http')
const express = require('express')
const { Server } = require('socket.io')
const { BotManager } = require('./src/botManager')

// .env facultatif, contient que PANEL_PORT
try { process.loadEnvFile() } catch { /* pas de .env : valeurs par défaut */ }
const PANEL_PORT = process.env.PANEL_PORT || 3000

const app = express()
const server = http.createServer(app)
const io = new Server(server)
app.use(express.static(path.join(__dirname, 'public')))

const manager = new BotManager((id, type, data) => {
    io.emit('bot:event', { id, type, data })
})

// Branche une action : appelle fn, puis répond { ok: true, resultat } ou { ok: false, erreur }
function brancher(socket, nom, fn) {
    socket.on(nom, async (donnees, repondre) => {
        if (typeof repondre !== 'function') return  // jamais confiance au navigateur
        try {
            const resultat = await fn(donnees)
            repondre({ ok: true, resultat })
        } catch (err) {
            repondre({ ok: false, erreur: err.message })
        }
    })
}

io.on('connection', (socket) => {
    socket.emit('bots:liste', manager.liste())

    brancher(socket, 'bot:ajouter', (config) => {
        const nouveau = manager.ajouter(config)
        io.emit('bots:liste', manager.liste())
        return nouveau
    })

    brancher(socket, 'bot:supprimer', (id) => {
        manager.supprimer(id)
        io.emit('bots:liste', manager.liste())
    })

    brancher(socket, 'bot:demarrer', (id) => manager.demarrer(id))

    brancher(socket, 'bot:arreter', (id) => manager.arreter(id))

    brancher(socket, 'bot:historique', (id) => manager.historique(id))

    brancher(socket, 'bot:parler', (donnees) => {
        if (!donnees || typeof donnees !== 'object' || typeof donnees.texte !== 'string') {
            throw new Error('Données invalides.')
        }
        const texte = donnees.texte.trim()
        if (texte === '') throw new Error('Le message est vide.')
        manager.parler(donnees.id, texte.slice(0, 256))
    })
})

server.listen(PANEL_PORT, '127.0.0.1', () => console.log(`Panel : http://localhost:${PANEL_PORT}`))
