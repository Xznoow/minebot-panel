const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { createBot } = require('mineflayer-viaproxy')
const { chargerBots, sauvegarderBots } = require('./store')

const HISTORIQUE_MAX = 100
const DOSSIER_VIAPROXY = path.join(__dirname, '..', 'viaproxy')
const PSEUDO_VALIDE = /^[A-Za-z0-9_]{3,16}$/  // règles des pseudos Minecraft

class BotManager {
    #bots = new Map()  // le # rend la propriété privée, comme "private" en C#
    #onEvent

    /** @param {function} onEvent (id, type, data) => void */
    constructor(onEvent = () => {}) {
        this.#onEvent = onEvent
        for (const config of chargerBots()) {
            this.#bots.set(config.id, { config, bot: null, statut: 'arrete', historique: [] })
        }
    }

    // Données simples pour le navigateur : jamais l'objet bot lui-même
    liste() {
        return [...this.#bots.values()].map(({ config, statut }) => ({ ...config, statut }))
    }

    historique(id) {
        const entree = this.#bots.get(id)
        return entree ? entree.historique : []
    }

    ajouter({ username, host, port }) {
        // Normalisation : un champ vide du formulaire arrive en '' et un port en chaîne ('25565')
        const hostNormalise = typeof host === 'string' ? host.trim() : ''
        const portNormalise = (port === '' || port == null) ? undefined : Number(port)

        if (typeof username !== 'string' || !PSEUDO_VALIDE.test(username)) {
            throw new Error('Pseudo invalide : 3 à 16 caractères, lettres, chiffres ou _.')
        }
        if (hostNormalise === '') {
            throw new Error("L'adresse du serveur est obligatoire.")
        }
        if (portNormalise !== undefined && (!Number.isInteger(portNormalise) || portNormalise < 1 || portNormalise > 65535)) {
            throw new Error('Port invalide : entier entre 1 et 65535, ou vide.')
        }

        // Doublon : même pseudo sur le même serveur, le serveur expulserait l'un des deux
        for (const { config } of this.#bots.values()) {
            if (config.username === username && config.host === hostNormalise && config.port === portNormalise) {
                throw new Error('Un bot avec ce pseudo existe déjà sur ce serveur.')
            }
        }

        const config = { id: crypto.randomUUID(), username, host: hostNormalise, port: portNormalise }
        this.#bots.set(config.id, { config, bot: null, statut: 'arrete', historique: [] })
        this.#sauvegarder()
        return config
    }

    supprimer(id) {
        const entree = this.#bots.get(id)
        if (entree) {
            if (entree.statut !== 'arrete') {
                this.arreter(id)
            }
            this.#bots.delete(id)
            this.#sauvegarder()
        }
    }

    async demarrer(id) {
        const entree = this.#bots.get(id)
        if (!entree || entree.statut !== 'arrete') return  // inconnu ou déjà lancé

        this.#changerStatut(entree, 'connexion')
        const { username, host, port } = entree.config
        const options = {
            auth: 'offline', username, host,
            viaProxyStdoutCb: (d) => console.log(`[ViaProxy ${username}] ${d}`),
            viaProxyStderrCb: (d) => console.error(`[ViaProxy ${username} ERR] ${d}`)
        }
        if (port) options.port = port

        // Un seul jar ViaProxy partagé, mais un dossier de travail par bot (config et logs séparés).
        // Sans jar existant (première installation), on laisse le plugin le télécharger dans le dossier partagé.
        const jar = trouverJarViaProxy()
        if (jar) {
            options.viaProxyLocation = jar
            options.viaProxyWorkingDir = path.join(DOSSIER_VIAPROXY, 'instances', entree.config.id)
        } else {
            options.viaProxyWorkingDir = DOSSIER_VIAPROXY
        }

        let bot
        try {
            bot = await createBot(options)
        } catch (err) {  // Java absent, adresse introuvable…
            this.#emettre(entree, 'error', err.message)
            this.#changerStatut(entree, 'arrete')
            return
        }
        entree.bot = bot
        corrigerTickEnd(bot)

        bot.once('login', () => this.#emettre(entree, 'login', { version: bot.version }))
        bot.on('spawn', () => {
            this.#emettre(entree, 'spawn', {})
            this.#changerStatut(entree, 'connecte')
        })
        bot.on('messagestr', (msg) => this.#emettre(entree, 'chat', { message: msg }))
        bot.on('kicked', (reason) => this.#emettre(entree, 'kicked', {
            reason: typeof reason === 'string' ? reason : JSON.stringify(reason)
        }))
        bot.on('error', (err) => this.#emettre(entree, 'error', { message: err.message }))
        bot.on('end', (reason) => {
            entree.bot = null
            this.#emettre(entree, 'end', { reason })
            this.#changerStatut(entree, 'arrete')
        })
    }

    arreter(id) {
        const entree = this.#bots.get(id)
        if (entree && entree.bot) {
            entree.bot.quit()
        }
    }

    parler(id, texte) {
        const entree = this.#bots.get(id)
        if (!entree) {
            throw new Error("Le bot n'existe pas.")
        }
        if (entree.statut !== 'connecte') {
            throw new Error("Le bot n'est pas connecté.")
        }
        entree.bot.chat(texte)
    }

    // Enregistre l'événement dans l'historique, puis prévient le serveur
    #emettre(entree, type, data) {
        entree.historique.push({ type, data })
        if (entree.historique.length > HISTORIQUE_MAX) entree.historique.shift()
        this.#onEvent(entree.config.id, type, data)
    }

    #changerStatut(entree, statut) {
        entree.statut = statut
        this.#onEvent(entree.config.id, 'statut', statut)
    }

    #sauvegarder() {
        sauvegarderBots([...this.#bots.values()].map((e) => e.config))
    }
}

// Cherche le jar ViaProxy déjà téléchargé dans viaproxy/ (son nom contient la version)
function trouverJarViaProxy() {
    if (!fs.existsSync(DOSSIER_VIAPROXY)) return undefined
    const jar = fs.readdirSync(DOSSIER_VIAPROXY).find((f) => /^ViaProxy-.+\.jar$/.test(f))
    return jar ? path.join(DOSSIER_VIAPROXY, jar) : undefined
}

// Contournement du bug Mineflayer #4189 (serveurs 26.3) : à retirer quand Mineflayer sera corrigé
function corrigerTickEnd(bot) {
    const origWrite = bot._client.write.bind(bot._client)
    bot._client.write = (name, packet) => {
        const result = origWrite(name, packet)
        if (['position', 'position_look', 'look', 'flying'].includes(name)) {
            try { origWrite('tick_end', {}) } catch { /* protocoles avant 1.21.2 */ }
        }
        return result
    }
}

module.exports = { BotManager }