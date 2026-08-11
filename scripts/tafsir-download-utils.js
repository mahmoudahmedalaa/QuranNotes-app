function decodeUtf8Chunks(chunks) {
  return Buffer.concat(chunks).toString('utf8');
}

module.exports = { decodeUtf8Chunks };
