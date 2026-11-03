# TaskFlow

Piattaforma di gestione progetti collaborativa: progetti di gruppo, bacheca dei task a colonne,
chat di progetto, notifiche in tempo reale, catalogo pubblico e pannello di amministrazione.

Progetto per l'esame finale del modulo **Programmazione Node.js** (ITS).

## Tecnologie

| Pacchetto | A cosa serve |
|---|---|
| **express** | Framework per il server e le API REST |
| **sequelize** + **mysql2** | ORM per il database MySQL (modelli invece di query SQL scritte a mano) |
| **dotenv** | Legge le credenziali dal file `.env` invece di scriverle nel codice |
| **jsonwebtoken** | Autenticazione con token JWT |
| **bcryptjs** | Hash delle password |
| **socket.io** | Comunicazione in tempo reale (bacheca live, chat, notifiche) |
| **helmet** | Header HTTP di sicurezza |
| **cors** | Permette chiamate alle API da altri domini |
| **express-rate-limit** | Limita il numero di richieste (anti brute-force) |
| **nodemon** *(devDependency)* | Riavvia il server a ogni modifica durante lo sviluppo |

## Installazione e avvio

Requisiti: Node.js (LTS) e MySQL in esecuzione.

```bash
# 1. Installa le dipendenze
npm install

# 2. Crea il file .env partendo dall'esempio e inserisci i tuoi dati
cp .env.example .env

# 3. Crea il database in MySQL (Workbench o terminale)
#    CREATE DATABASE taskflow;

# 4. Crea le tabelle e l'utente amministratore
npm run seed

# 5. (Facoltativo) Crea cinque account demo, progetti, task e chat
npm run seed:demo

# Avvia il server
npm start        # oppure: npm run dev (con nodemon)
```

Il server parte su `http://localhost:3000`. Le tabelle vengono create automaticamente da
`sequelize.sync()` a partire dai modelli.

La documentazione dettagliata del progetto e' nella [wiki](docs/wiki/index.md).

Gli account dimostrativi condividono la password `TaskFlow2026!`; il comando stampa gli
indirizzi email e i progetti creati. Il seed demo e' riutilizzabile e non duplica i dati.

## Test automatici

```powershell
npm.cmd test
npm.cmd run test:integration
```

Il primo comando esegue i test di regressione senza collegarsi al database. Il secondo
verifica le API HTTP e Socket.io con MySQL reale: usa le credenziali del `.env` per creare
un database casuale `taskflow_test_*`, eliminato alla fine. L'utente MySQL deve poter creare
ed eliminare database. I dati del database applicativo non vengono modificati.

I test coprono ruoli, accessi ai progetti privati, isolamento dei task, validazione,
reset concorrenti e scaduti, logout, blocco utenti e scadenza delle connessioni live.

Dopo questo aggiornamento occorre effettuare nuovamente il login: i nuovi JWT sono
collegati alla password corrente, così il reset invalida tutte le sessioni precedenti.

## Struttura del progetto

```
taskflow/
├── src/
│   ├── server.js            # Avvio: connessione DB, sync tabelle, server HTTP + Socket.io
│   ├── app.js               # Configurazione Express: middleware globali e rotte
│   ├── seed.js              # Crea l'utente amministratore
│   ├── config/db.js         # Connessione Sequelize a MySQL
│   ├── models/              # Modelli (tabelle) e relazioni (models/index.js)
│   ├── middleware/          # auth (JWT e ruoli), permessi sul progetto, gestione errori
│   ├── controllers/         # Logica di ogni endpoint
│   ├── routes/              # Collegano gli URL a middleware e controller
│   ├── socket/index.js      # Socket.io: autenticazione, stanze, invio eventi
│   └── utils/               # Piccole funzioni riutilizzabili
├── public/                  # Interfaccia web TaskFlow (HTML, CSS, JavaScript)
├── postman/                 # Collection Postman
├── .env.example             # Esempio di configurazione (il vero .env non va su GitHub)
└── package.json
```

Il percorso di una richiesta è sempre lo stesso:

```
richiesta → route → middleware (login? permessi?) → controller → modello (database) → risposta JSON
                                      │                    │
                                      └── errore ──────────┴──→ next(err) → errorHandler
```

## Database

```
Users ──< Projects (ownerId = proprietario)
Users >──< Projects   tramite ProjectMembers (membri del progetto)
Projects ──< Tasks    (assigneeId → Users)
Projects ──< Messages (userId → Users)
Projects ──< Reports  (userId → Users, chi segnala)
```

