//
// Wallets Object
// BitGo accessor to a user's wallets.
//
// Copyright 2014, BitGo, Inc.  All Rights Reserved.
//

var bitcoin = require('../bitcoin');
var EthWallet = require('./ethWallet');
var common = require('../common');
var Util = require('../util');
var Q = require('q');

//
// Constructor
// TODO: WORK IN PROGRESS
//
var EthWallets = function(bitgo) {
  this.bitgo = bitgo;
};

//
// list
// List the user's wallets
//
EthWallets.prototype.list = function(params, callback) {
  params = params || {};
  common.validateParams(params, [], [], callback);

  var args = [];

  if (params.skip && params.prevId) {
    throw new Error('cannot specify both skip and prevId');
  }

  if (params.limit) {
    if (typeof(params.limit) != 'number') {
      throw new Error('invalid limit argument, expecting number');
    }
    args.push('limit=' + params.limit);
  }
  if (params.getbalances) {
    if (typeof(params.getbalances) != 'boolean') {
      throw new Error('invalid getbalances argument, expecting boolean');
    }
    args.push('getbalances=' + params.getbalances);
  }
  if (params.skip) {
    if (typeof(params.skip) != 'number') {
      throw new Error('invalid skip argument, expecting number');
    }
    args.push('skip=' + params.skip);
  } else if (params.prevId) {
    args.push('prevId=' + params.prevId);
  }

  var query = '';
  if (args.length) {
    query = '?' + args.join('&');
  }

  var self = this;
  return this.bitgo.get(this.bitgo.url('/eth/wallet' + query))
  .result()
  .then(function(body) {
    body.wallets = body.wallets.map(function(w) { return new EthWallet(self.bitgo, w); });
    return body;
  })
  .nodeify(callback);
};

EthWallets.prototype.getWallet = function(params, callback) {
  params = params || {};
  common.validateParams(params, ['id'], [], callback);

  var self = this;

  var query = '';
  if (params.gpk) {
    query = '?gpk=1';
  }

  return this.bitgo.get(this.bitgo.url('/eth/wallet/' + params.id + query))
  .result()
  .then(function(wallet) {
    return new EthWallet(self.bitgo, wallet);
  })
  .nodeify(callback);
};

//
// listInvites
// List the invites on a user
//
EthWallets.prototype.listInvites = function(params, callback) {
  params = params || {};
  common.validateParams(params, [], [], callback);

  var self = this;
  return this.bitgo.get(this.bitgo.url('/eth/walletinvite'))
  .result()
  .nodeify(callback);
};

//
// cancelInvite
// cancel a wallet invite that a user initiated
//
EthWallets.prototype.cancelInvite = function(params, callback) {
  params = params || {};
  common.validateParams(params, ['walletInviteId'], [], callback);

  var self = this;
  return this.bitgo.del(this.bitgo.url('/eth/walletinvite/' + params.walletInviteId))
  .result()
  .nodeify(callback);
};

//
// listShares
// List the user's wallet shares
//
EthWallets.prototype.listShares = function(params, callback) {
  params = params || {};
  common.validateParams(params, [], [], callback);

  var self = this;
  return this.bitgo.get(this.bitgo.url('/eth/walletshare'))
  .result()
  .nodeify(callback);
};

//
// getShare
// Gets a wallet share information, including the encrypted sharing keychain. requires unlock if keychain is present.
// Params:
//    walletShareId - the wallet share to get information on
//
EthWallets.prototype.getShare = function(params, callback) {
  params = params || {};
  common.validateParams(params, ['walletShareId'], [], callback);

  return this.bitgo.get(this.bitgo.url('/eth/walletshare/' + params.walletShareId))
  .result()
  .nodeify(callback);
};

//
// updateShare
// updates a wallet share
// Params:
//    walletShareId - the wallet share to update
//    state - the new state of the wallet share
//
EthWallets.prototype.updateShare = function(params, callback) {
  params = params || {};
  common.validateParams(params, ['walletShareId'], [], callback);

  return this.bitgo.post(this.bitgo.url('/eth/walletshare/' + params.walletShareId))
  .send(params)
  .result()
  .nodeify(callback);
};

//
// cancelShare
// cancels a wallet share
// Params:
//    walletShareId - the wallet share to update
//
EthWallets.prototype.cancelShare = function(params, callback) {
  params = params || {};
  common.validateParams(params, ['walletShareId'], [], callback);

  return this.bitgo.del(this.bitgo.url('/eth/walletshare/' + params.walletShareId))
  .send()
  .result()
  .nodeify(callback);
};

