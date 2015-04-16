var Q = require('q');
var bitgo = require('../');
var ledger = require('ledger-api');
var dongle;
var remote;
if (process.env.LEDGER_PIN.length !== 4) {
  throw new Error('You need to se the LEDGER_PIN environment variable to be your ledger PIN');
}
ledger.Utils.getFirstDongle_async().
then(function(res) { 
  dongle = res;
  return dongle.verifyPin_async(new ledger.ByteString(process.env.LEDGER_PIN, ledger.GP.ASCII));
}).
then(function(res) {
  remote = new bitgo.BitGo(false);
  return Q.ninvoke(remote, "authenticate", {'username':process.argv[2], 'password':process.argv[3], 'otp':process.argv[4]});
}).
then(function(res) {
  return Q.ninvoke(remote.wallets(), "createWalletWithKeychainsLedger", {'ledger':dongle, 'label':'test'});
}).
then(function(res) {
  console.log(res);
}).
fail(function(err) {
  console.log("FAIL");
  console.log(err);
})
