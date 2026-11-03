# Database e modelli

TaskFlow usa MySQL con Sequelize. Le credenziali vengono caricate da `.env`; i modelli sono
definiti in `src/models/` e le relazioni in `src/models/index.js`.

## Tabelle principali

| Modello/tabella | Dati principali | Relazioni |
|---|---|---|
| `User` | nome, email, hash password, ruolo, blocco, reset password | proprietario, membro, assegnatario, autore |
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

`src/seed.js` sincronizza le tabelle e crea l'amministratore definito in `.env`.
`src/seedDemo.js` prepara cinque account, cinque progetti, collaborazioni, task e un messaggio
iniziale per ciascun progetto. I dati demo sono aggiuntivi al database locale.
