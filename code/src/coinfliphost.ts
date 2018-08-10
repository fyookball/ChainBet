import BITBOXCli from 'bitbox-cli/lib/bitbox-cli';
let BITBOX = new BITBOXCli();

var inquirer = require('inquirer');

import { Core, WalletKey, BetState, Phase2Data, Phase4Data, Phase6Data } from './core';
import { Utils } from './utils';
import { Host } from './host';
import { CoinFlipShared } from './coinflipshared';
import { MessageFeed } from './messagefeed';
import { AddressDetailsResult } from 'bitbox-cli/lib/Address';

let bip68 = require('bip68');

// CoinFlipClient class represents 1 bet's state management
export class CoinFlipHost extends Host {

    wallet: WalletKey;
    isDebugging: boolean;
    betState: BetState;
    complete: boolean;
    feed: MessageFeed;

    constructor(wif: string, betAmount: number, feed: MessageFeed, debug: boolean = false) {
        super();
        let ecpair = BITBOX.ECPair.fromWIF(wif);

        this.wallet = { 
            wif: wif, 
            pubkey: BITBOX.ECPair.toPublicKey(ecpair), 
            address: BITBOX.ECPair.toCashAddress(ecpair) 
        };            

        this.isDebugging = debug;

        this.betState = { 
            amount: betAmount, 
            phase: 1, 
         };
        this.betState.phase = 1;
        this.complete = false;

        this.feed = feed;
    }

