import 'package:uuid/uuid.dart';

class JournalLineData {
  final String accountId;
  final double debit;
  final double credit;

  JournalLineData({
    required this.accountId,
    this.debit = 0.0,
    this.credit = 0.0,
  });
}

class AccountingEngine {
  static bool validateBalance(List<JournalLineData> lines) {
    if (lines.isEmpty) return false;
    double totalDebit = 0.0;
    double totalCredit = 0.0;

    for (var l in lines) {
      totalDebit += l.debit;
      totalCredit += l.credit;
    }

    // Rounding to 2 decimal places to prevent double precision drift
    double roundedDebit = double.parse(totalDebit.toStringAsFixed(2));
    double roundedCredit = double.parse(totalCredit.toStringAsFixed(2));

    return (roundedDebit - roundedCredit).abs() < 0.005;
  }

  static List<JournalLineData> createSaleJournalLines({
    required String arAccountId,
    required String revenueAccountId,
    required String taxAccountId,
    required double subtotal,
    required double taxAmount,
    required double grandTotal,
  }) {
    final lines = <JournalLineData>[
      // Debit Accounts Receivable (Customer owes grand total)
      JournalLineData(accountId: arAccountId, debit: grandTotal, credit: 0.0),
      // Credit Revenue
      JournalLineData(accountId: revenueAccountId, debit: 0.0, credit: subtotal),
    ];

    if (taxAmount > 0) {
      // Credit Tax Payable
      lines.add(JournalLineData(accountId: taxAccountId, debit: 0.0, credit: taxAmount));
    }

    return lines;
  }

  static List<JournalLineData> createPaymentJournalLines({
    required String cashOrBankAccountId,
    required String arOrApAccountId,
    required double amount,
    required bool isReceipt, // true = receipt from customer, false = payment to supplier
  }) {
    if (isReceipt) {
      return [
        JournalLineData(accountId: cashOrBankAccountId, debit: amount, credit: 0.0),
        JournalLineData(accountId: arOrApAccountId, debit: 0.0, credit: amount),
      ];
    } else {
      return [
        JournalLineData(accountId: arOrApAccountId, debit: amount, credit: 0.0),
        JournalLineData(accountId: cashOrBankAccountId, debit: 0.0, credit: amount),
      ];
    }
  }
}
