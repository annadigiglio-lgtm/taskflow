# TaskFlow: guida allo studio per l'esame ITS

Questa guida spiega il progetto partendo dal suo utilizzo e arrivando al codice.
Non serve memorizzare ogni riga: devi saper riconoscere i compiti delle funzioni,
seguire il percorso dei dati e motivare le scelte principali.

## 1. Come presentare il progetto

«TaskFlow è un'applicazione web per organizzare progetti di gruppo. Un utente crea
un progetto, aggiunge altri utenti registrati e suddivide il lavoro in attività.
Le attività hanno stato, priorità, scadenza e assegnatario. I membri comunicano
in una chat e ricevono aggiornamenti in tempo reale.»

Un esempio concreto è un progetto ITS chiamato “Sito della classe”. Una persona
prepara il database, un'altra realizza la homepage e un'altra verifica le API.
La bacheca permette di sapere che cosa è ancora da fare e che cosa è finito.

## 2. Le funzionalità

| Funzione | Scopo |
|---|---|
| Registrazione, login e logout | Creare un account, entrare e uscire |
| Dashboard | Riepilogare progetti e attività assegnate all'utente |
| Progetti | Creare spazi di lavoro pubblici o privati |
| Membri | Aggiungere utenti registrati a un progetto |
| Bacheca | Organizzare attività in Da fare, In corso e Completato |
| Attività | Gestire titolo, descrizione, priorità, scadenza e assegnatario |
| Filtri | Cercare attività per testo, persona, priorità e scadenza |
| Chat | Comunicare con gli altri membri del progetto |
| Catalogo | Cercare e consultare progetti pubblici |
| Amministrazione | Bloccare utenti e gestire segnalazioni e progetti nascosti |
| Tempo reale | Ricevere modifiche e messaggi senza ricaricare manualmente |

Lo stato di un task si cambia con un menu a tendina. Non è presente il trascinamento.
L'invito aggiunge direttamente un utente già registrato: non invia un'email e non
prevede un passaggio di accettazione.

## 3. Frontend, backend e database

Il **frontend** è la parte eseguita nel browser. HTML definisce gli elementi della
pagina, CSS ne definisce l'aspetto e JavaScript reagisce alle azioni dell'utente.
Il progetto aggiorna direttamente la pagina con JavaScript, senza React.

Il **backend** è eseguito sul server con Node.js. Express riceve le richieste e le
indirizza alle funzioni che devono gestirle. Il server controlla sempre dati e
permessi: non si deve fidare soltanto dei controlli del browser.

Il **database MySQL** conserva i dati anche quando chiudi la pagina. Sequelize è
la libreria che permette al backend di lavorare con tabelle e relazioni usando
modelli JavaScript, come `User`, `Project` e `Task`.

```text
Browser (HTML, CSS, JavaScript)
            ↓ richiesta HTTP
Server (Node.js, Express)
            ↓ Sequelize
Database MySQL
```

Un'API è un insieme di indirizzi attraverso cui il browser richiede dati o azioni
al server. Le risposte usano normalmente JSON, un formato testuale per rappresentare
oggetti e array.

## 4. La mappa dei file

| File o cartella | Cosa studiare |
|---|---|
| `package.json` | Dipendenze, moduli ES e comandi npm |
| `src/server.js` | Avvio del server, connessione al DB, migrazioni e Socket.io |
| `src/app.js` | Configurazione Express e ordine dei middleware |
| `src/config/db.js` | Connessione di Sequelize a MySQL |
| `src/routes/` | Collegamento tra metodo, URL, controlli e controller |
| `src/middleware/` | Login, permessi, validazione e gestione errori |
| `src/controllers/` | Operazioni dell'applicazione |
| `src/models/` | Struttura dei dati e relazioni |
| `src/utils/` | Piccole funzioni riutilizzabili |
| `src/socket/` | Connessioni ed eventi in tempo reale |
| `src/migrations/` | Creazione e aggiornamento delle tabelle |
| `public/index.html` | Struttura delle schermate e dei moduli |
| `public/client.js` | Richieste API, eventi dei pulsanti e aggiornamenti della pagina |
| `public/notifications.js` | Storico locale e visualizzazione delle notifiche |
| `public/passwordRecovery.js` | Richiesta del codice e nuova password |
| `public/styles.css`, `public/components.css` | Aspetto e adattamento dell'interfaccia |
| `postman/` | Richieste da usare per verificare le API |
| `test/`, `integration/` | Verifiche automatiche |

