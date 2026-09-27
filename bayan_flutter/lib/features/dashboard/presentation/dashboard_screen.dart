import 'package:flutter/material.dart';
import '../../auth/presentation/login_screen.dart';
import '../../sales/presentation/sales_screen.dart';
import '../../purchases/presentation/purchases_screen.dart';
import '../../customers/presentation/customers_screen.dart';
import '../../journal/presentation/journal_screen.dart';
import '../../chart_of_accounts/presentation/chart_of_accounts_screen.dart';
import '../../inventory/presentation/inventory_screen.dart';
import '../../banks/presentation/banks_screen.dart';
import '../../reports/presentation/reports_screen.dart';
import '../../subscriptions/presentation/subscriptions_admin_screen.dart';
import '../../settings/presentation/settings_screen.dart';

class DashboardScreen extends StatefulWidget {
  final String userEmail;
  final bool isAdminOwner;

  const DashboardScreen({
    Key? key,
    this.userEmail = 'admin@admin.com',
    this.isAdminOwner = true,
  }) : super(key: key);

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _selectedNavIndex = 0;
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  final List<Map<String, dynamic>> _navigationItems = [
    {'title': 'لوحة التحكم الرئيسية', 'icon': Icons.dashboard_outlined, 'tag': 'dashboard'},
    {'title': 'المبيعات والفواتير', 'icon': Icons.point_of_sale_outlined, 'tag': 'sales'},
    {'title': 'المشتريات والموردين', 'icon': Icons.shopping_cart_outlined, 'tag': 'purchases'},
    {'title': 'العملاء والحسابات المدينة', 'icon': Icons.people_alt_outlined, 'tag': 'customers'},
    {'title': 'الدفتر العام والقيود المزدوجة', 'icon': Icons.menu_book_outlined, 'tag': 'journal'},
    {'title': 'شجرة ودليل الحسابات', 'icon': Icons.account_tree_outlined, 'tag': 'chart_of_accounts'},
    {'title': 'إدارة المخزون والمنتجات', 'icon': Icons.inventory_2_outlined, 'tag': 'inventory'},
    {'title': 'النقدية والبنوك والصناديق', 'icon': Icons.account_balance_outlined, 'tag': 'banks'},
    {'title': 'القوائم والتقارير المالية', 'icon': Icons.analytics_outlined, 'tag': 'reports'},
    {'title': 'إدارة الاشتراكات والتراخيص', 'icon': Icons.verified_user_outlined, 'tag': 'subscriptions'},
    {'title': 'إعدادات المنشأة والنظام', 'icon': Icons.settings_outlined, 'tag': 'settings'},
  ];

  Widget _buildSelectedScreenContent() {
    switch (_selectedNavIndex) {
      case 0:
        return _buildDashboardOverviewBody();
      case 1:
        return const SalesScreen();
      case 2:
        return const PurchasesScreen();
      case 3:
        return const CustomersScreen();
      case 4:
        return const JournalScreen();
      case 5:
        return const ChartOfAccountsScreen();
      case 6:
        return const InventoryScreen();
      case 7:
        return const BanksScreen();
      case 8:
        return const ReportsScreen();
      case 9:
        return const SubscriptionsAdminScreen();
      case 10:
        return const SettingsScreen();
      default:
        return _buildDashboardOverviewBody();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: const Color(0xFF0F172A),
      drawer: _buildErpSidebarDrawer(context),
      appBar: _buildErpTopAppBar(context),
      body: Directionality(
        textDirection: TextDirection.rtl,
        child: _buildSelectedScreenContent(),
      ),
    );
  }

  Widget _buildDashboardOverviewBody() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildFiscalYearBanner(),
          const SizedBox(height: 20),