    async run(){

        this.betState.secret = Core.generateSecretNumber();
        this.betState.secretCommitment = BITBOX.Crypto.hash160(this.betState.secret);
        console.log("Your secret number (shortened) is: " + Core.readScriptInt32(this.betState.secret));

        // Phase 1 -- Send out a bet announcement
        console.log('\n-------------------------------------------------------------------------------');
        console.log('|              PHASE 1: Sending coin flip bet announcement...                 |');
        console.log('-------------------------------------------------------------------------------')
        
        this.betState.betId = await CoinFlipHost.sendPhase1Message(this.wallet, <number> this.betState.amount, <Buffer> this.betState.secretCommitment);
        if(this.betState.betId.length == 64){
            console.log('\nCoinflip announcement sent. \n(msg txn: ' + this.betState.betId + ')');
            this.betState.phase = 2;
        } else {
            console.log("An error occured: " + this.betState.betId);
            this.complete = true;
            return;
        }

        // Phase 2 -- Wait for a bet client to accept...
        console.log('\n-------------------------------------------------------------------------------');
        console.log('|            PHASE 2: Waiting for someone to accept your bet...               |');
        console.log('-------------------------------------------------------------------------------');

        while(this.betState.phase == 2){

            let betId = this.betState.betId;

            var clientPhase2Messages = this.feed.messages.filter(function(item){ 
                if(item.phase == 2){
                    let p2item = <Phase2Data> item;
                    if(p2item.betTxId.toString('hex') == betId){ return true; }
                } 
                return false;
            });

            if(clientPhase2Messages.length > 0){
                // ignore target address field from host for now...
                // accept first bet detected
                let bet = <Phase2Data> clientPhase2Messages[clientPhase2Messages.length-1];
                this.betState.clientTxId = bet.op_return_txnId;
                this.betState.clientmultisigPubKey = bet.multisigPubKey;
                this.betState.clientCommitment = bet.secretCommitment;
                
                // NOTE: to simplify we will automatically accept the first bet host we see
                console.log("\nSomeone has accepted your bet! \n(msg txn: " + bet.op_return_txnId + ")");
                //console.log("Client txn Id: " + this.betState.clientTxId);

                this.betState.phase = 3;
            }
            await Utils.sleep(250);
        }

        // Phase 3 -- Send Client your Escrow Details and multisig pub key so he can create escrow
        console.log('\n-------------------------------------------------------------------------------');
        console.log("|              PHASE 3: Funding the host's side of the bet...                 |");
        console.log('-------------------------------------------------------------------------------');
        
        let escrowBuf = CoinFlipShared.buildCoinFlipHostEscrowScript(
            this.wallet.pubkey, 
            <Buffer> this.betState.secretCommitment, 
            <Buffer> this.betState.clientmultisigPubKey
        );
        this.wallet.utxo = await Core.getUtxoWithRetry(this.wallet.address);
        let escrowTxid = await Core.createEscrow(this.wallet, escrowBuf, <number> this.betState.amount);
        console.log('\nOur escrow address has been funded! \n(txn: ' + escrowTxid);
        await Utils.sleep(500); // short wait for BITBOX mempool to sync

        let phase3MsgTxId = await CoinFlipHost.sendPhase3Message(this.wallet, this.betState.betId, <string> this.betState.clientTxId, escrowTxid);
        console.log('Message sent to client with our escrow details. \n(msg txn: ' + phase3MsgTxId + ')');
        this.betState.phase = 4;

        // Phase 4 -- Wait for Client's Escrow Details
        console.log('\n-------------------------------------------------------------------------------');
        console.log('|          PHASE 4: Waiting for client to fund their side of bet...           |')
        console.log('-------------------------------------------------------------------------------');

        while(this.betState.phase == 4){

            let betId = this.betState.betId;

            // TODO filter message for selected bet participant

            var clientPhase4Messages = this.feed.messages.filter(function(item){ 
                if(item.phase == 4) {
                    let p4item = <Phase4Data> item;
                    if(p4item.betTxId.toString('hex') == betId){ // && item.participantP2SHTxId.toString('hex') == clientId){ 
                        return true; }
                }
                return false;
            });

            if(clientPhase4Messages.length > 0) {
                // ignore target address field from host for now...
                let bet = <Phase4Data> clientPhase4Messages[clientPhase4Messages.length-1];
                this.betState.clientP2SHTxId = bet.participantP2SHTxId.toString('hex');
                this.betState.participantSig1 = bet.participantSig1;
                this.betState.participantSig2 = bet.participantSig2;

                console.log("\nThe client has funded the bet! \n(msg txn: " + bet.op_return_txnId + ")");
                console.log("(escrow txn: " + this.betState.clientP2SHTxId + ")");

                this.betState.phase = 5;
            }
            await Utils.sleep(250);
        }

        // Phase 5 -- Submit Bet Transaction & try to claim it.
        console.log('\n-------------------------------------------------------------------------------');
        console.log('|                   PHASE 5: Submitting Coin flip bet...                      |');
        console.log('-------------------------------------------------------------------------------');        

        let betScriptBuf = CoinFlipShared.buildCoinFlipBetScriptBuffer(
            this.wallet.pubkey, 
            <Buffer> this.betState.secretCommitment,
            <Buffer> this.betState.clientmultisigPubKey, 
            <Buffer> this.betState.clientCommitment
        );

        let clientEscrowBuf = CoinFlipShared.buildCoinFlipClientEscrowScript(
            this.wallet.pubkey, 
            <Buffer> this.betState.clientmultisigPubKey
        );

        let betTxId = await CoinFlipHost.redeemEscrowToMakeBet(
            this.wallet, 
            this.betState.secret, 
            <Buffer>this.betState.participantSig1,
            <Buffer>this.betState.participantSig2,
            escrowBuf, clientEscrowBuf, betScriptBuf, escrowTxid, 
            <string> this.betState.clientP2SHTxId, 
            <number> this.betState.amount
        );
                                                                
        if(betTxId.length == 64){
            console.log("\nBet Submitted! \n(txn: " + betTxId  + ")");
            this.betState.phase = 6;
        }
        else {
            console.log("\nSomething went wrong when submitting the bet: " + betTxId);
            this.complete = true;
            return;
        }

        // Phase 6 -- Wait for Client's Resignation if we lost.
        console.log('\n-------------------------------------------------------------------------------');
        console.log('|                  PHASE 6: Wait for Client WIN or LOSS                       |');
        console.log('-------------------------------------------------------------------------------');
        
        let p2sh_hash160 = BITBOX.Crypto.hash160(betScriptBuf);
        let scriptPubKey = BITBOX.Script.scriptHash.output.encode(p2sh_hash160);
        let betAddress = BITBOX.Address.fromOutputScript(scriptPubKey);

        while(this.betState.phase == 6){

            // 1) we need check for 1 of 2 events, bet txn spending by the client or client resignation.

            let betId = this.betState.betId;

            // TODO filter message for selected bet participant

            var clientPhase6Messages = this.feed.messages.filter(function(item){ 
                if(item.phase == 6) {
                    let p6Item = <Phase6Data> item;
                    if(p6Item.betTxId.toString('hex') == betId){ // && item.participantP2SHTxId.toString('hex') == clientId){ 
                        return true; 
                    }
                }
                return false;
            });

            if(clientPhase6Messages.length > 0) {
                // ignore target address field from host for now...
                let bet = <Phase6Data> clientPhase6Messages[clientPhase6Messages.length-1];
                this.betState.clientSecret = bet.secretValue;

                let host_int_le = Core.readScriptInt32(this.betState.secret);
                let client_int_le = Core.readScriptInt32(this.betState.clientSecret);
                console.log("\n   " + client_int_le + " <- client secrect (shortened)");
                console.log("+  " + host_int_le + " <- your secret (shortened)");
                console.log("=========================================================")
                console.log("   " + (client_int_le + host_int_le) + " <- result");
                console.log("\nYou WIN! (because the result is an ODD number)");
                
                this.betState.phase = 7;
            }

            try {
                var betDetails = <AddressDetailsResult> await Core.getAddressDetailsWithRetry(betAddress);
            } catch(e) {
                console.log("\nClient failed to claim his win or report loss...");
                this.complete = true;
                return;
            }
            
            if((betDetails.balanceSat + betDetails.unconfirmedBalanceSat) <= 0 && betDetails.transactions.length == 2){
                console.log("\nYou Lose... (because the result is EVEN)");
                console.log("The client has claimed their winnings...");
                this.complete = true;
                return;
            }
            
            await Utils.sleep(250);
        }

        console.log('\n-------------------------------------------------------------------------------');
        console.log('|                     PHASE 7: Claiming Our Winnings...                       |');
        console.log('-------------------------------------------------------------------------------');
        

        let winTxnId = await CoinFlipHost.hostClaimWinSecret(this.wallet, 
                                                            this.betState.secret, 
                                                            <Buffer> this.betState.clientSecret, 
                                                            betScriptBuf, 
                                                            betTxId, 
                                                            <number> this.betState.amount);
        if(winTxnId.length != 64)
        {
            console.log("\nWe're sorry. Something terrible went wrong when trying to claim your winnings... " + winTxnId);
        } else {
            console.log("\nYou've been paid! \n(txn: " + winTxnId + ")");
        }
        
        this.complete = true;
    }

