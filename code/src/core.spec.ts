import { Core } from './core';
import * as assert from 'assert';
import 'mocha';

describe('#checkScriptNumberHandling', () => {
    it(`check proper handling of Script 32-bit signed integers`, () => {
        assert.equal(Core.readScriptInt32(Buffer.from('ffffff7f', 'hex')), 2147483647);
        assert.equal(Core.readScriptInt32(Buffer.from('ffffffff', 'hex')), -2147483647);
        assert.equal(Core.readScriptInt32(Buffer.from('ffffff8f', 'hex')), -268435455);
        assert.equal(Core.readScriptInt32(Buffer.from('ffffff3f', 'hex')), 1073741823);
        assert.equal(Core.readScriptInt32(Buffer.from('ffffffbf', 'hex')), -1073741823);
        assert.equal(Core.readScriptInt32(Buffer.from('00000000', 'hex')), 0);
        assert.equal(Core.readScriptInt32(Buffer.from('00000080', 'hex')), 0);
        assert.equal(Core.readScriptInt32(Buffer.from('01000000', 'hex')), 1);
        assert.equal(Core.readScriptInt32(Buffer.from('01000080', 'hex')), -1);
    });
});

describe('#checkSecretNumbers', () => {
        it(`check validity of secret numbers`, () => {
            var secret = Buffer.from('ffffff7f', 'hex');
            assert.equal(Core.secretIsValid(secret), false);

            var secret = Buffer.from('ffffffff', 'hex');
            assert.equal(Core.secretIsValid(secret), false);

            var secret = Buffer.from('ffffff3f', 'hex');
            assert.equal(Core.secretIsValid(secret), true);

            var secret = Buffer.from('ffffff8f', 'hex');
            assert.equal(Core.secretIsValid(secret), true);

            var secret = Buffer.from('ffffffbf', 'hex');
            assert.equal(Core.secretIsValid(secret), true);

            var secret = Buffer.from('00000000', 'hex');
            assert.equal(Core.secretIsValid(secret), true);

            var secret = Buffer.from('00000080', 'hex');
            assert.equal(Core.secretIsValid(secret), true);

            var secret = Buffer.from('01000000', 'hex');
            assert.equal(Core.secretIsValid(secret), true);

            var secret = Buffer.from('01000080', 'hex');
            assert.equal(Core.secretIsValid(secret), true);
        });
});