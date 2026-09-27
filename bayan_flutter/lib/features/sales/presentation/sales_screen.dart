import 'package:flutter/material.dart';

class SalesScreen extends StatefulWidget {
  const SalesScreen({Key? key}) : super(key: key);

  @override
  State<SalesScreen> createState() => _SalesScreenState();
}

class _SalesScreenState extends State<SalesScreen> {
  final List<Map<String, dynamic>> _invoices = [
    {'id': 'INV-1001', 'customer': 'شركة الأمل للتجارة', 'date': '2026-09-28', 'total': 4500.00, 'tax': 675.00, 'status': 'مدفوع 🟢'},
    {'id': 'INV-1002', 'customer': 'مؤسسة التقنية الذكية', 'date': '2026-09-27', 'total': 1250.00, 'tax': 187.50, 'status': 'مستحق 🟡'},
    {'id': 'INV-1003', 'customer': 'شركة العالمية للاستيراد', 'date': '2026-09-25', 'total': 8900.00, 'tax': 1335.00, 'status': 'مدفوع 🟢'},
    {'id': 'INV-1004', 'customer': 'مؤسسة الخليج التجارية', 'date': '2026-09-22', 'total': 3100.00, 'tax': 465.00, 'status': 'مسودة ⚪'},
  ];

  void _openNewInvoiceDialog() {
    final customerCtrl = TextEditingController();
    final amountCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (context) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: AlertDialog(
            backgroundColor: const Color(0xFF1E293B),
            title: const Text('إصدار فاتورة مبيعات جديدة 🧾', style: TextStyle(color: Colors.white, fontSize: 16)),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: customerCtrl,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(labelText: 'اسم العميل / الشركاء', hintText: 'مثال: شركة الرواد'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: amountCtrl,
                  keyboardType: TextInputType.number,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(labelText: 'المبلغ الإجمالي (\$)'),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('إلغاء', style: TextStyle(color: Color(0xFF94A3B8))),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF10B981)),
                onPressed: () {
                  if (customerCtrl.text.isNotEmpty && amountCtrl.text.isNotEmpty) {
                    final amount = double.tryParse(amountCtrl.text) ?? 0;
                    setState(() {
                      _invoices.insert(0, {
                        'id': 'INV-${1001 + _invoices.length}',
                        'customer': customerCtrl.text,
                        'date': DateTime.now().toString().split(' ')[0],
                        'total': amount,
                        'tax': amount * 0.15,
                        'status': 'مدفوع 🟢',
                      });
                    });
                    Navigator.pop(context);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('تم إصدار فاتورة المبيعات وتوليد القيد الآلي بنجاح ✅')),
                    );
                  }
                },
                child: const Text('إصدار الفاتورة والقيد', style: TextStyle(color: Colors.white)),
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
                  Text('إدارة المبيعات والفواتير', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                  SizedBox(height: 4),
                  Text('إصدار وتتبع فواتير المبيعات مع توليد قيود المبيعات والضريبة آلياً', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                ],
              ),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF10B981), padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12)),
                icon: const Icon(Icons.add_shopping_cart, color: Colors.white, size: 18),
                label: const Text('فاتورة مبيعات جديدة', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                onPressed: _openNewInvoiceDialog,
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
              itemCount: _invoices.length,
              separatorBuilder: (_, __) => const Divider(color: Color(0xFF334155), height: 16),
              itemBuilder: (context, index) {
                final inv = _invoices[index];
                return Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(color: const Color(0xFF0F172A), borderRadius: BorderRadius.circular(8)),
                      child: const Icon(Icons.receipt_long, color: Color(0xFF10B981), size: 22),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('${inv['id']} - ${inv['customer']}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                          const SizedBox(height: 4),
                          Text('التاريخ: ${inv['date']} | الضريبة (15%): \$${inv['tax'].toStringAsFixed(2)}', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text('\$${inv['total'].toStringAsFixed(2)}', style: const TextStyle(color: Color(0xFF10B981), fontWeight: FontWeight.bold, fontSize: 15)),
                        const SizedBox(height: 4),
                        Text(inv['status'] as String, style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
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
