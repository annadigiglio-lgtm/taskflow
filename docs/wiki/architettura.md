# Architettura

## Struttura

```text
src/
  server.js             connessione DB, migrazioni e avvio HTTP/Socket.io
  app.js                middleware Express, file statici e router API
  config/db.js          configurazione Sequelize/MySQL letta da .env
  routes/               associa URL e metodi HTTP a middleware/controller
  controllers/          logica delle operazioni e risposte JSON
  middleware/           autenticazione, permessi progetto, errori
  models/               tabelle Sequelize e relazioni
  socket/index.js       autenticazione Socket.io, stanze ed emissione eventi
  utils/                helper per errori, token e selezione campi
public/
  index.html             struttura delle schermate
  styles.css             stile e layout responsive
  components.css         stili per componenti aggiuntivi
  client.js              logica browser, chiamate API e Socket.io
```

## Avvio del server

`src/server.js` carica dotenv, crea un server HTTP condiviso da Express e Socket.io,
autentica la connessione MySQL e sincronizza i modelli Sequelize prima di mettersi in ascolto.
Se `JWT_SECRET` manca, il processo termina. La porta e' `PORT` oppure `3000`.

## Percorso di una richiesta

```text
browser/Postman
  -> router Express
  -> autenticazione JWT (se protetta)
  -> autorizzazione ruolo/membership/proprietario (se necessaria)
  -> controller
  -> modello Sequelize
  -> risposta JSON
```

Le rotte sono divise per area (`authRoutes`, `projectRoutes`, `taskRoutes`, ecc.). I router
annidati usano `mergeParams` per ricevere `projectId`. Nei progetti la sequenza e' normalmente
`authenticate -> loadProject -> requireMember/requireOwner -> controller`.

## Middleware globali

In `src/app.js` Express applica Helmet, CORS, logging delle richieste, rate limit generale
sotto `/api`, parsing JSON e serving della cartella `public`. Le rotte vengono montate sotto
`/api`; un middleware 404 e il gestore degli errori sono alla fine.

## Gestione errori

I controller inoltrano gli errori a `next(err)`. `errorHandler.js` converte errori Sequelize,
JSON malformato e `httpError` in risposte HTTP coerenti. Gli errori imprevisti producono un
500 generico al client e i dettagli vengono registrati sul server.
