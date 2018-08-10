## Node.js implementation of the Bitcoin Cash ChainBet protocol

This repo contains a node.js implementation of the ChainBet protocol built using TypeScript. The specification of the ChainBet protocol is here: [https://github.com/fyookball/ChainBet](https://github.com/fyookball/ChainBet).  An example program (dice.js) is provided to demonstrate how to use the `chainbet` npm package.  Instructions for compiling the chainbet npm package from TypeScript source are also provided.

### dice.js Main Menu

![Main Menu](https://github.com/deskviz/chainbet/blob/master/examples/dice/images/main_menu.png?raw=true)

## Running dice.js example

 1. install node.js (v8.11.3 or later)
 2. `git clone https://github.com/jcramer/chainbet`
 3. `cd chainbet/examples/dice`
 4. `npm install`
 6. `node dice.js`

## Compiling TypeScript Source for npm package

The following dice.js example shows a simple command-line program which facilitates a trustless p2p dice games using the ChainBet npm package.  Running this example requires that at least one player is already running the program in "client mode" before another player uses "host mode" to announce a coin flip bet wager.

 1. install node.js (v8.11.3 or later)
 2. `git clone https://github.com/jcramer/chainbet`
 3. `cd chainbet`
 4. `npm install`
 5. `npm run build`
 6. Verify the libs directory was created with output js and d.ts files.

### Dice Winner

![Dice Winner](https://github.com/deskviz/chainbet/blob/master/examples/dice/images/Coin%20Flip%20Winner.png?raw=true)

### Dice Loser

![Dice Loser](https://github.com/deskviz/chainbet/blob/master/examples/dice/images/Coin%20Flip%20Loser.png?raw=true)

## Dev Usage

Install: `npm install chainbet`

```js
let chainbet = require('chainbet');

// 1) Create Script Buffer object for any phase
chainbet.Host.encodePhase1Message(1000, 'bitcoincash:qzs02v05l7qs5s24srqju498qu55dwuj0cx5ehjm2c');
// <Buffer 6a 04 54 45 42 00 02 01 00 02 01 00 02 01 00 02 01 00 05 31 32 33 34 35 36 62 69 74 63 6f 69 6e 63 61 73 68 3a 71 7a 73 30 32 76 30 35 6c 37 71 73 35 ... >

// 2) Decode Script Hex for any ChainBet phase
let scriptHex = Buffer('01010100000000000003e81111111111111111111111111111111111111111a0f531f4ff810a415580c12e54a7072946bb927e');
chainbet.Core.decodePhaseData(scriptHex);

// { phase: 1,
//   type: 1,
//   amount: 1000,
//   hostCommitment: 11111111111111111111
//   address: 'bitcoincash:qzs02v05l7qs5s24srqju498qu55dwuj0cx5ehjm2c' }

```
