const path = require('path')
const http = require('http')
const express = require('express')
const { Server } = require('socket.io')
const { startBot } = require('./src/botManager')

// Charge la configuration depuis .env (fonction native de Node, pas besoin du paquet dotenv)
try {
    process.loadEnvFile()
} catch {
    console.error('Fichier .env introuvable : copie .env.example en .env et remplis-le.')
    process.exit(1)
}

const { MC_HOST, MC_PORT, MC_USERNAME, PANEL_PORT = 3000 } = process.env
if (!MC_HOST || !MC_USERNAME) {
    console.error('MC_HOST et MC_USERNAME doivent être définis dans .env')
    process.exit(1)
}

const app = express()
const server = http.createServer(app)
const io = new Server(server)

app.use(express.static(path.join(__dirname, 'public')))

async function main() {
    const options = { host: MC_HOST, username: MC_USERNAME }
    if (MC_PORT) options.port = Number(MC_PORT)  // sans port, l'adresse est résolue via DNS (ex. Aternos)

    const bot = await startBot(
        options,
        (type, data) => {
            console.log(`[${type}]`, data)  // trace dans le terminal
            io.emit(type, data)             // relaie à TOUS les navigateurs connectés
        }
    )

    io.on('connection', (socket) => {
        socket.on('say', (texte) => {
            if (typeof texte !== 'string') return

            const message = texte.trim()
            if (message === '') {
                socket.emit('error', 'Le message est vide.')
                return
            }

            bot.chat(message.slice(0, 256))
        })
    })

    server.listen(PANEL_PORT, '127.0.0.1', () => console.log(`Panel : http://localhost:${PANEL_PORT}`))
}

main().catch((err) => {
    console.error('Impossible de démarrer le panel :', err.message)
    process.exit(1)
})
