import 'package:flutter/material.dart';
import '../domain/subscription_model.dart';

class SubscriptionsAdminScreen extends StatefulWidget {
  const SubscriptionsAdminScreen({Key? key}) : super(key: key);

  @override
  State<SubscriptionsAdminScreen> createState() => _SubscriptionsAdminScreenState();
}

class _SubscriptionsAdminScreenState extends State<SubscriptionsAdminScreen> {
  final List<Map<String, dynamic>> _companies = [
    {
      'id': 'comp_101',
      'name': 'شركة الألفية للتجارة',
      'owner': 'mahdi@gmail.com',
      'type': SubscriptionType.monthly,
      'status': SubscriptionStatus.active,
      'expiry': '2026-10-25',
      'daysLeft': 28,
    },
    {
      'id': 'comp_102',
      'name': 'مؤسسة النجم الأزرق',
      'owner': 'blue.star@example.com',
      'type': SubscriptionType.trial,
      'status': SubscriptionStatus.trial,
      'expiry': '2026-10-04',
      'daysLeft': 7,
    },
    {
      'id': 'comp_103',
      'name': 'مركز تقنيات الخليج',
      'owner': 'gulf.tech@example.com',
      'type': SubscriptionType.annual,
      'status': SubscriptionStatus.suspended,
      'expiry': '2026-09-01',
      'daysLeft': 0,
    },
  ];

