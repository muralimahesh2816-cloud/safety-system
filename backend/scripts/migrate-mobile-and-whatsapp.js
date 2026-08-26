/**
 * One-time migration, to be run once after deploying.
 *
 * Does two things:
 *
 *  1. Normalises existing mobile numbers into `mobileNumber`. This is the one
 *     that matters operationally — OTP sign-in resolves against that field, and
 *     it is new, so on deployment day every existing user has it unset and
 *     nobody could sign in by mobile until it is populated.
 *  2. Enables the WhatsApp notification preference for users created before the
 *     channel existed.
 *
 * `notificationPreferences.whatsapp` shipped as `false` as a placeholder for an
 * unimplemented feature. No interface ever exposed it, so a stored `false`
 * records no decision by the user — but it does suppress every assignment
 * message, which is the opposite of the business rule.
 *
 * This is deliberately a script rather than a boot-time side effect: silently
 * rewriting a preference field on every start is not something a system should
 * do to its own data. Run it once, after deploying.
 *
 *   node backend/scripts/migrate-whatsapp-preference.js
 *
 * Idempotent, and safe to run again: it only touches documents still sitting on
 * the old default.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../src/models/User");

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const result = await User.updateMany(
    { "notificationPreferences.whatsapp": false },
    { $set: { "notificationPreferences.whatsapp": true } }
  );
  console.log(`Users updated: ${result.modifiedCount}`);

  // Backfill the normalised number from whatever is already stored in the
  // free-text `mobile` field. Without this, nobody can sign in by OTP on the
  // day this deploys, because `mobileNumber` is a new field and every existing
  // document has it unset — the numbers are already on file, they just have
  // not been normalised yet. `save()` runs the model hook that does the work.
  const candidates = await User.find({
    mobileNumber: null,
    mobile: { $nin: ["", null] }
  }).select("mobile mobileNumber");

  let backfilled = 0;
  let unparseable = 0;
  for (const user of candidates) {
    user.markModified("mobile");
    // eslint-disable-next-line no-await-in-loop
    await user.save().catch(() => null);
    if (user.mobileNumber) backfilled += 1;
    else unparseable += 1;
  }
  console.log(`Mobile numbers normalised: ${backfilled}`);
  if (unparseable) {
    console.log(`Could not parse ${unparseable} stored number(s); those users need a corrected number on their profile.`);
  }

  const withoutNumber = await User.countDocuments({ mobileNumber: null });
  if (withoutNumber > 0) {
    console.log(
      `Note: ${withoutNumber} user(s) have no mobile number on file and will not receive WhatsApp assignment messages or be able to sign in by OTP until one is added.`
    );
  }

  await mongoose.disconnect();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