Cancellando un progetto vengono cancellati anche i suoi task, messaggi e segnalazioni (`onDelete: CASCADE`).

## Ruoli e permessi

| Ruolo | Come si ottiene | Cosa può fare |
|---|---|---|
| **Utente base** | Registrazione | Crea progetti, partecipa ai progetti in cui è invitato, gestisce task, chatta, segnala progetti |
| **Proprietario** | Ha creato quel progetto | Modifica, archivia o elimina il progetto, invita o rimuove membri |
| **Amministratore** | `npm run seed` | Vede utenti e segnalazioni, nasconde progetti, blocca utenti |

Il proprietario non è un ruolo salvato sull'utente: dipende dal progetto (`Project.ownerId`).
Lo controllano i middleware in `src/middleware/projectAccess.js`.

## API REST

Le rotte protette richiedono l'header `Authorization: Bearer <token>` (il token si ottiene dal login).

### Autenticazione `/api/auth`
| Metodo | URL | Accesso | Descrizione |
|---|---|---|---|
| POST | `/register` | pubblico | Registrazione (`name`, `email`, `password`) |
| POST | `/login` | pubblico | Login, restituisce il token JWT |
| POST | `/logout` | loggato | Invalida il token |
| GET | `/me` | loggato | Dati dell'utente loggato |
| POST | `/forgot-password` | pubblico | Genera il token di reset (stampato nella console del server) |
| POST | `/reset-password` | pubblico | Nuova password (`token`, `newPassword`) |

### Progetti `/api/projects`
| Metodo | URL | Accesso | Descrizione |
|---|---|---|---|
| GET | `/public?category=&technology=&from=&to=` | pubblico | Catalogo dei progetti pubblici con filtri |
| POST | `/` | loggato | Crea un progetto |
| GET | `/:projectId` | membro, o chiunque se il progetto è pubblico | Dettaglio con i membri |
| PUT | `/:projectId` | proprietario | Modifica |
| PATCH | `/:projectId/archive` | proprietario | Archivia o riattiva (`archived: true/false`) |
| DELETE | `/:projectId` | proprietario | Elimina |
| POST | `/:projectId/members` | proprietario | Invita un utente (`email`) |
| DELETE | `/:projectId/members/:userId` | proprietario | Rimuove un membro |
| POST | `/:projectId/reports` | loggato | Segnala il progetto (`reason`) |

### Task `/api/projects/:projectId/tasks` (solo membri)
| Metodo | URL | Descrizione |
|---|---|---|
| GET | `/` | Bacheca: task divisi in `todo`, `in_progress`, `done` |
| POST | `/` | Crea task (`title`, `description`, `dueDate`, `priority`, `status`, `assigneeId`) |
| PUT | `/:taskId` | Modifica titolo, descrizione, scadenza, priorità |
| PATCH | `/:taskId/status` | Sposta in un'altra colonna (`status`) |
| PATCH | `/:taskId/assign` | Riassegna (`assigneeId`, oppure `null`) |
| DELETE | `/:taskId` | Elimina |

### Chat `/api/projects/:projectId/messages` (solo membri)
| Metodo | URL | Descrizione |
|---|---|---|
| GET | `/` | Storico dei messaggi |
| POST | `/` | Invia un messaggio (`content`) |

### Dashboard `/api/dashboard` (loggato)
Restituisce `ownedProjects` (progetti creati), `memberProjects` (progetti di altri in cui sono membro)
e `assignedTasks` (task assegnati a me, ordinati per scadenza).

### Admin `/api/admin` (solo amministratori)
| Metodo | URL | Descrizione |
|---|---|---|
| GET | `/users` | Lista utenti |
| PATCH | `/users/:userId/block` | Blocca o sblocca (`blocked: true/false`) |
| GET | `/reports?status=open` | Segnalazioni |
| PATCH | `/reports/:reportId/resolve` | Chiude una segnalazione |
| PATCH | `/projects/:projectId/hide` | Nasconde o mostra un progetto (`hidden: true/false`) |

