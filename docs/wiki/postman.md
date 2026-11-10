# Verifica con Postman

La collection e' `postman/TaskFlow.postman_collection.json`. Importarla da Postman con **Import**
e aprire il Runner della collection. La variabile `baseUrl` predefinita punta a
`http://localhost:3000/api`.

## Ordine delle cartelle

1. Auth
2. Progetti
3. Task (bacheca)
4. Chat
5. Dashboard
6. Segnalazioni e Admin
7. Pulizia (rimozioni e logout)
8. Recupero password (codice manuale)

Eseguire in una sola iterazione e mantenere l'ordine: gli script delle richieste salvano token
e ID (`token`, `token2`, `adminToken`, `projectId`, `taskId`, ecc.) usati dalle richieste
successive. Alcune richieste "ERRORE" sono intenzionali e verificano risposte come 400, 401,
403 o 404.

La collection contiene 50 richieste. La verifica con Newman del 10 novembre 2026 ha eseguito
49 richieste con 49 controlli superati e zero falliti. Il reset viene saltato se la variabile
`resetToken` non contiene un codice di 64 caratteri esadecimali; si verifica manualmente.
Il flusso di reset completo è verificato anche dai test browser e API.
Se l'admin non usa i dati di `.env.example`, impostare `adminEmail` e `adminPassword`
nelle variabili della collection prima del login.

## Registrazioni gia' esistenti

Gli account statici della collection potrebbero essere gia' presenti dopo una precedente
esecuzione. In tal caso la registrazione restituisce 409; il test accetta 201 (creato) oppure
409 (email gia' registrata), poi la collection prosegue con il login.

## Reset password

1. Avviare il server in una finestra visibile.
2. Eseguire `Password dimenticata`.
3. Copiare dalla console il token dopo `[EMAIL SIMULATA]`.
4. Incollarlo nella variabile `resetToken` della collection e inviare `Reset password`.

La stampa del token simula l'invio email, che nel progetto non e' configurato.
Il reset è alla fine perché invalida i token precedenti: dopo occorre un nuovo login.

## Pulizia e dati persistenti

La cartella 7 verifica il blocco delle modifiche su un progetto archiviato, lo riattiva,
elimina task, membro e progetto creati dalla collection e invalida il token di
Anna. Gli utenti di prova registrati dalla collection rimangono nel database. Gli account
`@example.com` creati da `seed:demo` sono separati da quelli Postman.
