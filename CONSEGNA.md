# TaskFlow — progetto finale di Programmazione Node.js

Autrice: **Anna Digiglio**. Versione di consegna: **10 novembre 2026**.

TaskFlow gestisce progetti collaborativi, membri, attività su bacheca, chat,
catalogo pubblico e moderazione. Il frontend usa HTML, CSS e JavaScript; il backend
usa Node.js, Express, Sequelize, MySQL e Socket.io.

## Installazione da zero

Requisiti: Node.js 22 o successivo, npm, MySQL avviato. Verificato con Node.js 24.
Estrarre lo ZIP, entrare nella cartella `taskflow` e aprire un terminale.

```powershell
npm.cmd ci
Copy-Item .env.example .env
```

Aprire `.env` e impostare host, utente e password di MySQL. Impostare una chiave
`JWT_SECRET` personale e i dati `ADMIN_*` dell'amministratore. Per generare una chiave:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

In MySQL Workbench o nel client MySQL eseguire:

```sql
CREATE DATABASE IF NOT EXISTS taskflow CHARACTER SET utf8mb4;
```

Poi, dalla cartella del progetto:

```powershell
npm.cmd run seed
npm.cmd run seed:demo
npm.cmd start
```

Aprire **http://localhost:3000**. Il seed crea le tabelle tramite migrazioni e
l'amministratore; `seed:demo` aggiunge gli esempi. Non serve importare un dump SQL.
Per fermare il server usare `Ctrl+C`. Su macOS/Linux usare `npm` al posto di `npm.cmd`
e `cp .env.example .env` al posto di `Copy-Item`.

## Account per la dimostrazione

I cinque account demo hanno password **`TaskFlow2026!`**:

- `demo.anna@example.com`
- `demo.marco@example.com`
- `demo.giulia@example.com`
- `demo.luca@example.com`
- `demo.sara@example.com`

L'amministratore usa email e password scelte nel `.env`. I valori di esempio sono
`admin@taskflow.it` e `admin12345`; sono destinati esclusivamente alla demo locale.

Per simulare due utenti contemporaneamente usare una finestra normale e una in
incognito, oppure due browser: due schede della stessa sessione condividono il token.

## Corrispondenza con la consegna

| Requisito | Implementazione |
|---|---|
| Registrazione, login, logout, JWT | API auth, bcrypt, middleware di autenticazione |
| Utente, proprietario e admin | Ruolo globale e permessi per progetto |
| Creazione e gestione progetti | Titolo, descrizione, categoria, tecnologie, visibilità e URL copertina |
| Modifica, archivio e cancellazione | Moduli web e API; archivio con task/chat in sola lettura |
| Invito e rimozione membri | Utenti già registrati, gestione riservata al proprietario |
| Task con stato, priorità, assegnazione e scadenza | Creazione, modifica, menu di stato e riassegnazione |
| Dashboard | Progetti creati e condivisi, attività assegnate ordinate per scadenza |
| Catalogo pubblico filtrabile | API pubblica, filtri per testo, categoria, tecnologia e date |
| Chat interna | Storico nel database, invio REST e ricezione Socket.io |
| Aggiornamenti live | Bacheca, assegnazioni, cambi stato, ingresso membri e segnalazioni admin |
| Moderazione | Segnalazioni, blocco utenti, progetti nascosti |
| API REST protette | Router, middleware e controller; collection Postman inclusa |
| Recupero password, facoltativo nella consegna | Codice temporaneo e reset; email simulata nella console |

## Percorso di dimostrazione

1. Accedere con Anna Demo e aprire un progetto condiviso.
2. Creare un progetto, modificarlo e impostare la copertina. Per un'immagine locale
   già inclusa si può usare `http://localhost:3000/demo-cover.svg`.
3. Aggiungere un altro account registrato e mostrare la lista membri.
4. Creare un task con scadenza, priorità, stato e assegnatario; modificarlo e spostarlo.
5. Aprire lo stesso progetto con il secondo utente e verificare bacheca e chat live.
6. Assegnare un task all'altro utente e mostrare le notifiche ricevute.
7. Archiviare il progetto: bacheca e chat restano leggibili; riattivarlo.
8. Pubblicare il progetto e cercarlo nel catalogo combinando i filtri.
9. Segnalarlo; accedere come admin per nasconderlo e risolvere la segnalazione.
10. Mostrare le richieste della collection Postman.

## Verifiche eseguite

- 5 test di regressione superati.
- 13 test di integrazione superati con MySQL temporaneo, API, Socket.io ed Edge.
- Copertina, archivio, modifiche, membri, segnalazioni, filtri, notifiche e reset
  password verificati anche tramite il browser automatico.
- Schermate desktop e mobile controllate; test di assenza di scorrimento orizzontale mobile.
- Collection eseguita con Newman: 49 richieste e 49 controlli superati, zero fallimenti.
  Il reset manuale senza codice viene saltato; il reset completo è coperto dai test API/browser.
- Sintassi JavaScript verificata e manifest/lockfile compatibili con `npm ci`.
- Seed e seed demo eseguiti due volte su un database vuoto: nessun duplicato;
  6 utenti (admin incluso), 5 progetti, 15 task, 5 messaggi e 15 appartenenze.

Per ripetere i test:

```powershell
npm.cmd test
npm.cmd run test:integration
```

I test di integrazione creano ed eliminano un database casuale `taskflow_test_*`;
richiedono un utente MySQL con questi permessi. Non modificano il database applicativo.
Edge/Chrome è necessario per la parte browser; in alternativa impostare `TEST_BROWSER_PATH`.

## Postman

Importare `postman/TaskFlow.postman_collection.json`. Impostare `baseUrl`,
`adminEmail` e `adminPassword` se diversi dai valori predefiniti. Eseguire una sola
iterazione in ordine. Il recupero è nell'ultima cartella: per provarlo manualmente
copiare il codice dalla console in `resetToken`, poi inviare il reset e rifare il login.

## Limiti dichiarati

- L'invio email è simulato; non sono necessarie credenziali SMTP per la demo.
- Le copertine sono URL, senza upload di file. Le immagini esterne richiedono connettività.
- Le notifiche conservano gli ultimi 50 eventi ricevuti nel browser corrente, per account;
  non recuperano eventi inviati durante la disconnessione e non si sincronizzano tra dispositivi.
- Revoche dei JWT e rate limit sono in memoria; si azzerano riavviando il server.
- Il catalogo API è pubblico, mentre la schermata web è nel sito dopo il login.
- Audit del 10 novembre 2026: zero segnalazioni alte/critiche, due moderate collegate
  a `uuid`/Sequelize. La correzione forzata proposta retrocede Sequelize dalla 6 alla 3
  ed è incompatibile: non è stata applicata. Le altre correzioni compatibili sono applicate.

## File inclusi

Sorgenti, `package.json`, lockfile, `.env.example`, migrazioni e seed, frontend,
collection Postman, test, README, wiki e guida di studio. Lo ZIP non contiene `.env`,
`node_modules`, cronologia Git, dati personali del database o file temporanei.
La documentazione principale è nel README; il materiale per l'orale è in `GUIDA_STUDIO.md`.
