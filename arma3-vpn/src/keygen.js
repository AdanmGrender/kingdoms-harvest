'use strict';
const crypto = require('crypto');

function generateKeyPair() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('x25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });
  return {
    privateKey: Buffer.from(privateKey).slice(-32).toString('base64'),
    publicKey: Buffer.from(publicKey).slice(-32).toString('base64'),
  };
}

module.exports = { generateKeyPair };
