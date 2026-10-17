import mongoose from 'mongoose';

await mongoose.connect('mongodb://127.0.0.1:27017/lms_dev');
const testEmails = ['student@test.lms', 'instructor@test.lms'];
const res = await mongoose.connection.collection('users').deleteMany({ email: { $in: testEmails } });
console.log('Deleted test users:', res.deletedCount);
await mongoose.disconnect();
