import BITBOXCli from 'bitbox-cli/lib/bitbox-cli';
let BITBOX = new BITBOXCli();

// let TransactionBuilder = require('bitbox-cli/lib/TransactionBuilder').default;
// import { ITransactionBuilder } from 'bitbox-cli/lib/TransactionBuilder';

let bip68 = require('bip68');

import { Utils } from './utils';

export interface WalletKey {
    wif: string,
    pubkey: Buffer,
    address: string,
    utxo?: any
}

export interface BetState {
    phase: number,
    amount?: number,
    hostCommitment?: Buffer, 
    betId?: string,
    secret?: Buffer,
    secretCommitment?: Buffer,
    clientTxId?: string,
    hostMultisigPubKey?: Buffer,
	hostP2SHTxId?: string,

	// host only side
	clientmultisigPubKey?: Buffer,
	clientCommitment?: Buffer,
	clientP2SHTxId?: string,
	participantSig1?: Buffer,
	participantSig2?: Buffer,
	clientSecret?: Buffer,
	
}

export interface PhaseData {
	betType: number, 
	version: number, 
	phase: number,
	op_return_txnId?: string
}

// Phase 1 - Host Advertisement
export interface Phase1Data extends PhaseData {
	// amount to bet
	amount: number,
	// 20 byte host's secret hash
	hostCommitment: Buffer, 
	// optional target client address
	address?: string
}

// Phase 2 - Client Accepts Host's offer
export interface Phase2Data extends PhaseData {
	// 32 byte Bet Txn Id
	betTxId: Buffer,
	// 33 byte public key
	multisigPubKey: Buffer, 
	// 20 byte secret hash
	secretCommitment: Buffer, 
}

// Phase 3 - Host Acknowledges client and funds escrow
export interface Phase3Data extends PhaseData { 
	// 32 byte Bet Txn Id
	betTxId: Buffer,
	// 32 byte Participant Txn Id
	participantOpReturnTxId: Buffer,
	// 32 byte Host P2SH txid
	hostP2SHTxId: Buffer,
	// 33 byte Host (Alice) multsig pubkey
	hostMultisigPubKey: Buffer
}

// Phase 4 - Client funds escrow
export interface Phase4Data extends PhaseData { 
	// 32 byte Bet Txn Id
	betTxId: Buffer,
	// 32 byte Participant Txn Id
	participantP2SHTxId: Buffer,
	// 71-72 byte Participant Signature 1
	participantSig1: Buffer,
	// 71-72 byte Participant Signature 2
	participantSig2: Buffer
}

// Phase 6 - Client sends resignation if loses.
export interface Phase6Data extends PhaseData { 
	// 32 byte Bet Txn Id
	betTxId: Buffer,
	// 32 byte Secret Value
	secretValue: Buffer
}

export class Core {
	
	// Method to get Script 32-bit integer (little-endian signed magnitude representation)
	static readScriptInt32(buffer: Buffer): number {
		var number: number;
		if(buffer.readUInt32LE(0) > 2147483647)
			number = -1 * (buffer.readUInt32LE(0) - 2147483648);
		else
			number = buffer.readUInt32LE(0);
		return number; 
	}

	// Method to check whether or not a secret value is valid
	static secretIsValid(buffer: Buffer): boolean {
		var number = this.readScriptInt32(buffer);
		if(number > 1073741823 || number < -1073741823)
			return false;
		return true;
	}

	static generateSecretNumber(): Buffer {
		var secret: Buffer = BITBOX.Crypto.randomBytes(32);
		while(!this.secretIsValid(secret)){
			secret = BITBOX.Crypto.randomBytes(32);
		}
		return secret;
	}

	static async sendRawTransaction(hex: string, retries=20): Promise<string> {
		var result: string = "";

		var i = 0;

		while(result == ""){
			result = await BITBOX.RawTransactions.sendRawTransaction(hex);
			i++;
			if (i > retries)
				throw new Error("BITBOX.RawTransactions.sendRawTransaction endpoint experienced a problem.")
			await Utils.sleep(250);
		}

		if(result.length != 64)
			console.log("An error occured while sending the transaction:\n" + result);

		return result;
	}

	static async getAddressDetailsWithRetry(address: string, retries: number = 20){
		var result;
		var count = 0;

		while(result == undefined){
			result = await BITBOX.Address.details(address);
			count++;
			if(count > retries)
				throw new Error("BITBOX.Address.details endpoint experienced a problem");

			await Utils.sleep(250);
		}

		return result;
	}

	static async getUtxoWithRetry(address: string, retries: number = 20){
		var result;
		var count = 0;

		while(result == undefined){
			result = await Core.getUtxo(address)
			count++;
			if(count > retries)
				throw new Error("BITBOX.Address.utxo endpoint experienced a problem");
			await Utils.sleep(250);
		}

		return result;
	}

