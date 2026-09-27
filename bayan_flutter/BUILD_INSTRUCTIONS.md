# دليل بناء وتجميع نظام بيان ERP للابتوبات والهواتف (دون إظهار السورس كود)

هذا الدليل يوضح خطوات تجميع نظام **بيان ERP** وحفظه كبرنامج مثبت آمن وجاهز للتنصيب على أجهزة اللابتوب والهواتف **دون إظهار أو مشاركة الكود المصدري (Source Code)**.

---

## 💻 1. بناء وتجميع نسخة الكمبيوتر واللابتوبات (Windows Release)

### الخطوات:
1. افتح موجه الأوامر (Terminal) في مجلد مشروع Flutter:
   ```bash
   cd bayan_flutter
   ```
2. قم بتجميع البرنامج بصيغة Release المفرغة والمشفرة:
   ```bash
   flutter build windows --release
   ```
3. ستجد الملف التشغيلي المجمع والتنفيذي جاهزاً في المسار:
   ```text
   bayan_flutter/build/windows/x64/runner/Release/
   ```

### 🔒 الحماية من تسريب السورس كود:
الملفات الناتجة في مجلد `Release` تكون عبارة عن خوارزميات مجمعة بلغة C++ وتتضمّن ملف `bayan_flutter.exe` المترجم كلياً، **ولا تحتوي على أي ملف من ملفات الكود المصدري (Dart / Source Code)**.

### 📦 إنشاء برنامج تثبيتي (Installer .exe):
يمكنك تحويل مجلد `Release` لملف تثبيت أوتوماتيكي واحد مثل `BayanERP_Setup.exe` بنقرة زر باستخدام برنامج **Inno Setup**:
1. افتح برنامج Inno Setup ودلّه على مجلد `Release`.
2. سيتولد لك ملف تثبيتي واحد `BayanERP_Setup.exe` يمكنك إعطاؤه للعميل وتثبيته على أي لابتوب يعمل بنظام Windows.

---

## 📱 2. بناء وتجميع نسخة الجوالات (Android APK)

### الخطوات:
1. لتجميع ملف التثبيت للهواتف الذكية (Android):
   ```bash
   flutter build apk --release
   ```
2. ستجد ملف الـ APK المشفر والناتج جاهزاً للتثبيت في المسار:
   ```text
   bayan_flutter/build/app/outputs/flutter-apk/app-release.apk
   ```

---

## 🍏 3. بناء وتجميع لابتوبات الماك والهواتف الذكية (macOS & iOS)

### للماك بوك:
```bash
flutter build macos --release
```
ينتج تطبيق `.app` أو `.dmg` جاهز للعمل على لابتوبات Apple.

### للهواتف (iPhone):
```bash
flutter build ipa --release
```

---

## 🔑 المزايا المضمنة في هذا البناء:
- **Offline-First**: يعمل النظام محلياً بواسطة **SQFlite** بدون وجود إنترنت.
- **Auto Cloud Sync**: مزامنة تلقائية مع **Firebase Cloud Firestore** عند الاتصال بالشبكة.
- **Double Entry Accounting Engine**: محرك القيد المحاسبي المزدوج الضامن لتوازن الحسابات.
- **Visual Dark Red Theme**: الواجهة الداكنة الراقية ذات الهوية الحمراء المطابقة للنموذج المطلوب.
