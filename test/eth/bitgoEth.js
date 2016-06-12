//
// Tests for Wallet
//
// Copyright 2014, BitGo, Inc.  All Rights Reserved.
//

var assert = require('assert');
var should = require('should');

var BitGoJS = require('../../src/index');
var TestBitGo = require('../lib/test_bitgo');
var BN = require('ethereumjs-util').BN;

// TODO: WORK IN PROGRESS
describe('Ethereum BitGo.eth:', function() {
  var bitgo;

  before(function() {
    BitGoJS.setNetwork('testnet');

    bitgo = new TestBitGo();
    bitgo.initializeTestVars();
  });

  describe('Ether to Wei conversion', function() {
    it('convert ethereum to wei', function() {
      // 0 ether
      var number = new BN('0');
      bitgo.eth().weiToEtherString(number).should.equal('0');

      // 12345 ether
      number = new BN('12345000000000000000000');
      bitgo.eth().weiToEtherString(number).should.equal('12345');

      // 1234.5 ether
      number = new BN('1234500000000000000000');
      bitgo.eth().weiToEtherString(number).should.equal('1234.5');

      // 1234.505 ether
      number = new BN('1234505000000000000000');
      bitgo.eth().weiToEtherString(number).should.equal('1234.505');
      assert.throws(function() {
        // this number should overflow
        bitgo.eth().weiToEtherString(1234505000000000000000).should.equal('1234.505');
      });

      // 123450 ether
      number = new BN('123450000000000000000000');
      bitgo.eth().weiToEtherString(number).should.equal('123450');

      // a lot of ether with wei
      number = new BN('15234212341234123412341321341234134132423443345');
      bitgo.eth().weiToEtherString(number).should.equal('15234212341234123412341321341.234134132423443345');

      number = new BN('12345');
      bitgo.eth().weiToEtherString(number).should.equal('0.000000000000012345');
    });
  });
});