//
// acceptShare
// Accepts a wallet share, adding the wallet to the user's list
// Needs a user's password to decrypt the shared key
// Params:
//    walletShareId - the wallet share to accept
//    userPassword - (required if more a keychain was shared) user's password to decrypt the shared wallet
//    newWalletPassphrase - new EthWallet passphrase for saving the shared wallet xprv.
//                          If left blank and a wallet with more than view permissions was shared, then the userpassword is used.
//    overrideEncryptedXprv - set only if the xprv was received out-of-band.
//
EthWallets.prototype.acceptShare = function(params, callback) {
  params = params || {};
  common.validateParams(params, ['walletShareId'], ['overrideEncryptedXprv'], callback);

  var self = this;
  var encryptedXprv = params.overrideEncryptedXprv;

  return this.getShare({ walletShareId: params.walletShareId })
  .then(function(walletShare) {
    // Return right away if there is no keychain to decrypt, or if explicit encryptedXprv was provided
    if (!walletShare.keychain || !walletShare.keychain.encryptedXprv || encryptedXprv) {
      return walletShare;
    }

    // More than viewing was requested, so we need to process the wallet keys using the shared ecdh scheme
    if (!params.userPassword) {
      throw new Error("userPassword param must be provided to decrypt shared key");
    }

    return self.bitgo.getECDHSharingKeychain()
    .then(function(sharingKeychain) {
      if (!sharingKeychain.encryptedXprv) {
        throw new Error('EncryptedXprv was not found on sharing keychain')
      }

      // Now we have the sharing keychain, we can work out the secret used for sharing the wallet with us
      sharingKeychain.xprv = self.bitgo.decrypt({ password: params.userPassword, input: sharingKeychain.encryptedXprv });
      var rootExtKey = bitcoin.HDNode.fromBase58(sharingKeychain.xprv);

      // Derive key by path (which is used between these 2 users only)
      var privKey = bitcoin.hdPath(rootExtKey).deriveKey(walletShare.keychain.path);
      var secret = self.bitgo.getECDHSecret({ eckey: privKey, otherPubKeyHex: walletShare.keychain.fromPubKey });

      // Yes! We got the secret successfully here, now decrypt the shared wallet xprv
      var decryptedSharedWalletXprv = self.bitgo.decrypt({ password: secret, input: walletShare.keychain.encryptedXprv });

      // We will now re-encrypt the wallet with our own password
      var newWalletPassphrase = params.newWalletPassphrase || params.userPassword;
      encryptedXprv = self.bitgo.encrypt({ password: newWalletPassphrase, input: decryptedSharedWalletXprv });

      // Carry on to the next block where we will post the acceptance of the share with the encrypted xprv
      return walletShare;
    });
  })
  .then(function(walletShare) {
    var updateParams = {
      walletShareId: params.walletShareId,
      state: 'accepted'
    };

    if (encryptedXprv) {
      updateParams.encryptedXprv = encryptedXprv;
    }

    return self.updateShare(updateParams);
  })
  .nodeify(callback);
};

