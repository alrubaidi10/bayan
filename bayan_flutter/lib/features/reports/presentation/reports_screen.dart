import 'package:flutter/material.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({Key? key}) : super(key: key);

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
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
                  Text('القوائم والتقارير المالية الشاملة', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                  SizedBox(height: 4),
                  Text('ميزان المراجعة بالمجاميع والأرصدة، قائمة الدخل، والميزانية العمومية', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                ],
              ),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2563EB), padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12)),
                icon: const Icon(Icons.print_outlined, color: Colors.white, size: 18),
                label: const Text('طباعة وتصدير PDF', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('جاري تصدير التقرير المالي إلى PDF 📄')));
                },
              ),
            ],
          ),
          const SizedBox(height: 20),

          TabBar(
            controller: _tabController,
            indicatorColor: const Color(0xFF2563EB),
            labelColor: const Color(0xFF2563EB),
            unselectedLabelColor: const Color(0xFF94A3B8),
            tabs: const [
              Tab(text: 'ميزان المراجعة (Trial Balance)'),
              Tab(text: 'قائمة الدخل (Profit & Loss)'),
              Tab(text: 'الميزانية العمومية (Balance Sheet)'),
            ],
          ),
          const SizedBox(height: 16),

          SizedBox(
            height: 400,
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildTrialBalanceTab(),
                _buildProfitAndLossTab(),
                _buildBalanceSheetTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTrialBalanceTab() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: const Color(0xFF1E293B), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFF334155))),
      child: Column(
        children: [
          const Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('كود وحساب شجرة الحسابات', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12, fontWeight: FontWeight.bold)),
              Row(
                children: [
                  Text('مجموع مدين', style: TextStyle(color: Color(0xFF10B981), fontSize: 12, fontWeight: FontWeight.bold)),
                  SizedBox(width: 40),
                  Text('مجموع دائن', style: TextStyle(color: Color(0xFFEF4444), fontSize: 12, fontWeight: FontWeight.bold)),
                ],
              ),
            ],
          ),
          const Divider(color: Color(0xFF334155)),
          _buildTbRow('1011 - الصندوق الرئيسي', '\$45,400.00', '\$0.00'),
          _buildTbRow('1012 - البنك الأهلي السعودي', '\$50,000.00', '\$0.00'),
          _buildTbRow('1031 - حسابات الذمم المدينة', '\$34,200.00', '\$0.00'),
          _buildTbRow('2011 - حسابات الموردين (الدائنين)', '\$0.00', '\$18,400.00'),
          _buildTbRow('4011 - إيرادات مبيعات المنتجات', '\$0.00', '\$148,250.00'),
          _buildTbRow('5011 - تكلفة البضائع المباعة', '\$31,100.00', '\$0.00'),
          const Spacer(),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: const Color(0xFF0F172A), borderRadius: BorderRadius.circular(8)),
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('المجموع الإجمالي لميزان المراجعة (متوازن 🟢)', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                Text('\$160,700.00 | \$160,700.00', style: TextStyle(color: Color(0xFF10B981), fontWeight: FontWeight.bold, fontSize: 13)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTbRow(String name, String debit, String credit) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(name, style: const TextStyle(color: Colors.white, fontSize: 13)),
          Row(
            children: [
              SizedBox(width: 80, child: Text(debit, style: const TextStyle(color: Color(0xFF10B981), fontSize: 13, fontWeight: FontWeight.w600))),
              SizedBox(width: 80, child: Text(credit, style: const TextStyle(color: Color(0xFFEF4444), fontSize: 13, fontWeight: FontWeight.w600))),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildProfitAndLossTab() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: const Color(0xFF1E293B), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFF334155))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildPlRow('إجمالي إيرادات المبيعات (+)', '\$148,250.00', const Color(0xFF10B981)),
          _buildPlRow('خصم: تكلفة المبيعات والمشتريات (-)', '-\$31,100.00', const Color(0xFFEF4444)),
          const Divider(color: Color(0xFF334155)),
          _buildPlRow('مجمل الربح (Gross Profit)', '\$117,150.00', const Color(0xFF2563EB)),
          _buildPlRow('خصم: المصروفات العمومية والأنشطة (-)', '-\$11,000.00', const Color(0xFFEF4444)),
          const Spacer(),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: const Color(0xFF10B981).withOpacity(0.15), borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFF10B981))),
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('صافي الأرباح التشغيلية للفترة 📈', style: TextStyle(color: Color(0xFF10B981), fontWeight: FontWeight.bold, fontSize: 15)),
                Text('+\$106,150.00', style: TextStyle(color: Color(0xFF10B981), fontWeight: FontWeight.bold, fontSize: 16)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPlRow(String label, String val, Color color) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
          Text(val, style: TextStyle(color: color, fontSize: 14, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _buildBalanceSheetTab() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: const Color(0xFF1E293B), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFF334155))),
      child: Column(
        children: [
          _buildPlRow('إجمالي الأصول (Assets)', '\$188,500.00', const Color(0xFF10B981)),
          const Divider(color: Color(0xFF334155)),
          _buildPlRow('إجمالي الالتزامات (Liabilities)', '\$18,400.00', const Color(0xFFEF4444)),
          _buildPlRow('حقوق الملكية والأرباح المبقاة', '\$170,100.00', const Color(0xFF2563EB)),
          const Spacer(),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: const Color(0xFF0F172A), borderRadius: BorderRadius.circular(8)),
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('معادلة الميزانية: الأصول = الالتزامات + حقوق الملكية (متوازنة 🟢)', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