`server.js` avvia il servizio; `app.js` configura l'applicazione. Sono separati
per distinguere questi due compiti e facilitare le verifiche.

## 5. Il percorso di una richiesta

```text
Evento nel browser → fetch → route → middleware → controller → modello → database
                                                        ↓
                                               risposta al browser
```

La **route** stabilisce quale funzione chiamare per un metodo e un indirizzo.
Il **middleware** esegue un controllo o prepara dati per il passaggio successivo.
Il **controller** esegue l'operazione richiesta. Il **modello** rappresenta i dati
e permette di consultarli o modificarli nel database.

Esempio di route:

```js
router.put('/:projectId', loadProject, requireOwner, updateProject);
```

Questa istruzione significa: quando arriva una richiesta PUT per quel progetto,
caricalo, controlla che l'utente sia il proprietario e poi esegui la modifica.
Nel router del progetto l'autenticazione è già stata applicata prima di questa route.

### I tre contenitori da riconoscere

| Espressione | Contenuto | Esempio |
|---|---|---|
| `req.params` | Valori nel percorso dell'URL | `projectId` in `/projects/3` |
| `req.query` | Filtri dopo il punto interrogativo | `page` in `?page=2` |
| `req.body` | Dati inviati nel corpo della richiesta | Titolo e descrizione del task |

`req` rappresenta la richiesta. `res` permette di costruire la risposta.
`next()` passa al middleware successivo; `next(err)` passa l'errore al gestore
degli errori.

## 6. Esempio completo: creare un task

1. L'utente compila il modulo nella pagina.
2. `client.js` legge i valori con `FormData`.
3. La funzione `api` usa `fetch` per inviare una POST a `/api/projects/3/tasks`.
4. Il server valida i dati e verifica il token dell'utente.
5. Carica il progetto e controlla che l'utente sia membro.
6. `createTask` controlla la scadenza e l'eventuale assegnatario.
7. Sequelize salva il task nel database.
8. Socket.io comunica la creazione ai membri collegati.
9. Il server risponde con il task e il codice `201 Created`.

```js
const created = await Task.create({ ...data, projectId: req.project.id });
```

`const created` conserva il risultato. `await` aspetta la conclusione del
salvataggio prima di proseguire in questa funzione. `Task.create` inserisce il
record. `...data` copia i campi selezionati. `projectId` collega il task al
progetto già caricato dal server.

`await` non blocca tutto il server: durante l'attesa Node.js può gestire altro
lavoro. Si usa dentro una funzione `async`.

```js
try {
    // Operazione che può fallire, per esempio una query.
} catch (err) {
    next(err);
}
```

`try` contiene l'operazione; `catch` intercetta un errore. Il controller lo passa
al gestore centrale, che restituisce una risposta appropriata al browser.

## 7. Database e relazioni

| Modello | Significato |
|---|---|
| `User` | Utente registrato |
| `Project` | Progetto, con proprietario e visibilità |
| `ProjectMember` | Collegamento tra utente e progetto |
| `Task` | Attività di un progetto |
| `Message` | Messaggio di un utente in un progetto |
| `Report` | Segnalazione di un progetto |

Un utente può creare molti progetti, mentre ogni progetto ha un proprietario:
è una relazione **uno a molti**, collegata tramite `ownerId`.

Un utente può partecipare a molti progetti e ogni progetto può avere molti utenti:
è una relazione **molti a molti**. La tabella ponte `ProjectMember` contiene i
collegamenti `userId` e `projectId`. Il proprietario viene aggiunto anche come membro.

Un progetto ha molti task e molti messaggi. Un task può avere un assegnatario
oppure `null`, che significa nessun assegnatario.

Le relazioni sono dichiarate in `src/models/index.js`. Metodi come `belongsTo`
e `hasMany` indicano a Sequelize come collegare i modelli.

### Transazioni e cancellazioni

Creare un progetto richiede anche di aggiungere il proprietario come membro.
Una **transazione** fa riuscire queste operazioni insieme: se una fallisce,
vengono annullate entrambe. Si evita un progetto creato solo a metà.

La cancellazione di un progetto elimina anche i dati collegati secondo i vincoli
del database. `CASCADE` indica questa cancellazione a catena.