	static async getUtxo(address: string) {
		return new Promise( (resolve, reject) => {
			BITBOX.Address.utxo(address).then((result: any) => { 
				resolve(result)
			}, (err: any) => { 
				console.log(err)
				reject(err)
			})
		})
	}

	static purseAmount(betAmount: number): number {
		let byteCount = BITBOX.BitcoinCash.getByteCount({ P2PKH: 1 }, { P2SH: 1 });
		return (betAmount * 2 ) - byteCount - 750;
	}


	static decodePhaseData(bufArray: (Buffer)[], networkByte: number = 0x00): Phase1Data | Phase2Data | Phase3Data | Phase4Data| Phase6Data {

		let result: Phase1Data | Phase2Data | Phase3Data | Phase3Data | Phase4Data | Phase6Data;

		// convert op_return buffer to hex string
		//op_return = op_return.toString('hex');

		// split the op_return payload and get relavant data
		//let data = op_return.split("04004245544c"); // pushdata (0x04) + Terab ID + pushdata (0x4c)
		//let buf = Buffer.from(data[0].trim(), 'hex');  // NOTE: the index of data was changed to 0 due to MessageFeed listen method.

		// grab the common fields
		//var results: PhaseData;
		try 
		{
			let version = bufArray[0].slice(0,1).readUInt8(0);
			let betType = bufArray[0].slice(1,2).readUInt8(0);
			let phase = bufArray[0].slice(2,3).readUInt8(0);
			//results = { betType: betType, version: version, phase: phase };
	
			// Phase 1 specific fields
			if(phase === 1) {
				let phase1Result: Phase1Data = { 
					betType: betType, 
					version: version, 
					phase: phase,
					amount: parseInt(bufArray[1].toString('hex'), 16),
					hostCommitment: bufArray[2]
				};
	
				// Target address (as hash160 without network or sha256)
				if (bufArray.length > 3){ 
					var pkHash160 = bufArray[3];
					phase1Result.address = Utils.hash160_2_cashAddr(pkHash160, networkByte);
				}
	
				result = phase1Result;
	
			// Phase 2 specific fields
			} else if(phase === 2) {
				let phase2Result: Phase2Data = {
					betType: betType, 
					version: version, 
					phase: phase,
					betTxId: bufArray[1],
					multisigPubKey: bufArray[2],
					secretCommitment: bufArray[3]
				};
	
				result = phase2Result;
	
			// Phase 3  specific fields
			} else if(phase === 3) {
	
				let phase3Result: Phase3Data = {
					betType: betType, 
					version: version, 
					phase: phase,
					betTxId: bufArray[1],
					participantOpReturnTxId: bufArray[2],
					hostP2SHTxId: bufArray[3],
					hostMultisigPubKey: bufArray[4]
				};
	
				result = phase3Result;
	
			//Phase 4 specific fields
			} else if(phase === 4) {
	
				let phase4Result: Phase4Data = {
					betType: betType, 
					version: version, 
					phase: phase,
					betTxId: bufArray[1],
					participantP2SHTxId: bufArray[2],
					participantSig1: bufArray[3],
					participantSig2: bufArray[4]
				}
	
				result = phase4Result;
	
			// Phase 6 specific fields
			} else if(phase === 6) {
				let phase6Result: Phase6Data = {
					betType: betType, 
					version: version, 
					phase: phase,
					betTxId: bufArray[1],
					secretValue: bufArray[2]
				}
	
				result = phase6Result;
			}
			else { 
				throw new Error("Phase not detected during decoding bet message data.")
			}
		}
		catch(e){
			throw new Error("Unable to decode OP_RETURN message with same protocol identifier.")
		}

		return result;
	}

	static async createOP_RETURN(wallet: any, op_return_buf: Buffer) {
		
		// THIS MAY BE BUGGY TO HAVE THIS HERE
		//wallet.utxo = await this.getUtxo(wallet.address);
		
		//return new Promise((resolve, reject) => {
		let transactionBuilder = new BITBOX.TransactionBuilder('bitcoincash'); 
		let hashType = transactionBuilder.hashTypes.SIGHASH_ALL;

		let totalUtxo = 0;
		wallet.utxo.forEach((item: any, index: any) => { 
			transactionBuilder.addInput(item.txid, item.vout); 
			totalUtxo += item.satoshis;
		});

		let byteCount = BITBOX.BitcoinCash.getByteCount({ P2PKH: wallet.utxo.length }, { P2SH: 0 }) + op_return_buf.length + 100;
		let satoshisAfterFee = totalUtxo - byteCount

		transactionBuilder.addOutput(op_return_buf, 0);        				        // OP_RETURN Message 
		transactionBuilder.addOutput(BITBOX.Address.toLegacyAddress(wallet.utxo[0].cashAddress), satoshisAfterFee); // Change 
		//console.log("txn fee: " + byteCount);
		//console.log("satoshis left: " + satoshisAfterFee);
		let key = BITBOX.ECPair.fromWIF(wallet.wif);

		let redeemScript: Buffer;
		wallet.utxo.forEach((item: any, index: number) => {
			transactionBuilder.sign(index, key, redeemScript, hashType, item.satoshis);
		});

		let hex = transactionBuilder.build().toHex();

		//console.log("Create op_return message hex:", hex);

		let txId = await Core.sendRawTransaction(hex);
		return txId;
	}