	static async sendPhase1Message(wallet: WalletKey, betAmount: number, hostCommitment: Buffer, clientTargetAddress?: string): Promise<string>{
        let phase1Buf = this.encodePhase1Message(betAmount, hostCommitment, clientTargetAddress);
        // console.log("Phase 1 OP_RETURN (hex): " + phase1Buf.toString('hex'));
        // console.log("Phase 1 OP_RETURN (ASM): " + BITBOX.Script.toASM(phase1Buf));
        wallet.utxo = await Core.getUtxoWithRetry(wallet.address);
		let txnId = await Core.createOP_RETURN(wallet, phase1Buf);
		return txnId;
    }

    static async sendPhase3Message(wallet: WalletKey, betId: string, clientTxId: string, escrowTxId: string): Promise<string>{
        let phase3Buf = this.encodePhase3Message(betId, clientTxId, escrowTxId, wallet.pubkey);
        // console.log("Phase 3 OP_RETURN (hex): " + phase3Buf.toString('hex'));
        // console.log("Phase 3 OP_RETURN (ASM): " + BITBOX.Script.toASM(phase3Buf));
        wallet.utxo = await Core.getUtxoWithRetry(wallet.address);
        let txnId = await Core.createOP_RETURN(wallet, phase3Buf);
        return txnId;
    }
    
