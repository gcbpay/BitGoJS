//
// Wallet Object
// BitGo accessor for a specific wallet
//
// Copyright 2014, BitGo, Inc.  All Rights Reserved.
//

var TransactionBuilder = require('../transactionBuilder');
var bitcoin = require('../bitcoin');
var Keychains = require('../keychains');
var PendingApproval = require('../pendingapproval');
var Util = require('../util');

var assert = require('assert');
var common = require('../common');
var Q = require('q');
var _ = require('lodash');

//
// Constructor
// TODO: WORK IN PROGRESS
//
var EthWallet = function(bitgo, wallet) {
  this.bitgo = bitgo;
  this.wallet = wallet;
  this.keychains = [];

  if (wallet.private) {
    this.keychains = wallet.private.keychains;
  }
};

EthWallet.prototype.toJSON = function() {
  return this.wallet;
};

//
// id
// Get the id of this wallet.
//
EthWallet.prototype.id = function() {
  return this.wallet.id;
};

//
// label
// Get the label of this wallet.
//
EthWallet.prototype.label = function() {
  return this.wallet.label;
};

//
// balance
// Get the balance of this wallet.
//
EthWallet.prototype.balance = function() {
  return this.wallet.balance;
};

//
// balance
// Get the spendable balance of this wallet.
// This is the total of all unspents except those that are unconfirmed and external
//
EthWallet.prototype.spendableBalance = function() {
  return this.wallet.spendableBalance;
};

//
// confirmedBalance
// Get the confirmedBalance of this wallet.
//
EthWallet.prototype.confirmedBalance = function() {
  return this.wallet.confirmedBalance;
};

//
// unconfirmedSends
// Get the balance of unconfirmedSends of this wallet.
//
EthWallet.prototype.unconfirmedSends = function() {
  return this.wallet.unconfirmedSends;
};

//
// unconfirmedReceives
// Get the balance of unconfirmedReceives balance of this wallet.
//
EthWallet.prototype.unconfirmedReceives = function() {
  return this.wallet.unconfirmedReceives;
};

//
// type
// Get the type of this wallet, e.g. 'safehd'
//
EthWallet.prototype.type = function() {
  return this.wallet.type;
};

EthWallet.prototype.url = function(extra) {
  extra = extra || '';
  return this.bitgo.url('/eth/wallet/' + this.id() + extra);
};

//
// get
// Refetches this wallet and returns it
//
EthWallet.prototype.get = function(params, callback) {
  params = params || {};
  common.validateParams(params, [], [], callback);

  var self = this;

  return this.bitgo.get(this.url())
  .result()
  .then(function(res) {
    self.wallet = res;
    return self;
  })
  .nodeify(callback);
};

//
// freeze
// Freeze the wallet for a duration of choice, stopping BitGo from signing any transactions
// Parameters include:
//   limit:  the duration to freeze the wallet for in seconds, defaults to 3600
//
EthWallet.prototype.freeze = function(params, callback) {
  params = params || {};
  common.validateParams(params, [], [], callback);

  if (params.duration) {
    if (typeof(params.duration) != 'number') {
      throw new Error('invalid duration - should be number of seconds');
    }
  }

  return this.bitgo.post(this.url('/freeze'))
  .send(params)
  .result()
  .nodeify(callback);
};

//
// delete
// Deletes the wallet
//
EthWallet.prototype.delete = function(params, callback) {
  params = params || {};
  common.validateParams(params, [], [], callback);

  return this.bitgo.del(this.url())
  .result()
  .nodeify(callback);
};

//
// labels
// List the labels for the addresses in a given wallet
//
EthWallet.prototype.labels = function(params, callback) {
  params = params || {};
  common.validateParams(params, [], [], callback);

  var url = this.bitgo.url('/labels/' + this.id());

  return this.bitgo.get(url)
  .result('labels')
  .nodeify(callback);
};

/**
 * Rename a wallet
 * @param params
 *  - label: the wallet's intended new name
 * @param callback
 * @returns {*}
 */
EthWallet.prototype.setWalletName = function(params, callback) {
  params = params || {};
  common.validateParams(params, ['label'], [], callback);

  var url = this.bitgo.url('/wallet/' + this.id());
  return this.bitgo.put(url)
  .send({ label: params.label })
  .result()
  .nodeify(callback);
};

