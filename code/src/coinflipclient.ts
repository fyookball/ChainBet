import BITBOXCli from 'bitbox-cli/lib/bitbox-cli';
let BITBOX = new BITBOXCli();

var inquirer = require('inquirer');

import { Core, Phase1Data, Phase3Data, WalletKey, BetState } from './core';
import { Utils } from './utils';
import { Client } from './client';
import { MessageFeed } from './messagefeed';
import { CoinFlipShared } from './coinflipshared';
import { AddressDetailsResult } from 'bitbox-cli/lib/Address';

export class CoinFlipClient extends Client {
    wallet: WalletKey;
    isDebugging: boolean;
    betState: BetState;
    complete: boolean;
    feed: MessageFeed;

    constructor(wif: string, feed: MessageFeed, debug: boolean = false){
        super();

        let ecpair = BITBOX.ECPair.fromWIF(wif);

        this.wallet = { 
            wif: wif, 
            pubkey: BITBOX.ECPair.toPublicKey(ecpair),
            address: BITBOX.ECPair.toCashAddress(ecpair) 
        };

        this.isDebugging = debug;

        this.betState = { phase: 1 };
        this.complete = false;

        this.feed = feed;
    }

    async run() {

        // Phase 1 -- keep checking for a host to bet with
        console.log('\n-------------------------------------------------------------------------------');
        console.log('|               PHASE 1: Waiting for a host bet announcement...               |');
        console.log('-------------------------------------------------------------------------------');
        
        while(this.betState.phase == 1) {

            var hostPhase1Messages = this.feed.messages.filter(function(item){ 
                return item.phase == 1 && item.betType == 1; 
            });

            if(hostPhase1Messages.length > 0){
                // ignore target address field from host for now...
                let newBet = <Phase1Data> hostPhase1Messages[hostPhase1Messages.length-1];
                this.betState.hostCommitment = newBet.hostCommitment;
                this.betState.amount = newBet.amount;
                this.betState.betId = newBet.op_return_txnId;

                // NOTE: to simplify we will automatically accept the first bet host we see
                console.log("\nCoin flip bet discovered! \n(msg txn: " + this.betState.betId + ")");
                console.log("\nHost's Bet Amount: " + newBet.amount);
                console.log('\n');
                if(!this.isDebugging) {
                    let answer = await inquirer.prompt([{
                        type: "input", 
                        name: "response", 
                        message: "Do you want to accept this bet (y/n)?",
                        validate: 
                            function(input: string): boolean{ 
                                if(input == "y" || input == "n") return true; 
                                return false; 
                            }
                    }]);
                    if(answer.response == "y")
                        this.betState.phase = 2;
                    else{
                        console.log("Bet ignored...");
                        this.complete = true;
                        return;
                    }
                }
                else{
                    console.log("Automatically accepting bet (in debug mode)...");
                    this.betState.phase = 2;
                }
            }

            await Utils.sleep(250);
        }

        // Phase 2 -- allow user to choose a secret number then send host our acceptance message
        this.betState.secret = Core.generateSecretNumber(); //Buffer("c667c14e218cf530c405e2d50def250b0c031f69593e95171048c772ad0e1bce",'hex');
        this.betState.secretCommitment = BITBOX.Crypto.hash160(this.betState.secret);
        console.log("Your secret number is: " + Core.readScriptInt32(this.betState.secret));

        console.log('\n-------------------------------------------------------------------------------');
        console.log('|           PHASE 2: Accepting bet & sending our secret commitment...         |');
        console.log('-------------------------------------------------------------------------------');

        this.betState.clientTxId = await CoinFlipClient.sendPhase2Message(this.wallet, <string> this.betState.betId, <Buffer> this.wallet.pubkey, <Buffer> this.betState.secretCommitment);
        console.log("\nMessage to accept the bet sent. \n(msg txn: " + this.betState.clientTxId + ")")
        this.betState.phase = 3;

        // Phase 3 -- keep checking for host to fund his side of bet...
        console.log('\n-------------------------------------------------------------------------------')
        console.log('|         PHASE 3: Waiting for host confirmation & to fund his bet...         |')
        console.log('-------------------------------------------------------------------------------')
        

        while(this.betState.phase == 3) {

            let betId = this.betState.betId;
            let clientId = this.betState.clientTxId;

            var clientPhase3Messages = this.feed.messages.filter(function(item){ 
                if(item.phase == 3 && betId != undefined) {
                    let p3item = <Phase3Data> item;
                    if(p3item.betTxId.toString('hex') == betId && p3item.participantOpReturnTxId.toString('hex') == clientId){ 
                        return true; }
                }
                return false;
            });

            if(clientPhase3Messages.length > 0){
                // ignore target address field from host for now...
                // assume its the host who is sending the message (TODO this will need to be fixed to prevent fake hosts)
                let bet = <Phase3Data> clientPhase3Messages[clientPhase3Messages.length-1];
                this.betState.hostMultisigPubKey = bet.hostMultisigPubKey;
                this.betState.hostP2SHTxId = bet.hostP2SHTxId.toString('hex');

                // NOTE: to simplify we will automatically accept the first bet host we see
                console.log("\nThe bet host has decided to bet with you! :-) \n(msg txn: " + bet.op_return_txnId + ")");
                console.log("(escrow txn: " + this.betState.hostP2SHTxId);

                this.betState.phase = 4;
            }
            await Utils.sleep(250);
        }

        // Phase 4 -- Send Host your Escrow Details
        console.log('\n-------------------------------------------------------------------------------');
        console.log('|                   PHASE 4: Funding our side of the bet...                   |');
        console.log('-------------------------------------------------------------------------------');

        let escrowBuf = CoinFlipShared.buildCoinFlipClientEscrowScript(<Buffer> this.betState.hostMultisigPubKey, this.wallet.pubkey);
        //console.log(BITBOX.Script.toASM(escrowBuf));
        this.wallet.utxo = await Core.getUtxoWithRetry(<string> this.wallet.address);
        let escrowTxid = await Core.createEscrow(this.wallet, escrowBuf, <number> this.betState.amount);
        console.log('\nOur escrow address has been funded! \n(txn: ' + escrowTxid);
        await Utils.sleep(500); // need to wait for BITBOX mempool to sync

        console.log('Sending our escrow details and signatures to host...');
        let betScriptBuf = CoinFlipShared.buildCoinFlipBetScriptBuffer(<Buffer> this.betState.hostMultisigPubKey, <Buffer> this.betState.hostCommitment, this.wallet.pubkey, <Buffer> this.betState.secretCommitment);
        
        // build bob's signatures
        let bobEscrowSig = CoinFlipShared.createEscrowSignature(this.wallet, escrowTxid, escrowBuf, <number> this.betState.amount, betScriptBuf);
        
        let hostEscrowBuf = CoinFlipShared.buildCoinFlipHostEscrowScript(<Buffer> this.betState.hostMultisigPubKey, <Buffer> this.betState.hostCommitment, this.wallet.pubkey);
        let aliceEscrowSig = CoinFlipShared.createEscrowSignature(this.wallet, <string> this.betState.hostP2SHTxId, hostEscrowBuf, <number> this.betState.amount, betScriptBuf);

        // prepare to send Phase 4 OP_RETURN
        let phase4MsgTxId = await CoinFlipClient.sendPhase4Message(this.wallet, <string> this.betState.betId, escrowTxid, bobEscrowSig, aliceEscrowSig);
        console.log('Message sent. \n(msg txn: ' + phase4MsgTxId +')');
        this.betState.phase = 5;

        console.log('\n-------------------------------------------------------------------------------');
        console.log('|             PHASE 5: Waiting for host to broadcast coin flip...             |');
        console.log('-------------------------------------------------------------------------------');
        
        // 5) keep check to see if the host's P2SH escrow has been spent (indicates bet is created).

        // Determine host's P2SH address
        let host_p2sh_hash160 = BITBOX.Crypto.hash160(hostEscrowBuf);
        let host_p2sh_scriptPubKey = BITBOX.Script.scriptHash.output.encode(host_p2sh_hash160);
        let host_p2sh_Address = BITBOX.Address.fromOutputScript(host_p2sh_scriptPubKey);

        while(this.betState.phase == 5){

            try{
                var host_p2sh_details = <AddressDetailsResult> await Core.getAddressDetailsWithRetry(host_p2sh_Address, 30);
            } catch(e){
                console.log("\nHost failed to broadcast message in a timely manner.");
                this.complete = true;
                return;
            }

            if((host_p2sh_details.unconfirmedBalanceSat + host_p2sh_details.balanceSat) == 0 && host_p2sh_details.transactions.length == 2)
            {
                var bet_txnId = host_p2sh_details.transactions[0];
                // TODO: Use a wrapped version of these
                var raw_txn = await BITBOX.RawTransactions.getRawTransaction(bet_txnId);
                var decoded_bet_txn = await BITBOX.RawTransactions.decodeRawTransaction(raw_txn);  //decoded_bet_txn.vin[0].scriptSig.asm
                let host_secret;
                if(decoded_bet_txn != undefined)
                    host_secret = CoinFlipClient.parseHostSecretFromASM(decoded_bet_txn.vin[0].scriptSig.asm);
                else
                    continue;
                    //throw new Error("Raw bet transaction could not be decoded.");

                // must remove right hand zeros so that the numbers aren't always even..
                let client_int_le = Core.readScriptInt32(this.betState.secret);
                let host_int_le = Core.readScriptInt32(host_secret);

                console.log("\n  " + client_int_le + " <- your secret (shortened)");
                console.log("+ " + host_int_le + " <- host's secret (shortened)");
                console.log("==============================================");
                console.log("  " + (client_int_le + host_int_le + " <- result"));
            
                let isEven = (client_int_le + host_int_le) % 2 == 0;

                if(isEven) {
                    console.log("\nYou win! (because the result is EVEN)");
                    let winTxnId = await CoinFlipClient.clientClaimWin(this.wallet, host_secret, this.betState.secret, betScriptBuf, bet_txnId, <number> this.betState.amount);
                    if(winTxnId.length != 64)
                    {
                        console.log("We're sorry. Something terrible went wrong when trying to claim your winnings... " + winTxnId);
                    } else {
                        console.log("\nYou've been paid! \n(txn: " + winTxnId + ")");
                    }
                    this.complete = true;
                    return
                }
                console.log("\nYou Lose... (becuase the result is ODD)");
                this.betState.phase = 6;
            }
            
            await Utils.sleep(250);
        }

        if(this.betState.phase == 6) {

            console.log('\n-------------------------------------------------------------------------------');
            console.log('|                    PHASE 6: Sending resignation to Host...                  |');
            console.log('-------------------------------------------------------------------------------');
            
            // 6) Send resignation to the client
            let phase6TxnId = await CoinFlipClient.sendPhase6Message(this.wallet, <string> this.betState.betId, this.betState.secret);
            if(phase6TxnId.length == 64)
                console.log("\nResignation message sent. \n(msg txn: " + phase6TxnId + ")");
            else {

            }
        }

        this.complete = true;
    }

