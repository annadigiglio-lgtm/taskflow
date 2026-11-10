# Funzionalita' dell'app

TaskFlow organizza il lavoro in progetti. Ogni progetto puo' avere proprietario, membri,
attivita' (task), conversazione e segnalazioni. I dati vengono salvati nel database e le
azioni passano dalle API protette.

## Account e ruoli

- **Utente**: si registra, accede, vede la propria dashboard e partecipa ai progetti di cui
  e' membro. Può anche esplorare il catalogo e segnalare progetti.
- **Proprietario del progetto**: e' l'utente che ha creato quel progetto. Puo' modificarlo,
  archiviarlo, eliminarlo e invitare o rimuovere membri. Non e' un ruolo globale dell'account.
- **Amministratore**: puo' vedere gli utenti, bloccare o sbloccare account, consultare le
  segnalazioni, nascondere progetti e risolvere segnalazioni.

## Progetti

Un progetto ha titolo, descrizione, categoria, elenco di tecnologie, visibilita' pubblica o
privata e URL facoltativo dell'immagine di copertina. Il proprietario puo' aggiungere membri
gia' registrati tramite email. I progetti pubblici e attivi, non nascosti dagli admin,
compaiono nel catalogo. Sono previsti filtri API per categoria, tecnologia e intervallo di
date di creazione.

## Task e dashboard

Ogni progetto ha una bacheca con tre stati: **Da fare**, **In corso** e **Completato**. Un task
puo' avere titolo, descrizione, scadenza, priorita' (bassa, media o alta) e un membro
assegnatario. I membri possono creare, modificare, spostare, riassegnare ed eliminare task.

La dashboard mostra i progetti posseduti, quelli di altri di cui l'utente e' membro e i task
assegnati all'utente, ordinati per scadenza.

## Chat e aggiornamenti

La chat e' associata a un progetto e accessibile ai suoi membri. I messaggi sono salvati via
API REST e inviati agli altri membri via Socket.io. Anche creazione, aggiornamento, spostamento,
assegnazione ed eliminazione dei task generano eventi live.

Le notifiche personali riguardano assegnazioni, cambi di stato dei propri task e inviti a un
progetto. Gli admin ricevono l'evento live di una nuova segnalazione mentre sono connessi.

## Segnalazioni e moderazione

Un utente autenticato puo' segnalare un progetto indicando un motivo. L'amministratore puo'
consultare le segnalazioni aperte, nascondere il progetto o chiudere la segnalazione. Quando
un account viene bloccato, non puo' piu' usare le API o aprire nuove connessioni Socket.io; le
connessioni live gia' aperte vengono chiuse.

## Funzionalita' nel browser e via API

Dal frontend si possono registrare e accedere, consultare dashboard e catalogo, creare
progetti, gestire bacheca e chat, invitare membri, archiviare o eliminare i propri progetti,
e usare le schermate admin. Sono disponibili anche modifica dei dati di progetti e task,
rimozione membri, segnalazioni, recupero password e filtri per tecnologia e date del catalogo.
Le notifiche ricevute sono conservate localmente per account, fino a 50, in questo browser;
non vengono recuperate quelle inviate mentre si era scollegati. La copertina è configurabile
anche nei moduli del sito. I progetti archiviati conservano task e chat in sola lettura,
con possibilità di riattivazione da parte del proprietario.
L'elenco puntuale delle rotte e' in [API REST](api.md).
