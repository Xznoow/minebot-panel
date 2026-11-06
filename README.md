# Minebot Panel

Panel web **local** pour piloter des bots Minecraft Java depuis le navigateur : chat en temps réel, envoi de messages, suivi de la connexion.

> Projet personnel en cours de développement.

## Fonctionnalités

- Chat du serveur affiché en temps réel dans le navigateur (Socket.IO)
- Envoi de messages en jeu depuis le panel
- Suivi de l'état du bot : connexion, apparition, expulsion, déconnexion
- Connexion aux serveurs récents (jusqu'à **26.3**) et plus anciens grâce à [ViaProxy](https://github.com/ViaVersion/ViaProxy)
- Bots en **offline-mode** : aucun compte Microsoft nécessaire

## Technologies

Node.js · Express · Socket.IO · [Mineflayer](https://github.com/PrismarineJS/mineflayer) · mineflayer-viaproxy · HTML / CSS / JavaScript vanilla

## Prérequis

- [Node.js](https://nodejs.org) 22 ou plus récent
- Java (par exemple [Temurin](https://adoptium.net) 25), nécessaire pour ViaProxy
- Un serveur Minecraft en **offline-mode** (`online-mode=false`) qui autorise les bots

## Installation

```bash
git clone https://github.com/Xznoow/minebot-panel.git
cd minebot-panel
npm install
cp .env.example .env    # Windows PowerShell : Copy-Item .env.example .env
```

Puis remplis le fichier `.env` :

| Variable | Rôle |
|---|---|
| `MC_HOST` | Adresse du serveur Minecraft |
| `MC_PORT` | Port du serveur (facultatif si l'adresse est résolue par DNS) |
| `MC_USERNAME` | Pseudo du bot |
| `PANEL_PORT` | Port du panel web (3000 par défaut) |

## Lancement

```bash
npm start
```

Ouvre ensuite [http://localhost:3000](http://localhost:3000). Le panel n'écoute que sur `127.0.0.1` : il n'est accessible que depuis ta machine.

Au premier lancement, ViaProxy est téléchargé automatiquement dans le dossier `viaproxy/`.

## Structure

```
├── server.js            Serveur Express + Socket.IO
├── src/botManager.js    Création du bot et remontée de ses événements
└── public/              Interface web (HTML, CSS, JS)
```

## Problème connu

Les serveurs 26.3 expulsent les bots Mineflayer (`invalid_player_movement`), car Mineflayer n'envoie pas le paquet `tick_end`
([PrismarineJS/mineflayer#4189](https://github.com/PrismarineJS/mineflayer/issues/4189)).
Un contournement est intégré dans `src/botManager.js`, à retirer quand Mineflayer sera corrigé.

## Prochaines étapes

- [ ] Gestion de plusieurs bots
- [ ] Reconnexion automatique
- [ ] État du bot envoyé aux navigateurs qui se connectent en cours de route
- [ ] Authentification du panel

## Utilisation responsable

N'utilise ce panel que sur tes propres serveurs ou sur des serveurs dont le règlement autorise les bots.

## Auteur

Antoine Degeorges — [@Xznoow](https://github.com/Xznoow)
