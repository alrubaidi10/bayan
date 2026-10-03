// desktop/build-desktop.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

console.log('🛠️  بناء تطبيق بيان ERP Desktop...\n');

// تأكد من وجود ملف Firebase
const firebaseSource = path.join(__dirname, '..', 'server', 'firebase-service-account.json');
const firebaseDest = path.join(__dirname, '..', 'server', 'firebase-service-account.json');

if (!fs.existsSync(firebaseSource)) {
  console.error('❌ ملف firebase-service-account.json غير موجود!');
  console.log('📝 يجب أن تضع الملف في:', firebaseSource);
  console.log('\n💡 كيفية الحصول على الملف:');
  console.log('1. اذهب إلى Firebase Console → Project Settings');
  console.log('2. اختر Service Accounts → Generate new private key');
  console.log('3. احفظ الملف كـ firebase-service-account.json');
  console.log('4. ضعه في مجلد server/');
  process.exit(1);
}

console.log('✅ ملف Firebase موجود');

// نصب dependencies
console.log('\n📦 تنزيل الـ dependencies...');
try {
  execSync('npm install', { cwd: __dirname, stdio: 'inherit' });
  execSync('npm install', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
} catch (error) {
  console.error('❌ فشل في تنزيل الـ dependencies:', error.message);
  process.exit(1);
}

console.log('\n🔧 بدء عملية البناء...');
try {
  execSync('npm run build:exe', { cwd: __dirname, stdio: 'inherit' });
} catch (error) {
  console.error('❌ فشل في البناء:', error.message);
  console.log('\n💡 حاول التالي:');
  console.log('1. تأكد من تثبيت Node.js 18+');
  console.log('2. تأكد من توفر اتصال بالإنترنت');
  console.log('3. تأكد من وجود مساحة كافية على القرص');
  process.exit(1);
}

console.log('\n🎉 تم البناء بنجاح!');
console.log('\n📂 ملف التثبيت موجود في:');
console.log('  ../dist-desktop/');
console.log('\n📋 خطوات التوزيع:');
console.log('1. أرسل ملف Setup.exe للعميل');
console.log('2. سيقوم التطبيق بإنشاء قاعدة بيانات منفصلة لكل عميل');
console.log('3. سيتم حفظ البيانات تلقائياً في Firebase الخاص بك');