# API REST

Base URL locale: `http://localhost:3000/api`. Per le rotte protette inviare
`Authorization: Bearer <token>`; il token viene restituito dal login.

## Autenticazione — `/auth`

| Metodo | Percorso | Accesso | Scopo |
|---|---|---|---|
| POST | `/register` | pubblico | Registra utente (`name`, `email`, `password`) |
| POST | `/login` | pubblico | Verifica credenziali e restituisce JWT |
| POST | `/logout` | autenticato | Revoca il token corrente |
| GET | `/me` | autenticato | Restituisce l'utente corrente |
| POST | `/forgot-password` | pubblico | Crea token di recupero temporaneo |
| POST | `/reset-password` | pubblico | Aggiorna password con token valido |

## Progetti — `/projects`

| Metodo | Percorso | Accesso | Scopo |
|---|---|---|---|
| GET | `/public` | pubblico | Catalogo; filtri `category`, `technology`, `from`, `to` |
| POST | `/` | autenticato | Crea progetto |
| GET | `/:projectId` | autenticato | Dettaglio di progetto pubblico, proprio o accessibile |
| PUT | `/:projectId` | proprietario | Modifica titolo, descrizione, categoria, tecnologie, visibilita', copertina |
| PATCH | `/:projectId/archive` | proprietario | Archivia/riattiva con `{ "archived": true/false }` |
| DELETE | `/:projectId` | proprietario | Elimina progetto e dati collegati |
| POST | `/:projectId/members` | proprietario | Aggiunge un utente con `{ "email": "..." }` |
| DELETE | `/:projectId/members/:userId` | proprietario | Rimuove un membro |
| POST | `/:projectId/reports` | autenticato | Crea segnalazione con `{ "reason": "..." }` |

I campi accettati per creazione/modifica progetto sono `title`, `description`, `category`,
`technologies`, `visibility` (`public` o `private`) e `coverImage` (URL). Le tecnologie possono
essere inviate come array di stringhe.

## Task — `/projects/:projectId/tasks`

Tutte le rotte richiedono un membro del progetto.

| Metodo | Percorso | Scopo |
|---|---|---|
| GET | `/` | Restituisce le liste `todo`, `in_progress`, `done` |
| POST | `/` | Crea task (`title`, `description`, `dueDate`, `priority`, `status`, `assigneeId`) |
| PUT | `/:taskId` | Modifica titolo, descrizione, scadenza o priorita' |
| PATCH | `/:taskId/status` | Cambia stato |
| PATCH | `/:taskId/assign` | Cambia assegnatario; `null` toglie l'assegnazione |
| DELETE | `/:taskId` | Elimina task |

Stati ammessi: `todo`, `in_progress`, `done`. Priorita': `low`, `medium`, `high`. La scadenza
attesa e' una data `AAAA-MM-GG`; l'assegnatario deve essere membro del progetto.

## Chat e dashboard

| Metodo | Percorso | Accesso | Scopo |
|---|---|---|---|
| GET | `/projects/:projectId/messages` | membro | Storico messaggi |
| POST | `/projects/:projectId/messages` | membro | Invia messaggio (`content`) |
| GET | `/dashboard` | autenticato | Progetti posseduti, condivisi e task assegnati |

## Amministrazione — `/admin`

Richiede utente autenticato con ruolo `admin`.

| Metodo | Percorso | Scopo |
|---|---|---|
| GET | `/users` | Lista utenti |
| PATCH | `/users/:userId/block` | Blocca/sblocca con `{ "blocked": true/false }` |
| GET | `/reports?status=open` | Lista segnalazioni (`open` o `resolved`) |
| PATCH | `/reports/:reportId/resolve` | Chiude una segnalazione |
| PATCH | `/projects/:projectId/hide` | Nasconde/mostra progetto con `{ "hidden": true/false }` |

## Risposte e codici comuni

- `200`: operazione riuscita; `201`: risorsa creata; `204`: eliminazione senza body.
- `400`: input non valido; `401`: autenticazione mancante/non valida/revocata.
- `403`: account bloccato o permessi insufficienti; `404`: risorsa/rotta assente.
- `409`: conflitto come email gia' registrata o utente gia' membro; `429`: rate limit.
- `500`: errore imprevisto, dettagli non esposti al client.
