# Requisiti finali e collegamento alle lezioni

Questa pagina collega il PDF `ProgettoFinale2026.pdf` alle implementazioni del repository e ai
materiali delle lezioni presenti nella cartella superiore. I riferimenti sono ai titoli dei
PDF e ai file sorgente, in modo che il collegamento sia verificabile.

## Mappa dei requisiti

| Richiesta del progetto finale | Implementazione TaskFlow |
|---|---|
| Registrazione, login, logout e JWT | `authController.js`, `authRoutes.js`, `middleware/auth.js`, `utils/jwt.js` |
| Ruoli utente, proprietario, admin | ruolo `User.role`; proprietario via `Project.ownerId`; `requireAdmin` e `projectAccess.js` |
| Recupero password | `forgotPassword` e `resetPassword`; token temporaneo stampato in console (email non integrata) |
| CRUD progetti, visibilita', archivio e immagine | `projectController.js`, modello `Project`; copertina come URL |
| Invito e rimozione membri | endpoint `/projects/:projectId/members`; associazione molti-a-molti `ProjectMember` |
| Task con stato, scadenza, priorita' e assegnatario | `taskController.js`, modello `Task`, `TASK_STATUSES` e `TASK_PRIORITIES` |
| Catalogo pubblico con filtri | `listPublicProjects`; filtri API categoria, tecnologia e date |
| Dashboard personale | `dashboardController.js` |
| Chat di progetto | `messageController.js`, modello `Message`, rotte sotto il progetto |
| Eventi realtime e notifiche | `socket/index.js` e chiamate evento nei controller |
| Segnalazioni e moderazione | modello `Report`, `adminController.js`, `adminRoutes.js` |
| Tutto via API REST e permessi per ruolo | router/controller/middleware; collection Postman |
| Interfaccia web per usare e presentare l'app | `public/index.html`, `styles.css`, `components.css`, `client.js` |

## Collegamento ai materiali didattici

| Materiale fornito | Concetti applicati | Dove si vedono |
|---|---|---|
| [Introduzione e Setup di Node.js.pdf](../../../Introduzione%20e%20Setup%20di%20Node.js.pdf) | Node.js, moduli ES, npm, variabili d'ambiente, avvio del server | `package.json`, `src/server.js`, `src/config/db.js` |
| [Sviluppo di Applicazioni Web con Node.js.pdf](../../../Sviluppo%20di%20Applicazioni%20Web%20con%20Node.js.pdf) | Express, middleware, router, API REST e controller | `src/app.js`, `src/routes/`, `src/controllers/` |
| [Database e Sicurezza in Node.js.pdf](../../../Database%20%20Sicurezza%20in%20Node.js.pdf) | MySQL/Sequelize, modelli e associazioni, validazione, bcrypt/JWT, sicurezza API | `src/models/`, `src/middleware/`, `src/utils/`, Helmet e rate limit in `app.js` |
| [Real-Time Applications e WebSockets.pdf](../../../Real-Time%20Applications%20e%20WebSockets.pdf) | Socket.io, stanze, eventi e notifiche | `src/socket/index.js` e `src/controllers/` |
| [ProgettoFinale2026.pdf](../../../ProgettoFinale2026.pdf) | Obiettivi e criteri specifici del prodotto TaskFlow | mappa in questa pagina e feature elencate in [Funzionalita'](funzionalita.md) |