//
// createWalletWithKeychains
// Create a new 2-of-3 wallet and it's associated keychains.
// Returns the locally created keys with their encrypted xprvs.
// **WARNING: BE SURE TO BACKUP! NOT DOING SO CAN RESULT IN LOSS OF FUNDS!**
//
// 1. Creates the user keychain locally on the client, and encrypts it with the provided passphrase
// 2. If no xpub was provided, creates the backup keychain locally on the client, and encrypts it with the provided passphrase
// 3. Uploads the encrypted user and backup keychains to BitGo
// 4. Creates the BitGo key on the service
// 5. Creates the wallet on BitGo with the 3 public keys above
//
// Parameters include:
//   "passphrase": wallet passphrase to encrypt user and backup keys with
//   "label": wallet label, is shown in BitGo UI
//   "backupAddress": backup ethereum address, it is HIGHLY RECOMMENDED you generate this on a separate machine!
//                 BITGO DOES NOT GUARANTEE SAFETY OF WALLETS WITH MULTIPLE KEYS CREATED ON THE SAME MACHINE **
//   "backupXpubProvider": Provision backup key from this provider (KRS), e.g. "keyternal".
//                         Setting this value will create an instant-capable wallet.
// Returns: {
//   wallet: newly created wallet model object
//   userKeychain: the newly created user keychain, which has an encrypted xprv stored on BitGo
//   backupKeychain: the newly created backup keychain
//
// ** BE SURE TO BACK UP THE ENCRYPTED USER AND BACKUP KEYCHAINS!**
//
// }
EthWallets.prototype.createWallet = function(params, callback) {
  params = params || {};
  common.validateParams(params, ['passphrase'], ['label', 'backupAddress', 'enterprise'], callback);
  var self = this;
  var label = params.label;

  // Create the user and backup key.
  var userKeychain = this.bitgo.keychains().create();
  userKeychain.encryptedXprv = this.bitgo.encrypt({ password: params.passphrase, input: userKeychain.xprv });
  var userAddress = Util.xpubToEthAddress(userKeychain.xpub);

  if ((!!params.backupXpub + !!params.backupXpubProvider) > 1) {
    throw new Error("Cannot provide more than one backupXpub or backupXpubProvider flag");
  }

  if (params.disableTransactionNotifications !== undefined && typeof(params.disableTransactionNotifications) != 'boolean') {
    throw new Error('Expected disableTransactionNotifications to be a boolean. ');
  }

  var backupKeychain;
  var backupAddress;
  var bitgoAddress = self.bitgo.getConstants().bitgoEthAddress;

  // Add the user keychain
  var userKeychainPromise = self.bitgo.keychains().add({
    "xpub": userKeychain.xpub,
    "encryptedXprv": userKeychain.encryptedXprv
  });

  var backupKeychainPromise = Q.fcall(function(){
    if (params.backupXpubProvider) {
      // If requested, use a KRS or backup key provider
      return self.bitgo.keychains().createBackup({
        provider: params.backupXpubProvider,
        disableKRSEmail: params.disableKRSEmail
      })
      .then(function(keychain) {
        backupKeychain = keychain;
      });
    }

    if (params.backupAddress) {
      // user provided backup ethereum address
      backupAddress = params.backupAddress;
    } else {
      // no provided xpub, so default to creating one here
      backupKeychain = self.bitgo.keychains().create();
    }

    if (backupKeychain) {
      backupAddress = Util.xpubToEthAddress(backupKeychain.xpub);
      return self.bitgo.keychains().add(backupKeychain);
    }
  });

  var bitgoKeychainPromise = self.bitgo.keychains().createBitGo({ type: 'eth' })
  .then(function(keychain) {
    if (keychain.ethAddress) {
      // TODO: once server starts supporting this, remove the constants() call
      bitgoAddress = keychain.ethAddress;
    }
  });

  // parallelize the independent keychain retrievals/syncs
  return Q.all([userKeychainPromise, backupKeychainPromise, bitgoKeychainPromise])
  .then(function() {
    var walletParams = {
      "label": label,
      "m": 2,
      "n": 3,
      "addresses": [
        userAddress,
        backupAddress,
        bitgoAddress
      ]
    };

    if (params.enterprise) {
      walletParams.enterprise = params.enterprise;
    }

    if (params.disableTransactionNotifications) {
      walletParams.disableTransactionNotifications = params.disableTransactionNotifications;
    }

    return self.add(walletParams);
  })
  .then(function(newWallet) {
    var result = {
      wallet: newWallet,
      userKeychain: userKeychain,
      backupKeychain: backupKeychain
    };

    if (backupKeychain.xprv) {
      result.warning = 'Be sure to back up the backup keychain -- it is not stored anywhere else!';
    }

    return result;
  })
  .nodeify(callback);
};

//
// add
// Add a new EthWallet (advanced mode).
// This allows you to manually submit the keychains, type, m and n of the wallet
// Parameters include:
//    "label": label of the wallet to be shown in UI
//    "m": number of keys required to unlock wallet (2)
//    "n": number of keys available on the wallet (3)
//    "keychains": array of keychain xpubs
EthWallets.prototype.add = function(params, callback) {
  params = params || {};
  common.validateParams(params, [], ['label', 'enterprise'], callback);

  if (Array.isArray(params.addresses) === false || typeof(params.m) !== 'number' ||
    typeof(params.n) != 'number') {
    throw new Error('invalid argument');
  }

  // TODO: support more types of multisig
  if (params.m != 2 || params.n != 3) {
    throw new Error('unsupported multi-sig type');
  }

  var self = this;
  var addresses = params.addresses;
  var walletParams = {
    label: params.label,
    m: params.m,
    n: params.n,
    addresses: addresses,
    type: 'eth'
  };

  if (params.enterprise) {
    walletParams.enterprise = params.enterprise;
  }

  if (params.disableTransactionNotifications) {
    walletParams.disableTransactionNotifications = params.disableTransactionNotifications;
  }

  return this.bitgo.post(this.bitgo.url('/eth/wallet'))
  .send(walletParams)
  .result()
  .then(function(body) {
    return new EthWallet(self.bitgo, body);
  })
  .nodeify(callback);
};

//
// get
// Shorthand to getWallet
// Parameters include:
//   id: the id of the wallet
//
EthWallets.prototype.get = function(params, callback) {
  return this.getWallet(params, callback);
};

//
// remove
// Remove an existing wallet.
// Parameters include:
//   id: the id of the wallet
//
EthWallets.prototype.remove = function(params, callback) {
  params = params || {};
  common.validateParams(params, ['id'], [], callback);

  var self = this;
  return this.bitgo.del(this.bitgo.url('/eth/wallet/' + params.id))
  .result()
  .nodeify(callback);
};

module.exports = EthWallets;
