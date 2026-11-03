# Frontend web

L'interfaccia e' servita da Express da `public/` e non richiede framework o build. E' composta
da HTML, CSS e JavaScript nativi; la pagina e' responsive e comunica con il backend attraverso
fetch e Socket.io.

## Schermate

- **Accesso/registrazione**: login JWT o creazione di un account base.
- **Panoramica**: riepilogo di progetti e task assegnati, scorciatoie ai progetti.
- **Esplora progetti**: catalogo pubblico con ricerca testuale e selettore categoria.
- **Progetto**: bacheca a tre colonne, creazione/spostamento/assegnazione/eliminazione task,
  invito membri, archivio o cancellazione del progetto, chat.
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

Il browser non espone tutte le funzioni REST: per esempio la modifica completa dei dati del
progetto, la rimozione membri, la scelta intervallo date nel catalogo e il flusso di reset
password si provano tramite API/Postman. L'immagine copertina e' un URL configurabile via API,
non un upload file. I dettagli e tutte le rotte sono in [API REST](api.md).

## Liste e filtri

Catalogo e amministrazione hanno pulsanti precedente/successiva. La dashboard permette di
caricare altri progetti e task mantenendo contatori globali. La chat parte dai messaggi
recenti e carica lo storico su richiesta, conservando la posizione di lettura.

La bacheca combina ricerca nel titolo/descrizione, assegnatario (anche non assegnati),
priorita e scadenza (scaduti, oggi, senza data). Un task completato non e marcato come scaduto.
Le date si confrontano con il giorno locale. L'eliminazione dei task richiede conferma.