    static async redeemEscrowToMakeBet(wallet: WalletKey, hostSecret: Buffer, clientSig1: Buffer, clientSig2: Buffer, 
                                        hostRedeemScript: Buffer, clientRedeemScript: Buffer, betScript: Buffer, 
                                        hostTxId: string, clientTxId: string, betAmount: number): Promise<string> {

        let hostKey = BITBOX.ECPair.fromWIF(wallet.wif)
        //let clientKey = BITBOX.ECPair.fromWIF(client.wif)
        let transactionBuilder = new BITBOX.TransactionBuilder('bitcoincash');

        let hashType = 0xc1 // transactionBuilder.hashTypes.SIGHASH_ANYONECANPAY | transactionBuilder.hashTypes.SIGHASH_ALL
        let satoshisAfterFee = Core.purseAmount(betAmount);
        transactionBuilder.addInput(hostTxId, 0);
        transactionBuilder.addInput(clientTxId, 0);

        // Determine bet address
        let p2sh_hash160 = BITBOX.Crypto.hash160(betScript);
        let scriptPubKey = BITBOX.Script.scriptHash.output.encode(p2sh_hash160);
        let betAddress = BITBOX.Address.fromOutputScript(scriptPubKey);
        transactionBuilder.addOutput(BITBOX.Address.toLegacyAddress(betAddress), satoshisAfterFee);

        let tx = transactionBuilder.transaction.buildIncomplete();

        // Sign alices escrow
        let sigHash: number = tx.hashForWitnessV0(0, hostRedeemScript, betAmount, hashType);
        let hostSig: Buffer = hostKey.sign(sigHash).toScriptSignature(hashType);
        //let clientSig = //clientKey.sign(sigHash).toScriptSignature(hashType);

        let redeemScriptSig: number[] = []; // start by pushing with true for makeBet mode

        // multisig off by one fix
        redeemScriptSig.push(BITBOX.Script.opcodes.OP_0);

        // host signature
        redeemScriptSig.push(hostSig.length);
        hostSig.forEach((item, index) => { redeemScriptSig.push(item); });

        // participant signature
        redeemScriptSig.push(clientSig2.length)
        clientSig2.forEach((item, index) => { redeemScriptSig.push(item); });
        
        // alice secret
        redeemScriptSig.push(hostSecret.length);
        hostSecret.forEach((item, index) => { redeemScriptSig.push(item); });

        // push mode onto stack for MakeBet mode
        redeemScriptSig.push(0x51); // non-zero is makeBet mode

        if (hostRedeemScript.length > 75) redeemScriptSig.push(0x4c);
        redeemScriptSig.push(hostRedeemScript.length);
        hostRedeemScript.forEach((item, index) => { redeemScriptSig.push(item); });
        
        let redeemScriptSigBuf: Buffer = Buffer.from(redeemScriptSig);
        tx.setInputScript(0, redeemScriptSigBuf);

        // Sign bob's escrow
        let sigHash2: number = tx.hashForWitnessV0(1, clientRedeemScript, betAmount, hashType);
        let hostSig2: Buffer = hostKey.sign(sigHash2).toScriptSignature(hashType);
        //let clientSig2 = clientKey.sign(sigHash2).toScriptSignature(hashType);

        let redeemScriptSig2: number[] = []

        // multisig off by one fix
        redeemScriptSig2.push(BITBOX.Script.opcodes.OP_0)

        // host signature
        redeemScriptSig2.push(hostSig2.length)
        hostSig2.forEach((item, index) => { redeemScriptSig2.push(item); })

        // participant signature
        redeemScriptSig2.push(clientSig1.length)
        clientSig1.forEach((item, index) => { redeemScriptSig2.push(item); });

        // push mode onto stack for MakeBet mode
        redeemScriptSig2.push(0x51); // non-zero is makeBet mode

        if (clientRedeemScript.length > 75) redeemScriptSig2.push(0x4c)
        redeemScriptSig2.push(clientRedeemScript.length)
        clientRedeemScript.forEach((item, index) => { redeemScriptSig2.push(item); });
        
        let redeemScriptSig2Buf = Buffer.from(redeemScriptSig2);
        tx.setInputScript(1, redeemScriptSig2Buf);
        
        // uncomment for viewing script hex
        // let redeemScriptSigHex = redeemScriptSig.toString('hex');
        // let redeemScriptHex = redeemScript.toString('hex');
        
        let hex: string = tx.toHex();
        
        let txId = await Core.sendRawTransaction(hex);
        return txId;
    }