//
// setLabel
// Sets a label on the provided address
//
EthWallet.prototype.setLabel = function(params, callback) {
  params = params || {};
  common.validateParams(params, ['address', 'label'], [], callback);

  var self = this;

  if (!self.bitgo.verifyAddress({ address: params.address })) {
    throw new Error('Invalid bitcoin address: ' + params.address);
  }

  var url = this.bitgo.url('/labels/' + this.id() + '/' + params.address);

  return this.bitgo.put(url)
  .send({'label': params.label})
  .result()
  .nodeify(callback);
};

//
// deleteLabel
// Deletes the label associated with the provided address
//
EthWallet.prototype.deleteLabel = function(params, callback) {
  params = params || {};
  common.validateParams(params, ['address'], [], callback);

  var self = this;

  if (!self.bitgo.verifyAddress({ address: params.address })) {
    throw new Error('Invalid bitcoin address: ' + params.address);
  }

  var url = this.bitgo.url('/eth/labels/' + this.id() + '/' + params.address);

  return this.bitgo.del(url)
  .result()
  .nodeify(callback);
};

//
// transactions
// List the transactions for a given wallet
// Options include:
//     TODO:  Add iterators for start/count/etc
EthWallet.prototype.transactions = function(params, callback) {
  params = params || {};
  common.validateParams(params, [], [], callback);

  var args = [];
  if (params.limit) {
    if (typeof(params.limit) != 'number') {
      throw new Error('invalid limit argument, expecting number');
    }
    args.push('limit=' + params.limit);
  }
  if (params.skip) {
    if (typeof(params.skip) != 'number') {
      throw new Error('invalid skip argument, expecting number');
    }
    args.push('skip=' + params.skip);
  }
  if (params.minHeight) {
    if (typeof(params.minHeight) != 'number') {
      throw new Error('invalid minHeight argument, expecting number');
    }
    args.push('minHeight=' + params.minHeight);
  }
  var query = '';
  if (args.length) {
    query = '?' + args.join('&');
  }

  var url = this.url('/tx' + query);

  return this.bitgo.get(url)
  .result()
  .nodeify(callback);
};

//
// transaction
// Get a transaction by ID for a given wallet
EthWallet.prototype.getTransaction = function(params, callback) {
  params = params || {};
  common.validateParams(params, ['id'], [], callback);

  var url = this.url('/tx/' + params.id);

  return this.bitgo.get(url)
  .result()
  .nodeify(callback);
};

//
// pollForTransaction
// Poll a transaction until successful or times out
// Parameters:
//   id: the txid
//   delay: delay between polls in ms (default: 1000)
//   timeout: timeout in ms (default: 10000)
EthWallet.prototype.pollForTransaction = function(params, callback) {
  var self = this;
  params = params || {};
  common.validateParams(params, ['id'], [], callback);
  if (params.delay && typeof(params.delay) !== 'number') {
    throw new Error('invalid delay parameter');
  }
  if (params.timeout && typeof(params.timeout) !== 'number') {
    throw new Error('invalid timeout parameter');
  }
  params.delay = params.delay || 1000;
  params.timeout = params.timeout || 10000;

  var start = new Date();

  var doNextPoll = function() {
    return self.getTransaction(params)
    .then(function(res) {
      return res;
    })
    .catch(function(err) {
      if (err.status !== 404 || (new Date() - start) > params.timeout) {
        throw err;
      }
      return Q.delay(params.delay)
      .then(function() {
        return doNextPoll();
      });
    });
  };

  return doNextPoll();
};

//
// transaction by sequence id
// Get a transaction by sequence id for a given wallet
EthWallet.prototype.getWalletTransactionBySequenceId = function(params, callback) {
  params = params || {};
  common.validateParams(params, ['sequenceId'], [], callback);

  var url = this.url('/tx/sequence/' + params.sequenceId);

  return this.bitgo.get(url)
  .result()
  .nodeify(callback);
};

