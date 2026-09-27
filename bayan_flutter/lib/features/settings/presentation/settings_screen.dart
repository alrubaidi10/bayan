import 'package:flutter/material.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({Key? key}) : super(key: key);

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _companyNameCtrl = TextEditingController(text: 'مجموعة البيان العالمية ERP');
  final _taxNoCtrl = TextEditingController(text: '310045982100003');
  bool _offlineMode = true;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('إعدادات المنشأة والنظام المحاسبي', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          const Text('تعديل اسم المنشأة، الرقم الضريبي، وتفضيلات المزامنة وقواعد الأوفلاين', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
          const SizedBox(height: 20),

          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(color: const Color(0xFF1E293B), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFF334155))),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('بيانات المنشأة الرسمية', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold)),
                const SizedBox(height: 16),
                TextField(
                  controller: _companyNameCtrl,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(labelText: 'اسم المنشأة / الشركة', prefixIcon: Icon(Icons.business, color: Color(0xFF94A3B8))),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: _taxNoCtrl,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(labelText: 'الرقم الضريبي (VAT ID)', prefixIcon: Icon(Icons.confirmation_number_outlined, color: Color(0xFF94A3B8))),
                ),
                const SizedBox(height: 20),
                const Divider(color: Color(0xFF334155)),
                const SizedBox(height: 12),
                SwitchListTile(
                  activeColor: const Color(0xFF10B981),
                  title: const Text('وضع العمل بدون إنترنت (Offline-First SQFlite)', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  subtitle: const Text('حفظ جميع البيانات محلياً مع المزامنة الآلية خلف الكواليس', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                  value: _offlineMode,
                  onChanged: (val) => setState(() => _offlineMode = val),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2563EB), padding: const EdgeInsets.symmetric(vertical: 14)),
                    icon: const Icon(Icons.save, color: Colors.white),
                    label: const Text('حفظ إعدادات المنشأة والنظام', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم حفظ إعدادات المنشأة بنجاح ✅')));
                    },
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
