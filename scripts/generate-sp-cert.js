#!/usr/bin/env node

/**
 * Generate SP (Service Provider) Private Key and Certificate for SAML
 * This script uses Node.js crypto module to generate certificates
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = process.cwd();
const KEY_FILE = path.join(OUTPUT_DIR, 'sp-private-key.pem');
const CERT_FILE = path.join(OUTPUT_DIR, 'sp-certificate.pem');

console.log('Generating SP Private Key and Certificate for SAML...\n');

try {
  // Generate key pair
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  // Create self-signed certificate
  const cert = crypto.createCertificate();
  cert.setSubject([
    ['CN', 'localhost'],
    ['O', 'YourApp'],
    ['C', 'US']
  ]);
  cert.setIssuer([
    ['CN', 'localhost'],
    ['O', 'YourApp'],
    ['C', 'US']
  ]);
  cert.setSerialNumber(Buffer.from(Date.now().toString()).toString('hex'));
  cert.setPublicKey(publicKey);
  cert.sign(privateKey, 'sha256');

  // Write files
  fs.writeFileSync(KEY_FILE, privateKey, 'utf8');
  fs.writeFileSync(CERT_FILE, cert.toLegacyObject().toString(), 'utf8');

  console.log('✅ Generated:');
  console.log(`   Private Key: ${KEY_FILE}`);
  console.log(`   Certificate: ${CERT_FILE}\n`);
  console.log('⚠️  IMPORTANT:');
  console.log(`   - Keep ${path.basename(KEY_FILE)} secure and NEVER commit it to version control`);
  console.log(`   - Add ${path.basename(KEY_FILE)} to .gitignore`);
  console.log(`   - Use ${path.basename(CERT_FILE)} in your SP metadata`);
  console.log(`   - Upload ${path.basename(CERT_FILE)} to Okta as the SP signing certificate\n`);
} catch (error) {
  console.error('❌ Error generating certificates:', error.message);
  console.error('\n💡 Alternative: Use OpenSSL command line:');
  console.error('   openssl genrsa -out sp-private-key.pem 2048');
  console.error('   openssl req -new -x509 -key sp-private-key.pem -out sp-certificate.pem -days 3650 -subj "/CN=localhost/O=YourApp/C=US"');
  process.exit(1);
}