    static parseHostSecretFromASM(asm: string): Buffer{
        let secretHex = asm.split(" ")[3];
        let secretBuf = Buffer.from(secretHex, 'hex');
        return secretBuf;
    }

    static async sendPhase2Message(wallet: WalletKey, betId: string, multisigPubKey: Buffer, secretCommitment: Buffer): Promise<string>{
        let phase2Buf = this.encodePhase2Message(betId, multisigPubKey, secretCommitment);
        wallet.utxo = await Core.getUtxoWithRetry(<string> wallet.address);
        let txnId = await Core.createOP_RETURN(wallet, phase2Buf);
        return txnId;
    }

    static async sendPhase4Message(wallet: WalletKey, betId: string, escrowTxid: string, bobEscrowSig: Buffer, aliceEscrowSig: Buffer): Promise<string>{
        let phase4Buf = this.encodePhase4Message(betId, escrowTxid, bobEscrowSig, aliceEscrowSig);
        wallet.utxo = await Core.getUtxoWithRetry(<string>wallet.address);
        let txnId = await Core.createOP_RETURN(wallet, phase4Buf);
        return txnId;
    }

    static async sendPhase6Message(wallet: WalletKey, betId: string, clientSecret: Buffer): Promise<string>{
        let phase6Buf = this.encodePhase6Message(betId, clientSecret);
        wallet.utxo = await Core.getUtxoWithRetry(<string> wallet.address);
        let txnId = await Core.createOP_RETURN(wallet, phase6Buf);
        return txnId;
    }

