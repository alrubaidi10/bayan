import 'package:flutter/material.dart';

class PurchasesScreen extends StatefulWidget {
  const PurchasesScreen({Key? key}) : super(key: key);

  @override
  State<PurchasesScreen> createState() => _PurchasesScreenState();
}

class _PurchasesScreenState extends State<PurchasesScreen> {
  final List<Map<String, dynamic>> _bills = [
    {'id': 'PUR-2001', 'vendor': 'شركة التوريدات العالمية', 'date': '2026-09-28', 'total': 6200.00, 'status': 'مرحل 🔵'},
    {'id': 'PUR-2002', 'vendor': 'مستودع الشرق للمعدات', 'date': '2026-09-26', 'total': 3400.00, 'status': 'مستحق 🟡'},
    {'id': 'PUR-2003', 'vendor': 'شركة التكنولوجيا المتقدمة', 'date': '2026-09-20', 'total': 15800.00, 'status': 'مكتمـل 🟢'},
  ];

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
                  Text('إدارة المشتريات والموردين', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                  SizedBox(height: 4),
                  Text('تسجيل وتتبع فواتير الشراء وحسابات الموردين (الالتزامات)', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                ],
              ),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEF4444), padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12)),
                icon: const Icon(Icons.add_shopping_cart, color: Colors.white, size: 18),
                label: const Text('فاتورة مشتريات جديدة', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('تم إطلاق نموذج تسجيل فاتورة مشتريات جديدة 🛒')),
                  );
                },
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
              itemCount: _bills.length,
              separatorBuilder: (_, __) => const Divider(color: Color(0xFF334155), height: 16),
              itemBuilder: (context, index) {
                final bill = _bills[index];
                return Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(color: const Color(0xFF0F172A), borderRadius: BorderRadius.circular(8)),
                      child: const Icon(Icons.shopping_bag_outlined, color: Color(0xFFEF4444), size: 22),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('${bill['id']} - ${bill['vendor']}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                          const SizedBox(height: 4),
                          Text('التاريخ: ${bill['date']} | قيد دائن 2011 (الموردين)', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text('-\$${bill['total'].toStringAsFixed(2)}', style: const TextStyle(color: Color(0xFFEF4444), fontWeight: FontWeight.bold, fontSize: 15)),
                        const SizedBox(height: 4),
                        Text(bill['status'] as String, style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
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
