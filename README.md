# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.


# 🎨 Gartic Draw — Multijoueur local

Application de dessin collaboratif en temps réel, style Gartic Phone.

## Stack

| Côté | Tech |
|------|------|
| Serveur | Node.js + `ws` (WebSocket natif) |
| Client | React + Vite |

---

## Installation

```bash
npm install
```

---

## Lancement

### 1 — Démarrer le serveur WebSocket (dans un terminal)

```bash
npm run server
# → 🎨 Gartic Draw — serveur WebSocket sur ws://localhost:3001
```

### 2 — Démarrer le client Vite (dans un autre terminal)

```bash
npm run dev
# → Local: http://localhost:5173
```

### 3 — Ouvrir plusieurs onglets / navigateurs

- Joueur 1 → `http://localhost:5173`
- Joueur 2 → `http://localhost:5173` (nouvel onglet ou autre navigateur)
- Joueur 3, 4… → idem

> Pour simuler des ports différents (5173 / 5174), tu peux lancer deux instances Vite :
> ```bash
> vite --port 5173   # terminal A
> vite --port 5174   # terminal B
> ```

---

## Architecture

```
Client A (5173) ──┐
Client B (5174) ──┤──▶  WebSocket Server (3001)  ──▶  broadcast à tous
Client C (5173) ──┘
```

### Messages WebSocket

| Type | Direction | Description |
|------|-----------|-------------|
| `join` | Client → Serveur | Rejoindre avec nom / avatar / couleur |
| `welcome` | Serveur → Client | ID, liste joueurs, historique des traits |
| `players` | Serveur → Tous | Liste mise à jour des joueurs connectés |
| `joined` | Serveur → Autres | Un nouveau joueur vient d'arriver |
| `left` | Serveur → Tous | Un joueur s'est déconnecté |
| `draw` | Bidirectionnel | Segment de trait (coordonnées normalisées 0-1) |
| `reset` | Bidirectionnel | Effacer le canvas |

### Coordonnées normalisées

Les traits sont envoyés avec des coordonnées normalisées entre 0 et 1 (`x1, y1, x2, y2`), indépendantes de la taille de l'écran. Le client multiplie par les dimensions réelles du canvas au moment du rendu.

---

## Fonctionnalités

- ✅ Dessin en temps réel synchronisé entre tous les joueurs
- ✅ Historique rejoué pour les nouveaux arrivants
- ✅ Crayon (20 couleurs) + Gomme (3 tailles)
- ✅ Remise à zéro partagée
- ✅ Liste des joueurs connectés en temps réel
- ✅ Notifications de connexion / déconnexion
- ✅ Support tactile (mobile / tablette)
