const fs = require('fs')
const path = require('path')

const DOSSIER = path.join(__dirname, '..', 'data')
const FICHIER = path.join(DOSSIER, 'bots.json')

function chargerBots() {
    if (!fs.existsSync(FICHIER)) {
        return []
    }
    return JSON.parse(fs.readFileSync(FICHIER, 'utf-8'))
}

function sauvegarderBots(bots) {
    if (!fs.existsSync(DOSSIER)) {
        fs.mkdirSync(DOSSIER, { recursive: true })
    }
    fs.writeFileSync(FICHIER, JSON.stringify(bots, null, 2))
}

module.exports = { chargerBots, sauvegarderBots }