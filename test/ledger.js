var q = require('q');
var should = require('should');
var BitGoJS = require('../');
var TestBitGo = require('./lib/test_bitgo');
var Script = require('bitcoinjs-lib/src/script');
var Transaction = require('bitcoinjs-lib/src/transaction');
var Scripts = require('bitcoinjs-lib/src/scripts');
var Opcodes = require('bitcoinjs-lib/src/opcodes');
var TransactionBuilder = require('../src/transactionBuilder');
var ledger = require('ledger-api');
var bitgo;
var dongle;
var remote;
var wallet1, // normal bitgo wallet
    wallet2; // ledger bitgo wallet

if (process.env.LEDGER_PIN.length !== 4) {
  throw new Error('You need to se the LEDGER_PIN environment variable to be your ledger PIN');
}
var PIN = process.env.LEDGER_PIN;

describe('Ledger', function() {

  before(function(done) {
    // connect to ledger
    ledger.Utils.getFirstDongle_async().
    then(function(res) { 
      dongle = res;
      if (!dongle) {
        throw new Error('dongle is undefined - is your ledger connected?');
      }
      return dongle.verifyPin_async(new ledger.ByteString(PIN, ledger.GP.ASCII));
    })
    .then(function() {
      done();
    });
  });

  before(function(done) {
    BitGoJS.setNetwork('testnet');

    bitgo = new TestBitGo();
    bitgo.initializeTestVars();
    wallets = bitgo.wallets();
    bitgo.authenticateTestUser(bitgo.testUserOTP(), function(err, response) {
      if (err) {
        console.log(err);
        throw err;
      }

      // get a normal, non-ledger, bitgo wallet
      var options = {
        id: TestBitGo.TEST_WALLET1_ADDRESS
      };
      wallets.get(options, function(err, res) {
        if (err) {
          throw err;
        }
        wallet1 = res;
        done();
      });
    });
  });

  it('should create a new BitGo wallet with the ledger', function(done) {
    var remote = new BitGoJS.BitGo(false);
    return q.ninvoke(remote, "authenticate", {'username': TestBitGo.TEST_SHARED_KEY_USER, 'password': TestBitGo.TEST_SHARED_KEY_PASSWORD, 'otp': '0000000'})
    .then(function(res) {
      return q.ninvoke(remote.wallets(), "createWalletWithKeychainsLedger", {'ledger': dongle, 'label': 'test'});
    })
    .then(function(res) {
      should.exist(res.wallet);
      should.exist(res.userKeychain.ledgerPath);
      res.userKeychain.ledgerPath.should.equal("44'/0'");
      res.userKeychain.xpub.substr(0, 4).should.equal('xpub'); // not tpub
      res.backupKeychain.xpub.substr(0, 4).should.equal('xpub'); // not tpub
      res.bitgoKeychain.xpub.substr(0, 4).should.equal('xpub'); // not tpub
      //console.dir(res.wallet.keychains);
      done();
    })
    .fail(function(err) {
      done(new Error(err));
    });
  });

  it('should receive from and send bitcoins back to another test wallet', function(done) {
    var tx;
    var addr;
    var splitTransaction;
    var scripts;

    // create a new ledger wallet
    return q.ninvoke(bitgo.wallets(), "createWalletWithKeychainsLedger", {'ledger': dongle, 'label': 'test'})
    .then(function(res) {
      should.exist(res.wallet);
      should.exist(res.userKeychain.ledgerPath);
      res.userKeychain.ledgerPath.should.equal("44'/0'");
      res.userKeychain.xpub.substr(0, 4).should.equal('xpub'); // not tpub
      res.backupKeychain.xpub.substr(0, 4).should.equal('xpub'); // not tpub
      res.bitgoKeychain.xpub.substr(0, 4).should.equal('xpub'); // not tpub
      wallet2 = res.wallet;

      // get an address from the ledger wallet to send to
      return wallet2.createAddress({});
    })
    .then(function(res) {
      var address = res;
      address.should.have.property('path');
      address.should.have.property('redeemScript');
      address.should.have.property('address');
      address.address.substr(0, 1).should.equal('2');
      addr = address.address;

      // send to ledger wallet
      console.log('unlocking');
      return bitgo.unlock({ otp: '0000000' });
    })
    .then(function() {
      console.log('sending from wallet1 to wallet2 (addr: ' + addr + ')');
      return wallet1.sendCoins({address: addr, amount: 0.006 * 1e8, walletPassphrase: TestBitGo.TEST_WALLET1_PASSCODE});
    })
    .then(function(res) {
      res.should.have.property('tx');
      res.should.have.property('hash');
      res.should.have.property('fee');
      console.log('sent from wallet1 to wallet2');

      // get an address from the normal wallet to send back to
      return wallet1.createAddress({});
    })
    .then(function(res) {
      var address = res;
      address.should.have.property('path');
      address.should.have.property('redeemScript');
      address.should.have.property('address');
      address.address.substr(0, 1).should.equal('2');
      var addr = address.address;

      console.log('creating transaction to send from wallet2 to wallet1');

      // to send back to the normal wallet, we must next build the transaction, not yet with any signatures
      var obj = {};
      obj[addr] = 0.004 * 1e8;
      return TransactionBuilder.createTransaction(wallet2, obj, 0.001 * 1e8, undefined, 0);
    })
    .then(function(res) {
      should.exist(res.transactionHex);
      res.fee.should.equal(0.001 * 1e8);
      var txhex = res.transactionHex;
      tx = Transaction.fromHex(txhex);
      var unspents = res.unspents; //chainPath and redeemScript of each of the unspents used in the tx
      var fee = res.fee;

      console.log('createTransaction created transaction:');
      console.log(txhex);

      // Now that we have built an unsigned transaction from real unspent
      // outputs, we must sign it using the ledger. To do that, we need to
      // produce the exact inputs the ledger API's signing method wants. First,
      // the transaction itself.
      var tx_tosign = new ledger.ByteString(tx.toBuffer().toString('hex'), ledger.GP.HEX);
      splitTransaction = dongle.splitTransaction(tx_tosign);

      // It also expects an array if inputs containing the *unreversed*
      // transaction hash we are spending from for each input, alongside a 4
      // byte big endian value representing which output from that transaction
      var inputs = tx.ins.map(function(input) {
        var txhashhex = input.hash.toString('hex')
        var voutbe = new Buffer(4);
        voutbe.writeUInt32BE(input.index, 0);
        var voutbehex = voutbe.toString('hex');
        return [new ledger.ByteString(txhashhex, ledger.GP.HEX), new ledger.ByteString(voutbehex, ledger.GP.HEX)];
      });

      // We also must have the redeem scripts in the proper binary form
      scripts = unspents.map(function(unspent) {
        var script = Script.fromHex(unspent.redeemScript);
        return new ledger.ByteString(script.toBuffer().toString('hex'), ledger.GP.HEX);
      });

      // Finally, we must have the paths we need to derive from
      var paths = unspents.map(function(unspent) {
        var path = "44'/0'"; // NOT the same as BIP 44 - missing extra 0'
        path = path + "/0/0"; // extra paths added by bitgo
        path = path + unspent.chainPath; // finally, the paths leading to these particular unspent outputs
        return path;
      });

      return dongle.signP2SHTransaction_async(inputs, scripts, splitTransaction.outputs.length, splitTransaction.outputScript, paths);
    })
    .then(function(res) {
      var signatures = res;
      console.log('signatures:');
      console.dir(signatures);

      for (var i = 0; i < splitTransaction.inputs.length; i++) {
        splitTransaction.inputs[i]['script'] = dongle.formatP2SHInputScript(scripts[i], [signatures[i]]);
      }
      var txdongle = dongle.serializeTransaction(splitTransaction);
      var txhex = txdongle.toString(ledger.GP.HEX);

      console.log('sending transaction:');
      console.log(txhex);

      return wallet2.sendTransaction({tx: txhex});
    })
    .then(function(result) {
      should.exist(result.tx);
      should.exist(result.hash);

      console.log('sent transaction: ');
      console.log(result.tx);
      console.log(result.hash);
      done();
    })
    .fail(function(err) {
      done(new Error(err));
    });
    

    // get address in new wallet
    // get another test wallet
    // send testnet bitcoins from that wallet to new wallet
    // retrieve unspent outputs and build unsigned transaction sending bitcoins back to original wallet
    // sign transaction with ledger
    // broadcast transaction
  });

});
