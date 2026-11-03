# Avvio e demo locale

## Requisiti

- Node.js LTS e npm.
- MySQL avviato e un database `taskflow` creato.
- File `.env` compilato a partire da `.env.example`.

In PowerShell su Windows usare `npm.cmd` se l'esecuzione di `npm.ps1` e' bloccata dalla
Execution Policy.

## Comandi

```powershell
npm install
npm.cmd run seed
npm.cmd run seed:demo
npm.cmd start
```

Il primo seed crea l'account amministratore dai valori `ADMIN_*` nel file `.env`. Il seed demo
crea cinque utenti, cinque progetti, task, messaggi e membri di esempio. I seed creano le
tabelle mancanti con Sequelize e possono essere rilanciati senza duplicare i dati demo.

Con il server attivo aprire `http://localhost:3000`. Per fermarlo, premere `Ctrl+C` nella
finestra PowerShell in cui e' in esecuzione.

## Account demo

Password condivisa dagli account dimostrativi: **`TaskFlow2026!`**.

| Nome | Email | Progetto posseduto |
|---|---|---|
| Anna Demo | `demo.anna@example.com` | Portfolio di classe |
| Marco Demo | `demo.marco@example.com` | EcoMarket |
| Giulia Demo | `demo.giulia@example.com` | App eventi ITS |
| Luca Demo | `demo.luca@example.com` | Dashboard IoT |
| Sara Demo | `demo.sara@example.com` | TaskFlow per il team |

Ogni demo ha un progetto proprio, due progetti condivisi e tre task assegnati. Il seed si
trova in `src/seedDemo.js`; il comando e' `npm.cmd run seed:demo`.

Queste credenziali sono esclusivamente per la demo locale e non vanno riutilizzate in
produzione.

## Percorso demo consigliato

1. Accedere come Anna Demo e aprire **Portfolio di classe**.
2. Mostrare le tre colonne e spostare un task in un altro stato.
3. Aprire il tab chat e inviare un messaggio.
4. Accedere come Marco Demo in un'altra finestra/sessione per vedere i progetti condivisi e
   gli aggiornamenti realtime sul progetto comune.
5. Accedere come amministratore e aprire **Amministrazione** per mostrare utenti e report.

I nomi e le password dell'amministratore dipendono dal file `.env`; non sono gli account demo.
