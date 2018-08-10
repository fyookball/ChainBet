import { Utils } from './utils';
import * as assert from 'assert';
import 'mocha';

describe('#amount_2_Hex', () => {
    it(`should convert number amount to 8 byte hex big-endian`, () => {
        let amount = 10000000000 // 100 BCH
        let hex = Utils.amount_2_hex(amount)
        assert.equal(hex.toString('hex'), '00000002540be400');
    });
});

describe('#hash160_2_cashAddr', () => {
    it(`should convert public key hash160 to bitcoin cash address format`, () => {
        let expected_address = 'bitcoincash:qzs02v05l7qs5s24srqju498qu55dwuj0cx5ehjm2c';
        let actual_pkHash160 = Buffer.from('a0f531f4ff810a415580c12e54a7072946bb927e', 'hex');
        let networkByte = 0x00;
        let actual_address = Utils.hash160_2_cashAddr(actual_pkHash160, networkByte);
        assert.equal(actual_address, expected_address);
    });
});