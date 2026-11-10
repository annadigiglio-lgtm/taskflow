# Frontend web

L'interfaccia e' servita da Express da `public/` e non richiede framework o build. E' composta
da HTML, CSS e JavaScript nativi; la pagina e' responsive e comunica con il backend attraverso
fetch e Socket.io.

## Schermate

- **Accesso/registrazione**: login JWT, creazione di un account base e recupero password.
- **Panoramica**: riepilogo di progetti e task assegnati, scorciatoie ai progetti.
- **Esplora progetti**: catalogo con ricerca testuale e filtri per categoria, tecnologia e
  date di creazione, combinabili e azzerabili.
- **Progetto**: modifica dei dettagli, bacheca a tre colonne,
  creazione/modifica/spostamento/assegnazione/eliminazione task, invito e rimozione membri,
  archivio o cancellazione del progetto, segnalazioni e chat.
- **Notifiche**: elenco delle ultime 50 notifiche live ricevute, con stato letto e
  cancellazione dello storico locale.
- **Amministrazione**: visibile agli account admin, con elenco utenti e report; consente
  blocco/sblocco, nascondere/mostrare progetto e risolvere report.

## Come comunica con il server

`client.js` invia il token nelle chiamate protette come header `Authorization: Bearer ...`.
Il token e' memorizzato in `localStorage` per mantenere la sessione anche dopo il refresh.
Le operazioni (task, chat, moderazione) passano dalle API REST. Socket.io aggiorna bacheca,
chat e notifiche quando arriva un evento dal server.

I valori ricevuti dal server sono escapati prima di essere inseriti in HTML dinamico; i
messaggi di stato usano `textContent` dove non serve markup.

## Limiti del client rispetto alle API

L'immagine copertina e' un URL configurabile via API, non un upload file. Il recupero
password ha due moduli: richiesta del codice e impostazione della nuova password con
conferma. L'email resta simulata nella console del server; il modulo lo indica esplicitamente.
I dettagli e tutte le rotte sono in [API REST](api.md).

Lo storico notifiche usa `localStorage`, con una chiave distinta per ID utente. Non e'
salvato nel database, non si sincronizza tra dispositivi e non recupera notifiche inviate
durante la disconnessione. I dati locali non sono cifrati. L'elenco viene svuotato a video
al logout e riletto per l'account corrente al login.

## Liste e filtri

Catalogo e amministrazione hanno pulsanti precedente/successiva. La dashboard permette di
caricare altri progetti e task mantenendo contatori globali. La chat parte dai messaggi
recenti e carica lo storico su richiesta, conservando la posizione di lettura.

La bacheca combina ricerca nel titolo/descrizione, assegnatario (anche non assegnati),
priorita e scadenza (scaduti, oggi, senza data). Un task completato non e marcato come scaduto.
Le date si confrontano con il giorno locale. L'eliminazione dei task richiede conferma.