    static async hostClaimWinSecret(wallet: WalletKey, hostSecret: Buffer, clientSecret: Buffer, betScript: Buffer, betTxId: string, betAmount: number): Promise<string>{

        let purseAmount = Core.purseAmount(betAmount);

        let hostKey = BITBOX.ECPair.fromWIF(wallet.wif)
        let transactionBuilder = new BITBOX.TransactionBuilder('bitcoincash');

        let hashType = 0xc1 // transactionBuilder.hashTypes.SIGHASH_ANYONECANPAY | transactionBuilder.hashTypes.SIGHASH_ALL
        let byteCount = BITBOX.BitcoinCash.getByteCount({ P2PKH: 1 }, { P2SH: 1 });
        let satoshisAfterFee = purseAmount - byteCount - betScript.length - 109;
        transactionBuilder.addInput(betTxId, 0)
        transactionBuilder.addOutput(BITBOX.Address.toLegacyAddress(wallet.utxo[0].cashAddress), satoshisAfterFee);

        let tx = transactionBuilder.transaction.buildIncomplete();

        // Sign bet tx
        let sigHash: number = tx.hashForWitnessV0(0, betScript, purseAmount, hashType);
        let hostSig: Buffer = hostKey.sign(sigHash).toScriptSignature(hashType);

        let redeemScriptSig: number[] = []; // start by pushing with true for makeBet mode

        // host signature
        redeemScriptSig.push(hostSig.length)
        hostSig.forEach((item, index) => { redeemScriptSig.push(item); });

        // host secret
        redeemScriptSig.push(hostSecret.length);
        hostSecret.forEach((item, index) => { redeemScriptSig.push(item); });

        // client secret
        redeemScriptSig.push(clientSecret.length);
        clientSecret.forEach((item, index) => { redeemScriptSig.push(item); });

        // Host wins with client secret mode
        redeemScriptSig.push(0x51);
        redeemScriptSig.push(0x51);

        if (betScript.length > 75) redeemScriptSig.push(0x4c);
        redeemScriptSig.push(betScript.length);
        betScript.forEach((item, index) => { redeemScriptSig.push(item); });
        
        tx.setInputScript(0, Buffer.from(redeemScriptSig));
        
        // uncomment for viewing script hex
        // let redeemScriptSigHex = redeemScriptSig.toString('hex');
        // let redeemScriptHex = redeemScript.toString('hex');
                // uncomment for viewing script hex
        // console.log("Bet redeem script hex: " + redeemScriptSig.toString('hex'));
        // console.log("Bet Script Hex: " + betScript.toString('hex'));
        console.log("Winning amount after fees: " + satoshisAfterFee);

        let hex = tx.toHex();
        
        let txId = await Core.sendRawTransaction(hex);
        return txId;
    }

    static async hostClaimWinTimeout(wallet: WalletKey, betScript: Buffer, betTxId: string, betAmount: number): Promise<string>{

        let hostKey = BITBOX.ECPair.fromWIF(wallet.wif)
        let transactionBuilder = new BITBOX.TransactionBuilder('bitcoincash');

        let hashType = 0xc1 // transactionBuilder.hashTypes.SIGHASH_ANYONECANPAY | transactionBuilder.hashTypes.SIGHASH_ALL
        let byteCount = BITBOX.BitcoinCash.getByteCount({ P2PKH: 1 }, { P2SH: 1 });
        let satoshisAfterFee = betAmount - byteCount - 800;
        transactionBuilder.addInput(betTxId, 0, bip68.encode({ blocks: 1 }))
        transactionBuilder.addOutput(BITBOX.Address.toLegacyAddress(wallet.utxo[0].cashAddress), satoshisAfterFee);

        let tx = transactionBuilder.transaction.buildIncomplete();

        // Sign bet tx
        let sigHash: number = tx.hashForWitnessV0(0, betScript, betAmount, hashType);
        let hostSig: Buffer = hostKey.sign(sigHash).toScriptSignature(hashType);

        let redeemScriptSig: number[] = []; // start by pushing with true for makeBet mode

        // host signature
        redeemScriptSig.push(hostSig.length)
        hostSig.forEach((item, index) => { redeemScriptSig.push(item); });

        // Host wins with timeout mode
        redeemScriptSig.push(0x00);
        redeemScriptSig.push(0x51);

        if (betScript.length > 75) redeemScriptSig.push(0x4c);
        redeemScriptSig.push(betScript.length);
        betScript.forEach((item, index) => { redeemScriptSig.push(item); });
        
        tx.setInputScript(0, Buffer.from(redeemScriptSig));
        
        // uncomment for viewing script hex
        // let redeemScriptSigHex = redeemScriptSig.toString('hex');
        // let redeemScriptHex = redeemScript.toString('hex');
        
        let hex: string = tx.toHex();
        
        let txId = await Core.sendRawTransaction(hex);
        return txId;
    }
}