Le **migrazioni** sono file versionati che creano o aggiornano lo schema del
database. Sono diverse dai seed: i seed inseriscono dati iniziali o dimostrativi.

## 8. Login, password e permessi

**Autenticazione** significa capire chi sei. **Autorizzazione** significa
controllare che tu possa eseguire una certa operazione.

Alla registrazione bcrypt trasforma la password in un **hash**. Nel database si
salva l'hash; al login `bcrypt.compare` verifica la password inserita. Un hash
non è una password cifrata da decifrare: la verifica avviene tramite confronto.

Se il login riesce, il server genera un **JWT**, un token firmato con scadenza.
Il browser lo conserva in `localStorage` e lo invia nelle richieste protette:

```text
Authorization: Bearer <token>
```

Il server verifica firma, scadenza e revoca del token e rilegge l'utente. Il JWT
è firmato, non cifrato: non bisogna inserirci password o segreti.
Nel progetto il JWT contiene anche `tokenVersion`, un numero che parte da 0.
Il server lo confronta con il numero salvato sull'utente. Il reset della password
aumenta il numero nel database: i token vecchi vengono quindi rifiutati.

| Figura | Permessi principali |
|---|---|
| Utente | Crea progetti e usa quelli di cui è membro |
| Membro | Usa bacheca e chat del progetto |
| Proprietario | Modifica il progetto e gestisce i membri |
| Admin | Gestisce utenti e moderazione |

Il proprietario non è un ruolo globale sull'utente: dipende da `Project.ownerId`.
Un admin non diventa automaticamente membro o proprietario di tutti i progetti.

Nascondere un pulsante non protegge un'API: una richiesta può essere inviata anche
con Postman. Per questo i permessi sono controllati sul server.

`pick` seleziona i soli campi accettati dal controller. In questo modo il client
non può aggiungere liberamente campi come il ruolo amministratore.
Sequelize usa query parametrizzate per i valori nelle normali operazioni ORM.

## 9. REST e tempo reale

Le azioni passano dalle API HTTP: creare un task o inviare un messaggio richiede
una chiamata REST. Socket.io serve a distribuire gli aggiornamenti ai client.
Così la logica di salvataggio e i controlli restano nei controller e middleware.

Le **stanze** di Socket.io raggruppano le connessioni:

- `user:ID`: notifiche personali;
- `project:ID`: bacheca e chat dei membri del progetto;
- `admins`: segnalazioni per gli amministratori.

Il server controlla l'appartenenza prima di far entrare un utente nella stanza
di un progetto. Una stanza è un gruppo di connessioni, non una tabella del database.

## 10. Metodi e codici HTTP

| Metodo | Utilizzo nel progetto |
|---|---|
| GET | Leggere dati |
| POST | Creare dati o eseguire azioni come il login |
| PUT | Modificare i dati di un progetto o task |
| PATCH | Cambiare un aspetto specifico, come stato o assegnatario |
| DELETE | Eliminare una risorsa |

Nel progetto le PUT accettano anche un sottoinsieme dei campi modificabili:
descrivi il comportamento effettivo del codice quando lo spieghi.

| Codice | Significato |
|---|---|
| 200 | Operazione riuscita |
| 201 | Risorsa creata |
| 204 | Operazione riuscita senza contenuto nella risposta |
| 400 | Dati non validi |
| 401 | Autenticazione mancante o non valida |
| 403 | Operazione non consentita |
| 404 | Risorsa non trovata |
| 409 | Conflitto, per esempio email già registrata |
| 429 | Troppe richieste |
| 500 | Errore imprevisto del server |

## 11. Limiti e scelte da spiegare

- Il catalogo ha un endpoint pubblico, ma l'interfaccia del catalogo è nel sito
  dopo il login. Anche il dettaglio progetto richiede autenticazione.
- Un progetto pubblico non rende pubbliche la bacheca e la chat.
- Archiviare cambia lo stato, esclude il progetto dal catalogo e rende task e chat
  di sola lettura. Il proprietario può riattivarlo e gestire dettagli e membri.
- Il recupero password genera un token temporaneo, ma l'email viene simulata
  nella console del server.
- La copertina è un URL: non c'è un caricamento di file dal computer.
- I token revocati sono conservati in memoria e si perdono al riavvio del server.
- Le notifiche live non sono uno storico persistente nel database.

Questi limiti definiscono il comportamento e l'ambito di utilizzo dell'applicazione.

