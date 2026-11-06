const socket = io()
const chat = document.querySelector('#chat')
const formChat = document.querySelector('#form-chat')
const champMessage = document.querySelector('#message')

function ajouterLigne(texte, classe = '') {
    const li = document.createElement('li')
    li.textContent = texte
    if (classe) li.className = classe
    chat.appendChild(li)
    chat.scrollTop = chat.scrollHeight
}

formChat.addEventListener('submit', (e) => {
    e.preventDefault()
    const texte = champMessage.value.trim()
    if (texte === '') return
    socket.emit('say', texte)
    champMessage.value = ''
    champMessage.focus()
})

// Événements relayés par server.js
socket.on('chat', (message) => ajouterLigne(message))
socket.on('login', (data) => ajouterLigne(`Connecté au serveur (version ${data.version})`, 'systeme'))
socket.on('spawn', (data) => ajouterLigne(`${data.username} est apparu dans le monde`, 'systeme'))
socket.on('kicked', (raison) => ajouterLigne(`Expulsé : ${raison}`, 'systeme erreur'))
socket.on('error', (message) => ajouterLigne(`Erreur : ${message}`, 'systeme erreur'))
socket.on('end', (raison) => ajouterLigne(`Déconnecté (${raison})`, 'systeme'))