### Codici di risposta usati
| Codice | Quando |
|---|---|
| 200 OK | Richiesta riuscita |
| 201 Created | Risorsa creata |
| 204 No Content | Eliminazione riuscita |
| 400 Bad Request | Dati mancanti o non validi, JSON malformato |
| 401 Unauthorized | Token mancante, non valido, scaduto o revocato; credenziali errate |
| 403 Forbidden | Loggato ma senza permessi (non membro, non proprietario, non admin, utente bloccato) |
| 404 Not Found | Risorsa o rotta inesistente |
| 409 Conflict | Email già registrata, utente già membro |
| 429 Too Many Requests | Superato il rate limit |
| 500 Internal Server Error | Errore imprevisto (dettagli solo nella console del server) |

## Tempo reale (Socket.io)

Il client si connette inviando il token: `io("http://localhost:3000", { auth: { token } })`.

Il server usa le **stanze** (room) per inviare i messaggi solo a chi interessa:
- `user:<id>`: stanza personale di ogni utente, per le notifiche;
- `project:<id>`: membri di un progetto, per la bacheca e la chat (il client entra con l'evento `joinProject`, solo se è membro);
- `admins`: amministratori, per le segnalazioni.

| Evento (dal server) | Quando |
|---|---|
| `taskCreated`, `taskUpdated`, `taskDeleted` | Un task viene creato, modificato, spostato, riassegnato o eliminato |
| `chatMessage` | Nuovo messaggio nella chat del progetto |
| `memberJoined`, `memberLeft` | Un membro entra o viene rimosso |
| `notification` | Notifica personale: task assegnato, cambio di stato di un mio task, aggiunta a un progetto |
| `newReport` | (solo admin) Un progetto è stato segnalato |

**Scelta implementativa:** le azioni (compreso l'invio dei messaggi in chat) passano sempre
dalle API REST, con i loro controlli di sicurezza. Socket.io serve solo a **inviare** gli
aggiornamenti ai client. Così tutte le funzionalità sono disponibili via REST, come richiesto,
e i permessi sono controllati in un unico punto.

**Interfaccia web:** con il server avviato, apri `http://localhost:3000` e accedi o crea un
account. Dalla dashboard puoi creare progetti, aprire una bacheca, gestire i task, invitare
membri e usare la chat. Gli amministratori hanno anche la schermata per moderare utenti,
progetti e segnalazioni. La pagina si collega automaticamente a Socket.io per mostrare gli
aggiornamenti live; le operazioni continuano a passare dalle API REST.

## Collection Postman

File: `postman/TaskFlow.postman_collection.json` (in Postman: *Import*).

- Le cartelle vanno eseguite in ordine: si possono lanciare tutte insieme con il *Collection Runner*.
- Gli script di test salvano da soli token e id nelle variabili della collection (`token`, `token2`, `adminToken`, `projectId`, `taskId`...).
- Le richieste che iniziano con "ERRORE" mostrano la gestione degli errori (400, 401, 403, 404).
- Recupero password: dopo "Password dimenticata", copia il token stampato nella console del server
  nella variabile `resetToken` della collection, poi esegui "Reset password".

## Sicurezza

- **Credenziali nel `.env`**, escluso da git con `.gitignore`.
- **Password salvate con hash bcrypt**, mai in chiaro. Il campo password è escluso da tutte le risposte (`defaultScope` del modello User).
- **JWT** con scadenza; logout tramite lista dei token revocati.
- **Ruoli e permessi** controllati da middleware dedicati (`requireAdmin`, `requireMember`, `requireOwner`).
- **SQL injection**: Sequelize usa query parametrizzate. Inoltre login e registrazione accettano solo stringhe.
- **Mass assignment**: con la funzione `pick` i controller accettano solo i campi previsti (un utente non può impostarsi `role` o `isHidden`).
- **helmet** per gli header di sicurezza, **cors**, **rate limiting** su tutte le API e sui tentativi di login falliti.
- Gli errori 500 non mostrano dettagli interni al client.

## Limiti noti e possibili miglioramenti

- La lista dei token revocati e il conteggio del rate limit sono in memoria: si azzerano al riavvio (in produzione si userebbe Redis).
- L'email di recupero password è simulata in console: per inviarla davvero si potrebbe usare `nodemailer`.
- L'immagine di copertina è un URL: per il caricamento di file si potrebbe usare `multer`.
- Le tabelle sono create con `sequelize.sync()`: in un progetto più grande si userebbero le migrazioni di Sequelize CLI.
- `npm audit` segnala alcune vulnerabilità nelle dipendenze indirette (`braces` tramite nodemon, solo in sviluppo; `uuid` tramite Sequelize). La correzione proposta (`npm audit fix --force`) farebbe tornare Sequelize alla versione 3, quindi non è stata applicata.
