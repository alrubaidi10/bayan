import 'package:flutter/material.dart';

class BanksScreen extends StatefulWidget {
  const BanksScreen({Key? key}) : super(key: key);

  @override
  State<BanksScreen> createState() => _BanksScreenState();
}

class _BanksScreenState extends State<BanksScreen> {
  final List<Map<String, dynamic>> _vouchers = [
    {'type': 'سند قبض 📥', 'id': 'REC-3015', 'party': 'شركة الأمل للتجارة', 'amount': 1800.00, 'acc': '1011 - الصندوق الرئيسي'},
    {'type': 'سند صرف 📤', 'id': 'PAY-4022', 'party': 'مالك المعرض - الإيجار', 'amount': 950.00, 'acc': '1012 - البنك الأهلي'},
    {'type': 'سند قبض 📥', 'id': 'REC-3016', 'party': 'مؤسسة التقنية الذكية', 'amount': 1250.00, 'acc': '1011 - الصندوق الرئيسي'},
  ];

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('الصناديق والخزينة والبنوك', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          const Text('إدارة أرصدة الحسابات النقدية والبنكية وسندات القبض والصرف', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
          const SizedBox(height: 20),

          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: const Color(0xFF1E293B), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFF334155))),
                  child: const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('الصندوق الرئيسي (1011)', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                      SizedBox(height: 6),
                      Text('\$45,400.00', style: TextStyle(color: Color(0xFF10B981), fontSize: 20, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: const Color(0xFF1E293B), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFF334155))),
                  child: const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('البنك الأهلي (1012)', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                      SizedBox(height: 6),
                      Text('\$50,000.00', style: TextStyle(color: Color(0xFF2563EB), fontSize: 20, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('سندات القبض والصرف الأخيرة', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
              Row(
                children: [
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF10B981)),
                    icon: const Icon(Icons.arrow_downward, color: Colors.white, size: 16),
                    label: const Text('سند قبض جديد', style: TextStyle(color: Colors.white, fontSize: 12)),
                    onPressed: () {},
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEF4444)),
                    icon: const Icon(Icons.arrow_upward, color: Colors.white, size: 16),
                    label: const Text('سند صرف جديد', style: TextStyle(color: Colors.white, fontSize: 12)),
                    onPressed: () {},
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),

          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: const Color(0xFF1E293B), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFF334155))),
            child: ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _vouchers.length,
              separatorBuilder: (_, __) => const Divider(color: Color(0xFF334155), height: 16),
              itemBuilder: (context, index) {
                final v = _vouchers[index];
                final isRec = v['type'].toString().contains('قبض');
                return Row(
                  children: [
                    Icon(isRec ? Icons.call_received : Icons.call_made, color: isRec ? const Color(0xFF10B981) : const Color(0xFFEF4444)),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('${v['type']} - ${v['id']} (${v['party']})', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                          Text('الحساب: ${v['acc']}', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                        ],
                      ),
                    ),
                    Text('${isRec ? '+' : '-'}\$${v['amount'].toStringAsFixed(2)}', style: TextStyle(color: isRec ? const Color(0xFF10B981) : const Color(0xFFEF4444), fontWeight: FontWeight.bold, fontSize: 15)),
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
