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
    {'title': 'إدارة الاشتراكات', 'icon': Icons.card_membership_outlined, 'screen': 'subscriptions'},
    {'title': 'تحويلات مالية', 'icon': Icons.swap_horizontal_circle_outlined},
    {'title': 'حوالات محلية', 'icon': Icons.send_to_mobile_outlined},
    {'title': 'الشحن والسداد', 'icon': Icons.phone_android_outlined},
    {'title': 'شراء اونلاين', 'icon': Icons.shopping_cart_outlined},
    {'title': 'دفع المشتريات', 'icon': Icons.shopping_bag_outlined},
    {'title': 'سحب نقدي', 'icon': Icons.atm_outlined},
    {'title': 'المدفوعات', 'icon': Icons.account_balance_wallet_outlined},
    {'title': 'حسابي والديون', 'icon': Icons.shield_outlined},
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
              'بيان ERP',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
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
              // 1. Top Promo Banner Card
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
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: const BoxDecoration(
                        color: Color(0xFFE50914),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.savings_outlined, color: Colors.white, size: 28),
                    ),
                    const SizedBox(width: 16),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'ابدأ المحاسبة والتنظيم..',
                            style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                          SizedBox(height: 4),
                          Text(
                            'نظام بيان المحاسبي المزدوج يعمل بدون إنترنت',
                            style: TextStyle(color: Color(0xFF9A9DB0), fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // 2. Action Grid (3 columns matching screenshot)
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
                          SnackBar(content: Text('تم النقر على: ${item['title']}')),
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
                              size: 26,
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

              // 3. Transactions Section
              const Text(
                'العمليات الأخيرة',
                style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
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
                      title: Text('فاتورة مبيعات #INV-0001', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                      subtitle: Text('العميل: شركة الألفية', style: TextStyle(color: Color(0xFF9A9DB0))),
                      trailing: Text('+$780.00', style: TextStyle(color: Color(0xFF00C853), fontSize: 15, fontWeight: FontWeight.bold)),
                    ),
                    Divider(color: Color(0xFF2B2C38)),
                    ListTile(
                      leading: CircleAvatar(
                        backgroundColor: Color(0xFF252631),
                        child: Icon(Icons.shopping_bag, color: Color(0xFFFF2D55)),
                      ),
                      title: Text('فاتورة شراء #BILL-0002', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                      subtitle: Text('المورد: التوريدات العالمية', style: TextStyle(color: Color(0xFF9A9DB0))),
                      trailing: Text('-$620.00', style: TextStyle(color: Color(0xFFE50914), fontSize: 15, fontWeight: FontWeight.bold)),
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
          // Open quick action modal (New Invoice / Quick Sale)
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
            BottomNavigationBarItem(icon: Icon(Icons.widgets_outlined), label: 'الخدمات'),
            BottomNavigationBarItem(icon: Icon(Icons.bar_chart), label: 'التقارير'),
            BottomNavigationBarItem(icon: Icon(Icons.person_outline), label: 'الملف'),
          ],
        ),
      ),
    );
  }
}
