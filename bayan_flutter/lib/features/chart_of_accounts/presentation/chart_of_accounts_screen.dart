import 'package:flutter/material.dart';

class ChartOfAccountsScreen extends StatefulWidget {
  const ChartOfAccountsScreen({Key? key}) : super(key: key);

  @override
  State<ChartOfAccountsScreen> createState() => _ChartOfAccountsScreenState();
}

class _ChartOfAccountsScreenState extends State<ChartOfAccountsScreen> {
  final List<Map<String, dynamic>> _chart = [
    {
      'code': '1',
      'name': 'الأصول (Assets)',
      'type': 'رئيسي',
      'balance': 188500.00,
      'children': [
        {'code': '1011', 'name': 'الصندوق الرئيسي النقدي', 'type': 'فرعي (مدين)', 'balance': 45400.00},
        {'code': '1012', 'name': 'حساب البنك الأهلي السعودي', 'type': 'فرعي (مدين)', 'balance': 50000.00},
        {'code': '1031', 'name': 'حسابات العملاء (ذمم مدينة)', 'type': 'رئيسي فرعي', 'balance': 34200.00},
        {'code': '1041', 'name': 'مخزون البضائع والمستودع', 'type': 'رئيسي فرعي', 'balance': 58900.00},
      ]
    },
    {
      'code': '2',
      'name': 'الالتزامات (Liabilities)',
      'type': 'رئيسي',
      'balance': 18400.00,
      'children': [
        {'code': '2011', 'name': 'حسابات الموردين (ذمم دائنة)', 'type': 'رئيسي فرعي', 'balance': 18400.00},
      ]
    },
    {
      'code': '3',
      'name': 'حقوق الملكية (Equity)',
      'type': 'رئيسي',
      'balance': 100000.00,
      'children': [
        {'code': '3011', 'name': 'رأس المال المدفوع', 'type': 'فرعي (دائن)', 'balance': 100000.00},
      ]
    },
    {
      'code': '4',
      'name': 'الإيرادات (Revenue)',
      'type': 'رئيسي',
      'balance': 148250.00,
      'children': [
        {'code': '4011', 'name': 'إيرادات مبيعات المنتجات', 'type': 'فرعي (دائن)', 'balance': 148250.00},
      ]
    },
    {
      'code': '5',
      'name': 'المصروفات (Expenses)',
      'type': 'رئيسي',
      'balance': 42100.00,
      'children': [
        {'code': '5011', 'name': 'تكلفة البضاعة المباعة', 'type': 'فرعي (مدين)', 'balance': 31100.00},
        {'code': '6011', 'name': 'مصروفات الإيجار والكهرباء', 'type': 'فرعي (مدين)', 'balance': 11000.00},
      ]
    },
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
                  Text('شجرة ودليل الحسابات الشامل', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                  SizedBox(height: 4),
                  Text('الهيكل الشجري للحسابات الرئيسية والفرعية ومجاميع ميزان المراجعة', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                ],
              ),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2563EB), padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12)),
                icon: const Icon(Icons.account_tree_outlined, color: Colors.white, size: 18),
                label: const Text('إضافة حساب جديد', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('نموذج إضافة حساب فرعي جديد لشجرة الحسابات')));
                },
              ),
            ],
          ),
          const SizedBox(height: 20),

          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _chart.length,
            itemBuilder: (context, index) {
              final root = _chart[index];
              final children = root['children'] as List<Map<String, dynamic>>;
              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFF334155)),
                ),
                child: ExpansionTile(
                  leading: const Icon(Icons.folder_special, color: Color(0xFF2563EB)),
                  title: Text('${root['code']} - ${root['name']}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                  subtitle: Text('النوع: ${root['type']} | الرصيد: \$${root['balance'].toStringAsFixed(2)}', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                  children: children.map((sub) {
                    return Container(
                      margin: const EdgeInsets.only(right: 24, left: 16, bottom: 8),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFF0F172A),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFF334155)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.subdirectory_arrow_right, color: Color(0xFF10B981), size: 18),
                              const SizedBox(width: 8),
                              Text('${sub['code']} - ${sub['name']}', style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
                            ],
                          ),
                          Text('\$${sub['balance'].toStringAsFixed(2)}', style: const TextStyle(color: Color(0xFF10B981), fontWeight: FontWeight.bold, fontSize: 13)),
                        ],
                      ),
                    );
                  }).toList(),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
