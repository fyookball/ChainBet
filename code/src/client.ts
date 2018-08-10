import BITBOXCli from 'bitbox-cli/lib/bitbox-cli';
let BITBOX = new BITBOXCli();

export class Client {

	// Phase 2: Bet Participant Acceptance
	static encodePhase2Message(betId: string, multisigPubKey: Buffer, secretCommitment: Buffer): Buffer {

		let script = [
			BITBOX.Script.opcodes.OP_RETURN,
			// 4 byte prefix
			Buffer.from('00424554', 'hex'),
			// 1 byte version id / 1 betType byte /  1 phase byte
			Buffer.from('010102', 'hex'),
			// 32 byte betTxId hex
			Buffer.from(betId, 'hex'),
			// 33 byte participant (Bob) multisig Pub Key hex 
			multisigPubKey,
			// 32 byte participant (Bob) secret commitment
			secretCommitment
		];

		return BITBOX.Script.encode(script)
	}

	// Phase 4: Bet Participant Funding
	static encodePhase4Message(betId: string, clientEscrowTxId: string, participantSig1: Buffer, participantSig2: Buffer): Buffer {

		let script = [
			BITBOX.Script.opcodes.OP_RETURN,
			// 4 byte prefix
			Buffer.from('00424554','hex'),
			// 1 byte version id / 1 betType byte /  1 phase byte
			Buffer.from('010104', 'hex'),
			// 32 byte bet tx id
			Buffer.from(betId, 'hex'),
			// 32 byte bet tx id
			Buffer.from(clientEscrowTxId, 'hex'),
			// 71-72 bytes for sig
			participantSig1,
			// 71-72 bytes for sig
			participantSig2,
		];

		return BITBOX.Script.encode(script)
	}

	// Phase 6: Bet Participant Resignation
	static encodePhase6Message(betId: string, secretValue: Buffer): Buffer {

		let script = [
		BITBOX.Script.opcodes.OP_RETURN,
		// 4 byte prefix
		Buffer.from('00424554', 'hex'),
		// 1 byte version id / 1 betType byte /  1 phase byte
		Buffer.from('010106', 'hex'),
		// 32 byte bet txn id
		Buffer.from(betId, 'hex'),
		// 32 byte Secret value
		secretValue
	];

		return BITBOX.Script.encode(script)
	}

}