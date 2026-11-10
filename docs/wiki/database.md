# Database e modelli

TaskFlow usa MySQL con Sequelize. Le credenziali vengono caricate da `.env`; i modelli sono
definiti in `src/models/` e le relazioni in `src/models/index.js`.

## Tabelle principali

| Modello/tabella | Dati principali | Relazioni |
|---|---|---|
| `User` | nome, email, hash password, ruolo, blocco, reset password, tokenVersion | proprietario, membro, assegnatario, autore |
| `Project` | titolo, descrizione, categoria, tecnologie, visibilita', stato, copertina, nascosto | proprietario, membri, task, messaggi, report |
| `ProjectMember` | `userId`, `projectId` | tabella ponte utente-progetto |
| `Task` | titolo, descrizione, scadenza, priorita', stato, progetto, assegnatario | progetto e utente assegnatario |
| `Message` | contenuto, progetto, autore | progetto e utente autore |
| `Report` | motivo, stato, progetto, segnalante | progetto e utente segnalante |

## Relazioni

```text
User 1 ---- N Project                 proprietario (ownerId)
User N ---- N Project                 membri via ProjectMember
Project 1 - N Task                    attivita' del progetto
User 1 ---- N Task                    assegnatario facoltativo
Project 1 - N Message                 chat
User 1 ---- N Message                 autore
Project 1 - N Report                  segnalazioni
User 1 ---- N Report                  segnalante
```

La cancellazione del progetto elimina i task, i messaggi e i report collegati. L'utente che
crea un progetto viene aggiunto anche come primo membro: il controllo membership protegge
task e chat.

## Regole dei dati

- L'email utente e' univoca; password e token di reset sono esclusi dallo scope standard.
- Il ruolo globale e' `user` o `admin`; il proprietario e' determinato da `Project.ownerId`.
- Le tecnologie sono esposte come array nel modello ma memorizzate come stringa separata da
  virgole.
- Visibilita' progetto: `public` o `private`; stato progetto: `active` o `archived`.
- Stati task: `todo`, `in_progress`, `done`; priorita': `low`, `medium`, `high`.
- Stato report: `open` o `resolved`.

## Seed

`src/seed.js` applica le migrazioni e crea l'amministratore definito in `.env`.
`src/seedDemo.js` prepara cinque account, cinque progetti, collaborazioni, task e un messaggio
iniziale per ciascun progetto. I dati demo sono aggiuntivi al database locale.

## Migrazioni versionate

`src/migrations/001-initial-schema.js` contiene uno snapshot dello schema iniziale.
Su database vuoto crea le tabelle; su installazioni esistenti verifica colonne, tipi e chiavi
primarie, senza ricreare le tabelle. Uno schema incompatibile interrompe la migrazione con
un errore esplicito. `002-list-indexes.js` aggiunge indici a chat, catalogo, progetti personali,
task assegnati e segnalazioni.

`003-token-version.js` aggiunge un contatore intero agli utenti esistenti, inizialmente 0.
Il reset password lo incrementa e rende inutilizzabili i JWT con una versione precedente.

Le migrazioni applicate sono registrate in `SequelizeMeta`. Un ciclo legge i nomi già
registrati, applica i file mancanti in ordine e salva i nomi applicati. Per la demo si
usa una sola istanza: non avviare insieme due server, seed o comandi di migrazione.
Non è presente un lock per gli avvii concorrenti. In MySQL le operazioni DDL non sono
transazionali; i file riconoscono tabelle, indici e colonne già presenti.

Comandi: `npm.cmd run db:status` (sola lettura), `npm.cmd run db:migrate` (applicazione).
Anche server e seed eseguono le migrazioni prima di usare le tabelle. Per cambiare lo schema,
aggiungere una nuova migrazione alla lista in `src/migrations/index.js` e aggiornare i modelli;
non modificare le versioni gia applicate. Non e previsto un rollback distruttivo automatico.
