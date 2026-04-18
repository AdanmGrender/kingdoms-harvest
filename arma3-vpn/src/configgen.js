'use strict';

function buildServerConfig(serverPrivKey, port, peers) {
  let config = `[Interface]
PrivateKey = ${serverPrivKey}
Address = 10.8.0.1/24
ListenPort = ${port}
MTU = 1420
DNS = 1.1.1.1

`;
  for (const peer of peers) {
    config += `[Peer]
PublicKey = ${peer.publicKey}
AllowedIPs = ${peer.vpnIp}/32

`;
  }
  return config.trimEnd();
}

function buildClientConfig(clientPrivKey, serverPubKey, serverEndpoint, clientVpnIp) {
  return `[Interface]
PrivateKey = ${clientPrivKey}
Address = ${clientVpnIp}/24
MTU = 1420
DNS = 1.1.1.1

[Peer]
PublicKey = ${serverPubKey}
Endpoint = ${serverEndpoint}
AllowedIPs = 10.8.0.0/24
PersistentKeepalive = 21`;
}

function encodeJoinCode(config) {
  return Buffer.from(config, 'utf8').toString('base64url');
}

function decodeJoinCode(code) {
  return Buffer.from(code.trim(), 'base64url').toString('utf8');
}

module.exports = { buildServerConfig, buildClientConfig, encodeJoinCode, decodeJoinCode };
