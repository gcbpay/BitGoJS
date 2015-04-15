var q = require('q');
var should = require('should');
var BitGoJS = require('../');
var TestBitGo = require('./lib/test_bitgo');
var ledger = require('ledger-api');
var dongle;
var remote;

if (process.env.LEDGER_PIN.length !== 4) {
  throw new Error('You need to se the LEDGER_PIN environment variable to be your ledger PIN');
}
var PIN = process.env.LEDGER_PIN;

describe('Ledger', function() {

  it('should create a new BitGo wallet with the ledger', function(done) {
    ledger.Utils.getFirstDongle_async().
    then(function(res) { 
      dongle = res;
      if (!dongle) {
        throw new Error('dongle is undefined - is your ledger connected?');
      }
      return dongle.verifyPin_async(new ledger.ByteString(PIN, ledger.GP.ASCII));
    }).
    then(function(res) {
      remote = new BitGoJS.BitGo(false);
      return q.ninvoke(remote, "authenticate", {'username':TestBitGo.TEST_SHARED_KEY_USER, 'password':TestBitGo.TEST_SHARED_KEY_PASSWORD, 'otp':'0000000'});
    }).
    then(function(res) {
      return q.ninvoke(remote.wallets(), "createWalletWithKeychainsLedger", {'ledger':dongle, 'label':'test'});
    }).
    then(function(res) {
      should.exist(res.wallet);
      should.exist(res.userKeychain.ledgerPath);
      res.userKeychain.ledgerPath.should.equal("44'/0'");
      res.userKeychain.xpub.substr(0, 4).should.equal('xpub'); // not tpub
      res.backupKeychain.xpub.substr(0, 4).should.equal('xpub'); // not tpub
      res.bitgoKeychain.xpub.substr(0, 4).should.equal('xpub'); // not tpub
      done();
    }).
    fail(function(err) {
      done(new Error(err));
    });
  });

});