  void _openManageSubscriptionModal(Map<String, dynamic> company) {
    SubscriptionType selectedType = company['type'] as SubscriptionType;
    SubscriptionStatus selectedStatus = company['status'] as SubscriptionStatus;
    int customDays = 7;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1C1D24),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(context).viewInsets.bottom + 20,
              ),
              child: Directionality(
                textDirection: TextDirection.rtl,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.card_membership, color: Color(0FFE50914)),
                        const SizedBox(width: 10),
                        Text(
                          'إدارة اشتراك: ${company['name']}',
                          style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    const Divider(color: Color(0xFF2B2C38), height: 24),

                    // 1. Subscription Status (Active, Trial, Suspended)
                    const Text('حالة الحساب:', style: TextStyle(color: Color(0FF9A9DB0), fontSize: 14)),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<SubscriptionStatus>(
                      value: selectedStatus,
                      dropdownColor: const Color(0xFF252631),
                      decoration: const InputDecoration(filled: true, fillColor: Color(0xFF252631)),
                      items: const [
                        DropdownMenuItem(value: SubscriptionStatus.active, child: Text('نشط (مفعّل)')),
                        DropdownMenuItem(value: SubscriptionStatus.trial, child: Text('فترة تجريبية')),
                        DropdownMenuItem(value: SubscriptionStatus.suspended, child: Text('موقوف (إيقاف بسبب عدم السداد)')),
                        DropdownMenuItem(value: SubscriptionStatus.expired, child: Text('منتهي الصلاحية')),
                      ],
                      onChanged: (val) {
                        if (val != null) setModalState(() => selectedStatus = val);
                      },
                    ),
                    const SizedBox(height: 16),

                    // 2. Subscription Type (Monthly, Quarterly, Annual, Trial)
                    const Text('نوع الاشتراك / الدورات:', style: TextStyle(color: Color(0FF9A9DB0), fontSize: 14)),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<SubscriptionType>(
                      value: selectedType,
                      dropdownColor: const Color(0xFF252631),
                      decoration: const InputDecoration(filled: true, fillColor: Color(0xFF252631)),
                      items: const [
                        DropdownMenuItem(value: SubscriptionType.trial, child: Text('فترة تجريبية (أسبوع / أيام مخصصة)')),
                        DropdownMenuItem(value: SubscriptionType.monthly, child: Text('اشتراك شهري (1 شهر)')),
                        DropdownMenuItem(value: SubscriptionType.quarterly, child: Text('اشتراك ربع سنوي (3 أشهر)')),
                        DropdownMenuItem(value: SubscriptionType.semiAnnual, child: Text('اشتراك نصف سنوي (6 أشهر)')),
                        DropdownMenuItem(value: SubscriptionType.annual, child: Text('اشتراك سنوي (12 شهر)')),
                      ],
                      onChanged: (val) {
                        if (val != null) setModalState(() => selectedType = val);
                      },
                    ),
                    const SizedBox(height: 16),

                    // 3. Days Duration Input
                    const Text('عدد الأيام المضافة لتحديث الصلاحية:', style: TextStyle(color: Color(0FF9A9DB0), fontSize: 14)),
                    const SizedBox(height: 8),
                    TextFormField(
                      initialValue: '30',
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        filled: true,
                        fillColor: Color(0xFF252631),
                        hintText: 'مثال: 7 للتجريبي، 30 للشهري، 365 للسنوي',
                      ),
                      onChanged: (val) => customDays = int.tryParse(val) ?? 7,
                    ),
                    const SizedBox(height: 24),

                    // Actions buttons
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0FFE50914),
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            icon: const Icon(Icons.save, color: Colors.white),
                            label: const Text('حفظ تحديث الاشتراك', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                            onPressed: () {
                              setState(() {
                                company['status'] = selectedStatus;
                                company['type'] = selectedType;
                                company['daysLeft'] = selectedStatus == SubscriptionStatus.suspended ? 0 : customDays;
                              });
                              Navigator.pop(context);
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('تم تحديث اشتراك ${company['name']} بنجاح ✅')),
                              );
                            },
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF121318),
      appBar: AppBar(
        title: const Text('إدارة الاشتراكات والتراخيص'),
        backgroundColor: const Color(0xFF1C1D24),
      ),
      body: Directionality(
        textDirection: TextDirection.rtl,
        child: ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: _companies.length,
          itemBuilder: (context, index) {
            final c = _companies[index];
            final status = c['status'] as SubscriptionStatus;
            final type = c['type'] as SubscriptionType;
            final daysLeft = c['daysLeft'] as int;

            Color badgeColor = const Color(0FF00C853);
            if (status == SubscriptionStatus.suspended || status == SubscriptionStatus.expired) {
              badgeColor = const Color(0FFE50914);
            } else if (status == SubscriptionStatus.trial) {
              badgeColor = const Color(0FFFFAB00);
            }

            return Card(
              margin: const EdgeInsets.only(bottom: 12),
              color: const Color(0xFF1C1D24),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          c['name'] as String,
                          style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                        const Spacer(),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: badgeColor.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: badgeColor),
                          ),
                          child: Text(
                            SubscriptionModel.getStatusLabel(status),
                            style: TextStyle(color: badgeColor, fontSize: 12, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text('البريد: ${c['owner']}', style: const TextStyle(color: Color(0FF9A9DB0), fontSize: 13)),
                    const SizedBox(height: 4),
                    Text('نوع الباقة: ${SubscriptionModel.getTypeLabel(type)}', style: const TextStyle(color: Color(0FF9A9DB0), fontSize: 13)),
                    const SizedBox(height: 4),
                    Text('المتبقي: $daysLeft يوم (تاريخ الانتهاء: ${c['expiry']})', style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        if (status != SubscriptionStatus.suspended)
                          OutlinedButton.icon(
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0FFE50914),
                              side: const BorderSide(color: Color(0FFE50914)),
                            ),
                            icon: const Icon(Icons.block, size: 16),
                            label: const Text('إيقاف الحساب (عدم سداد)'),
                            onPressed: () {
                              setState(() {
                                c['status'] = SubscriptionStatus.suspended;
                                c['daysLeft'] = 0;
                              });
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('تم إيقاف حساب ${c['name']} بنجاح 🚫')),
                              );
                            },
                          )
                        else
                          ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(backgroundColor: const Color(0FF00C853)),
                            icon: const Icon(Icons.check_circle, size: 16, color: Colors.white),
                            label: const Text('تفعيل الحساب', style: TextStyle(color: Colors.white)),
                            onPressed: () {
                              setState(() {
                                c['status'] = SubscriptionStatus.active;
                                c['daysLeft'] = 30;
                              });
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('تم إعادة تفعيل حساب ${c['name']} ✅')),
                              );
                            },
                          ),
                        const SizedBox(width: 8),
                        ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(backgroundColor: const Color(0FF252631)),
                          icon: const Icon(Icons.settings_outlined, size: 16, color: Colors.white),
                          label: const Text('تعديل الاشتراك', style: TextStyle(color: Colors.white)),
                          onPressed: () => _openManageSubscriptionModal(c),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
