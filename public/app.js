const socket = io()

// --- État de la page ---
let bots = []
let botSelectionne = null

// --- Éléments ---
const listeBots = document.querySelector('#liste-bots')
const formAjout = document.querySelector('#form-ajout')
const champUsername = document.querySelector('#ajout-username')
const champHost = document.querySelector('#ajout-host')
const champPort = document.querySelector('#ajout-port')
const erreurAjout = document.querySelector('#erreur-ajout')
const titreBot = document.querySelector('#titre-bot')
const chat = document.querySelector('#chat')
const formChat = document.querySelector('#form-chat')
const champMessage = document.querySelector('#message')
const boutonEnvoyer = formChat.querySelector('button')

const LIBELLES = { arrete: 'Arrêté', connexion: 'Connexion…', connecte: 'Connecté' }

function ajouterLigne(texte, classe = '') {
    const li = document.createElement('li')
    li.textContent = texte
    if (classe) li.className = classe
    chat.appendChild(li)
    chat.scrollTop = chat.scrollHeight
}

// Transforme un événement en ligne de chat : sert pour le direct ET pour l'historique
function afficherEvenement({ type, data }) {
    switch (type) {
        case 'chat': ajouterLigne(data.message); break
        case 'login': ajouterLigne(`Connecté au serveur (version ${data.version})`, 'systeme'); break
        // TODO 1 : 'spawn', 'kicked' (data.reason), 'error' (data.message), 'end' (data.reason)
        //          avec les classes 'systeme' ou 'systeme erreur'
        case 'spawn': ajouterLigne(`Bot spawné`, 'systeme'); break
        case 'kicked': ajouterLigne(`Bot expulsé : ${data.reason}`, 'systeme erreur'); break
        case 'error': ajouterLigne(`Erreur : ${data.message}`, 'systeme erreur'); break
        case 'end': ajouterLigne(`Connexion terminée : ${data.reason}`, 'systeme erreur'); break
    }
}

// Envoie une action et affiche l'erreur éventuelle dans le chat
function action(nom, donnees) {
    socket.emit(nom, donnees, (rep) => {
        if (!rep.ok) ajouterLigne(`Erreur : ${rep.erreur}`, 'systeme erreur')
    })
}

function afficherListe() {
    listeBots.replaceChildren()  // vide la liste avant de la redessiner
    for (const bot of bots) {
        const li = document.createElement('li')
        li.className = 'bot' + (bot.id === botSelectionne ? ' selectionne' : '')

        // TODO 2 : le pseudo, puis un <span class="adresse"> avec host (+ ':' + port s'il existe)
        //          → toujours textContent : l'adresse est un texte libre saisi par l'utilisateur
        li.textContent = bot.username + ' '
        const spanAdresse = document.createElement('span')
        spanAdresse.className = 'adresse'
        spanAdresse.textContent = bot.host + (bot.port ? ':' + bot.port : '')
        li.appendChild(spanAdresse)

        // TODO 3 : une pastille <span class="statut statut-XXX"> contenant LIBELLES[bot.statut]
        const spanStatut = document.createElement('span')
        spanStatut.className = 'statut statut-' + bot.statut
        spanStatut.textContent = LIBELLES[bot.statut]
        li.appendChild(spanStatut)

        // TODO 4 : un bouton « Démarrer » si bot.statut === 'arrete', sinon « Arrêter »
        //          → action('bot:demarrer', bot.id) ou action('bot:arreter', bot.id)
        const boutonDemarrerArreter = document.createElement('button')
        if (bot.statut === 'arrete') {
            boutonDemarrerArreter.textContent = 'Démarrer'
            boutonDemarrerArreter.addEventListener('click', (e) => {
                e.stopPropagation()
                action('bot:demarrer', bot.id)
            })
        } else {
            boutonDemarrerArreter.textContent = 'Arrêter'
            boutonDemarrerArreter.addEventListener('click', (e) => {
                e.stopPropagation()
                action('bot:arreter', bot.id)
            })
        }
        li.appendChild(boutonDemarrerArreter)
        // TODO 5 : un bouton « Supprimer » → if (confirm(...)) action('bot:supprimer', bot.id)
        // Dans les gestionnaires des boutons, commence par e.stopPropagation() :
        // sinon le clic « remonte » jusqu'au <li> et sélectionne aussi le bot.
        const boutonSupprimer = document.createElement('button')
        boutonSupprimer.textContent = 'Supprimer'
        boutonSupprimer.addEventListener('click', (e) => {
            e.stopPropagation()
            if (confirm(`Voulez-vous vraiment supprimer le bot "${bot.username}" ?`)) {
                action('bot:supprimer', bot.id)
            }
        })
        li.appendChild(boutonSupprimer)

        li.addEventListener('click', () => selectionner(bot.id))
        listeBots.append(li)
    }
}