//
// Key chains
// Gets the user key chain for this wallet
// The user key chain is typically the first keychain of the wallet and has the encrypted xpriv stored on BitGo.
// Useful when trying to get the users' keychain from the server before decrypting to sign a transaction.
EthWallet.prototype.getEncryptedUserKeychain = function(params, callback) {
  params = params || {};
  common.validateParams(params, [], [], callback);
  var self = this;

  var tryKeyChain = function(index) {
    if (!self.keychains || index >= self.keychains.length) {
      return self.bitgo.reject('No encrypted keychains on this wallet.', callback);
    }

    var params = { "xpub": self.keychains[index].xpub };

    return self.bitgo.keychains().get(params)
    .then(function(keychain) {
      // If we find the xpriv, then this is probably the user keychain we're looking for
      keychain.walletSubPath = self.keychains[index].path;
      if (keychain.encryptedXprv) {
        return keychain;
      }
      return tryKeyChain(index + 1);
    });
  };

  return tryKeyChain(0).nodeify(callback);
};

//
// createTransaction
// Create a transaction (unsigned). To sign it, do signTransaction
// Parameters:
//   recipients - object of recipient addresses and the amount to send to each e.g. {address:1500, address2:1500}
//   fee      - the blockchain fee to send (optional)
//   feeRate  - the fee per kb to send (optional)
//   minConfirms - minimum number of confirms to use when gathering unspents
//   forceChangeAtEnd - force change address to be last output (optional)
//   noSplitChange - disable automatic change splitting for purposes of unspent management
//   changeAddress - override the change address (optional)
//   validate - extra verification of change addresses (which are always verified server-side) (defaults to global config)
// Returns:
//   callback(err, { transactionHex: string, unspents: [inputs], fee: satoshis })
EthWallet.prototype.createTransaction = function(params, callback) {
  params = _.extend({}, params);
  common.validateParams(params, [], [], callback);

  var self = this;

  if ((typeof(params.fee) != 'number' && typeof(params.fee) != 'undefined') ||
      (typeof(params.feeRate) != 'number' && typeof(params.feeRate) != 'undefined') ||
      (typeof(params.minConfirms) != 'number' && typeof(params.minConfirms) != 'undefined') ||
      (typeof(params.forceChangeAtEnd) != 'boolean' && typeof(params.forceChangeAtEnd) != 'undefined') ||
      (typeof(params.changeAddress) != 'string' && typeof(params.changeAddress) != 'undefined') ||
      (typeof(params.validate) != 'boolean' && typeof(params.validate) != 'undefined') ||
      (typeof(params.instant) != 'boolean' && typeof(params.instant) != 'undefined')) {
    throw new Error('invalid argument');
  }

  if (typeof(params.recipients) != 'object') {
    throw new Error('expecting recipients object');
  }

  params.validate = params.validate !== undefined ? params.validate : this.bitgo.getValidate();
  params.wallet = this;

  return TransactionBuilder.createTransaction(params)
  .nodeify(callback);
};


//
// signTransaction
// Sign a previously created transaction with a keychain
// Parameters:
// transactionHex - serialized form of the transaction in hex
// unspents - array of unspent information, where each unspent is a chainPath
//            and redeemScript with the same index as the inputs in the
//            transactionHex
// keychain - Keychain containing the xprv to sign with.
// signingKey - For legacy safe wallets, the private key string.
// validate - extra verification of signatures (which are always verified server-side) (defaults to global config)
// Returns:
//   callback(err, transaction)
EthWallet.prototype.signTransaction = function(params, callback) {
  params = _.extend({}, params);
  common.validateParams(params, ['transactionHex'], [], callback);

  var self = this;

  if (!Array.isArray(params.unspents)) {
    throw new Error('expecting the unspents array');
  }

  if (typeof(params.keychain) != 'object' || !params.keychain.xprv) {
    if (typeof(params.signingKey) === 'string') {
      // allow passing in a WIF private key for legacy safe wallet support
    } else {
      throw new Error('expecting keychain object with xprv');
    }
  }

  params.validate = params.validate !== undefined ? params.validate : this.bitgo.getValidate();
  return TransactionBuilder.signTransaction(params)
  .then(function(result) {
    return {
      tx: result.transactionHex
    };
  })
  .nodeify(callback);
};

