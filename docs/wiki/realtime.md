# Aggiornamenti in tempo reale

TaskFlow usa Socket.io per distribuire eventi ai client collegati. Le modifiche vengono fatte
con le API REST; Socket.io comunica gli aggiornamenti agli altri client. Questo mantiene
validazione e autorizzazioni nei controller HTTP.

## Connessione

Il browser include il client servito da Socket.io (`/socket.io/socket.io.js`) e apre la
connessione passando il JWT come `auth.token`. Il middleware Socket.io verifica il token,
rilegge l'utente e rifiuta utenti inesistenti o bloccati.

## Stanze

| Stanza | Destinatari | Uso |
|---|---|---|
| `user:<id>` | sessioni di uno specifico utente | notifiche personali e gestione membership |
| `project:<id>` | membri autorizzati entrati nel progetto | task, chat, membri |
| `admins` | amministratori collegati | nuove segnalazioni |

Il client chiede la stanza con `joinProject(projectId)`. Il server verifica la membership dal
database prima di aggiungere il socket. `leaveProject` abbandona la stanza.

## Eventi dal server

| Evento | Quando viene emesso |
|---|---|
| `taskCreated` | Un membro crea un task |
| `taskUpdated` | Un task viene modificato, spostato o riassegnato |
| `taskDeleted` | Un task viene eliminato |
| `chatMessage` | Un membro invia un messaggio REST |
| `memberJoined` / `memberLeft` | Aggiunta o rimozione membro |
| `notification` | Assegnazione, cambio stato di un task proprio, invito a un progetto |
| `newReport` | Segnalazione inviata; evento agli admin connessi |
| `joinedProject` / `errorMessage` | Esito dell'ingresso in stanza |

Le notifiche `taskAssigned`, `taskStatusChanged`, `addedToProject` sono i valori del campo
`type` nel payload dell'evento `notification`.

## Blocco di un utente

Il middleware HTTP rifiuta gli utenti bloccati. Il middleware Socket.io rifiuta nuove
connessioni; inoltre `disconnectUser` chiude le connessioni gia' nella stanza personale
dell'utente quando l'admin lo blocca.

## Prova pratica

Accedere a TaskFlow da due browser/sessioni con account membri dello stesso progetto. Aprire
la bacheca in entrambe e creare/spostare un task oppure inviare un messaggio dalla chat: il
secondo client riceve l'aggiornamento senza ricaricare la pagina.
