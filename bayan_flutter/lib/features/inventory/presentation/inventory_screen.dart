import 'package:flutter/material.dart';

class InventoryScreen extends StatefulWidget {
  const InventoryScreen({Key? key}) : super(key: key);

  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen> {
  final List<Map<String, dynamic>> _products = [
    {'sku': 'PRD-101', 'name': 'شاشة عرض ذكية 55 بوصة 4K', 'stock': 45, 'buyPrice': 450.00, 'sellPrice': 680.00},
    {'sku': 'PRD-102', 'name': 'جهاز كمبيوتر محمول Intel i7', 'stock': 18, 'buyPrice': 850.00, 'sellPrice': 1200.00},
    {'sku': 'PRD-103', 'name': 'طابعة ليفر الفواتير الحرارية', 'stock': 120, 'buyPrice': 65.00, 'sellPrice': 110.00},
    {'sku': 'PRD-104', 'name': 'ماسح باركود لاسلكي 2D', 'stock': 8, 'buyPrice': 35.00, 'sellPrice': 65.00},
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
                  Text('إدارة المخزون والمنتجات', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                  SizedBox(height: 4),
                  Text('دليل الأصناف والمنتجات، تتبع الكميات، وتقييم المخزون المالي (حـ/ 1041)', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                ],
              ),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFF59E0B), padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12)),
                icon: const Icon(Icons.add_box_outlined, color: Colors.white, size: 18),
                label: const Text('إضافة صنف جديد', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('نموذج إضافة منتج جديد للمستودع 📦')));
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
              itemCount: _products.length,
              separatorBuilder: (_, __) => const Divider(color: Color(0xFF334155), height: 16),
              itemBuilder: (context, index) {
                final p = _products[index];
                return Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(color: const Color(0xFF0F172A), borderRadius: BorderRadius.circular(8)),
                      child: const Icon(Icons.inventory_2, color: Color(0xFFF59E0B), size: 22),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('${p['sku']} - ${p['name']}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                          const SizedBox(height: 4),
                          Text('شراء: \$${p['buyPrice']} | بيع: \$${p['sellPrice']}', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text('الكمية: ${p['stock']} قطعة', style: TextStyle(color: p['stock'] < 10 ? const Color(0xFFEF4444) : const Color(0xFF10B981), fontWeight: FontWeight.bold, fontSize: 13)),
                        const SizedBox(height: 4),
                        Text('قيمة: \$${(p['stock'] * p['buyPrice']).toStringAsFixed(2)}', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
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
