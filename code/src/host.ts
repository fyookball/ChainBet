import BITBOXCli from 'bitbox-cli/lib/bitbox-cli';
let BITBOX = new BITBOXCli();

let base58 = require('bs58');
import { Utils } from './utils';

export class Host {
	constructor(){}

	// Phase 1: Bet Offer Announcement
	static encodePhase1Message(amount: number, hostCommitment: Buffer, targetAddress?: string): Buffer {
		
		let script = [
			BITBOX.Script.opcodes.OP_RETURN,
			// 4 byte prefix
			Buffer.from('00424554', 'hex'),
			// 1 byte version id / 1 betType byte /  1 phase byte
			Buffer.from('010101', 'hex'),
			// add 8 byte amount
			Utils.amount_2_hex(amount),
			// add 20 byte host commitment
			hostCommitment
		];
		
		// add optional 20 byte target address (encode in HASH160 hexidecimal form)
		if(targetAddress != undefined) {
			
			if(BITBOX.Address.isLegacyAddress(targetAddress)) {
				// do nothing
			} else if(BITBOX.Address.isCashAddress(targetAddress)){
				// convert to legacy address
				targetAddress = BITBOX.Address.toLegacyAddress(targetAddress);
			} else
				throw new Error("Unsupported address format provided");

			// convert from legacy address to binary   
			var addrBuf = Buffer.from(base58.decode(targetAddress), 'hex');

			// chop off network byte and 4 checksum bytes
			let hash160 = addrBuf.slice(1,21);
			script.push(hash160);
		}

		let encoded = BITBOX.Script.encode(script);
		//let asm = BITBOX.Script.toASM(encoded);
		return encoded;
	}

	// Phase 3: Bet Host Funding
	static encodePhase3Message(betId: string, participantTxId: string, hostP2SHTxId: string, hostMultisigPubKey: Buffer): Buffer {
	
		let script = [
			BITBOX.Script.opcodes.OP_RETURN,
			// 4 byte prefix
			Buffer.from('00424554', 'hex'),
			// 1 byte version id / 1 betType byte /  1 phase byte
			Buffer.from('010103', 'hex'),
			// 32 byte bet tx id
			Buffer.from(betId, 'hex'),
			// 32 byte participant tx id
			Buffer.from(participantTxId, 'hex'),
			// 32 byte host P2SH id
			Buffer.from(hostP2SHTxId, 'hex'),
			// 33 byte host (Alice) Multisig Pub Key
			hostMultisigPubKey
		];

		return BITBOX.Script.encode(script)
	}
}