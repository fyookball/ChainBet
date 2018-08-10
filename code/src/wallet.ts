import BITBOXCli from 'bitbox-cli/lib/bitbox-cli';
let BITBOX = new BITBOXCli();


import { Core } from './core';
import { AddressDetailsResult } from 'bitbox-cli/lib/Address';

export class Wallet {

	static async listAddressDetails(wallet: any): Promise<void>{
		for (let i = 0; i < wallet.length; i++) {
            let ecpair = BITBOX.ECPair.fromWIF(wallet[i].wif);
			let address = BITBOX.ECPair.toCashAddress(ecpair);
			console.log("\nChecking " + address + "...");
            let details = <AddressDetailsResult> await Core.getAddressDetailsWithRetry(address);
			console.log("balance (sat): " + (details.balanceSat + details.unconfirmedBalanceSat));
			console.log("Unconfirmed Txns: " + details.unconfirmedTxApperances);
        }
	}

    static async selectViableWIF(wallet: any[]): Promise<string> {

		for (let i = 0; i < wallet.length; i++) {

            let ecpair = BITBOX.ECPair.fromWIF(wallet[i].wif);
			let address = BITBOX.ECPair.toCashAddress(ecpair);
			console.log("\nChecking " + address + "...");
            let details = <AddressDetailsResult> await Core.getAddressDetailsWithRetry(address);
			console.log("balance (sat): " + (details.balanceSat + details.unconfirmedBalanceSat));
			console.log("Unconfirmed Txns: " + details.unconfirmedTxApperances);
			
            if(details.unconfirmedTxApperances < 15 && (details.balanceSat + details.unconfirmedBalanceSat > 3000)) {
                return wallet[i].wif;
			}
        }

        throw new Error("No viable WIF found in wallet.");
    }

	static async sweepToAddress(wallet: any, destinationAddress: string): Promise<void> {

		for (let i = 0; i < wallet.length; i++) {
			let ecpair = BITBOX.ECPair.fromWIF(wallet[i].wif);
			let address = BITBOX.ECPair.toCashAddress(ecpair);
			console.log("Checking address: " + address + "...");
			wallet[i].utxo = await Core.getUtxoWithRetry(address);
	
			//return new Promise( (resolve, reject) => {
			let transactionBuilder = new BITBOX.TransactionBuilder('bitcoincash');
			let hashType = transactionBuilder.hashTypes.SIGHASH_ALL;
	
			let totalUtxo = 0;
			wallet[i].utxo.forEach((item: any, index: any) => { 
				transactionBuilder.addInput(item.txid, item.vout); 
				totalUtxo += item.satoshis;
			});
	
			if(totalUtxo > 0) {
				let byteCount = BITBOX.BitcoinCash.getByteCount({ P2PKH: wallet[i].utxo.length }, { P2SH: 0 }) + 50;
				let satoshisAfterFee = totalUtxo - byteCount;
		
				// let p2sh_hash160 = BITBOX.Crypto.hash160(script);
				// let p2sh_hash160_hex = p2sh_hash160.toString('hex');
				// let scriptPubKey = BITBOX.Script.scriptHash.output.encode(p2sh_hash160);
		
				//let escrowAddress = BITBOX.Address.toLegacyAddress(BITBOX.Address.fromOutputScript(scriptPubKey));
				//let changeAddress = BITBOX.Address.toLegacyAddress(destinationAddress);
				// console.log("escrow address: " + address);
				// console.log("change satoshi: " + satoshisAfterFee);
				// console.log("change bet amount: " + betAmount);
		
				//transactionBuilder.addOutput(escrowAddress, betAmount);
				transactionBuilder.addOutput(destinationAddress, satoshisAfterFee);
				//console.log("Added escrow outputs...");
		
				//let key = BITBOX.ECPair.fromWIF(wallet.wif);
		
				let redeemScript: Buffer;
				wallet[i].utxo.forEach((item: any, index: any) => {
					transactionBuilder.sign(index, ecpair, redeemScript, hashType, item.satoshis);
				});
				//console.log("signed escrow inputs...");
		
				let hex = transactionBuilder.build().toHex();
				//console.log("built escrow...");
		
				let txId = await Core.sendRawTransaction(hex);
				console.log("SENT " + totalUtxo + " FROM " + address + " TO " + destinationAddress);
				console.log("(txn: " + txId + ")");
			}
			else {
				console.log("No funds at " + address);
			}
		}
		console.log("Done withdrawing funds from wallet");
	}
	
	static async checkSufficientBalance(address: string) {
		let addrDetails = <AddressDetailsResult> await Core.getAddressDetailsWithRetry(address);
		
		if ((addrDetails.unconfirmedBalanceSat <= 0 && addrDetails.balanceSat == 0) || 
			(addrDetails.unconfirmedBalanceSat + addrDetails.balanceSat == 0)) {
			console.log("\nThe address provided has a zero balance... please add funds to this address.");
			return false;
		}

		console.log("\nconfirmed balance (sat): " + addrDetails.balanceSat);
		console.log("unconfirmed balance (sat): " + addrDetails.unconfirmedBalanceSat);
		return true;

	}
	
	static async getConfirmedAndUnconfirmedAddressBalance(address: string){
		let addrDetails = <AddressDetailsResult> await Core.getAddressDetailsWithRetry(address);
		let total = addrDetails.balanceSat + addrDetails.unconfirmedBalanceSat;
		return total;
	}
}