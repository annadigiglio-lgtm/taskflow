# Sicurezza

## Credenziali e password

- Le configurazioni MySQL, la chiave JWT e i dati admin sono letti da `.env`.
- `.env` e `node_modules/` sono esclusi da Git tramite `.gitignore`.
- La registrazione salva l'hash bcrypt della password (costo 10), mai la password in chiaro.
- Il modello `User` esclude password e token di recupero dalle query standard.

## Autenticazione e permessi

Il login restituisce un JWT firmato con `JWT_SECRET` e con scadenza configurabile da
`JWT_EXPIRES_IN` (default un giorno). `authenticate` verifica il token e rilegge l'utente dal
database a ogni richiesta protetta; in questo modo il blocco admin ha effetto sulle richieste
HTTP gia' autenticate. Il ruolo admin viene controllato separatamente da `requireAdmin`.

`loadProject` carica progetto e membership. `requireMember` protegge task e chat;
`requireOwner` protegge modifica, archiviazione, cancellazione e gestione membri. I task possono
essere assegnati solo a membri del progetto.

## Validazione e difese

- `validateApiInput` controlla body JSON, ID positivi, tipi, lunghezze, enum, URL HTTP/HTTPS
  e date di calendario prima dei controller. I dati non validi ricevono una risposta 400.
- Le nuove password devono avere almeno 8 caratteri e occupare al massimo 72 byte UTF-8,
  evitando il troncamento implicito di bcrypt.
- I controller selezionano i campi ammessi con `pick`, per limitare mass assignment.
- Sequelize parametrizza le query; login e registrazione controllano i tipi dei campi.
- Helmet imposta gli header HTTP; Express Rate Limit applica limiti generali e un limite piu'
  stretto ai login falliti.
- Gli errori 500 non inviano dettagli interni al client.
- Socket.io richiede JWT all'apertura della connessione e controlla la membership prima di
  entrare nella stanza di un progetto.
- Quando l'admin blocca un utente vengono disconnesse anche le connessioni Socket.io gia' aperte.

## Recupero password e sessioni

Il token di recupero casuale dura un'ora. Il database conserva solo il suo hash SHA-256;
il token originale compare esclusivamente nell'email simulata in console. Un aggiornamento
condizionale consuma il token insieme al cambio password: anche due richieste concorrenti
non possono utilizzarlo entrambe. Le richieste di recupero/reset condividono un limite di
10 tentativi ogni 15 minuti per IP.

Ogni JWT ha un identificatore casuale e una versione delle credenziali derivata tramite HMAC
dall'hash della password corrente. HTTP e Socket.io verificano questa versione contro il
database: dopo un reset i token precedenti sono rifiutati anche dopo il riavvio del server.
Il reset chiude tutti i socket dell'utente; il logout chiude quelli della sola sessione
revocata. Anche la scadenza del JWT chiude le connessioni live gia' aperte.

I JWT emessi prima di questo aggiornamento non hanno la versione delle credenziali e
richiedono un nuovo login. Anche eventuali token di reset precedenti vanno richiesti di nuovo.

## Limiti noti

- I token revocati al logout sono conservati in un `Set` in memoria: riavviando il server la
  lista si svuota. In produzione servirebbe uno storage condiviso (per esempio Redis o DB).
- Il recupero password genera un token valido un'ora ma stampa il token nella console invece
  di inviare una email. E' una simulazione da progetto didattico.
- La configurazione CORS e Socket.io accetta origini ampie per semplificare il client locale;
  per una distribuzione pubblica va ristretta ai domini autorizzati.
- Le migrazioni versionate aggiornano lo schema senza ricreare le tabelle esistenti.
- Le credenziali demo sono pubblicate nella wiki solo per la prova locale; non riutilizzarle
  in produzione.
