import 'package:flutter/material.dart';

class CustomersScreen extends StatefulWidget {
  const CustomersScreen({Key? key}) : super(key: key);

  @override
  State<CustomersScreen> createState() => _CustomersScreenState();
}

class _CustomersScreenState extends State<CustomersScreen> {
  final List<Map<String, dynamic>> _customers = [
    {'name': 'شركة الأمل للتجارة', 'phone': '+966 50 123 4567', 'balance': 4500.00, 'code': 'CUST-101'},
    {'name': 'مؤسسة التقنية الذكية', 'phone': '+966 55 987 6543', 'balance': 1250.00, 'code': 'CUST-102'},
    {'name': 'شركة العالمية للاستيراد', 'phone': '+966 54 321 0987', 'balance': 8900.00, 'code': 'CUST-103'},
    {'name': 'مؤسسة الخليج التجارية', 'phone': '+966 56 654 3210', 'balance': 0.00, 'code': 'CUST-104'},
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
                  Text('العملاء والحسابات المدينة (AR)', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                  SizedBox(height: 4),
                  Text('دليل العملاء، الذمم المدينة، وكشف حساب كل عميل', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                ],
              ),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2563EB), padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12)),
                icon: const Icon(Icons.person_add, color: Colors.white, size: 18),
                label: const Text('إضافة عميل جديد', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('نموذج إضافة عميل جديد')));
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
              itemCount: _customers.length,
              separatorBuilder: (_, __) => const Divider(color: Color(0xFF334155), height: 16),
              itemBuilder: (context, index) {
                final c = _customers[index];
                return Row(
                  children: [
                    CircleAvatar(
                      backgroundColor: const Color(0xFF2563EB).withOpacity(0.2),
                      child: Text(c['name'][0], style: const TextStyle(color: Color(0xFF2563EB), fontWeight: FontWeight.bold)),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('${c['code']} - ${c['name']}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                          const SizedBox(height: 4),
                          Text('الهاتف: ${c['phone']} | حساب 1031 الذمم المدينة', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text('الرصيد: \$${c['balance'].toStringAsFixed(2)}', style: TextStyle(color: c['balance'] > 0 ? const Color(0xFF10B981) : Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                        const SizedBox(height: 4),
                        OutlinedButton(
                          style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2), side: const BorderSide(color: Color(0xFF2563EB))),
                          onPressed: () {
                            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('كشف حساب ${c['name']} 📄')));
                          },
                          child: const Text('كشف حساب', style: TextStyle(color: Color(0xFF2563EB), fontSize: 11)),
                        ),
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
