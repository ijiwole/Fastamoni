// Artillery processor for custom functions
const { randomUUID } = require('crypto');

module.exports = {
  generateRandomAmount: (context, events, done) => {
    // Generate random amount between 1 and 100
    context.vars.randomAmount = (Math.random() * 99 + 1).toFixed(2);
    return done();
  },
  
  generateUUID: (context, events, done) => {
    // Generate UUID for unique email addresses
    context.vars.uuid = randomUUID();
    return done();
  },
  
  setTestUserVars: (context, events, done) => {
    // Set verified test user variables from environment
    context.vars.verifiedTestEmail = process.env.TEST_USER_EMAIL || 'loadtest@example.com';
    context.vars.verifiedTestPassword = process.env.TEST_USER_PASSWORD || 'TestPass123!';
    context.vars.verifiedTestPin = process.env.TEST_USER_PIN || '123456';
    context.vars.beneficiaryId = process.env.BENEFICIARY_ID || '';
    context.vars.testDonationId = process.env.TEST_DONATION_ID || '00000000-0000-0000-0000-000000000000';
    return done();
  },

  setLoadTestVars: (context, events, done) => {
    // Same as setTestUserVars, plus an access token for authenticated endpoints
    context.vars.verifiedTestEmail = process.env.TEST_USER_EMAIL || 'loadtest@example.com';
    context.vars.verifiedTestPassword = process.env.TEST_USER_PASSWORD || 'TestPass123!';
    context.vars.verifiedTestPin = process.env.TEST_USER_PIN || '123456';
    context.vars.beneficiaryId = process.env.BENEFICIARY_ID || '';
    context.vars.testDonationId = process.env.TEST_DONATION_ID || '00000000-0000-0000-0000-000000000000';
    context.vars.token = process.env.TEST_ACCESS_TOKEN || '';
    return done();
  },

  setDonationLookupId: (context, events, done) => {
    // Prefer the donation created in this run; fall back to a known test ID
    context.vars.donationLookupId = context.vars.donationId || context.vars.testDonationId;
    return done();
  },
};

