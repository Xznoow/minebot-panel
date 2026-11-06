const { createBot } = require('mineflayer-viaproxy')

/**
 * @param {object} options  { host, port?, username } : port facultatif (résolue via DNS)
 * @param {function} onEvent (type, data) => void
 * @returns {Promise<object>} le bot Mineflayer
*/

async function startBot(options, onEvent = () => {}) {
    const bot = await createBot({
        auth: 'offline',
        ...options,
        // Logs du proxy : affichés dans le terminal du serveur, pas envoyés au navigateur
        viaProxyStdoutCb: (data) => console.log(`[ViaProxy] ${data}`),
        viaProxyStderrCb: (data) => console.error(`[ViaProxy ERR] ${data}`)
    })

    // Contournement du bug Mineflayer #4189 (serveurs 26.3) : à retirer quand Mineflayer sera corrigé
    const origWrite = bot._client.write.bind(bot._client)
    bot._client.write = (name, packet) => {
        const result = origWrite(name, packet)
        if (name === 'position' || name === 'position_look' || name === 'look' || name === 'flying') {
            try { origWrite('tick_end', {}) } catch (err) { /* protocoles avant 1.21.2 */ }
        }
        return result
    }

    bot.once('login', () => onEvent('login', { version: bot.version }))

    bot.on('spawn', () => onEvent('spawn', { username: bot.username }))

    bot.on('messagestr', (message) => onEvent('chat', message))

    bot.on('kicked', (reason) => {
        onEvent('kicked', typeof reason === 'string' ? reason : JSON.stringify(reason))
    })

    bot.on('error', (err) => onEvent('error', err.message))

    bot.on('end', (reason) => onEvent('end', reason))

    return bot
}

module.exports = { startBot }