//
// send
// Send a transaction to the Bitcoin network via BitGo.
// One of the keys is typically signed, and BitGo will sign the other (if approved) and relay it to the P2P network.
// Parameters:
//   tx  - the hex encoded, signed transaction to send
// Returns:
//
EthWallet.prototype.sendTransaction = function(params, callback) {
  params = params || {};
  common.validateParams(params, ['tx'], ['message', 'otp'], callback);

  var self = this;
  return this.bitgo.post(this.bitgo.url('/eth/tx/send'))
  .send(params)
  .result()
  .then(function(body) {
    if (body.pendingApproval) {
      return _.extend(body, { status: 'pendingApproval' });
    }

    if (body.otp) {
      return _.extend(body, { status: 'otp' });
    }

    return {
      status: 'accepted',
      tx: body.transaction,
      hash: body.transactionHash,
      instant: body.instant,
      instantId: body.instantId
    };
  })
  .nodeify(callback);
};

//
// sendCoins
// Send coins to a destination address from this wallet using the user key.
// 1. Gets the user keychain by checking the wallet for a key which has an encrypted xpriv
// 2. Decrypts user key
// 3. Creates the transaction with default fee
// 4. Signs transaction with decrypted user key
// 3. Sends the transaction to BitGo
//
// Parameters:
//   address - the destination address
//   amount - the amount in satoshis to be sent
//   message - optional message to attach to transaction
//   walletPassphrase - the passphrase to be used to decrypt the user key on this wallet
//   xprv - the private key in string form, if walletPassphrase is not available
//   (See transactionBuilder.createTransaction for other passthrough params)
// Returns:
//
EthWallet.prototype.sendCoins = function(params, callback) {
  params = params || {};
  common.validateParams(params, ['address'], ['message'], callback);

  if (typeof(params.amount) != 'number') {
    throw new Error('invalid argument for amount - number expected');
  }

  params.recipients = {};
  params.recipients[params.address] = params.amount;

  return this.sendMany(params)
  .nodeify(callback);
};

//
// createAndSignTransaction
// INTERNAL function to create and sign a transaction
//
// Parameters:
//   recipients - array of { address, amount } to send to
//   walletPassphrase - the passphrase to be used to decrypt the user key on this wallet
//   (See transactionBuilder.createTransaction for other passthrough params)
// Returns:
//
EthWallet.prototype.createAndSignTransaction = function(params, callback) {
  params = params || {};
  common.validateParams(params, [], [], callback);
  var self = this;

  if (typeof(params.recipients) != 'object') {
    throw new Error('expecting recipients object');
  }

  if (params.fee && typeof(params.fee) != 'number') {
    throw new Error('invalid argument for fee - number expected');
  }

  if (params.feeRate && typeof(params.feeRate) != 'number') {
    throw new Error('invalid argument for feeRate - number expected');
  }

  if (params.dynamicFeeConfirmTarget && typeof(params.dynamicFeeConfirmTarget) != 'number') {
    throw new Error('invalid argument for confirmTarget - number expected');
  }

  if (params.instant && typeof(params.instant) != 'boolean') {
    throw new Error('invalid argument for instant - boolean expected');
  }

  var keychain;
  var fee;
  var feeRate;
  var bitgoFee;
  var travelInfos;

  return Q()
  .then(function() {
    // wrap in a Q in case one of these throws
    return Q.all([self.getAndPrepareSigningKeychain(params), self.createTransaction(params)]);
  })
  .spread(function(keychain, transaction) {
    fee = transaction.fee;
    feeRate = transaction.feeRate;
    // Sign the transaction
    transaction.keychain = keychain;
    bitgoFee = transaction.bitgoFee;
    travelInfos = transaction.travelInfos;
    transaction.feeSingleKeyWIF = params.feeSingleKeyWIF;
    return self.signTransaction(transaction);
  })
  .then(function(result) {
    return _.extend(result, {
      fee: fee,
      feeRate: feeRate,
      instant: params.instant,
      bitgoFee: bitgoFee,
      travelInfos: travelInfos
    });
  })
  .nodeify(callback);
};