## 12. Funzionamento dell'interfaccia

L'interfaccia comprende modifica di progetti e attività, lista e rimozione dei
membri e invio delle segnalazioni. Le operazioni usano le API REST del backend.

In `client.js` si trovano le funzioni di apertura dei
moduli e quelle di salvataggio. Un modulo di modifica parte dai valori esistenti,
li mostra negli input e invia i nuovi valori tramite PUT. I permessi rimangono
controllati dal backend.

Le principali funzioni sono:

| Funzione in `client.js` | Che cosa fa |
|---|---|
| `editProject` | Riempie il modulo con i dati del progetto |
| `saveProject` | Invia i nuovi valori tramite PUT e aggiorna vista e dashboard |
| `editTask` | Trova il task nella bacheca e riempie il modulo |
| `saveTask` | Invia titolo, descrizione, scadenza e priorità tramite PUT |
| `renderMembers` | Mostra i membri e i comandi disponibili al proprietario |
| `removeMember` | Chiede conferma e invia la richiesta DELETE |
| `sendReport` | Invia il motivo della segnalazione tramite POST |

Gli ID del progetto e del task vengono conservati nei `data-*` del modulo.
`form.dataset.projectId`, per esempio, legge l'ID del progetto aperto
per la modifica. Questi valori sono stringhe nel DOM. Non sono un controllo di
sicurezza: il backend deve comunque verificare utente e permessi.

I pulsanti di invio vengono disabilitati durante il salvataggio e riattivati
in `finally`, sia in caso di successo sia in caso di errore. Se il server rifiuta
i dati, il modulo resta aperto per permettere di correggerli.

Per provare il percorso completo:

1. Crea un progetto e usa **Modifica progetto** per cambiarne titolo e visibilità.
2. Crea un task e usa **Modifica attività** per cambiare descrizione e priorità.
3. Cancella la scadenza nel modulo e salva: il server riceve `null`.
4. Aggiungi un secondo account già registrato e apri **Membri**.
5. Prova ad annullare la rimozione, poi confermala. Il proprietario non è rimovibile.
6. Usa **Segnala**, scrivi un motivo e invia. Accedi poi come amministratore per
   leggere e gestire la segnalazione.

Le sezioni seguenti descrivono recupero password, storico locale delle notifiche
e filtri del catalogo.

### Recuperare la password dal sito

Le funzioni di questa sezione sono in `public/passwordRecovery.js`.

Dalla schermata di accesso premi **Password dimenticata?**. Il primo modulo
richiede l'email. `requestPasswordReset` invia una POST a `/auth/forgot-password`.
La risposta è generica: non rivela se l'indirizzo è registrato.

Per questa demo, se l'account esiste, il server stampa il codice nella propria
console. Copia la stringa dopo `token:` nel secondo modulo, inserisci la nuova
password e ripetila nel campo di conferma. Non devi copiare l'hash dal database.
Il codice dura un'ora e può essere usato una sola volta.

`resetPassword` verifica che le password coincidano, poi invia codice e nuova
password al server. Il server verifica il codice e salva l'hash bcrypt della
nuova password. Al termine devi accedere di nuovo. Non viene effettuato un login
automatico e le vecchie sessioni diventano invalide.

Il controllo sulla conferma della password aiuta l'utente a evitare errori di
battitura. La validità del codice e la sicurezza della nuova password sono
comunque controllate dal server. Un errore resta visibile nel modulo per poterlo
correggere. L'invio reale di email rimane una possibile estensione futura.

### Storico delle notifiche: perché usiamo localStorage

Le funzioni di questa sezione sono in `public/notifications.js`.

`addNotification` aggiunge il testo e la data a `state.notifications` e conserva
le ultime 50 notifiche in `localStorage`.

```js
localStorage.setItem(`taskflowNotifications:${state.user.id}`, JSON.stringify(state.notifications));
```

Il nome della chiave contiene l'ID dell'utente per separare gli elenchi degli
account nello stesso browser. `JSON.stringify` trasforma l'array in testo;
`JSON.parse` lo ricostruisce quando l'utente entra nuovamente.
Al logout svuotiamo l'array visualizzato, conservando lo storico salvato per
quell'account. Al login `loadNotifications` rilegge soltanto la chiave dell'utente
corrente. Questo separa la visualizzazione, ma non cifra i dati locali.

