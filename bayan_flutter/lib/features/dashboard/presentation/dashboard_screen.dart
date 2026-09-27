import 'package:flutter/material.dart';
import '../../subscriptions/presentation/subscriptions_admin_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({Key? key}) : super(key: key);

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _selectedIndex = 0;

  final List<Map<String, dynamic>> _gridActions = [
    {'title': 'فواتير المبيعات', 'icon': Icons.point_of_sale_outlined, 'screen': 'sales'},
    {'title': 'فواتير المشتريات', 'icon': Icons.shopping_cart_outlined, 'screen': 'purchases'},
    {'title': 'سندات القبض', 'icon': Icons.arrow_downward_outlined, 'screen': 'receipts'},
    {'title': 'سندات الصرف', 'icon': Icons.arrow_upward_outlined, 'screen': 'payments'},
    {'title': 'القيود اليومية', 'icon': Icons.menu_book_outlined, 'screen': 'journal'},
    {'title': 'شجرة الحسابات', 'icon': Icons.account_tree_outlined, 'screen': 'accounts'},
    {'title': 'إدارة المخزون', 'icon': Icons.inventory_2_outlined, 'screen': 'inventory'},
    {'title': 'التقارير المالية', 'icon': Icons.assessment_outlined, 'screen': 'reports'},
    {'title': 'إدارة الاشتراكات', 'icon': Icons.card_membership_outlined, 'screen': 'subscriptions'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF121318),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1C1D24),
        title: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: const Color(0xFFE50914),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.account_balance, color: Colors.white, size: 20),
            ),
            const SizedBox(width: 8),
            const Text(
              'نظام بيان المحاسبي ERP',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_none, color: Colors.white),
            onPressed: () {},
          ),
        ],
      ),
      body: Directionality(
        textDirection: TextDirection.rtl,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Top Accounting Header Summary
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF8B0000), Color(0xFF1C1D24)],
                    begin: Alignment.topRight,
                    end: Alignment.bottomLeft,
                  ),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE50914).withOpacity(0.5)),
                ),
                child: Column(
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: const BoxDecoration(
                            color: Color(0xFFE50914),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.analytics_outlined, color: Colors.white, size: 24),
                        ),
                        const SizedBox(width: 12),
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'نظام المحاسبة المزدوجة والمخزون',
                                style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                              ),
                              SizedBox(height: 2),
                              Text(
                                'يعمل أوفلاين مع المزامنة السحابية وتتبع الاشتراكات',
                                style: TextStyle(color: Color(0xFF9A9DB0), fontSize: 12),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        _buildKpiSummary('إجمالي المبيعات', '+\$12,450.00', const Color(0xFF00C853)),
                        Container(width: 1, height: 35, color: const Color(0xFF2B2C38)),
                        _buildKpiSummary('إجمالي المشتريات', '-\$4,120.00', const Color(0xFFFF2D55)),
                        Container(width: 1, height: 35, color: const Color(0xFF2B2C38)),
                        _buildKpiSummary('صافي الأرباح', '+\$8,330.00', const Color(0xFFFFAB00)),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              const Text(
                'وحدات النظام المحاسبي والإداري',
                style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),

              // 2. ERP Action Grid (3 columns matching user UI design preference)
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                  childAspectRatio: 0.95,
                ),
                itemCount: _gridActions.length,
                itemBuilder: (context, index) {
                  final item = _gridActions[index];
                  return InkWell(
                    onTap: () {
                      if (item['screen'] == 'subscriptions') {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const SubscriptionsAdminScreen()),
                        );
                      } else {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('تم فتح وحدة: ${item['title']}')),
                        );
                      }
                    },
                    borderRadius: BorderRadius.circular(14),
                    child: Container(
                      decoration: BoxDecoration(
                        color: const Color(0xFF1C1D24),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFF2B2C38)),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: const Color(0xFF252631),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: const Color(0xFFE50914).withOpacity(0.3)),
                            ),
                            child: Icon(
                              item['icon'] as IconData,
                              color: const Color(0xFFE50914),
                              size: 24,
                            ),
                          ),
                          const SizedBox(height: 10),
                          Text(
                            item['title'] as String,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
              const SizedBox(height: 24),

              // 3. Accounting Transactions Section
              const Text(
                'أحدث القيود والفواتير المحاسبية',
                style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF1C1D24),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFF2B2C38)),
                ),
                child: const Column(
                  children: [
                    ListTile(
                      leading: CircleAvatar(
                        backgroundColor: Color(0xFF252631),
                        child: Icon(Icons.receipt_long, color: Color(0xFFE50914)),
                      ),
                      title: Text('فاتورة مبيعات #INV-1001', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                      subtitle: Text('العميل: شركة الأمل - قيد آلي 401/101', style: TextStyle(color: Color(0xFF9A9DB0), fontSize: 12)),
                      trailing: Text('+\$1,250.00', style: TextStyle(color: Color(0xFF00C853), fontSize: 14, fontWeight: FontWeight.bold)),
                    ),
                    Divider(color: Color(0xFF2B2C38)),
                    ListTile(
                      leading: CircleAvatar(
                        backgroundColor: Color(0xFF252631),
                        child: Icon(Icons.shopping_bag, color: Color(0xFFFF2D55)),
                      ),
                      title: Text('فاتورة شراء #PUR-2005', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                      subtitle: Text('المورد: شركة التوريدات - قيد آلي 501/201', style: TextStyle(color: Color(0xFF9A9DB0), fontSize: 12)),
                      trailing: Text('-\$620.00', style: TextStyle(color: Color(0xFFE50914), fontSize: 14, fontWeight: FontWeight.bold)),
                    ),
                    Divider(color: Color(0xFF2B2C38)),
                    ListTile(
                      leading: CircleAvatar(
                        backgroundColor: Color(0xFF252631),
                        child: Icon(Icons.arrow_downward, color: Color(0xFF00C853)),
                      ),
                      title: Text('سند قبض #REC-3012', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                      subtitle: Text('الصندوق الرئيسي - سداد حساب عميل', style: TextStyle(color: Color(0xFF9A9DB0), fontSize: 12)),
                      trailing: Text('+\$500.00', style: TextStyle(color: Color(0xFF00C853), fontSize: 14, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          _showQuickAddMenu(context);
        },
        backgroundColor: const Color(0xFFE50914),
        child: const Icon(Icons.add, color: Colors.white, size: 28),
      ),
      bottomNavigationBar: Directionality(
        textDirection: TextDirection.rtl,
        child: BottomNavigationBar(
          currentIndex: _selectedIndex,
          onTap: (index) => setState(() => _selectedIndex = index),
          backgroundColor: const Color(0xFF1C1D24),
          selectedItemColor: const Color(0xFFE50914),
          unselectedItemColor: const Color(0xFF9A9DB0),
          items: const [
            BottomNavigationBarItem(icon: Icon(Icons.home), label: 'الرئيسية'),
            BottomNavigationBarItem(icon: Icon(Icons.menu_book), label: 'الدفاتر'),
            BottomNavigationBarItem(icon: Icon(Icons.bar_chart), label: 'القوائم المالية'),
            BottomNavigationBarItem(icon: Icon(Icons.person_outline), label: 'الملف والترخيص'),
          ],
        ),
      ),
    );
  }

  Widget _buildKpiSummary(String title, String val, Color color) {
    return Column(
      children: [
        Text(title, style: const TextStyle(color: Color(0xFF9A9DB0), fontSize: 11)),
        const SizedBox(height: 4),
        Text(val, style: TextStyle(color: color, fontSize: 13, fontWeight: FontWeight.bold)),
      ],
    );
  }

  void _showQuickAddMenu(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1C1D24),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'إضافة قيد أو فاتورة جديدة ➕',
                  style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 16),
                ListTile(
                  leading: const Icon(Icons.receipt_long, color: Color(0xFF00C853)),
                  title: const Text('فاتورة مبيعات جديدة', style: TextStyle(color: Colors.white)),
                  onTap: () => Navigator.pop(context),
                ),
                ListTile(
                  leading: const Icon(Icons.shopping_bag, color: Color(0xFFFF2D55)),
                  title: const Text('فاتورة مشتريات جديدة', style: TextStyle(color: Colors.white)),
                  onTap: () => Navigator.pop(context),
                ),
                ListTile(
                  leading: const Icon(Icons.menu_book, color: Color(0xFFE50914)),
                  title: const Text('قيد يومية مزدوج جديد', style: TextStyle(color: Colors.white)),
                  onTap: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
