//
// Tests for Wallets
//
// Copyright 2014, BitGo, Inc.  All Rights Reserved.
//

var assert = require('assert');
var should = require('should');
var Q = require('q');

var BitGoJS = require('../../src/index');
var common = require('../../src/common');
var TestBitGo = require('../lib/test_bitgo');
var Util = require('../../src/util');

var bitcoin = BitGoJS.bitcoin;

var TEST_WALLET_LABEL = 'wallet management test';

// TODO: WORK IN PROGRESS
describe('Ethereum Wallets API:', function() {
  var bitgo;
  var wallets;
  var testWallet;      // Test will create this wallet
  var keychains = [];  // Test will create these keychains

  before(function(done) {
    bitgo = new TestBitGo();
    bitgo.initializeTestVars();
    wallets = bitgo.ethWallets();
    bitgo.authenticateTestUser(bitgo.testUserOTP(), function(err, response) {
      if (err) {
        throw err;
      }
      done();
    });
  });

  describe('List', function() {
    it('arguments', function() {
      assert.throws(function() { wallets.list({}, 'invalid'); });
      assert.throws(function() { wallets.list('invalid'); });
    });

    it('all', function(done) {
      wallets.list({}, function(err, result) {
        assert.equal(err, null);
        result.should.have.property('wallets');
        result.should.have.property('start');
        result.should.have.property('limit');
        result.should.have.property('total');

        result.start.should.equal(0);
        result.limit.should.not.equal(0);
        result.total.should.not.equal(0);
        result.wallets.length.should.not.equal(0);
        done();
      });
    });

    it('prevId', function() {
      return wallets.list({})
      .then(function(result) {
        result.should.have.property('wallets');
        result.should.have.property('start');
        result.should.have.property('limit');
        result.should.have.property('total');
        result.should.have.property('nextBatchPrevId');

        return wallets.list({prevId: result.nextBatchPrevId});
      })
      .then(function(result) {
        result.should.have.property('wallets');
        result.should.not.have.property('start'); // if you passed in the prevId start will be undefined
        result.should.have.property('limit');
        result.should.have.property('total');
      });
    });

    it('limit', function(done) {
      wallets.list({ limit: 2 }, function(err, result) {
        assert.equal(err, null);

        result.should.have.property('wallets');
        result.should.have.property('start');
        result.should.have.property('limit');
        result.should.have.property('total');

        result.start.should.equal(0);
        result.limit.should.equal(2);
        result.total.should.not.equal(0);
        result.wallets.length.should.equal(2);
        done();
      });
    });

    it('skip', function(done) {
      wallets.list({ limit: 1, skip: 2 }, function(err, result) {
        assert.equal(err, null);

        result.should.have.property('wallets');
        result.should.have.property('start');
        result.should.have.property('limit');
        result.should.have.property('total');

        result.start.should.equal(2);
        result.limit.should.equal(1);
        result.total.should.not.equal(0);
        result.wallets.length.should.equal(1);
        done();
      });
    });

    it('limit and skip', function(done) {
      wallets.list({ limit: 1, skip: 5 }, function(err, result) {
        assert.equal(err, null);

        result.should.have.property('wallets');
        result.should.have.property('start');
        result.should.have.property('limit');
        result.should.have.property('total');

        result.start.should.equal(5);
        result.limit.should.equal(1);
        result.total.should.not.equal(0);
        result.wallets.length.should.equal(1);
        done();
      });
    });
  });

  describe('Add', function() {
    before(function() {
      keychains.push(bitgo.keychains().create());
      keychains.push(bitgo.keychains().create());
    });

    it('arguments', function() {
      assert.throws(function() { wallets.add(); });
      assert.throws(function() { wallets.add('invalid'); });
      assert.throws(function() { wallets.add({}, 0); });
    });

    it('wallet', function(done) {
      var options = {
        xpub: keychains[0].xpub,
        encryptedXprv: keychains[0].xprv
      };
      bitgo.keychains().add(options, function(err, keychain) {
        assert.equal(err, null);
        assert.equal(keychain.xpub, keychains[0].xpub);
        assert.equal(keychain.encryptedXprv, keychains[0].xprv);

        var options = {
          xpub: keychains[1].xpub
        };
        bitgo.keychains().add(options, function(err, keychain) {
          assert.equal(err, null);
          assert.equal(keychain.xpub, keychains[1].xpub);

          bitgo.keychains().createBitGo({ type: 'eth' }, function(err, keychain) {
            assert(keychain.ethAddress);
            keychains.push(keychain);

            var options = {
              label: 'my wallet',
              m: 2,
              n: 3,
              addresses: keychains.map(function(k) { return k.ethAddress; })
            };
            wallets.add(options, function(err, wallet) {
              assert.equal(err, null);
              testWallet = wallet;

              assert.equal(wallet.balance(), 0);
              assert.equal(wallet.label(), 'my wallet');
              assert.equal(wallet.confirmedBalance(), 0);
              assert.equal(wallet.keychains.length, 3);
              assert.equal(bitgo.keychains().isValid({ key: wallet.keychains[0].xpub }), true);
              assert.equal(bitgo.keychains().isValid({ key: wallet.keychains[1].xpub }), true);
              assert.equal(bitgo.keychains().isValid({ key: wallet.keychains[2].xpub }), true);
              assert.equal(wallet.keychains[0].xpub, keychains[0].xpub);
              assert.equal(wallet.keychains[1].xpub, keychains[1].xpub);
              done();
            });
          });
        });
      });
    });
  });

  describe('Create wallet', function() {
    it('arguments', function() {
      assert.throws(function() { wallets.createWallet({"passphrase": TestBitGo.TEST_WALLET1_PASSCODE, "backupAddress": backupXpub}); });
      assert.throws(function() { wallets.createWallet({"passphrase": TestBitGo.TEST_WALLET1_PASSCODE, "label": TEST_WALLET_LABEL, "backupAddress": backupXpub}); });
      assert.throws(function() { wallets.createWallet({"passphrase": TestBitGo.TEST_WALLET1_PASSCODE, "label": TEST_WALLET_LABEL, "backupAddress": 123}); });
      assert.throws(function() { wallets.createWallet({"label": TEST_WALLET_LABEL, "backupAddress": backupXpub}); });
      assert.throws(function() { wallets.createWallet('invalid'); });
      assert.throws(function() { wallets.createWallet(); });
    });

    it('default create', function(done) {
      var options = {
        "passphrase": TestBitGo.TEST_WALLET1_PASSCODE,
        "label": TEST_WALLET_LABEL
      };

      bitgo.ethWallets().createWallet(options, function(err, result) {
        assert.equal(err, null);
        assert.notEqual(result, null);

        result.should.have.property('wallet');
        var wallet = result.wallet;

        assert.equal(wallet.balance(), 0);
        assert.equal(wallet.spendableBalance(), 0);
        assert.equal(wallet.label(), TEST_WALLET_LABEL);
        assert.equal(wallet.confirmedBalance(), 0);
        assert.equal(wallet.keychains.length, 3);
        assert.equal(bitgo.keychains().isValid({ key: wallet.keychains[0].xpub }), true);
        assert.equal(bitgo.keychains().isValid({ key: wallet.keychains[1].xpub }), true);
        assert.equal(bitgo.keychains().isValid({ key: wallet.keychains[2].xpub }), true);
        assert.equal(wallet.keychains[0].xpub, result.userKeychain.xpub);
        assert.equal(wallet.keychains[1].xpub, result.backupKeychain.xpub);

        result.userKeychain.should.have.property('encryptedXprv');
        result.backupKeychain.should.not.have.property('encryptedXprv');
        result.backupKeychain.should.have.property('xprv');
        result.warning.should.include('backup the backup keychain -- it is not stored anywhere else');

        wallet.delete({}, function() {});
        done();
      });
    });

    it('create with cold backup eth address', function(done) {

      // Simulate a cold backup key
      var coldBackupKey = bitgo.keychains().create();
      var options = {
        "passphrase": TestBitGo.TEST_WALLET1_PASSCODE,
        "label": TEST_WALLET_LABEL,
        "backupAddress": Util.xpubToEthAddress(coldBackupKey.xpub)
      };

      bitgo.ethWallets().createWallet(options, function(err, result) {
        assert.equal(err, null);
        assert.notEqual(result, null);

        result.should.have.property('wallet');
        var wallet = result.wallet;

        assert.equal(wallet.balance(), 0);
        assert.equal(wallet.label(), TEST_WALLET_LABEL);
        assert.equal(wallet.confirmedBalance(), 0);
        assert.equal(wallet.keychains.length, 3);
        assert.equal(bitgo.keychains().isValid({ key: wallet.keychains[0].xpub }), true);
        assert.equal(bitgo.keychains().isValid({ key: wallet.keychains[1].xpub }), true);
        assert.equal(bitgo.keychains().isValid({ key: wallet.keychains[2].xpub }), true);
        assert.equal(wallet.keychains[0].xpub, result.userKeychain.xpub);
        assert.equal(wallet.keychains[1].xpub, result.backupKeychain.xpub);

        assert.equal(result.backupKeychain.xpub, coldBackupKey.xpub);

        result.userKeychain.should.have.property('encryptedXprv');
        result.backupKeychain.should.have.property('xpub');
        result.backupKeychain.should.not.have.property('xprv');
        result.backupKeychain.should.not.have.property('encryptedXprv');

        wallet.delete({}, function() {});
        done();
      });
    });

    it('create with backup xpub provider (KRS wallet)', function(done) {
      var options = {
        "passphrase": TestBitGo.TEST_WALLET1_PASSCODE,
        "label": TEST_WALLET_LABEL,
        "backupXpubProvider": "keyvault-io"
      };

      bitgo.ethWallets().createWallet(options, function(err, result) {
        assert.equal(err, null);
        assert.notEqual(result, null);

        result.should.have.property('wallet');
        var wallet = result.wallet;

        assert.equal(wallet.balance(), 0);
        assert.equal(wallet.spendableBalance(), 0);
        assert.equal(wallet.label(), TEST_WALLET_LABEL);
        assert.equal(wallet.confirmedBalance(), 0);
        assert.equal(wallet.keychains.length, 3);
        assert.equal(bitgo.keychains().isValid({ key: wallet.keychains[0].xpub }), true);
        assert.equal(bitgo.keychains().isValid({ key: wallet.keychains[1].xpub }), true);
        assert.equal(bitgo.keychains().isValid({ key: wallet.keychains[2].xpub }), true);
        assert.equal(wallet.keychains[0].xpub, result.userKeychain.xpub);
        assert.equal(wallet.keychains[1].xpub, result.backupKeychain.xpub);

        result.userKeychain.should.have.property('encryptedXprv');
        result.backupKeychain.should.not.have.property('encryptedXprv');
        result.should.not.have.property('warning');

        result.wallet.canSendInstant().should.eql(true);

        wallet.delete({}, function() {});
        done();
      });
    });
  });

  describe('Get', function() {
    it('arguments', function() {
      assert.throws(function() { wallets.get(); });
      assert.throws(function() { wallets.get('invalid'); });
      assert.throws(function() { wallets.get({}, function() {}); });
    });

    it('non existent wallet', function(done) {
      var options = {
        id: '0xUnsupportedWalletId'
      };
      wallets.get(options, function(err, wallet) {
        assert(!wallet);
        done();
      });
    });

    it('get', function(done) {
      var options = {
        id: testWallet.id()
      };
      wallets.get(options, function(err, wallet) {
        assert.equal(err, null);
        assert.equal(wallet.id(), options.id);
        assert.equal(wallet.balance(), 0);
        assert.equal(wallet.label(), 'my wallet');
        assert.equal(wallet.confirmedBalance(), 0);
        assert.equal(wallet.unconfirmedReceives(), 0);
        assert.equal(wallet.unconfirmedSends(), 0);
        assert.equal(wallet.approvalsRequired(), 1);
        assert.equal(wallet.keychains.length, 3);
        assert.equal(bitgo.keychains().isValid({ key: wallet.keychains[0] }), true);
        assert.equal(bitgo.keychains().isValid({ key: wallet.keychains[1] }), true);
        assert.equal(bitgo.keychains().isValid({ key: wallet.keychains[2] }), true);
        done();
      });
    });
  });

  describe('Delete', function() {
    it('arguments', function(done) {
      assert.throws(function() { testWallet.delete({}, 'invalid'); });
      done();
    });

    it('delete', function(done) {
      testWallet.delete({}, function(err, status) {
        assert.equal(err, null);
        done();
      });
    });
  });
});
