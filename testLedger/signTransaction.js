var Q = require('q');
var bitgo = require('bitgo');
var ledger = require('ledger-api');

var splitTransaction;

var TX_TOSIGN = new ledger.ByteString("0100000002f6e0cbe68499e33b4799c149dbe9d2ac928d06aea87496d9ec8614a2a27ff9710000000017a914d6dae0c99b20ea060991f8778173f42901a3a98687ffffffffbae3f97c7284c6c5c55c062a6797c23fe392c28047baaacfa296f19f966a1e170100000017a914d047433da9ccb0983b39ef41b7d780569d7218ce87ffffffff0240420f00000000001976a91496986c2703c6b311c884bf916d28621bc61e8b7a88acdc0c03000000000017a914ddf0a9f3e0c9822feef702d36dee6c0bd2bf7c6d8700000000", ledger.GP.HEX);
var UNSPENTS = [ { confirmations: 3,
    address: '2NCqGoFWfQnUSF2EX1dSkqsMQCBUEo2zq6Y',
    tx_hash: '71f97fa2a21486ecd99674a8ae068d92acd2e9db49c199473be39984e6cbe0f6',
    tx_output_n: 0,
    value: 700000,
    script: 'a914d6dae0c99b20ea060991f8778173f42901a3a98687',
    redeemScript: '52210289b4a3ad52a919abd2bdd6920d8a6879b1e788c38aa76f0440a6f32a9f1996d02103a3393b1439d1693b063482c04bd40142db97bdf139eedd1b51ffb7070a37eac321030b9a409a1e476b0d5d17b804fcdb81cf30f9b99c6f3ae1178206e08bc500639853ae',
    chainPath: '/0/1' },
  { confirmations: 3,
    address: '2NCEVubpGwVVZ8Et8EPzTViUWNVEvdbgWf1',
    tx_hash: '171e6a969ff196a2cfaaba4780c292e33fc297672a065cc5c5c684727cf9e3ba',
    tx_output_n: 1,
    value: 500000,
    script: 'a914d047433da9ccb0983b39ef41b7d780569d7218ce87',
    redeemScript: '522102afe2165371442437b86089a17e8d1c26d127e3723b19f568e9c11e326946111521032d139518b16c112d5f1a52157f1468c0b7a570c41673debee8cd2e53eb084df12103b13fe78b0320ceb77795c87ed72069f12edf64169d15f8f9827f0bb4fdbe760f53ae',
    chainPath: '/0/2' } ];

var dongle;
var remote;
ledger.Utils.getFirstDongle_async().
then(function(res) { 
  dongle = res;
  return dongle.verifyPin_async(new ledger.ByteString("1234", ledger.GP.ASCII));
}).
then(function(res) {
  splitTransaction = dongle.splitTransaction(TX_TOSIGN);
  dongle.displayTransactionDebug(splitTransaction);
  var inputs = [];
  var scripts = [];
  var inputs = [
    [ new ledger.ByteString("71f97fa2a21486ecd99674a8ae068d92acd2e9db49c199473be39984e6cbe0f6", ledger.GP.HEX),
      new ledger.ByteString("00000000", ledger.GP.HEX) ],
    [ new ledger.ByteString("171e6a969ff196a2cfaaba4780c292e33fc297672a065cc5c5c684727cf9e3ba", ledger.GP.HEX),
      new ledger.ByteString("00000001", ledger.GP.HEX) ]
  ];
  var scripts = [ 
    new ledger.ByteString("52210289b4a3ad52a919abd2bdd6920d8a6879b1e788c38aa76f0440a6f32a9f1996d02103a3393b1439d1693b063482c04bd40142db97bdf139eedd1b51ffb7070a37eac321030b9a409a1e476b0d5d17b804fcdb81cf30f9b99c6f3ae1178206e08bc500639853ae", ledger.GP.HEX),
      new ledger.ByteString("522102afe2165371442437b86089a17e8d1c26d127e3723b19f568e9c11e326946111521032d139518b16c112d5f1a52157f1468c0b7a570c41673debee8cd2e53eb084df12103b13fe78b0320ceb77795c87ed72069f12edf64169d15f8f9827f0bb4fdbe760f53ae", ledger.GP.HEX)
  ];    
  var paths = [
    "44'/0'/0'/0/0/0/1",
    "44'/0'/0'/0/0/0/2",
  ];
  return dongle.signP2SHTransaction_async(inputs, scripts, splitTransaction.outputs.length, splitTransaction.outputScript, paths);
  /*  
  return Q.fcall(function() {
    return [ new ledger.ByteString('3045022100a58e83b20da4fa8997f76b6c998b91d528c042f1238415b9df60db4a12511f8d022062f99d64388999aa1f2280919fea297622a918bcdd4c49fb7892fbb90de8935563', ledger.GP.HEX),
           new ledger.ByteString('3045022100c8a1d17960637f1558f54bc58e0d70b6b6a325865843275e212150d865dbcd3902201504524f3fd20950a431299cdb4c7f16b0499c0d824c720a138ef4a0c5b055980a', ledger.GP.HEX) ];

  });
  */
}).
then(function(res) {
  console.log(res);
  var signatures = res;
  var scripts = [ 
    new ledger.ByteString("52210289b4a3ad52a919abd2bdd6920d8a6879b1e788c38aa76f0440a6f32a9f1996d02103a3393b1439d1693b063482c04bd40142db97bdf139eedd1b51ffb7070a37eac321030b9a409a1e476b0d5d17b804fcdb81cf30f9b99c6f3ae1178206e08bc500639853ae", ledger.GP.HEX),
      new ledger.ByteString("522102afe2165371442437b86089a17e8d1c26d127e3723b19f568e9c11e326946111521032d139518b16c112d5f1a52157f1468c0b7a570c41673debee8cd2e53eb084df12103b13fe78b0320ceb77795c87ed72069f12edf64169d15f8f9827f0bb4fdbe760f53ae", ledger.GP.HEX)
  ];      
  for (var i=0; i<splitTransaction.inputs.length; i++) {
    splitTransaction.inputs[i]['script'] = dongle.formatP2SHInputScript(scripts[i], [ signatures[i] ]);
  }
  var tx = dongle.serializeTransaction(splitTransaction);
  console.log(tx.toString(ledger.GP.HEX));

}).
fail(function(err) {
  console.log("FAIL");
  console.log(err);
})
