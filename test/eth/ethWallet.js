  //
// Tests for Wallet
//
// Copyright 2014, BitGo, Inc.  All Rights Reserved.
//

var assert = require('assert');
var should = require('should');
var Q = require('q');

var BitGoJS = require('../../src/index');
var common = require('../../src/common');
var TestBitGo = require('../lib/test_bitgo');
var TransactionBuilder = require('../../src/transactionBuilder');
var unspentData = require('../fixtures/largeunspents.json');
var crypto = require("crypto");
var _ = require('lodash');
var bitcoin = BitGoJS.bitcoin;

Q.longStackTrace = true;

// TODO: WORK IN PROGRESS
describe('Ethereum Wallet API:', function() {
  var bitgo;
  var wallet1, wallet2, wallet3, safewallet;

  before(function() {
    BitGoJS.setNetwork('testnet');

    bitgo = new TestBitGo();
    bitgo.initializeTestVars();
    wallets = bitgo.eth().wallets();
    return bitgo.authenticateTestUser(bitgo.testUserOTP())
    .then(function() {
      // Fetch the first wallet.
      var options = {
        id: TestBitGo.TEST_ETH_WALLET1_ADDRESS
      };
      return wallets.get(options);
    })
    .then(function(wallet) {
      wallet1 = wallet;

      // Fetch the second wallet
      var options = {
        id: TestBitGo.TEST_ETH_WALLET2_ADDRESS
      };
      return wallets.get(options);
    })
    .then(function(wallet) {
      wallet2 = wallet;

      // Fetch the third wallet
      var options = {
        id: TestBitGo.TEST_ETH_WALLET3_ADDRESS
      };
      return wallets.get(options);
    })
    .then(function(wallet) {
      wallet3 = wallet;

      // Fetch legacy safe wallet
      var options = {
        id: TestBitGo.TEST_ETH_WALLET4_ADDRESS
      };
      return wallets.get(options);
    })
    .then(function(wallet) {
      safewallet = wallet;
    });
  });

  describe('Labels', function() {
    it('list', function() {
      // delete all labels from wallet1
      wallet1.labels({})
      .then(function(labels) {
        if (labels == null) {
          return;
        }

        labels.forEach(function(label) {
          wallet1.deleteLabel({ address: label.address }, function(err, label) {
            assert.equal(err, null);
          });
        });
      });

      // create a single label on TestBitGo.TEST_ETH_WALLET1_ADDRESS2 and check that it is returned
      return wallet1.setLabel({ label: "testLabel", address: TestBitGo.TEST_ETH_WALLET1_ADDRESS2 })
      .then(function() {
        // create a label on wallet2's TEST_ETH_WALLET2_ADDRESS to ensure that it is not returned
        return wallet2.setLabel({ label: "wallet2TestLabel", address: TestBitGo.TEST_ETH_WALLET3_ADDRESS });
      })
      .then(function() {
        return wallet1.labels({});
      })
      .then(function(labels) {
        labels.forEach(function(label) {
          label.should.have.property('label');
          label.should.have.property('address');
          label.label.should.eql("testLabel");
          label.address.should.eql(TestBitGo.TEST_ETH_WALLET1_ADDRESS2);
        });
      });
    });
  });

  describe('SetLabel', function() {

    it('arguments', function() {
      assert.throws(function() { wallet1.setLabel({}, function() {}); });
      assert.throws(function() { wallet1.setLabel({label: "testLabel"}, function() {}); });
      assert.throws(function() { wallet1.setLabel({address: TestBitGo.TEST_ETH_WALLET1_ADDRESS2}, function() {}); });
      assert.throws(function() { wallet1.setLabel({label: "testLabel", address: "invalidAddress"}, function() {}); });
      assert.throws(function() { wallet1.setLabel({label: "testLabel", address: TestBitGo.TEST_ETH_WALLET2_ADDRESS2}, function() {}); });
    });

    it('create', function() {
      return wallet1.setLabel({ label: "testLabel", address: TestBitGo.TEST_ETH_WALLET1_ADDRESS2 })
      .then(function(label) {
        label.should.have.property('label');
        label.should.have.property('address');
        label.label.should.equal("testLabel");
        label.address.should.equal(TestBitGo.TEST_ETH_WALLET1_ADDRESS2);
      });
    });
  });

  describe('Rename Wallet / Set Wallet Label', function() {

    it('arguments', function() {
      assert.throws(function() { wallet1.setLabel({}, function() {}); });
    });

    it('should rename wallet', function() {
      // generate some random string to make the rename visible in the system
      var renameIndicator = crypto.randomBytes(3).toString('hex');
      var originalWalletName = 'Even Better Test Wallet 1';
      var newWalletName = originalWalletName + '(' + renameIndicator + ')';
      return wallet1.setWalletName({ label: newWalletName })
      .then(function(result){
        result.should.have.property('id');
        result.should.have.property('label');
        result.id.should.eql(TestBitGo.TEST_ETH_WALLET1_ADDRESS);
        result.label.should.eql(newWalletName);

        // now, let's rename it back
        return wallet1.setWalletName({ label: originalWalletName });
      })
      .catch(function(err){
        // it should never be in here
        assert.equal(err, null);
      });
    });
  });

  describe('DeleteLabel', function() {

    it('arguments', function() {
      assert.throws(function() { wallet1.deleteLabel({}, function() {}); });
      assert.throws(function() { wallet1.deleteLabel({address: "invalidAddress"}, function() {}); });
    });

    it('delete', function() {
      return wallet1.deleteLabel({ address: TestBitGo.TEST_ETH_WALLET1_ADDRESS2 })
      .then(function(label) {
        label.should.have.property('address');
        label.address.should.eql(TestBitGo.TEST_ETH_WALLET1_ADDRESS2);
      });
    });
  });

  describe('Transactions', function() {
    it('arguments', function() {
      assert.throws(function() { wallet1.transactions('invalid', function() {}); });
      assert.throws(function() { wallet1.transactions({}, 'invalid'); });
    });

    var txHash0;
    it('list', function() {
      var options = {};
      return wallet1.transactions(options)
      .then(function(result) {
        assert.equal(Array.isArray(result.transactions), true);
        // result.should.have.property('total');
        result.should.have.property('count');
        result.start.should.eql(0);
        txHash0 = result.transactions[0].id;
      });
    });

    var limitedTxes;
    var limitTestNumTx = 6;
    var totalTxCount;
    it('list with limit', function() {
      var options = { limit: limitTestNumTx };
      return wallet1.transactions(options)
      .then(function(result) {
        assert.equal(Array.isArray(result.transactions), true);
        // result.should.have.property('total');
        result.should.have.property('count');
        result.start.should.eql(0);
        result.count.should.eql(limitTestNumTx);
        result.transactions.length.should.eql(result.count);
        limitedTxes = result.transactions;
        totalTxCount = result.total;
      });
    });

    it('list with minHeight', function() {

      var minHeight = 530000;
      var options = { minHeight: minHeight, limit: 500 };
      return wallet1.transactions(options)
      .then(function(result) {
        assert.equal(Array.isArray(result.transactions), true);
        // result.should.have.property('total');
        result.should.have.property('count');
        result.start.should.eql(0);
        result.transactions.length.should.eql(result.count);
        result.transactions.forEach(function(transaction) {
          if (!transaction.pending) {
            transaction.height.should.be.above(minHeight - 1);
          }
        });
        result.total.should.be.below(totalTxCount);
      });
    });


    it('list with limit and skip', function() {
      var skipNum = 2;
      var options = { limit: (limitTestNumTx - skipNum), skip: skipNum };
      return wallet1.transactions(options)
      .then(function(result){
        assert.equal(err, null);
        assert.equal(Array.isArray(result.transactions), true);
        // result.should.have.property('total');
        result.should.have.property('count');
        result.start.should.eql(skipNum);
        result.count.should.eql(limitTestNumTx - skipNum);
        result.transactions.length.should.eql(result.count);
        limitedTxes = limitedTxes.slice(skipNum);
        result.transactions.should.eql(limitedTxes);
      });
    });

    it('get transaction', function() {
      var options = { id: txHash0 };
      return wallet1.getTransaction(options)
      .then(function(result) {
        result.should.have.property('fee');
        result.should.have.property('outputs');
        result.outputs.length.should.not.eql(0);
        result.should.have.property('entries');
        result.entries.length.should.not.eql(0);
        result.should.have.property('confirmations');
        result.should.have.property('hex');
      });
    });

    it('get transaction with travel info', function() {
      var keychain;
      var options = {
        xpub: wallet1.keychains[0].xpub
      };
      return bitgo.keychains().get(options)
      .then(function(res) {
        keychain = res;
        res.xprv = bitgo.decrypt({ password: TestBitGo.TEST_ETH_WALLET3_PASSCODE, input: keychain.encryptedXprv });
        return wallet3.getTransaction({ id: TestBitGo.TRAVEL_RULE_TXID });
      })
      .then(function(tx) {
        tx.should.have.property('receivedTravelInfo');
        tx.receivedTravelInfo.should.have.length(2);
        tx = bitgo.travelRule().decryptReceivedTravelInfo({ tx: tx, keychain: keychain });
        var infos = tx.receivedTravelInfo;
        infos.should.have.length(2);
        var info = infos[0].travelInfo;
        info.fromUserName.should.equal('Alice');
        info.toEnterprise.should.equal('SDKOther');
        info = infos[1].travelInfo;
        info.fromUserName.should.equal('Bob');
      });
    });
  });

  describe('Transfers', function() {
    it('arguments', function() {
      assert.throws(function() { wallet1.transfers('invalid', function() {}); });
      assert.throws(function() { wallet1.transfers({}, 'invalid'); });
    });

    var txHash0;
    it('list', function() {
      var options = {};
      return wallet1.transfers(options)
      .then(function(result) {
        assert.equal(Array.isArray(result.transfers), true);
        result.should.have.property('total');
        // result.should.have.property('count');
        result.start.should.eql(0);
        txHash0 = result.transfers[0].id;
      });
    });
  });

  describe('Get wallet user encrypted key', function() {
    it('arguments', function(done) {
      assert.throws(function() { wallet1.getEncryptedUserKeychain(undefined, 'invalid'); });
      assert.throws(function() { wallet1.getEncryptedUserKeychain({}, 'invalid'); });
      assert.throws(function() { wallet1.transactions('invalid', function() {}); });
      done();
    });

    it('get key', function(done) {
      var options = {};
      return bitgo.unlock({ otp: '0000000' })
      .then(function() {
        return wallet1.getEncryptedUserKeychain(options);
      })
      .then(function(result) {
        result.should.have.property('xpub');
        assert.equal(result.xpub, TestBitGo.TEST_ETH_WALLET1_XPUB);
        result.should.have.property('encryptedXprv');
        done();
      });
    });
  });

  describe('Freeze Wallet', function() {
    it('arguments', function (done) {
      assert.throws(function () {
        wallet2.freeze({duration: 'asdfasdasd'});
      });
      assert.throws(function () {
        wallet2.freeze({duration: 5}, 'asdasdsa');
      });
      done();
    });

    it('perform freeze', function() {
      return wallet2.freeze({ duration: 6 })
      .then(function(freezeResult) {
        freezeResult.should.have.property('time');
        freezeResult.should.have.property('expires');
      });
    });

    it('get wallet should show freeze', function() {
      return wallet2.get({})
      .then(function(res) {
        var wallet = res.wallet;
        wallet.should.have.property('freeze');
        wallet.freeze.should.have.property('time');
        wallet.freeze.should.have.property('expires');
      });
    });
  });
});
