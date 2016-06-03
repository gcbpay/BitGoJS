//
// Tests for Wallet
//
// Copyright 2014, BitGo, Inc.  All Rights Reserved.
//

var assert = require('assert');
var should = require('should');

var BitGoJS = require('../../src/index');
var TestBitGo = require('../lib/test_bitgo');

var TEST_ADDRESS1 = '0x8ce4949d8a16542d423c17984e6739fa72ceb177';
var TEST_MANYTRANSACTIONSADDRESS = '0x8ce4949d8a16542d423c17984e6739fa72ceb177';

var TEST_TRANSACTION = '0xc0c1c720bc5b3583ad3a4075730b44c0c120a0fe660e51817f8c857bf37dbec0';

var TEST_BLOCK = '0xbee4330cdd56d2bcc47fa42e52e3c089c649b209acc0ae5611f6c7bc7c0b350e';

// TODO: WORK IN PROGRESS
describe('Ethereum Blockchain API:', function() {
  var bitgo;
  var blockchain;

  before(function(done) {
    BitGoJS.setNetwork('testnet');

    bitgo = new TestBitGo();
    bitgo.initializeTestVars();
    blockchain = bitgo.eth().blockchain();
    done();
  });

  describe('Get Address', function() {
    it('arguments', function(done) {
      assert.throws(function() { blockchain.getAddress('invalid', function() {}); });
      assert.throws(function() { blockchain.getAddress({}); });
      done();
    });

    it('get', function(done) {
      blockchain.getAddress({address: TEST_ADDRESS1}, function(err, address) {
        assert.equal(err, null);
        address.should.have.property('address');
        address.should.have.property('balance');

        done();
      });
    });
  });

  describe('Get Address Transactions', function() {
    it('arguments', function(done) {
      assert.throws(function() { blockchain.getAddressTransactions('invalid', function() {}); });
      assert.throws(function() { blockchain.getAddressTransactions({}); });
      done();
    });

    it('list', function(done) {
      var options = { address: TEST_ADDRESS1 };
      blockchain.getAddressTransactions(options, function(err, result) {
        assert.equal(err, null);
        assert.equal(Array.isArray(result.transactions), true);
        assert.equal(result.start, 0);
        result.should.have.property('total');
        result.should.have.property('count');
        done();
      });
    });

    it('list_many_transactions', function(done) {
      var options = { address: TEST_MANYTRANSACTIONSADDRESS };
      blockchain.getAddressTransactions(options, function(err, result) {
        assert.equal(err, null);
        assert.equal(Array.isArray(result.transactions), true);
        assert.equal(result.start, 0);
        result.should.have.property('total');
        result.should.have.property('count');
        assert(result.transactions.length > 20);
        assert.equal(result.transactions.length, result.count);
        assert(result.total > 75);
        done();
      });
    });
  });

  describe('Get Transaction', function() {
    it('arguments', function(done) {
      assert.throws(function() { blockchain.getTransaction('invalid', function() {}); });
      assert.throws(function() { blockchain.getTransaction({}); });
      assert.throws(function() { blockchain.getTransaction({}, function() {}); });
      done();
    });

    it('get', function(done) {
      blockchain.getTransaction({id: TEST_TRANSACTION}, function(err, transaction) {
        assert.equal(err, null);
        transaction.should.have.property('id');
        transaction.should.have.property('date');
        transaction.should.have.property('entries');
        assert.equal(Array.isArray(transaction.entries), true);
        assert.equal(transaction.entries.length, 3);
        var transactionEntry = transaction.entries[0];
        transactionEntry.should.have.property('account');
        transactionEntry.should.have.property('value');

        done();
      });
    });
  });

  describe('Get Block', function() {
    it('arguments', function(done) {
      assert.throws(function() { blockchain.getBlock('invalid', function() {}); });
      assert.throws(function() { blockchain.getBlock({}); });
      assert.throws(function() { blockchain.getBlock({}, function() {}); });
      done();
    });

    it('get', function(done) {
      blockchain.getBlock({id: TEST_BLOCK}, function(err, block) {
        assert.equal(err, null);
        block.should.have.property('height');
        block.should.have.property('date');
        block.should.have.property('previous');
        block.should.have.property('transactions');
        block.height.should.eql(326945);
        block.previous.should.eql('00000000eecd159babde9b094c6dbf1f4f63028ba100f6f092cacb65f04afc46');
        block.transactions.should.include('e393422e5a0b4c011f511cf3c5911e9c09defdcadbcf16ceb12a47a80e257aaa');
        done();
      });
    });
  });
});