function selectionner(id) {
    botSelectionne = id
    const bot = bots.find((b) => b.id === id)
    // TODO 6 : mettre le pseudo dans titreBot, vider le chat (chat.replaceChildren())
    titreBot.textContent = bot.username
    chat.replaceChildren()
    // TODO 7 : activer champMessage et boutonEnvoyer (disabled = false)
    champMessage.disabled = false
    boutonEnvoyer.disabled = false
    // TODO 8 : socket.emit('bot:historique', id, (rep) => { ... })
    //          → afficher chaque événement de rep.resultat avec afficherEvenement
    //          → mais si botSelectionne !== id (on a cliqué sur un autre bot entre-temps),
    //            ignorer la réponse
    socket.emit('bot:historique', id, (rep) => {
        if (!rep.ok) {
            ajouterLigne(`Erreur : ${rep.erreur}`, 'systeme erreur')
            return
        }
        if (botSelectionne !== id) return  // on a cliqué sur un autre bot entre-temps
        for (const evenement of rep.resultat) {
            afficherEvenement(evenement)
        }
    })
    afficherListe()  // pour mettre la ligne en surbrillance
}

socket.on('bots:liste', (liste) => {
    bots = liste
    // TODO 9 : si botSelectionne n'existe plus dans la liste (bot supprimé, peut-être depuis
    //          un autre onglet) → botSelectionne = null, titre par défaut, chat vidé,
    //          champ et bouton désactivés
    if (botSelectionne && !bots.find((b) => b.id === botSelectionne)) {
        botSelectionne = null
        titreBot.textContent = 'Sélectionnez un bot'
        chat.replaceChildren()
        champMessage.disabled = true
        boutonEnvoyer.disabled = true
    }
    afficherListe()
})

socket.on('bot:event', ({ id, type, data }) => {
    const bot = bots.find((b) => b.id === id)
    if (!bot) return  // bot supprimé pendant qu'il tournait
    if (type === 'statut') {
        // TODO 10 : mettre à jour bot.statut avec data, puis afficherListe()
        bot.statut = data
        afficherListe()
        return
    }
    if (id === botSelectionne) afficherEvenement({ type, data })
})

formAjout.addEventListener('submit', (e) => {
    e.preventDefault()
    // TODO 11 : lire les 3 champs (.value), puis socket.emit('bot:ajouter', { username, host, port }, (rep) => ...)
    //   - échec  → erreurAjout.textContent = rep.erreur
    //   - succès → vider erreurAjout, formAjout.reset(), selectionner(rep.resultat.id)
    const username = champUsername.value.trim()
    const host = champHost.value.trim()
    const port = champPort.value.trim() || undefined

    socket.emit('bot:ajouter', { username, host, port }, (rep) => {
        if (!rep.ok) {
            erreurAjout.textContent = rep.erreur
            return
        }
        erreurAjout.textContent = ''
        formAjout.reset()
        selectionner(rep.resultat.id)
    })
})

formChat.addEventListener('submit', (e) => {
    e.preventDefault()
    // TODO 12 : comme dans ton ancienne version, mais avec
    //           action('bot:parler', { id: botSelectionne, texte })
    const texte = champMessage.value.trim()
    if (texte === '') return
    action('bot:parler', { id: botSelectionne, texte })
    champMessage.value = ''
})