`renderNotifications` mostra l'elenco usando `escapeHTML`. Il pallino indica
notifiche ancora da leggere. Aprendo l'elenco vengono segnate come lette;
**Svuota elenco** cancella lo storico locale. Anche le nuove segnalazioni ricevute
dagli amministratori entrano nell'elenco.

Questo storico non è una tabella MySQL. Rimane dopo un ricaricamento, ma solo in
questo browser: non si sincronizza con altri dispositivi e non recupera eventi
inviati mentre l'utente era scollegato. Uno storico condiviso tra dispositivi
richiederebbe dati salvati e letti dal server.

### Filtri del catalogo

Il catalogo permette di combinare testo libero, categoria esatta, tecnologia e
intervallo delle date di creazione. Le date si riferiscono al progetto, non alla
scadenza dei task.

`loadCatalog` legge gli input e costruisce i parametri con `URLSearchParams`.
Per esempio:

```text
/api/projects/public?page=1&category=Web&technology=node&from=2026-01-01&to=2026-12-31
```

Solo i filtri compilati vengono aggiunti alla richiesta. Il controller applica
i controlli e le condizioni alla query del database; non scarichiamo tutti i
progetti per filtrarli nel browser. Il filtro tecnologia cerca una sottostringa:
per esempio `node` cerca quel testo nell'elenco delle tecnologie.

Se la data iniziale supera quella finale, il browser mostra un errore e sospende
la ricerca. Il server mantiene un proprio controllo sulle date. Cambiando i
filtri si torna alla prima pagina; **Azzera filtri** cancella anche la ricerca
testuale. Il breve ritardo di 300 millisecondi evita una richiesta per ogni tasto
premuto durante la digitazione.

Per provare queste funzioni, usa due account: dal secondo assegna un task al
primo mentre è collegato, poi apri le notifiche e ricarica la pagina. Prova anche
due date invertite nel catalogo e il recupero password dalla schermata di accesso.

### Copertina e archiviazione

I moduli di creazione e modifica del progetto includono un URL di copertina
facoltativo. L'URL viene salvato come stringa in MySQL; il browser scarica l'immagine
da quell'indirizzo e la mostra con un elemento `img`. Non stiamo caricando file
sul server. Per rimuovere la copertina basta svuotare il campo e salvare: inviamo `null`.
Un evento `error` nasconde l'immagine se l'indirizzo non è raggiungibile.

`canWriteProject` verifica se l'utente è membro e il progetto è attivo, per mostrare
i comandi corretti nel browser. `requireActiveForWrites` fa il controllo sul server:
lascia passare le GET di task e chat, ma rifiuta le scritture su progetti archiviati.
Il controllo nel browser aiuta l'utente; quello nel backend protegge davvero i dati.

Le funzioni delle notifiche e del recupero si trovano in due script distinti.
Tutti gli script condividono lo stesso contesto
della pagina; le funzioni accedono a `state` quando vengono chiamate, dopo che
`client.js` ha inizializzato lo stato. Non c'è un sistema di compilazione.

## 13. Domande per allenarti all'orale

**Perché usi una tabella ponte?**
Per rappresentare la partecipazione di molti utenti a molti progetti. Ogni riga
collega un utente e un progetto.

**Perché usi una transazione quando crei un progetto?**
Per salvare insieme progetto e appartenenza del proprietario. Se una delle due
operazioni fallisce, nessuna delle due deve restare salvata.

**Perché controlli il progetto quando cerchi un task?**
Per evitare di modificare un task di un altro progetto. La ricerca usa sia
l'identificativo del task sia quello del progetto corrente.

**Che cosa fa `mergeParams: true` nei router di task e messaggi?**
Permette di leggere anche il parametro `projectId` del router padre.

**Che cosa fa `include` nelle query Sequelize?**
Carica dati collegati, per esempio il nome dell'assegnatario insieme al task.

**Perché usi `escapeHTML` quando costruisci contenuto HTML con dati degli utenti?**
Per trasformare caratteri speciali in testo e impedire che vengano interpretati
come elementi HTML. Quando possibile, `textContent` inserisce direttamente testo.

**Perché usi `event.preventDefault()` nel submit?**
Per gestire l'invio con JavaScript senza il normale caricamento della pagina.

**Perché il logout deve coinvolgere il server?**
Per revocare il token: cancellarlo soltanto dal browser non renderebbe invalida
un'eventuale copia ancora esistente.

