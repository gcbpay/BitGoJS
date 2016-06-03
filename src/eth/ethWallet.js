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
  this.addresses = [];

  if (wallet.private) {
    this.addresses = wallet.private.addresses;
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
// This is the total of all funds available for s(p)ending
//
EthWallet.prototype.spendableBalance = function() {
  return this.wallet.spendableBalance;
};

//
// type
// Get the type of this wallet, e.g. 'eth'
//
EthWallet.prototype.type = function() {
  return this.wallet.type;
};

//
// url
// Get the URL of this wallet
//
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

  var url = this.url();
  return this.bitgo.put(url)
  .send({ label: params.label })
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

//
// setLabel
// Sets a label on the provided address
//
EthWallet.prototype.setLabel = function(params, callback) {
  params = params || {};
  common.validateParams(params, ['address', 'label'], [], callback);

  var self = this;

  if (!self.bitgo.eth().verifyAddress({ address: params.address })) {
    throw new Error('Invalid Ethereum address: ' + params.address);
  }

  var url = this.bitgo.url('/labels/' + this.id() + '/' + params.address);

  return this.bitgo.put(url)
  .send({ 'label': params.label })
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

  if (!self.bitgo.eth().verifyAddress({ address: params.address })) {
    throw new Error('Invalid Ethereum address: ' + params.address);
  }

  var url = this.bitgo.url('/labels/' + this.id() + '/' + params.address);

  return this.bitgo.del(url)
  .result()
  .nodeify(callback);
};

//
// transactions
// List the transactions for a given wallet
// Options include:
// TODO: Add iterators for start/count/etc
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
// Key chains
// Gets the user key chain for this wallet
// The user key chain is typically the first keychain of the wallet and has the encrypted xpriv stored on BitGo.
// Useful when trying to get the users' keychain from the server before decrypting to sign a transaction.
EthWallet.prototype.getEncryptedUserKeychain = function(params, callback) {
  params = params || {};
  common.validateParams(params, [], [], callback);
  var self = this;

  return self.bitgo.keychains()
  .get({ 'ethAddress': self.addresses[0].address })
  .then(function(keychain) {
    if (!keychain.encryptedXprv) {
      return self.bitgo.reject('No encrypted keychains on this wallet.', callback);
    }
    return keychain;
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
// TODO: (benchan)
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
      return _.extend({ status: 'pendingApproval' }, body);
    }

    if (body.otp) {
      return _.extend({ status: 'otp' }, body);
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
        keychain.xprv = self.bitgo.decrypt({ password: params.walletPassphrase, input: keychain.encryptedXprv });
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

  var walletAddresses = _.pluck(self.addresses, 'address');
  if (!_.includes(walletAddresses, Util.xpubToEthAddress(xpub))) {
    throw new Error('xprv provided did not correspond to any address on this wallet!');
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

module.exports = EthWallet;