    static async clientClaimWin(wallet: WalletKey, hostSecret: Buffer, clientSecret: Buffer, betScript: Buffer, betTxId: string, betAmount: number): Promise<string> {

        let purseAmount = Core.purseAmount(betAmount);

        let clientKey = BITBOX.ECPair.fromWIF(wallet.wif)
        let transactionBuilder = new BITBOX.TransactionBuilder('bitcoincash');

        let byteCount = BITBOX.BitcoinCash.getByteCount({ P2PKH: 1 }, { P2SH: 1 });

        let hashType = 0xc1 // transactionBuilder.hashTypes.SIGHASH_ANYONECANPAY | transactionBuilder.hashTypes.SIGHASH_ALL
        let satoshisAfterFee = purseAmount - byteCount - betScript.length - 142;
        transactionBuilder.addInput(betTxId, 0);
        transactionBuilder.addOutput(BITBOX.Address.toLegacyAddress(wallet.utxo[0].cashAddress), satoshisAfterFee);

        let tx = transactionBuilder.transaction.buildIncomplete();

        // Sign bet tx
        let sigHash = <number> tx.hashForWitnessV0(0, betScript, purseAmount, hashType);
        let clientSig = <Buffer> clientKey.sign(sigHash).toScriptSignature(hashType);

        let redeemScriptSig: number[] = []

        // client signature
        redeemScriptSig.push(clientSig.length)
        clientSig.forEach((item, index) => { redeemScriptSig.push(item); });

        // host secret
        redeemScriptSig.push(hostSecret.length);
        hostSecret.forEach((item, index) => { redeemScriptSig.push(item); });

        // client secret
        redeemScriptSig.push(clientSecret.length);
        clientSecret.forEach((item, index) => { redeemScriptSig.push(item); });

        redeemScriptSig.push(0x00); // zero is client wins mode

        if (betScript.length > 75) redeemScriptSig.push(0x4c);
        redeemScriptSig.push(betScript.length);
        betScript.forEach((item, index) => { redeemScriptSig.push(item); });
        
        let redeemScriptSigBuf = Buffer.from(redeemScriptSig);
        tx.setInputScript(0, redeemScriptSigBuf);
        
        // uncomment for viewing script hex
        // console.log("Bet redeem script hex: " + redeemScriptSig.toString('hex'));
        // console.log("Bet Script Hex: " + betScript.toString('hex'));
        console.log("Winning amount after fees: " + satoshisAfterFee);

        let hex: string = tx.toHex();
        
        let txId = await Core.sendRawTransaction(hex);
        return txId;
    }
}