          LayoutBuilder(
            builder: (context, constraints) {
              int crossCount = constraints.maxWidth > 900 ? 4 : (constraints.maxWidth > 600 ? 2 : 1);
              return GridView.count(
                crossAxisCount: crossCount,
                crossAxisSpacing: 16,
                mainAxisSpacing: 16,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                childAspectRatio: constraints.maxWidth > 900 ? 1.6 : 2.1,
                children: [
                  _buildKpiMetricCard(
                    title: 'إجمالي مبيعات الفترة',
                    value: '\$148,250.00',
                    trend: '+14.5% عن الشهر السابق',
                    isPositiveTrend: true,
                    icon: Icons.trending_up,
                    accentColor: const Color(0xFF10B981),
                  ),
                  _buildKpiMetricCard(
                    title: 'إجمالي المشتريات والمصروفات',
                    value: '\$42,100.00',
                    trend: '-2.4% انخفاض النفقات',
                    isPositiveTrend: true,
                    icon: Icons.trending_down,
                    accentColor: const Color(0xFFEF4444),
                  ),
                  _buildKpiMetricCard(
                    title: 'صافي الأرباح التشغيلية',
                    value: '\$106,150.00',
                    trend: 'هامش أرباح 71.6%',
                    isPositiveTrend: true,
                    icon: Icons.account_balance_wallet_outlined,
                    accentColor: const Color(0xFF2563EB),
                  ),
                  _buildKpiMetricCard(
                    title: 'السيولة المتوفرة بالخزينة',
                    value: '\$95,400.00',
                    trend: 'الصناديق والبنك الأهلي',
                    isPositiveTrend: true,
                    icon: Icons.savings_outlined,
                    accentColor: const Color(0xFFF59E0B),
                  ),
                ],
              );
            },
          ),
          const SizedBox(height: 24),

          _buildQuickAccountingActions(context),
          const SizedBox(height: 24),

