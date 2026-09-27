import 'package:flutter/material.dart';

class JournalScreen extends StatefulWidget {
  const JournalScreen({Key? key}) : super(key: key);

  @override
  State<JournalScreen> createState() => _JournalScreenState();
}

class _JournalScreenState extends State<JournalScreen> {
  final List<Map<String, dynamic>> _entries = [
    {'id': 'JOU-5001', 'desc': 'إثبات مبيعات بضاعة نقدية', 'debitAcc': '1011 - الصندوق الرئيسي', 'creditAcc': '4011 - مبيعات البضاعة', 'amount': 4500.00, 'date': '2026-09-28', 'balanced': true},
    {'id': 'JOU-5002', 'desc': 'شراء مواد خام ومستلزمات آلتك', 'debitAcc': '5012 - مشتريات البضائع', 'creditAcc': '2011 - حساب الموردين', 'amount': 2100.00, 'date': '2026-09-27', 'balanced': true},
    {'id': 'JOU-5003', 'desc': 'سداد مصاريف كهرباء وصيانة', 'debitAcc': '6015 - مصاريف عمومية', 'creditAcc': '1011 - الصندوق الرئيسي', 'amount': 650.00, 'date': '2026-09-25', 'balanced': true},
  ];

  void _openNewJournalDialog() {
    final descCtrl = TextEditingController();
    final debitCtrl = TextEditingController();
    final creditCtrl = TextEditingController();
    final amountCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (context) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: AlertDialog(
            backgroundColor: const Color(0xFF1E293B),
            title: const Text('إضافة قيد يومية مزدوج جديد 📖', style: TextStyle(color: Colors.white, fontSize: 16)),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: descCtrl,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(labelText: 'بيان وصف القيد', hintText: 'مثال: إثبات إيجار المعرض'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: debitCtrl,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(labelText: 'الحساب المدين (Dr)', hintText: 'مثال: 6021 - مصروفات إيجار'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: creditCtrl,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(labelText: 'الحساب الدائن (Cr)', hintText: 'مثال: 1011 - الصندوق الرئيسي'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: amountCtrl,
                    keyboardType: TextInputType.number,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(labelText: 'المبلغ الإجمالي للقيد (\$)'),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('إلغاء', style: TextStyle(color: Color(0xFF94A3B8))),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2563EB)),
                onPressed: () {
                  if (descCtrl.text.isNotEmpty && amountCtrl.text.isNotEmpty) {
                    final amount = double.tryParse(amountCtrl.text) ?? 0;
                    setState(() {
                      _entries.insert(0, {
                        'id': 'JOU-${5001 + _entries.length}',
                        'desc': descCtrl.text,
                        'debitAcc': debitCtrl.text.isEmpty ? '1011 - الصندوق' : debitCtrl.text,
                        'creditAcc': creditCtrl.text.isEmpty ? '4011 - مبيعات' : creditCtrl.text,
                        'amount': amount,
                        'date': DateTime.now().toString().split(' ')[0],
                        'balanced': true,
                      });
                    });
                    Navigator.pop(context);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('تم ترحيل القيد المزدوج المتوازن إلى الدفتر العام بنجاح ✅')),
                    );
                  }
                },
                child: const Text('ترحيل القيد المزدوج', style: TextStyle(color: Colors.white)),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('الدفتر العام والقيود المزدوجة', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                  SizedBox(height: 4),
                  Text('تسجيل وتتبع القيود اليومية المتوازنة (من حـ/ المدين إلى حـ/ الدائن)', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                ],
              ),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2563EB), padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12)),
                icon: const Icon(Icons.post_add, color: Colors.white, size: 18),
                label: const Text('قيد يومية جديد', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                onPressed: _openNewJournalDialog,
              ),
            ],
          ),
          const SizedBox(height: 20),

          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFF334155)),
            ),
            child: ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _entries.length,
              separatorBuilder: (_, __) => const Divider(color: Color(0xFF334155), height: 16),
              itemBuilder: (context, index) {
                final entry = _entries[index];
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('${entry['id']} - ${entry['desc']}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                        Text('\$${entry['amount'].toStringAsFixed(2)}', style: const TextStyle(color: Color(0xFF10B981), fontWeight: FontWeight.bold, fontSize: 15)),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        const Icon(Icons.arrow_right_alt, color: Color(0xFF10B981), size: 16),
                        const SizedBox(width: 4),
                        Text('من حـ/ ${entry['debitAcc']}', style: const TextStyle(color: Color(0xFF10B981), fontSize: 12)),
                        const SizedBox(width: 16),
                        const Icon(Icons.arrow_back, color: Color(0xFFEF4444), size: 16),
                        const SizedBox(width: 4),
                        Text('إلى حـ/ ${entry['creditAcc']}', style: const TextStyle(color: Color(0xFFEF4444), fontSize: 12)),
                      ],
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
