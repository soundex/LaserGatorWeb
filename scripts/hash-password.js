const bcrypt = require('bcryptjs');

const password = process.argv[2];
if (!password) {
  console.error('Usage: npm run hash-password -- <password>');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
console.log('Add this to your .env file:');
console.log(`ADMIN_PASSWORD_HASH=${hash}`);
