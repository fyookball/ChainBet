import BITBOXCli from 'bitbox-cli/lib/bitbox-cli';
let BITBOX = new BITBOXCli();

let node_crypto = require('crypto');
let base58 = require('bs58');

export class Utils {

	static getNewPrivKeyWIF() {

		var wif: string;
		var n = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
							0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFE,
							0xBA, 0xAE, 0xDC, 0xE6, 0xAF, 0x48, 0xA0, 0x3B,
							0xBF, 0xD2, 0x5E, 0x8C, 0xD0, 0x36, 0x41, 0x41]);

		var isValid = false;
		var pk = new Buffer(0);

		while (!isValid) {
			pk = BITBOX.Crypto.randomBytes(32);

			if(Buffer.compare(n, pk)){
				isValid = true;
			}
		}

		// add 0x01 to priv key for WIF-compressed format
		pk = Buffer.concat([pk, Buffer.from('01', 'hex')])

		// add wif-compressed version prefix (0x80) before calculating checksum
		let preHash = Buffer.concat([ Buffer.from('80', 'hex'), pk ]);

		// get hash and append 4 byte checksum
		let hash1 = node_crypto.createHash('sha256');
		let hash2 = node_crypto.createHash('sha256');
		hash1.update(preHash);
		hash2.update(hash1.digest());
		let checksum = hash2.digest().slice(0,4);
		let wifBuf = Buffer.concat([preHash, checksum]);

		// get base58 encoded
		wif = base58.encode(wifBuf);

		return wif;
	}

	// get big-endian hex from satoshis
	static amount_2_hex(amount: number): Buffer {
		var hex = amount.toString(16)
		const len = hex.length
		for (let i = 0; i < 16 - len; i++) {
		hex = '0' + hex;
		}
		let buf = Buffer.from(hex, 'hex');
		return buf
	}

	static hash160_2_cashAddr(pkHash160: Buffer, networkByte: number): string {
		// handle the network byte prefix
		let pkHash160Hex = pkHash160.toString('hex');
		let networkHex = Buffer.from([networkByte]).toString('hex');

		// calculate checksum and 
		// add first 4 bytes from double sha256
		let hash1 = node_crypto.createHash('sha256');
		let hash2 = node_crypto.createHash('sha256');
		hash1.update(Buffer.from(networkHex + pkHash160Hex, 'hex'));
		hash2.update(hash1.digest());
		let checksum = hash2.digest().slice(0,4).toString('hex');
		let addressBuf = Buffer.from(networkHex + pkHash160Hex + checksum, 'hex')
		let hex = addressBuf.toString('hex')
		let addressBase58 = base58.encode(addressBuf)
		
		return BITBOX.Address.toCashAddress(addressBase58);
	}
	
    static sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
	}

}