//
// getAndPrepareSigningKeychain
// INTERNAL function to get the user keychain for signing.
// Caller must provider either a keychain, or walletPassphrase or xprv as a string
// If the caller provides the keychain with xprv, it is simply returned.
// If the caller provides the encrypted xprv (walletPassphrase), then fetch the keychain object and decrypt
// Otherwise if the xprv is provided, fetch the keychain object and augment it with the xprv.
//
// Parameters:
//   keychain - keychain with xprv
//   xprv - the private key in string form
//   walletPassphrase - the passphrase to be used to decrypt the user key on this wallet
// Returns:
//   Keychain object containing xprv, xpub and paths
//
EthWallet.prototype.getAndPrepareSigningKeychain = function(params, callback) {
  params = params || {};

  // If keychain with xprv is already provided, use it
  if (typeof(params.keychain) === 'object' && params.keychain.xprv) {
    return Q(params.keychain);
  }

  common.validateParams(params, [], ['walletPassphrase', 'xprv'], callback);

  if ((params.walletPassphrase && params.xprv) || (!params.walletPassphrase && !params.xprv)) {
    throw new Error('must provide exactly one of xprv or walletPassphrase');
  }

  var self = this;

  // Caller provided a wallet passphrase
  if (params.walletPassphrase) {
    return self.getEncryptedUserKeychain()
    .then(function(keychain) {
      // Decrypt the user key with a passphrase
      try {
        keychain.xprv = self.bitgo.decrypt({password: params.walletPassphrase, input: keychain.encryptedXprv});
      } catch (e) {
        throw new Error('Unable to decrypt user keychain');
      }
      return keychain;
    });
  }

  // Caller provided an xprv - validate and construct keychain object
  var xpub;
  try {
    xpub = bitcoin.HDNode.fromBase58(params.xprv).neutered().toBase58();
  } catch (e) {
    throw new Error('Unable to parse the xprv');
  }

  if (xpub == params.xprv) {
    throw new Error('xprv provided was not a private key (found xpub instead)');
  }

  var walletXpubs = _.pluck(self.keychains, 'xpub');
  if (!_.includes(walletXpubs, xpub)) {
    throw new Error('xprv provided was not a keychain on this wallet!');
  }

  // get the keychain object from bitgo to find the path and (potential) wallet structure
  return self.bitgo.keychains().get({ xpub: xpub })
  .then(function(keychain) {
    keychain.xprv = params.xprv;
    return keychain;
  });
};

EthWallet.prototype.listWebhooks = function(params, callback) {
  params = params || {};
  common.validateParams(params, [], [], callback);

  return this.bitgo.get(this.url('/webhooks'))
  .send()
  .result()
  .nodeify(callback);
};

EthWallet.prototype.addWebhook = function(params, callback) {
  params = params || {};
  common.validateParams(params, ['url', 'type'], [], callback);

  return this.bitgo.post(this.url('/webhooks'))
  .send(params)
  .result()
  .nodeify(callback);
};

EthWallet.prototype.removeWebhook = function(params, callback) {
  params = params || {};
  common.validateParams(params, ['url', 'type'], [], callback);

  return this.bitgo.del(this.url('/webhooks'))
  .send(params)
  .result()
  .nodeify(callback);
};

EthWallet.prototype.estimateFee = function(params, callback) {
  common.validateParams(params, [], [], callback);

  if (params.amount && params.recipients) {
    throw new Error('cannot specify both amount as well as recipients');
  }
  if (params.recipients && typeof(params.recipients) != 'object') {
    throw new Error('recipients must be array of { address: abc, amount: 100000 } objects');
  }
  if (params.amount && typeof(params.amount) != 'number') {
    throw new Error('invalid amount argument, expecting number');
  }

  var recipients = params.recipients || [];

  if (params.amount) {
    // only the amount was passed in, so we need to make a false recipient to run createTransaction with
    recipients.push({
      address: common.Environments[this.bitgo.env].signingAddress, // any address will do
      amount: params.amount
    });
  }

  var transactionParams = _.extend({}, params);
  transactionParams.amount = undefined;
  transactionParams.recipients = recipients;

  return this.createTransaction(transactionParams)
  .then(function(tx) {
    return {
      estimatedSize: tx.estimatedSize,
      fee: tx.fee,
      feeRate: tx.feeRate
    };
  });
};

//
// getBitGoFee
// Get the required on-transaction BitGo fee
//
EthWallet.prototype.getBitGoFee = function(params, callback) {
  params = params || {};
  common.validateParams(params, [], [], callback);
  if (typeof(params.amount) !== 'number') {
    throw new Error('invalid amount argument');
  }
  if (params.instant && typeof(params.instant) !== 'boolean') {
    throw new Error('invalid instant argument');
  }
  return this.bitgo.get(this.url('/billing/fee'))
  .query(params)
  .result()
  .nodeify(callback);
};



module.exports = EthWallet;