	static async createEscrow(wallet: any, script: Buffer, betAmount: number){
		
		//return new Promise( (resolve, reject) => {
		let transactionBuilder = new BITBOX.TransactionBuilder('bitcoincash');
		let hashType = transactionBuilder.hashTypes.SIGHASH_ALL | transactionBuilder.hashTypes.SIGHASH_ANYONECANPAY;

		let totalUtxo = 0;
		wallet.utxo.forEach((item: any, index: any) => { 
			transactionBuilder.addInput(item.txid, item.vout); 
			totalUtxo += item.satoshis;
		});

		let byteCount = BITBOX.BitcoinCash.getByteCount({ P2PKH: wallet.utxo.length }, { P2SH: 1 }) + 50;
		let satoshisAfterFee = totalUtxo - byteCount - betAmount

		let p2sh_hash160 = BITBOX.Crypto.hash160(script);
		let p2sh_hash160_hex = p2sh_hash160.toString('hex');
		let scriptPubKey = BITBOX.Script.scriptHash.output.encode(p2sh_hash160);

		let escrowAddress = BITBOX.Address.toLegacyAddress(BITBOX.Address.fromOutputScript(scriptPubKey));
		let changeAddress = BITBOX.Address.toLegacyAddress(wallet.utxo[0].cashAddress);
		// console.log("escrow address: " + address);
		// console.log("change satoshi: " + satoshisAfterFee);
		// console.log("change bet amount: " + betAmount);

		transactionBuilder.addOutput(escrowAddress, betAmount);
		transactionBuilder.addOutput(changeAddress, satoshisAfterFee);
		//console.log("Added escrow outputs...");

		let key = BITBOX.ECPair.fromWIF(wallet.wif);

		let redeemScript: Buffer;
		wallet.utxo.forEach((item: any, index: any) => {
			transactionBuilder.sign(index, key, redeemScript, hashType, item.satoshis);
		});
		//console.log("signed escrow inputs...");

		let hex = transactionBuilder.build().toHex();
		//console.log("built escrow...");

		let txId = await Core.sendRawTransaction(hex);
		return txId;
    }
    
    static async redeemEscrowToEscape(wallet: any, redeemScript: Buffer, txid: Buffer, betAmount: number){
        
        //return new Promise( (resolve, reject) => {
    
		let hostKey = BITBOX.ECPair.fromWIF(wallet.wif)
		//let participantKey = BITBOX.ECPair.fromWIF(client.wif)
		let transactionBuilder = new BITBOX.TransactionBuilder('bitcoincash');

		let hashType = 0xc1 // transactionBuilder.hashTypes.SIGHASH_ANYONECANPAY | transactionBuilder.hashTypes.SIGHASH_ALL
		let byteCount = BITBOX.BitcoinCash.getByteCount({ P2PKH: 1 }, { P2SH: 1 });
		let satoshisAfterFee = betAmount - byteCount - 350;

		// NOTE: must set the Sequence number below
		transactionBuilder.addInput(txid, 0, bip68.encode({ blocks: 1 })); // No need to worry about sweeping the P2SH address.      
		transactionBuilder.addOutput(BITBOX.Address.toLegacyAddress(wallet.utxo[0].cashAddress), satoshisAfterFee);

		let tx = transactionBuilder.transaction.buildIncomplete();

		let signatureHash = tx.hashForWitnessV0(0, redeemScript, betAmount, hashType);
		let hostSignature = hostKey.sign(signatureHash).toScriptSignature(hashType);
		//let participantSignature = participantKey.sign(signatureHash).toScriptSignature(hashType);

		let redeemScriptSig: any = []; // start by pushing with true for makeBet mode

		// host signature
		redeemScriptSig.push(hostSignature.length);
		hostSignature.forEach((item: number, index: number) => { redeemScriptSig.push(item); });

		// push mode onto stack for MakeBet mode
		redeemScriptSig.push(0x00); //use 0 for escape mode

		if (redeemScript.length > 75) redeemScriptSig.push(0x4c);
		redeemScriptSig.push(redeemScript.length);
		redeemScript.forEach((item, index) => { redeemScriptSig.push(item); });
		
		redeemScriptSig = Buffer.from(redeemScriptSig);
		
		let redeemScriptSigHex = redeemScriptSig.toString('hex');
		let redeemScriptHex = redeemScript.toString('hex');
		
		tx.setInputScript(0, redeemScriptSig);
		let hex = tx.toHex();
		
		let txId = await Core.sendRawTransaction(hex);

		return txId;
	}
}