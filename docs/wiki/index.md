# Wiki TaskFlow

TaskFlow e' un'applicazione web per organizzare progetti di gruppo. Questa wiki raccoglie
le istruzioni per usarla, le scelte tecniche fatte nel progetto e il collegamento con i
requisiti dell'esame e con le lezioni di Programmazione Node.js.

## Da dove iniziare

- [Avvio e demo](avvio-e-demo.md): configurazione locale, account dimostrativi e Postman.
- [Funzionalita'](funzionalita.md): cosa possono fare utenti, proprietari e amministratori.
- [Frontend](frontend.md): schermate e operazioni disponibili dal browser.
- [API REST](api.md): rotte, metodi HTTP e permessi.
- [Architettura](architettura.md): organizzazione di Express, controller, middleware e modelli.
- [Database](database.md): entita', relazioni e dati dimostrativi.
- [Sicurezza](sicurezza.md): autenticazione, autorizzazione e protezioni.
- [Realtime](realtime.md): stanze Socket.io, eventi e notifiche.
- [Verifica con Postman](postman.md): collection, ordine di esecuzione e risultati attesi.
- [Requisiti e lezioni](requisiti-e-lezioni.md): mappa tra PDF finale, slide del corso e codice.

## In breve

TaskFlow usa Node.js ed Express per esporre API REST, Sequelize e MySQL per i dati,
JWT e bcrypt per l'accesso, e Socket.io per gli aggiornamenti live. Il client web si trova
in `public/`; la logica server e' in `src/`; le richieste Postman sono in `postman/`.

## Stato della documentazione

La wiki descrive il codice presente nel repository. Le operazioni disponibili nell'interfaccia
web non coincidono necessariamente con tutte le rotte: per i dettagli vedere [Frontend](frontend.md)
e [API REST](api.md). Le email di recupero password sono simulate nella console e non inviate.

## Riferimento ai materiali

La mappa didattica fa riferimento ai PDF forniti nella cartella del corso.
