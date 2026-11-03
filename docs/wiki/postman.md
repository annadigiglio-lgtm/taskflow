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
7. Recupero password
8. Pulizia (rimozioni e logout)

Eseguire in una sola iterazione e mantenere l'ordine: gli script delle richieste salvano token
e ID (`token`, `token2`, `adminToken`, `projectId`, `taskId`, ecc.) usati dalle richieste
successive. Alcune richieste "ERRORE" sono intenzionali e verificano risposte come 400, 401,
403 o 404.

La collection contiene 48 richieste; la richiesta di reset password non ha uno script test,
le altre 47 hanno controlli automatici. Una verifica locale eseguita con Postman ha riportato
47 test superati e zero falliti.

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

## Pulizia e dati persistenti

La cartella 8 elimina task, membro e progetto creati dalla collection e invalida il token di
Anna. Gli utenti di prova registrati dalla collection rimangono nel database. Gli account
`@example.com` creati da `seed:demo` sono separati da quelli Postman.
