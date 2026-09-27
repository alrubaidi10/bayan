enum SubscriptionType { trial, monthly, quarterly, semiAnnual, annual }
enum SubscriptionStatus { active, trial, suspended, expired }

class SubscriptionModel {
  final String companyId;
  final String companyName;
  final SubscriptionType type;
  final SubscriptionStatus status;
  final DateTime? startDate;
  final DateTime? endDate;
  final int daysLeft;

  SubscriptionModel({
    required this.companyId,
    required this.companyName,
    required this.type,
    required this.status,
    this.startDate,
    this.endDate,
    required this.daysLeft,
  });

  bool get isBlocked => status == SubscriptionStatus.suspended || status == SubscriptionStatus.expired || daysLeft <= 0;

  static String getTypeLabel(SubscriptionType type) {
    switch (type) {
      case SubscriptionType.trial:
        return 'تجريبي (اختباري)';
      case SubscriptionType.monthly:
        return 'اشتراك شهري (1 شهر)';
      case SubscriptionType.quarterly:
        return 'اشتراك ربع سنوي (3 أشهر)';
      case SubscriptionType.semiAnnual:
        return 'اشتراك نصف سنوي (6 أشهر)';
      case SubscriptionType.annual:
        return 'اشتراك سنوي (12 شهر)';
    }
  }

  static String getStatusLabel(SubscriptionStatus status) {
    switch (status) {
      case SubscriptionStatus.active:
        return 'نشط';
      case SubscriptionStatus.trial:
        return 'فترة تجريبية';
      case SubscriptionStatus.suspended:
        return 'موقوف (عدم السداد)';
      case SubscriptionStatus.expired:
        return 'منتهي الصلاحية';
    }
  }
}