**Che differenza c'è tra test di regressione e di integrazione?**
I primi verificano comportamenti mirati senza collegarsi al database in questa
suite. I test di integrazione verificano più parti insieme con un database
temporaneo e comprendono verifiche di API, socket e browser.

## 14. Ordine consigliato di studio

1. `package.json`, `server.js`, `app.js`: avvio e configurazione.
2. `models/` e `models/index.js`: dati e relazioni.
3. Login: modulo → client → route → controller → modello → token.
4. Middleware di autenticazione e permessi sul progetto.
5. Creazione e modifica di un progetto.
6. Creazione, modifica e spostamento di un task.
7. Chat e aggiornamenti Socket.io.
8. Amministrazione, validazione, errori, migrazioni e test.
9. HTML e CSS: struttura, classi e adattamento alle dimensioni dello schermo.

Per ogni funzione chiediti: chi la chiama? Quali dati riceve? Quali controlli fa?
Che cosa restituisce? Che cosa succede se qualcosa va storto?
Se sai rispondere seguendo il codice, stai comprendendo il progetto.

## 15. Validazione, migrazioni, sessioni e dashboard

### Validazione: valori in ingresso e risposte true/false

In `middleware/validate.js` le funzioni ricevono i dati da controllare e restituiscono
un valore booleano che indica se il dato è valido.

```js
function isText(value, min, max) {
    if (typeof value !== "string") return false;
    return value.trim().length >= min && value.length <= max;
}
```

Per leggere `isText("Ciao", 1, 255)` chiediti: è una stringa? Il testo senza spazi
esterni ha almeno un carattere? Non supera 255 caratteri? Se sì restituisce `true`.
`isValidField` usa uno `switch` per scegliere il controllo del singolo campo.
`checkBody` verifica i campi obbligatori e quelli presenti con due cicli.

La parte finale legge i pezzi del percorso e il metodo HTTP per scegliere quali
campi controllare. Per una POST a `/projects` il titolo è obbligatorio; per una
PUT al progetto si controllano soltanto i campi inviati. I controller continuano
a ignorare i campi non consentiti: inviare `role: "admin"` non rende amministratori.

### Migrazioni: un elenco e un ciclo

`migrations/index.js` legge da `SequelizeMeta` i nomi dei file già applicati.
Scorre poi l'elenco delle migrazioni: salta quelle presenti e applica quelle nuove,
registrandone il nome solo quando l'operazione termina correttamente.

L'applicazione prevede una sola istanza del server. Si aspetta la fine di un seed o di una migrazione
prima di avviare altri comandi. Le migrazioni restano ripetibili e conservano i dati.

### Sessioni: confrontare due numeri

La colonna `Users.tokenVersion` viene aggiunta dalla terza migrazione; non devi
cancellare il database. Ecco il percorso completo:

1. L'utente ha versione 0 nel database.
2. Al login il server firma un JWT che contiene versione 0.
3. Durante una richiesta `loadSessionUser` legge l'utente e confronta le versioni.
4. Dopo un reset la password viene aggiornata e la versione passa a 1.
5. Il vecchio JWT contiene ancora 0: la richiesta viene rifiutata.
6. Un nuovo login produce un JWT con versione 1, quindi accettato.

Il numero non è una password e non deve essere segreto. Non può essere modificato
liberamente nel token, perché la firma JWT diventerebbe non valida. Il reset
mantiene anche il controllo che impedisce di consumare due volte lo stesso codice.

### Dashboard: una query dopo l'altra

`dashboardController.js` divide il lavoro in passaggi numerati:

1. Cerca i progetti con `ownerId` uguale all'utente corrente.
2. Legge da `ProjectMember` gli ID dei progetti a cui partecipa.
3. Cerca tra questi quelli che appartengono ad altri proprietari.
4. Cerca i task assegnati all'utente, includendo il titolo del progetto.
5. Conta i progetti attivi e le attività non completate.
6. Controlla se esistono altri risultati e costruisce la risposta JSON.

`Op.in` significa “uno dei valori dell'elenco”; `Op.ne` significa “diverso da”.
`findAndCountAll` restituisce sia i record della pagina (`rows`) sia il numero
totale (`count`). Le query vengono eseguite in sequenza con `await`; la risposta
JSON viene costruita quando tutte le letture sono terminate.