          LayoutBuilder(
            builder: (context, constraints) {
              if (constraints.maxWidth > 1000) {
                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(flex: 3, child: _buildRecentJournalEntriesTable()),
                    const SizedBox(width: 20),
                    Expanded(flex: 2, child: _buildAccountsBreakdownWidget()),
                  ],
                );
              } else {
                return Column(
                  children: [
                    _buildRecentJournalEntriesTable(),
                    const SizedBox(height: 20),
                    _buildAccountsBreakdownWidget(),
                  ],
                );
              }
            },
          ),
        ],
      ),
    );
  }

  PreferredSizeWidget _buildErpTopAppBar(BuildContext context) {
    return AppBar(
      backgroundColor: const Color(0xFF1E293B),
      elevation: 1,
      leading: IconButton(
        icon: const Icon(Icons.menu, color: Colors.white),
        onPressed: () => _scaffoldKey.currentState?.openDrawer(),
      ),
      title: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(7),
            decoration: BoxDecoration(
              color: const Color(0xFF2563EB),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.account_balance, color: Colors.white, size: 20),
          ),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _navigationItems[_selectedNavIndex]['title'] as String,
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
              ),
              const Text(
                'بيان BAYAN ERP - نظام محاسبي متكامل',
                style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
              ),
            ],
          ),
        ],
      ),
      actions: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: const Color(0xFF10B981).withOpacity(0.15),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFF10B981).withOpacity(0.4)),
          ),
          child: const Row(
            children: [
              Icon(Icons.wifi, color: Color(0xFF10B981), size: 14),
              SizedBox(width: 6),
              Text(
                'أوفلاين متزامن 🟢',
                style: TextStyle(color: Color(0xFF10B981), fontSize: 11, fontWeight: FontWeight.bold),
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        IconButton(
          icon: const Icon(Icons.logout, color: Color(0xFFEF4444)),
          tooltip: 'تسجيل الخروج',
          onPressed: () {
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(builder: (_) => const LoginScreen()),
            );
          },
        ),
        const SizedBox(width: 8),
      ],
    );
  }

  Widget _buildErpSidebarDrawer(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Drawer(
        backgroundColor: const Color(0xFF0F172A),
        child: Column(
          children: [
            UserAccountsDrawerHeader(
              decoration: const BoxDecoration(
                color: Color(0xFF1E293B),
              ),
              currentAccountPicture: CircleAvatar(
                backgroundColor: const Color(0xFF2563EB),
                child: Image.asset(
                  'assets/images/bayan_logo.png',
                  height: 40,
                  errorBuilder: (context, error, stackTrace) => const Icon(Icons.account_balance, color: Colors.white, size: 28),
                ),
              ),
              accountName: Text(
                widget.isAdminOwner ? 'مالك التطبيق (الآدمن) 🛡️' : 'مستخدم بيان ERP',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
              ),
              accountEmail: Text(
                widget.userEmail,
                style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
              ),
            ),

            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                itemCount: _navigationItems.length,
                itemBuilder: (context, index) {
                  final item = _navigationItems[index];
                  final bool isSelected = _selectedNavIndex == index;
                  return Container(
                    margin: const EdgeInsets.only(bottom: 4),
                    decoration: BoxDecoration(
                      color: isSelected ? const Color(0xFF2563EB) : Colors.transparent,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: ListTile(
                      leading: Icon(
                        item['icon'] as IconData,
                        color: isSelected ? Colors.white : const Color(0xFF94A3B8),
                        size: 22,
                      ),
                      title: Text(
                        item['title'] as String,
                        style: TextStyle(
                          color: isSelected ? Colors.white : const Color(0xFFF8FAFC),
                          fontSize: 13,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                        ),
                      ),
                      onTap: () {
                        setState(() => _selectedNavIndex = index);
                        Navigator.pop(context);
                      },
                    ),
                  );
                },
              ),
            ),
            const Divider(color: Color(0xFF334155)),
            const Padding(
              padding: EdgeInsets.all(12.0),
              child: Text(
                'إصدار بيان المحاسبي 2.0.0 © 2026',
                style: TextStyle(color: Color(0xFF64748B), fontSize: 11),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFiscalYearBanner() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF334155)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFF2563EB).withOpacity(0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.business_center_outlined, color: Color(0xFF2563EB), size: 26),
          ),
          const SizedBox(width: 14),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'المركز الرئيسي للمنشأة - السنة المالية 2026',
                  style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
                ),
                SizedBox(height: 3),
                Text(
                  'نظام دفتري مزدوج متكامل مع دليل الحسابات وتتبع الأصول والمخزون',
                  style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                ),
              ],
            ),
          ),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF2563EB),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            icon: const Icon(Icons.picture_as_pdf_outlined, size: 18, color: Colors.white),
            label: const Text('تقرير ميزان المراجعة', style: TextStyle(color: Colors.white, fontSize: 13)),
            onPressed: () {
              setState(() => _selectedNavIndex = 8);
            },
          ),
        ],
      ),
    );
  }

  Widget _buildKpiMetricCard({
    required String title,
    required String value,
    required String trend,
    required bool isPositiveTrend,
    required IconData icon,
    required Color accentColor,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF334155)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(title, style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12, fontWeight: FontWeight.w500)),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: accentColor.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: accentColor, size: 20),
              ),
            ],
          ),
          Text(
            value,
            style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
          ),
          Row(
            children: [
              Icon(
                isPositiveTrend ? Icons.arrow_upward : Icons.arrow_downward,
                color: accentColor,
                size: 14,
              ),
              const SizedBox(width: 4),
              Text(
                trend,
                style: TextStyle(color: accentColor, fontSize: 11, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildQuickAccountingActions(BuildContext context) {
    final actions = [
      {'title': 'فاتورة مبيعات', 'icon': Icons.add_shopping_cart, 'color': const Color(0xFF10B981), 'index': 1},
      {'title': 'فاتورة مشتريات', 'icon': Icons.shopping_bag_outlined, 'color': const Color(0xFFEF4444), 'index': 2},
      {'title': 'قيد يومية جديد', 'icon': Icons.post_add_outlined, 'color': const Color(0xFF2563EB), 'index': 4},
      {'title': 'سند قبض / صرف', 'icon': Icons.call_received_outlined, 'color': const Color(0xFFF59E0B), 'index': 7},
      {'title': 'إدارة الاشتراكات', 'icon': Icons.verified_user_outlined, 'color': const Color(0xFF6366F1), 'index': 9},
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'الإجراءات والقيود المحاسبية السريعة',
          style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: actions.map((act) {
              return Container(
                margin: const EdgeInsets.only(left: 12),
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1E293B),
                    surfaceTintColor: Colors.transparent,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                      side: BorderSide(color: (act['color'] as Color).withOpacity(0.4)),
                    ),
                  ),
                  icon: Icon(act['icon'] as IconData, color: act['color'] as Color, size: 18),
                  label: Text(
                    act['title'] as String,
                    style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                  onPressed: () {
                    setState(() => _selectedNavIndex = act['index'] as int);
                  },
                ),
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _buildRecentJournalEntriesTable() {
    final entries = [
      {'id': '#INV-1004', 'desc': 'فاتورة مبيعات آلتك الحديثة', 'account': '4011 - مبيعات البضاعة', 'amount': '+\$4,500.00', 'status': 'مكتمل 🟢', 'color': const Color(0xFF10B981)},
      {'id': '#PUR-2009', 'desc': 'فاتورة توريد خامات وشاشات', 'account': '5012 - مشتريات المخزون', 'amount': '-\$2,100.00', 'status': 'مرحل 🔵', 'color': const Color(0xFF2563EB)},
      {'id': '#REC-3015', 'desc': 'سند قبض نقدي من مؤسسة النور', 'account': '1011 - الصندوق الرئيسي', 'amount': '+\$1,800.00', 'status': 'مكتمل 🟢', 'color': const Color(0xFF10B981)},
      {'id': '#PAY-4022', 'desc': 'سند صرف سداد إيجار المعرض', 'account': '6021 - مصروفات عمومية', 'amount': '-\$950.00', 'status': 'مستحق 🟡', 'color': const Color(0xFFF59E0B)},
      {'id': '#JOU-5001', 'desc': 'قيد تسوية إهلاك الأصول الثابتة', 'account': '1050 - مجمع الإهلاك', 'amount': '-\$350.00', 'status': 'مكتمل 🟢', 'color': const Color(0xFF10B981)},
    ];

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF334155)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'أحدث القيود والفواتير المحاسبية',
                style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
              ),
              TextButton(
                onPressed: () => setState(() => _selectedNavIndex = 4),
                child: const Text('عرض كافة القيود (الدفتر العام)', style: TextStyle(color: Color(0xFF2563EB), fontSize: 12)),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: entries.length,
            separatorBuilder: (_, __) => const Divider(color: Color(0xFF334155), height: 16),
            itemBuilder: (context, index) {
              final e = entries[index];
              return Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F172A),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFF334155)),
                    ),
                    child: const Icon(Icons.receipt_long_outlined, color: Color(0xFF2563EB), size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              e['id'] as String,
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              e['desc'] as String,
                              style: const TextStyle(color: Color(0xFFF8FAFC), fontSize: 12),
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          e['account'] as String,
                          style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        e['amount'] as String,
                        style: TextStyle(color: e['color'] as Color, fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        e['status'] as String,
                        style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                      ),
                    ],
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildAccountsBreakdownWidget() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF334155)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'توزيع شجرة الحسابات والأصول',
            style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 16),
          _buildAccountCategoryRow('الأصول المتداولة (الصناديق والبنك)', '\$95,400.00', 0.85, const Color(0xFF10B981)),
          const SizedBox(height: 14),
          _buildAccountCategoryRow('حسابات العملاء (الذمم المدينة)', '\$34,200.00', 0.60, const Color(0xFF2563EB)),
          const SizedBox(height: 14),
          _buildAccountCategoryRow('مخزون البضائع والمعدات', '\$58,900.00', 0.72, const Color(0xFFF59E0B)),
          const SizedBox(height: 14),
          _buildAccountCategoryRow('حسابات الموردين (الالتزامات)', '\$18,400.00', 0.30, const Color(0xFFEF4444)),
        ],
      ),
    );
  }

  Widget _buildAccountCategoryRow(String title, String val, double progress, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(title, style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
            Text(val, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
          ],
        ),
        const SizedBox(height: 6),
        LinearProgressIndicator(
          value: progress,
          backgroundColor: const Color(0xFF0F172A),
          color: color,
          minHeight: 6,
          borderRadius: BorderRadius.circular(4),
        ),
      ],
    );
  }
}
