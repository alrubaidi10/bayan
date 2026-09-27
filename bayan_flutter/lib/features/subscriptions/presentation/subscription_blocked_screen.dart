import 'package:flutter/material.dart';

class SubscriptionBlockedScreen extends StatelessWidget {
  final String title;
  final String message;
  final VoidCallback? onRefresh;

  const SubscriptionBlockedScreen({
    Key? key,
    this.title = 'حساب المنشأة موقوف',
    this.message = 'انتهت مدة اشتراكك أو تم إيقاف الحساب مؤقتاً لعدم السداد. يرجى التواصل مع إدارة نظام بيان لتجديد وتفعيل باقتك.',
    this.onRefresh,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF121318),
      body: Directionality(
        textDirection: TextDirection.rtl,
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFF1C1D24),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0FFE50914).withOpacity(0.5), width: 1.5),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: const Color(0FFE50914).withOpacity(0.15),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.block, color: Color(0FFE50914), size: 56),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    title,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    message,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Color(0FF9A9DB0), fontSize: 14, height: 1.5),
                  ),
                  const SizedBox(height: 24),

                  // Support & Renewal options
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0FFE50914),
                      minimumSize: const Size(double.infinity, 48),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    icon: const Icon(Icons.phone, color: Colors.white),
                    label: const Text('التواصل مع الدعم / تجديد الاشتراك', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    onPressed: () {
                      // Open support contact
                    },
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.white,
                      side: const BorderSide(color: Color(0FF2B2C38)),
                      minimumSize: const Size(double.infinity, 48),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    icon: const Icon(Icons.refresh),
                    label: const Text('إعادة التحقق من حالة الاشتراك'),
                    onPressed: onRefresh ?? () {},
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
